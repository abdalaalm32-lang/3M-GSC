
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
  Trash2, Calendar, Building2, Search, RefreshCw, Printer, 
  AlertCircle, DollarSign, TrendingDown, Layers, 
  BarChart3, ArrowDownRight, Box, Tag, PieChart, 
  Download, FileSpreadsheet, Loader2, Warehouse
} from 'lucide-react';
import { ReportsData } from '../hooks/useReportsData';
import { ReportFilters } from '../hooks/useReportFilters';
import * as XLSX from 'xlsx';

interface Props extends ReportsData {
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
}

const WasteReport: React.FC<Props> = ({ 
  filters, setFilters, wasteRecords, items, branches, reload 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // تحميل المخازن المكوّدة فعلياً
  useEffect(() => {
    const savedWh = localStorage.getItem('gsc_warehouses_config');
    if (savedWh) setWarehouses(JSON.parse(savedWh));
  }, []);
  
  // تجميع ومعالجة بيانات الهالك بشكل تحليلي
  const aggregatedWaste = useMemo(() => {
    const aggregated: Record<string, any> = {};
    
    const filteredRecords = wasteRecords.filter(rec => {
      const dateMatch = rec.date >= filters.from && rec.date <= filters.to;
      const branchMatch = filters.branchId === 'all' || rec.branchId === filters.branchId;
      return rec.status === 'مرحل' && dateMatch && branchMatch;
    });

    filteredRecords.forEach(rec => {
      rec.items.forEach(wItem => {
        const stockItem = items.find(i => i.id === wItem.itemId);
        const name = wItem.name || stockItem?.name || 'خامة غير معرفة';
        
        if (filters.searchTerm !== '' && !name.includes(filters.searchTerm) && !wItem.itemId.includes(filters.searchTerm)) {
            return;
        }

        if (!aggregated[wItem.itemId]) {
          aggregated[wItem.itemId] = {
            itemId: wItem.itemId,
            name: name,
            category: stockItem?.category || 'بدون فئة',
            unit: wItem.unit,
            totalQty: 0,
            totalCost: 0,
            reasons: {} as Record<string, number>,
            occurrenceCount: 0
          };
        }

        const costValue = Number(wItem.quantity) * Number(wItem.cost);
        aggregated[wItem.itemId].totalQty += Number(wItem.quantity);
        aggregated[wItem.itemId].totalCost += costValue;
        aggregated[wItem.itemId].occurrenceCount += 1;
        
        const reason = wItem.reason || 'غير محدد';
        aggregated[wItem.itemId].reasons[reason] = (aggregated[wItem.itemId].reasons[reason] || 0) + 1;
      });
    });

    return Object.values(aggregated).map(row => {
      const avgWasteCost = row.totalQty > 0 ? row.totalCost / row.totalQty : 0;
      const topReason = Object.entries(row.reasons)
        .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || '-';

      return { ...row, avgWasteCost, topReason };
    }).sort((a, b) => b.totalCost - a.totalCost);
  }, [wasteRecords, items, filters]);

  const summary = useMemo(() => {
    const totalLoss = aggregatedWaste.reduce((s, r) => s + r.totalCost, 0);
    const totalQty = aggregatedWaste.reduce((s, r) => s + r.totalQty, 0);
    const mostWastedItem = aggregatedWaste[0]?.name || '-';
    return { totalLoss, totalQty, mostWastedItem };
  }, [aggregatedWaste]);

  const formatNum = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // الحصول على اسم الموقع المختار (مخزن أو فرع)
  const getSelectedLocationName = () => {
    if (filters.branchId === 'all') return 'كافة الفروع والمخازن';
    const loc = warehouses.find(w => w.id === filters.branchId) || branches.find(b => b.id === filters.branchId);
    return loc?.name || 'موقع غير معروف';
  };

  // --- دالة الطباعة الاحترافية ---
  const handlePrint = () => {
    const el = document.getElementById('waste-report-table');
    if (!el) return;

    const branchName = getSelectedLocationName();
    
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('المتصفح منع فتح نافذة الطباعة. يرجى تفعيل الـ Pop-ups.');
      return;
    }

    const headerHtml = `
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:15px; margin-bottom:20px;">
        <h1 style="margin:0; font-size:24px;">3M GSC - GLOBAL SYSTEM COST</h1>
        <h2 style="margin:5px 0; font-size:18px;">تقرير تحليل الهالك والفاقد المالي</h2>
        <div style="font-size:12px;">الموقع: ${branchName} | الفترة: من ${filters.from} إلى ${filters.to}</div>
      </div>
    `;

    const summaryHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-weight:bold; font-size:14px; background: #f9f9f9; padding: 15px; border: 1px solid #ddd;">
        <div>إجمالي قيمة الخسارة: ${formatNum(summary.totalLoss)} ج.م</div>
        <div>إجمالي الكميات المفقودة: ${summary.totalQty}</div>
        <div>الصنف الأكثر هدراً: ${summary.mostWastedItem}</div>
      </div>
    `;

    const tableClone = el.cloneNode(true) as HTMLElement;
    tableClone.style.maxHeight = 'none';
    tableClone.style.overflow = 'visible';
    
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة تقرير الهالك</title>
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
            طُبع بواسطة نظام 3M GSC لإدارة التكاليف | تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}
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

  // --- دالة تصدير Excel ---
  const handleExportExcel = () => {
    setIsProcessing(true);
    try {
        const exportData = aggregatedWaste.map(r => ({
          'كود الخامة': r.itemId,
          'اسم الصنف': r.name,
          'الفئة': r.category,
          'إجمالي كمية الهالك': r.totalQty,
          'الوحدة': r.unit,
          'متوسط تكلفة الهالك': r.avgWasteCost,
          'إجمالي الخسارة المالية': r.totalCost,
          'السبب الأكثر شيوعاً': r.topReason,
          'مرات التكرار': r.occurrenceCount
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Waste Report");
        if(!ws['!views']) ws['!views'] = [];
        ws['!views'].push({RTL: true});
        XLSX.writeFile(wb, `Waste_Analysis_Report_${filters.from}_to_${filters.to}.xlsx`);
    } catch (error) {
        console.error("Excel Export Error:", error);
        alert("حدث خطأ أثناء تصدير ملف Excel");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div id="waste-report-printable-area" className="flex flex-col h-full gap-4 animate-in fade-in duration-500">
      
      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center no-print">
          <div className="bg-sys-surface p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="text-sys-primary animate-spin" size={48} />
            <p className="text-white font-bold animate-pulse">جاري تحضير ملف الـ Excel...</p>
          </div>
        </div>
      )}

      {/* Dynamic Header & Advanced Filters */}
      <div className="bg-sys-surface p-4 rounded-2xl border border-white/5 flex flex-wrap items-end gap-3 no-print shadow-lg">
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> من تاريخ</label>
          <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-danger outline-none transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> إلى تاريخ</label>
          <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-danger outline-none transition-all" />
        </div>
        <div className="space-y-1 min-w-[200px]">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Building2 size={10}/> اختيار الموقع (مخزن / فرع)</label>
          <select value={filters.branchId} onChange={e => setFilters({...filters, branchId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-danger outline-none transition-all">
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
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Search size={10}/> بحث في سجل الهالك</label>
          <input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="ابحث باسم المادة الخام أو الكود..." className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-danger outline-none shadow-inner" />
        </div>
        <div className="flex gap-2 relative">
          <button onClick={reload} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-sm hover:bg-sys-danger/10" title="تحديث البيانات"><RefreshCw size={18} /></button>
          <button onClick={handlePrint} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-sm" title="طباعة التحليل المالي"><Printer size={18} /></button>
          
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

      {/* Control Panel KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-sys-danger"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-sys-danger/10 text-sys-danger rounded-xl shadow-lg shadow-red-900/10"><TrendingDown size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">إجمالي الخسائر المادية</div>
              <div className="text-2xl font-black text-white">{formatNum(summary.totalLoss)} <span className="text-[10px] font-normal opacity-40">ج.م</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1 h-full bg-sys-warning"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-sys-warning/10 text-sys-warning rounded-xl shadow-lg shadow-yellow-900/10"><PieChart size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">الصنف الأكثر هدراً</div>
              <div className="text-sm font-black text-white truncate max-w-[140px]">{summary.mostWastedItem}</div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1 h-full bg-sys-primary"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-xl shadow-lg shadow-blue-900/10"><Layers size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">عدد المواد المفقودة</div>
              <div className="text-2xl font-black text-white">{aggregatedWaste.length} <span className="text-[10px] font-normal opacity-40">صنف</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-danger/5 border border-sys-danger/20 p-5 rounded-2xl flex flex-col justify-center shadow-lg shadow-red-900/5 no-print">
          <div className="text-[10px] text-sys-danger font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <AlertCircle size={12} /> تقرير الاستهلاك غير المبرر
          </div>
          <div className="text-xs text-white/60 font-medium leading-relaxed italic">يتم احتساب التكاليف بناءً على متوسط السعر الفعلي وقت تسجيل عملية الهالك.</div>
        </div>
      </div>

      {/* Main Analysis Table */}
      <div className="flex-1 bg-sys-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center no-print">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-sys-danger" /> 
              مصفوفة تحليل الهالك والفاقد المالي
            </h3>
            <div className="text-[10px] text-white/30 italic uppercase tracking-wider">مرتب حسب إجمالي قيمة الخسارة</div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar" id="waste-report-table">
          <table className="w-full text-right text-[11px] border-collapse min-w-[1000px]">
            <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase tracking-tighter shadow-md">
              <tr>
                <th className="p-4 border-b border-white/5">الخامة / مادة الخام</th>
                <th className="p-4 border-b border-white/5">الفئة</th>
                <th className="p-4 border-b border-white/5 text-center">إجمالي كمية الهالك</th>
                <th className="p-4 border-b border-white/5 text-center">متوسط تكلفة الهالك</th>
                <th className="p-4 border-b border-white/5 text-center bg-sys-danger/5 text-sys-danger font-black">إجمالي الخسارة المالية</th>
                <th className="p-4 border-b border-white/5">السبب الأكثر شيوعاً</th>
                <th className="p-4 border-b border-white/5 text-center">مرات التكرار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aggregatedWaste.map((row) => (
                <tr key={row.itemId} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-white group-hover:text-sys-danger transition-colors">{row.name}</div>
                    <div className="text-[9px] text-white/20 font-mono tracking-tighter uppercase">{row.itemId}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-lg bg-white/5 text-white/40 border border-white/5 text-[10px] flex items-center gap-1.5 w-fit">
                      <Tag size={10} className="text-sys-danger/40" />
                      {row.category}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="font-black text-white text-sm">{row.totalQty.toLocaleString()}</div>
                    <div className="text-[9px] text-white/20 font-bold uppercase">{row.unit}</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 text-white/60 font-bold">
                      <DollarSign size={10} className="text-sys-success" />
                      {formatNum(row.avgWasteCost)}
                    </div>
                  </td>
                  <td className="p-4 text-center bg-sys-danger/5">
                    <div className="text-sm font-black text-sys-danger tracking-tight">
                      {formatNum(row.totalCost)}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-white/50 text-[10px]">
                      <ArrowDownRight size={10} className="text-sys-danger" />
                      {row.topReason}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/5 text-white/40 text-[10px] font-black border border-white/5">
                      {row.occurrenceCount}
                    </div>
                  </td>
                </tr>
              ))}
              {aggregatedWaste.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-24 text-center text-white/20 italic">
                    <Box size={48} className="mx-auto mb-4 opacity-5" />
                    لم يتم العثور على أي بيانات هالك مرحلة للفترة والخيارات المحددة.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-[#121212] font-black border-t-2 border-sys-danger sticky bottom-0 z-10 text-white uppercase text-[10px]">
              <tr>
                <td colSpan={4} className="p-4 text-left border-l border-white/5 pl-10">إجمالي النزيف المالي الناتج عن الهالك (Total Loss)</td>
                <td className="p-4 text-center bg-sys-danger/20 text-sys-danger text-sm tracking-tighter">
                  {formatNum(summary.totalLoss)} ج.م
                </td>
                <td colSpan={2} className="p-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WasteReport;
