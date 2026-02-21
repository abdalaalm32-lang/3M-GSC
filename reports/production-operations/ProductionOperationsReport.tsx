
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Factory, Calendar, Building2, Search, RefreshCw, Printer, 
  TrendingUp, Layers, Zap, DollarSign, Hash, 
  ArrowUpRight, Box, Tag, Download, FileSpreadsheet, Loader2
} from 'lucide-react';
import { ReportsData } from '../hooks/useReportsData';
import { ReportFilters } from '../hooks/useReportFilters';
import * as XLSX from 'xlsx';

interface Props extends ReportsData {
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
}

const ProductionOperationsReport: React.FC<Props> = ({ 
  filters, setFilters, productionLogs, items, branches, reload 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // تحميل المخازن المكوّدة فعلياً من الإعدادات
  useEffect(() => {
    const savedWh = localStorage.getItem('gsc_warehouses_config');
    if (savedWh) {
        try {
            setWarehouses(JSON.parse(savedWh));
        } catch (e) {
            console.error("Error parsing warehouses", e);
        }
    }
  }, []);
  
  // تجميع ومعالجة بيانات الإنتاج
  const aggregatedData = useMemo(() => {
    const aggregated: Record<string, any> = {};
    
    // تصفية العمليات المرحلة فقط وضمن الفترة والموقع المختار
    const filteredLogs = productionLogs.filter(log => {
      const dateMatch = log.date >= filters.from && log.date <= filters.to;
      const locationMatch = filters.branchId === 'all' || log.branchId === filters.branchId;
      return log.status === 'مرحل' && dateMatch && locationMatch;
    });

    filteredLogs.forEach(log => {
      if (!aggregated[log.productId]) {
        const itemInfo = items.find(i => i.id === log.productId);
        aggregated[log.productId] = {
          productId: log.productId,
          productName: log.productName || itemInfo?.name || 'منتج غير معرف',
          category: itemInfo?.category || 'بدون فئة',
          unit: log.unit,
          totalProducedQty: 0,
          totalCost: 0,
          batchCount: 0,
          lastProductionDate: log.date
        };
      }

      aggregated[log.productId].totalProducedQty += Number(log.producedQty);
      aggregated[log.productId].totalCost += Number(log.totalProductionCost);
      aggregated[log.productId].batchCount += 1;
      
      if (log.date > aggregated[log.productId].lastProductionDate) {
        aggregated[log.productId].lastProductionDate = log.date;
      }
    });

    let results = Object.values(aggregated).map(row => {
      const avgCost = row.totalProducedQty > 0 ? row.totalCost / row.totalProducedQty : 0;
      return { ...row, avgCost };
    });

    // تطبيق فلتر البحث (الاسم أو الكود)
    if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase().trim();
        results = results.filter(r => 
            r.productName.toLowerCase().includes(term) || 
            r.productId.toLowerCase().includes(term)
        );
    }

    return results.sort((a, b) => b.totalCost - a.totalCost);
  }, [productionLogs, items, filters]);

  const summary = useMemo(() => {
    const totalProductionValue = aggregatedData.reduce((s, r) => s + r.totalCost, 0);
    const totalBatches = aggregatedData.reduce((s, r) => s + r.batchCount, 0);
    const topProduct = aggregatedData[0]?.productName || '-';
    return { totalProductionValue, totalBatches, topProduct };
  }, [aggregatedData]);

  const formatNum = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- دالة تصدير Excel ---
  const handleExportExcel = () => {
    setIsProcessing(true);
    try {
        const exportData = aggregatedData.map(r => ({
          'كود المنتج': r.productId,
          'اسم المنتج المصنع': r.productName,
          'الفئة': r.category,
          'إجمالي الكمية المنتجة': r.totalProducedQty,
          'الوحدة': r.unit,
          'عدد مرات التشغيل': r.batchCount,
          'متوسط تكلفة الوحدة': r.avgCost,
          'إجمالي التكلفة للفترة': r.totalCost,
          'تاريخ آخر تشغيلة': r.lastProductionDate
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Production Report");
        if(!ws['!views']) ws['!views'] = [];
        ws['!views'].push({RTL: true});
        XLSX.writeFile(wb, `Production_Operations_Report_${filters.from}_to_${filters.to}.xlsx`);
    } catch (error) {
        console.error("Excel Export Error:", error);
        alert("حدث خطأ أثناء تصدير ملف Excel");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- دالة الطباعة الاحترافية ---
  const handlePrint = () => {
    const el = document.getElementById('production-report-table-content');
    if (!el) return;

    const locationName = filters.branchId === 'all' ? 'كافة الفروع والمخازن' : 
        (warehouses.find(w => w.id === filters.branchId)?.name || branches.find(b => b.id === filters.branchId)?.name || 'موقع غير معروف');
    
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('المتصفح منع فتح نافذة الطباعة. يرجى تفعيل الـ Pop-ups.');
      return;
    }

    const headerHtml = `
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:15px; margin-bottom:20px; font-family: Arial, sans-serif;">
        <h1 style="margin:0; font-size:24px;">3M GSC - GLOBAL SYSTEM COST</h1>
        <h2 style="margin:5px 0; font-size:18px;">تقرير تحليل كفاءة وتكاليف عمليات الإنتاج</h2>
        <div style="font-size:12px;">الموقع: ${locationName} | الفترة: من ${filters.from} إلى ${filters.to}</div>
      </div>
    `;

    const summaryHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-weight:bold; font-size:14px; background: #f9f9f9; padding: 15px; border: 1px solid #ddd; font-family: Arial, sans-serif;">
        <div>إجمالي قيمة الإنتاج: ${formatNum(summary.totalProductionValue)} ج.م</div>
        <div>إجمالي عدد التشغيلات: ${summary.totalBatches}</div>
        <div>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</div>
      </div>
    `;

    const tableClone = el.cloneNode(true) as HTMLElement;
    tableClone.style.maxHeight = 'none';
    tableClone.style.overflow = 'visible';
    
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة تقرير الإنتاج</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 11px; }
            th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; font-weight: bold; }
            .no-print { display: none !important; }
            @page { size: A4 landscape; margin: 10mm; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${summaryHtml}
          ${tableClone.outerHTML}
          <div style="margin-top:30px; border-top:1px solid #eee; padding-top:10px; font-size:10px; text-align:center; color:#666;">
            طُبع بواسطة نظام 3M GSC لإدارة التكاليف | وحدة الرقابة الصناعية
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
      
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center no-print">
          <div className="bg-sys-surface p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="text-sys-primary animate-spin" size={48} />
            <p className="text-white font-bold animate-pulse">جاري تحضير ملف الـ Excel...</p>
          </div>
        </div>
      )}

      {/* شريط الفلاتر */}
      <div className="bg-sys-surface p-4 rounded-2xl border border-white/5 flex flex-wrap items-end gap-3 no-print shadow-lg">
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> من تاريخ</label>
          <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> إلى تاريخ</label>
          <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none" />
        </div>
        <div className="space-y-1 min-w-[200px]">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Building2 size={10}/> اختيار الموقع (مخزن / فرع)</label>
          <select value={filters.branchId} onChange={e => setFilters({...filters, branchId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none">
            <option value="all">كافة الفروع والمخازن</option>
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
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Search size={10}/> بحث بالأسم أو الكود</label>
          <input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="ابحث باسم المنتج أو كود التعريف..." className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={reload} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-sm" title="تحديث البيانات"><RefreshCw size={18} /></button>
          <button onClick={handlePrint} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-sm" title="طباعة التقرير"><Printer size={18} /></button>
          
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-5 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-bold shadow-lg transition-all hover:bg-blue-600 active:scale-95"
          >
            <Download size={16} />
            <span>تصدير Excel</span>
            <FileSpreadsheet size={14} className="opacity-60" />
          </button>
        </div>
      </div>

      {/* بطاقات مؤشرات الأداء */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1 h-full bg-sys-primary"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-xl shadow-lg shadow-blue-900/10"><DollarSign size={22} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">قيمة الإنتاج الإجمالية</div>
              <div className="text-2xl font-black text-white">{formatNum(summary.totalProductionValue)} <span className="text-[10px] font-normal opacity-40">ج.م</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1 h-full bg-sys-success"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-sys-success/10 text-sys-success rounded-xl shadow-lg shadow-green-900/10"><Zap size={22} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">إجمالي التشغيلات</div>
              <div className="text-2xl font-black text-white">{summary.totalBatches} <span className="text-[10px] font-normal opacity-40">مرة</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1 h-full bg-sys-warning"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-sys-warning/10 text-sys-warning rounded-xl shadow-lg shadow-yellow-900/10"><TrendingUp size={22} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">الأكثر إنتاجاً</div>
              <div className="text-sm font-black text-white truncate max-w-[130px]">{summary.topProduct}</div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1 h-full bg-purple-500"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl shadow-lg shadow-purple-900/10"><Layers size={22} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">تنوع المنتجات</div>
              <div className="text-2xl font-black text-white">{aggregatedData.length} <span className="text-[10px] font-normal opacity-40">صنف</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* الجدول الرئيسي */}
      <div className="flex-1 bg-sys-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center no-print">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Factory size={16} className="text-sys-primary" /> 
              تحليل كفاءة وتكاليف عمليات الإنتاج
            </h3>
            <div className="text-[10px] text-white/30 italic uppercase tracking-wider">مرتب حسب إجمالي قيمة الإنتاج</div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar" id="production-report-table-content">
          <table className="w-full text-right text-[11px] border-collapse min-w-[1000px]">
            <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase tracking-tighter shadow-md">
              <tr>
                <th className="p-4 border-b border-white/5">كثافة الإنتاج</th>
                <th className="p-4 border-b border-white/5">المنتج المصنع / الكود</th>
                <th className="p-4 border-b border-white/5">الفئة</th>
                <th className="p-4 border-b border-white/5 text-center">إجمالي الكمية</th>
                <th className="p-4 border-b border-white/5 text-center bg-white/5">متوسط تكلفة الوحدة</th>
                <th className="p-4 border-b border-white/5 text-center">إجمالي تكلفة الإنتاج</th>
                <th className="p-4 border-b border-white/5 text-center">آخر تاريخ إنتاج</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aggregatedData.map((row) => (
                <tr key={row.productId} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-sys-primary" style={{ width: `${Math.min((row.batchCount / summary.totalBatches) * 300, 100)}%` }}></div>
                      </div>
                      <span className="text-[10px] font-bold text-white/40">{row.batchCount} batch</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-white group-hover:text-sys-primary transition-colors">{row.productName}</div>
                    <div className="text-[9px] text-white/20 font-mono">{row.productId}</div>
                  </td>
                  <td className="p-4 text-white/40">
                    <div className="flex items-center gap-1.5 w-fit">
                      <Tag size={10} className="text-sys-primary/50" />
                      {row.category}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="font-black text-white text-sm">{row.totalProducedQty.toLocaleString()}</div>
                    <div className="text-[9px] text-white/20 uppercase font-bold">{row.unit}</div>
                  </td>
                  <td className="p-4 text-center bg-white/5 font-black text-sys-success text-sm tracking-tighter">
                    {formatNum(row.avgCost)}
                  </td>
                  <td className="p-4 text-center">
                    <div className="font-bold text-white tracking-tight">{formatNum(row.totalCost)}</div>
                  </td>
                  <td className="p-4 text-center text-white/30 font-mono">
                    {row.lastProductionDate}
                  </td>
                </tr>
              ))}
              {aggregatedData.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-24 text-center text-white/20 italic">
                    <Box size={48} className="mx-auto mb-4 opacity-5" />
                    لا توجد بيانات إنتاج مرحلة ضمن الفترة والخيارات المختارة.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-[#121212] font-black border-t-2 border-sys-primary sticky bottom-0 z-10 text-white uppercase text-[10px]">
              <tr>
                <td colSpan={5} className="p-4 text-left border-l border-white/5 pl-10">إجمالي القيمة المالية للإنتاج المفلتر</td>
                <td className="p-4 text-center bg-sys-primary/20 text-sys-primary text-sm tracking-tighter">
                  {formatNum(summary.totalProductionValue)} ج.م
                </td>
                <td className="p-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductionOperationsReport;
