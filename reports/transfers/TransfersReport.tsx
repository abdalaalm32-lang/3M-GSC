
import React, { useMemo, useState, useEffect } from 'react';
import { 
  ArrowRightLeft, Calendar, Building2, Search, RefreshCw, Printer, 
  MapPin, Truck, Box, Layers, ArrowRight, Package, 
  TrendingUp, Activity, Info, BarChart3, Tag, DollarSign,
  Download, FileSpreadsheet, Loader2
} from 'lucide-react';
import { ReportsData } from '../hooks/useReportsData';
import { ReportFilters } from '../hooks/useReportFilters';
import * as XLSX from 'xlsx';

interface Props extends ReportsData {
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
}

const TransfersReport: React.FC<Props> = ({ 
  filters, setFilters, transferRecords, items, branches, reload 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // تحميل المخازن المكوّدة فعلياً في النظام
  useEffect(() => {
    const savedWh = localStorage.getItem('gsc_warehouses_config');
    if (savedWh) setWarehouses(JSON.parse(savedWh));
  }, []);
  
  // معالجة بيانات التحويلات وتجميعها حسب (الصنف + المصدر + الوجهة)
  const aggregatedTransfers = useMemo(() => {
    const aggregated: Record<string, any> = {};
    
    // تصفية الأذونات المرحلة فقط وضمن النطاق الزمني والمكاني
    const filteredRecords = transferRecords.filter(rec => {
      const dateMatch = rec.date >= filters.from && rec.date <= filters.to;
      const sourceMatch = filters.branchId === 'all' || rec.sourceId === filters.branchId;
      const destMatch = filters.destinationId === 'all' || rec.destinationId === filters.destinationId;
      return rec.status === 'مرحل' && dateMatch && sourceMatch && destMatch;
    });

    filteredRecords.forEach(rec => {
      rec.items.forEach((tItem: any) => {
        // منطق الفلترة بالاسم أو الكود
        const stockItem = items.find(i => i.id === tItem.itemId);
        const name = (tItem.name || stockItem?.name || 'صنف غير معرف').toLowerCase();
        const search = filters.searchTerm.toLowerCase();
        const itemId = tItem.itemId.toLowerCase();
        
        if (search !== '' && !name.includes(search) && !itemId.includes(search)) {
          return;
        }

        // مفتاح التجميع: صنف + من + إلى
        const key = `${tItem.itemId}-${rec.sourceId}-${rec.destinationId}`;

        if (!aggregated[key]) {
          aggregated[key] = {
            itemId: tItem.itemId,
            name: tItem.name || stockItem?.name || 'صنف غير معرف',
            unit: tItem.unit,
            category: stockItem?.category || 'بدون فئة',
            sourceName: rec.sourceName,
            destinationName: rec.destinationName,
            totalQty: 0,
            totalValue: 0,
            occurrence: 0,
            lastDate: rec.date
          };
        }

        aggregated[key].totalQty += Number(tItem.quantity);
        // سحب التكلفة من سطر البيانات إن وجدت أو حسابها تقديرياً
        const itemVal = Number(tItem.totalCost) || (Number(tItem.quantity) * (Number(tItem.unitCost) || Number(stockItem?.avgCost) || 0));
        aggregated[key].totalValue += itemVal;
        aggregated[key].occurrence += 1;
        
        if (rec.date > aggregated[key].lastDate) {
          aggregated[key].lastDate = rec.date;
        }
      });
    });

    return Object.values(aggregated).sort((a, b) => b.totalQty - a.totalQty);
  }, [transferRecords, items, filters]);

  const summary = useMemo(() => {
    const totalQty = aggregatedTransfers.reduce((s, r) => s + r.totalQty, 0);
    const totalValue = aggregatedTransfers.reduce((s, r) => s + r.totalValue, 0);
    const uniqueItems = new Set(aggregatedTransfers.map(r => r.itemId)).size;
    const totalOps = transferRecords.filter(r => {
        const dateMatch = r.date >= filters.from && r.date <= filters.to;
        return r.status === 'مرحل' && dateMatch;
    }).length;
    
    // تحديد الوجهة الأكثر استقبالاً
    const destFreq: Record<string, number> = {};
    aggregatedTransfers.forEach(r => {
      destFreq[r.destinationName] = (destFreq[r.destinationName] || 0) + r.totalQty;
    });
    const topDest = Object.entries(destFreq).sort((a,b) => b[1] - a[1])[0]?.[0] || '-';

    return { totalQty, totalValue, uniqueItems, totalOps, topDest };
  }, [aggregatedTransfers, transferRecords, filters]);

  const formatNum = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- دالة تصدير Excel ---
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const exportData = aggregatedTransfers.map(r => ({
        'كود الصنف': r.itemId,
        'اسم الصنف': r.name,
        'الفئة': r.category,
        'المصدر': r.sourceName,
        'الوجهة': r.destinationName,
        'إجمالي الكمية': r.totalQty,
        'الوحدة': r.unit,
        'إجمالي التكلفة (ج.م)': r.totalValue,
        'عدد العمليات': r.occurrence,
        'تاريخ آخر حركة': r.lastDate
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transfers Report");
      
      if(!ws['!views']) ws['!views'] = [];
      ws['!views'].push({RTL: true});

      XLSX.writeFile(wb, `Transfers_Analysis_${filters.from}_to_${filters.to}.xlsx`);
    } catch (error) {
      console.error("Excel Export Error", error);
    } finally {
      setIsExporting(false);
    }
  };

  // --- دالة الحصول على اسم الموقع بدقة ---
  const getSelectedLocationName = (id: string) => {
    if (id === 'all') return 'كافة المواقع';
    const loc = warehouses.find(w => w.id === id) || branches.find(b => b.id === id);
    return loc?.name || 'موقع غير معروف';
  };

  // --- تفعيل زر الطباعة ---
  const handlePrint = () => {
    const el = document.getElementById('transfers-table-container');
    if (!el) return;

    const sourceName = getSelectedLocationName(filters.branchId);
    const destName = getSelectedLocationName(filters.destinationId);

    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const headerHtml = `
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:15px; margin-bottom:20px; font-family: Arial, sans-serif;">
        <h1 style="margin:0; font-size:24px;">3M GSC - GLOBAL SYSTEM COST</h1>
        <h2 style="margin:5px 0; font-size:18px;">تقرير تحليل مسارات حركة المخزون البينية</h2>
        <div style="font-size:12px;">المصدر: ${sourceName} | الوجهة: ${destName} | الفترة: من ${filters.from} إلى ${filters.to}</div>
      </div>
    `;

    const summaryHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-weight:bold; font-size:14px; background: #f9f9f9; padding: 15px; border: 1px solid #ddd; font-family: Arial, sans-serif;">
        <div>إجمالي الكمية المحولة: ${summary.totalQty.toLocaleString()}</div>
        <div>إجمالي القيمة المالية: ${formatNum(summary.totalValue)} ج.م</div>
        <div>عدد الإرساليات: ${summary.totalOps}</div>
      </div>
    `;

    const tableClone = el.cloneNode(true) as HTMLElement;
    tableClone.style.maxHeight = 'none';
    tableClone.style.overflow = 'visible';
    
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة تقرير التحويلات</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 11px; }
            th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
            @page { size: A4 landscape; margin: 10mm; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${summaryHtml}
          ${tableClone.outerHTML}
          <div style="margin-top:30px; border-top:1px solid #eee; padding-top:10px; font-size:10px; text-align:center; color:#666;">
            طُبع بواسطة نظام 3M GSC لإدارة التكاليف والمخزون | تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-500">
      
      {/* Advanced Filter Bar */}
      <div className="bg-sys-surface p-4 rounded-2xl border border-white/5 flex flex-wrap items-end gap-3 no-print shadow-lg">
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> من تاريخ</label>
          <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> إلى تاريخ</label>
          <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none" />
        </div>
        <div className="space-y-1 min-w-[150px]">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><MapPin size={10}/> من (المصدر)</label>
          <select value={filters.branchId} onChange={e => setFilters({...filters, branchId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none">
            <option value="all">كافة المواقع</option>
            {warehouses.length > 0 && (
                <optgroup label="المخازن والمستودعات" className="bg-[#1e1e1e] text-sys-primary font-bold">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </optgroup>
            )}
            {branches.length > 0 && (
                <optgroup label="الفروع ومراكز البيع" className="bg-[#1e1e1e] text-sys-warning font-bold">
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </optgroup>
            )}
          </select>
        </div>
        <div className="space-y-1 min-w-[150px]">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Truck size={10}/> إلى (الوجهة)</label>
          <select value={filters.destinationId} onChange={e => setFilters({...filters, destinationId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none">
            <option value="all">كافة الوجهات</option>
            {warehouses.length > 0 && (
                <optgroup label="المخازن والمستودعات" className="bg-[#1e1e1e] text-sys-primary font-bold">
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </optgroup>
            )}
            {branches.length > 0 && (
                <optgroup label="الفروع ومراكز البيع" className="bg-[#1e1e1e] text-sys-warning font-bold">
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </optgroup>
            )}
          </select>
        </div>
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Search size={10}/> بحث بالأصناف أو الكود</label>
          <input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="ابحث باسم الخامة أو الكود..." className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none shadow-inner" />
        </div>
        <div className="flex gap-2">
          <button onClick={reload} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-sm" title="تحديث البيانات"><RefreshCw size={18} /></button>
          <button onClick={handlePrint} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-sm" title="طباعة التقرير"><Printer size={18} /></button>
          <button 
            onClick={handleExportExcel} 
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-bold shadow-lg transition-all hover:bg-blue-600 active:scale-95 disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>تصدير Excel</span>
            <FileSpreadsheet size={14} className="opacity-60" />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 no-print">
        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-sys-primary"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-xl shadow-lg shadow-blue-900/10"><ArrowRightLeft size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">إجمالي العمليات</div>
              <div className="text-2xl font-black text-white">{summary.totalOps} <span className="text-[10px] font-normal opacity-40">أمر</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-sys-success"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sys-success/10 text-sys-success rounded-xl shadow-lg shadow-green-900/10"><Layers size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">إجمالي الكمية</div>
              <div className="text-2xl font-black text-white">{summary.totalQty.toLocaleString()} <span className="text-[10px] font-normal opacity-40">وحدة</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-sys-primary"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-xl shadow-lg shadow-blue-900/10"><DollarSign size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">إجمالي التكلفة</div>
              <div className="text-xl font-black text-white">{formatNum(summary.totalValue)} <span className="text-[10px] font-normal opacity-40">ج.م</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-sys-warning"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sys-warning/10 text-sys-warning rounded-xl shadow-lg shadow-yellow-900/10"><TrendingUp size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">الوجهة الأكثر طلباً</div>
              <div className="text-sm font-black text-white truncate max-w-[140px]">{summary.topDest}</div>
            </div>
          </div>
        </div>

        <div className="bg-sys-primary/5 border border-sys-primary/20 p-5 rounded-2xl flex flex-col justify-center shadow-lg shadow-blue-900/5">
          <div className="text-[10px] text-sys-primary font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <Info size={12} /> تدفق الأصول
          </div>
          <div className="text-[10px] text-white/60 font-medium leading-relaxed italic">يتم احتساب الكميات بناءً على كافة أذونات الصرف والتحويل المرحلة.</div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="flex-1 bg-sys-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-sys-primary" /> 
              تحليل مسارات حركة المخزون البينية
            </h3>
            <div className="text-[10px] text-white/30 italic uppercase tracking-wider">مرتب تنازلياً حسب إجمالي الكمية المحولة</div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar" id="transfers-table-container">
          <table className="w-full text-right text-[11px] border-collapse min-w-[1000px]">
            <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase tracking-tighter shadow-md">
              <tr>
                <th className="p-4 border-b border-white/5">المادة الخام</th>
                <th className="p-4 border-b border-white/5">الفئة</th>
                <th className="p-4 border-b border-white/5">مسار الحركة (Source → Destination)</th>
                <th className="p-4 border-b border-white/5 text-center">إجمالي الكمية المحولة</th>
                <th className="p-4 border-b border-white/5 text-center bg-white/5">إجمالي التكلفة</th>
                <th className="p-4 border-b border-white/5 text-center">عدد الإرساليات</th>
                <th className="p-4 border-b border-white/5 text-center">تاريخ آخر حركة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aggregatedTransfers.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-white group-hover:text-sys-primary transition-colors">{row.name}</div>
                    <div className="text-[9px] text-white/20 font-mono tracking-tighter uppercase">{row.itemId}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-lg bg-white/5 text-white/40 border border-white/5 text-[10px] flex items-center gap-1.5 w-fit">
                      <Tag size={10} className="text-sys-primary/40" />
                      {row.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3 bg-white/[0.02] p-2 rounded-xl border border-white/5 w-fit">
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] text-white/20 uppercase font-bold">من</span>
                        <span className="text-white font-medium text-[10px]">{row.sourceName}</span>
                      </div>
                      <ArrowRight size={14} className="text-sys-primary animate-pulse" />
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] text-white/20 uppercase font-bold">إلى</span>
                        <span className="text-white font-medium text-[10px]">{row.destinationName}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="font-black text-white text-sm tracking-tight">{row.totalQty.toLocaleString()}</div>
                    <div className="text-[9px] text-white/20 font-bold uppercase">{row.unit}</div>
                  </td>
                  <td className="p-4 text-center bg-white/5 font-black text-sys-primary text-sm tracking-tighter">
                    {formatNum(row.totalValue)}
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/5 text-white/40 text-[10px] font-black border border-white/5">
                      {row.occurrence}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-white/40 text-[10px] font-mono">
                      <Calendar size={12} className="text-white/20" />
                      {row.lastDate}
                    </div>
                  </td>
                </tr>
              ))}
              {aggregatedTransfers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-24 text-center text-white/20 italic">
                    <Box size={48} className="mx-auto mb-4 opacity-5" />
                    لم يتم العثور على أي عمليات تحويل مرحلة تطابق معايير البحث.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-[#121212] font-black border-t-2 border-sys-primary sticky bottom-0 z-10 text-white uppercase text-[10px]">
              <tr>
                <td colSpan={4} className="p-4 text-left border-l border-white/5 pl-10">إجمالي قيمة التداولات المخزنية للفترة</td>
                <td className="p-4 text-center bg-sys-primary/20 text-sys-primary text-sm tracking-tighter">
                  {formatNum(summary.totalValue)} ج.م
                </td>
                <td colSpan={2} className="p-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Printable Footer */}
      <div className="hidden print:block mt-10 border-t-2 border-black pt-4 text-[10px]">
          <div className="flex justify-between items-center text-black font-bold">
              <div>نظام 3M GSC - وحدة مراقبة النقل والخدمات اللوجستية</div>
              <div>تاريخ التقرير: {new Date().toLocaleString('ar-EG')}</div>
              <div>توقيع أمين المخزن العام: ..........................</div>
          </div>
          <div className="mt-4 text-[9px] text-gray-500 italic text-center">Confidential Logistics Movement Audit Log</div>
      </div>
    </div>
  );
};

export default TransfersReport;
