
import React, { useMemo, useState, useEffect } from 'react';
import { 
  // Add ArrowRight to the imports from lucide-react
  Package, Search, ListFilter, AlertTriangle, RefreshCw, Printer, 
  DollarSign, Database, CheckCircle2, Box, Building2,
  Download, FileSpreadsheet, Loader2, BarChart, ArrowRight
} from 'lucide-react';
import { ReportsData } from '../hooks/useReportsData';
import { ReportFilters } from '../hooks/useReportFilters';
import * as XLSX from 'xlsx';

interface Props extends ReportsData {
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
}

const StockLevelsReport: React.FC<Props> = ({ 
  filters, setFilters, items, branches, reload, purchaseOrders, productionLogs, wasteRecords, stocktakes, transferRecords 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // محرك احتساب الأرصدة التفصيلي لكل موقع
  const processedData = useMemo(() => {
    return items
      .filter(item => {
        const matchesSearch = filters.searchTerm === '' || 
          item.name.includes(filters.searchTerm) || 
          item.id.includes(filters.searchTerm);
        return matchesSearch && item.active === 'نعم';
      })
      .map(item => {
        let currentQty = Number(item.currentStock) || 0;
        const branchId = filters.branchId;

        if (branchId !== 'all') {
          const lastStocktake = stocktakes
            .filter(st => st.branchId === branchId && st.status === 'مرحل')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

          let baseQty = 0;
          let refDate = '1970-01-01';

          if (lastStocktake) {
            baseQty = lastStocktake.items.find(si => si.itemId === item.id)?.countedQty || 0;
            refDate = lastStocktake.date;
          }

          const purchasesIn = purchaseOrders
            .filter(po => (po.branchId === branchId || (po as any).warehouseId === branchId) && po.status === 'مكتمل' && po.date >= refDate)
            .reduce((sum, po) => sum + (po.items.find(i => i.itemId === item.id)?.quantity || 0), 0);

          const transfersIn = transferRecords
            .filter(tr => tr.destinationId === branchId && tr.status === 'مرحل' && tr.date >= refDate)
            .reduce((sum, tr) => sum + (tr.items.find(i => i.itemId === item.id)?.quantity || 0), 0);
          const transfersOut = transferRecords
            .filter(tr => tr.sourceId === branchId && tr.status === 'مرحل' && tr.date >= refDate)
            .reduce((sum, tr) => sum + (tr.items.find(i => i.itemId === item.id)?.quantity || 0), 0);

          const producedOutput = productionLogs
            .filter(pl => pl.branchId === branchId && pl.status === 'مرحل' && pl.date >= refDate && pl.productId === item.id)
            .reduce((sum, pl) => sum + Number(pl.producedQty), 0);
          const productionConsumed = productionLogs
            .filter(pl => pl.branchId === branchId && pl.status === 'مرحل' && pl.date >= refDate)
            .reduce((sum, pl) => sum + (pl.ingredients.find(i => i.stockItemId === item.id)?.requiredQty || 0), 0);

          const wastedQty = wasteRecords
            .filter(wr => wr.branchId === branchId && wr.status === 'مرحل' && wr.date >= refDate)
            .reduce((sum, wr) => sum + (wr.items.find(wi => wi.itemId === item.id)?.quantity || 0), 0);

          currentQty = baseQty + purchasesIn + transfersIn + producedOutput - transfersOut - productionConsumed - wastedQty;
        }

        const totalValue = currentQty * (item.avgCost || 0);
        const isLow = currentQty <= item.reorderLevel;
        
        let status: 'safe' | 'warning' | 'critical' = 'safe';
        if (currentQty <= item.minLevel) status = 'critical';
        else if (isLow) status = 'warning';

        return { ...item, currentStock: currentQty, totalValue, status };
      })
      .filter(item => {
        return filters.stockFilter === 'all' || (filters.stockFilter === 'low' && item.status !== 'safe');
      })
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [items, filters, purchaseOrders, productionLogs, wasteRecords, stocktakes, transferRecords]);

  const summary = useMemo(() => {
    const totalInvValue = processedData.reduce((s, r) => s + r.totalValue, 0);
    const lowStockCount = processedData.filter(r => r.status !== 'safe').length;
    const totalItems = processedData.length;
    return { totalInvValue, lowStockCount, totalItems };
  }, [processedData]);

  const formatNum = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- دالة الطباعة الاحترافية ---
  const handlePrint = () => {
    const el = document.getElementById('stock-levels-printable');
    if (!el) return;

    const branchName = filters.branchId === 'all' ? 'كافة الفروع' : branches.find(b => b.id === filters.branchId)?.name;
    
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('المتصفح منع فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
      return;
    }

    const headerHtml = `
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:15px; margin-bottom:20px;">
        <h1 style="margin:0; font-size:24px;">3M GSC - GLOBAL SYSTEM COST</h1>
        <h2 style="margin:5px 0; font-size:18px;">تقرير جرد مستويات المخزون التفصيلي</h2>
        <div style="font-size:12px;">الموقع: ${branchName} | التاريخ: ${new Date().toLocaleString('ar-EG')}</div>
      </div>
    `;

    const summaryHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-weight:bold; font-size:14px;">
        <div>إجمالي قيمة المخزون: ${formatNum(summary.totalInvValue)} ج.م</div>
        <div>عدد الأصناف: ${summary.totalItems}</div>
        <div>أصناف تحت حد الطلب: ${summary.lowStockCount}</div>
      </div>
    `;

    const tableClone = el.cloneNode(true) as HTMLElement;
    tableClone.style.maxHeight = 'none';
    tableClone.style.overflow = 'visible';
    
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة تقرير مستويات المخزون</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 11px; }
            th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
            @page { size: A4; margin: 10mm; }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${summaryHtml}
          ${tableClone.outerHTML}
          <div style="margin-top:30px; border-top:1px solid #eee; padding-top:10px; font-size:10px; text-align:center; color:#666;">
            طُبع بواسطة نظام 3M GSC - وحدة الرقابة المالية
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
        const exportData = processedData.map(r => ({
          'الحالة': r.status === 'critical' ? 'حرج' : r.status === 'warning' ? 'تحت الطلب' : 'متوفر',
          'كود الصنف': r.id,
          'اسم الصنف': r.name,
          'الفئة': r.category,
          'الرصيد الحالي': r.currentStock,
          'الوحدة': r.stockUnit,
          'حد الطلب': r.reorderLevel,
          'متوسط التكلفة': r.avgCost,
          'إجمالي القيمة': r.totalValue
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock Levels");
        if(!ws['!views']) ws['!views'] = [];
        ws['!views'].push({RTL: true});
        XLSX.writeFile(wb, `Stock_Levels_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        console.error("Excel Export Error:", error);
        alert("حدث خطأ أثناء تصدير ملف Excel");
    } finally {
        setIsProcessing(false);
    }
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

      {/* Dynamic Header & Filters */}
      <div className="bg-sys-surface p-4 rounded-2xl border border-white/5 flex flex-wrap items-end gap-3 no-print shadow-lg">
        
        {/* Branch Filter */}
        <div className="space-y-1 min-w-[160px]">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1">
            <Building2 size={10}/> اختيار الفرع / المخزن
          </label>
          <select 
            value={filters.branchId} 
            onChange={e => setFilters({...filters, branchId: e.target.value})}
            className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none transition-all"
          >
            <option value="all">كافة الفروع والمخازن (إجمالي)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="space-y-1 min-w-[140px]">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1">
            <ListFilter size={10}/> فلترة الحالة
          </label>
          <select 
            value={filters.stockFilter} 
            onChange={e => setFilters({...filters, stockFilter: e.target.value as any})}
            className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none transition-all"
          >
            <option value="all">كافة المخزون</option>
            <option value="low">أصناف تحت حد الطلب</option>
          </select>
        </div>
        
        {/* Search Bar */}
        <div className="flex-1 min-w-[200px] space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1">
            <Search size={10}/> بحث ذكي في المستودع
          </label>
          <div className="relative">
            <input 
              type="text" 
              value={filters.searchTerm} 
              onChange={e => setFilters({...filters, searchTerm: e.target.value})} 
              placeholder="ابحث بالكود أو اسم الخامة..." 
              className="w-full bg-[#121212] border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-xs text-white focus:border-sys-primary outline-none shadow-inner" 
            />
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={reload} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all hover:bg-white/10 shadow-sm" title="تحديث الأرصدة">
            <RefreshCw size={18} />
          </button>
          
          <button onClick={handlePrint} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all hover:bg-white/10 shadow-sm" title="طباعة الجرد">
            <Printer size={18} />
          </button>

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

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-sys-primary/5 rounded-full blur-2xl group-hover:bg-sys-primary/10 transition-colors"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-xl"><Database size={22} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-tighter">رأس المال المخزني</div>
              <div className="text-xl font-black text-white">{formatNum(summary.totalInvValue)} <span className="text-[10px] font-normal opacity-40">ج.م</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-sys-danger/5 rounded-full blur-2xl group-hover:bg-sys-danger/10 transition-colors"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-sys-danger/10 text-sys-danger rounded-xl"><AlertTriangle size={22} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">أصناف تحتاج شراء</div>
              <div className="text-xl font-black text-white">{summary.lowStockCount} <span className="text-[10px] font-normal opacity-40">صنف</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-sys-success/5 rounded-full blur-2xl group-hover:bg-sys-success/10 transition-colors"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-sys-success/10 text-sys-success rounded-xl"><CheckCircle2 size={22} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-tighter">إجمالي الأصناف النشطة</div>
              <div className="text-xl font-black text-white">{summary.totalItems} <span className="text-[10px] font-normal opacity-40">مادة</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-primary/10 border border-sys-primary/20 p-5 rounded-2xl flex flex-col justify-center shadow-lg shadow-blue-900/10">
          <div className="text-[10px] text-sys-primary font-black uppercase tracking-widest mb-1">
            {filters.branchId === 'all' ? 'تقرير جرد مجمع لكافة المواقع' : `رصيد: ${branches.find(b => b.id === filters.branchId)?.name}`}
          </div>
          <div className="text-xs text-white/60 font-medium italic">تم تحديث الأرصدة بناءً على العمليات</div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 bg-sys-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart size={16} className="text-sys-primary" /> 
              تحليل كفاية وقيمة المخزون للموقع المختار
            </h3>
            <div className="text-[10px] text-white/30 italic">التحليل يتم من واقع سجل حركات الموقع</div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar" id="stock-levels-printable">
          <table className="w-full text-right text-[11px] border-collapse min-w-[1000px]">
            <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase tracking-tighter shadow-md">
              <tr>
                <th className="p-4 border-b border-white/5">حالة التوفر</th>
                <th className="p-4 border-b border-white/5">الخامة / المادة</th>
                <th className="p-4 border-b border-white/5">الفئة</th>
                <th className="p-4 border-b border-white/5 text-center">الرصيد بالموقع</th>
                <th className="p-4 border-b border-white/5 text-center">متوسط التكلفة</th>
                <th className="p-4 border-b border-white/5 text-center bg-white/5">إجمالي القيمة بالموقع</th>
                <th className="p-4 border-b border-white/5 no-print">مستوى الكفاية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {processedData.map((row) => {
                const stockRatio = row.reorderLevel > 0 ? (row.currentStock / row.reorderLevel) : 1;
                return (
                  <tr key={row.id} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="p-4">
                      {row.status === 'critical' ? (
                        <span className="flex items-center gap-1.5 text-sys-danger font-bold">
                          <AlertTriangle size={12} /> نفاد / حرج
                        </span>
                      ) : row.status === 'warning' ? (
                        <span className="flex items-center gap-1.5 text-sys-warning font-bold">
                          <ArrowRight size={12} /> تحت الطلب
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sys-success font-bold">
                          <CheckCircle2 size={12} /> متوفر
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white group-hover:text-sys-primary transition-colors">{row.name}</div>
                      <div className="text-[9px] text-white/20 font-mono tracking-tighter">{row.id}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-lg bg-white/5 text-white/40 border border-white/5 text-[10px]">
                        {row.category}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                        <div className={`text-sm font-black ${row.status === 'critical' ? 'text-sys-danger' : 'text-white'}`}>
                          {row.currentStock.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-white/20">{row.stockUnit}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-white/60">
                        <DollarSign size={10} className="text-sys-success" />
                        {formatNum(row.avgCost)}
                      </div>
                    </td>
                    <td className="p-4 text-center bg-white/5">
                      <div className="text-sm font-black text-sys-primary tracking-tight">
                        {formatNum(row.totalValue)}
                      </div>
                    </td>
                    <td className="p-4 min-w-[150px] no-print">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[9px] text-white/30 font-bold uppercase">
                          <span>الرصيد</span>
                          <span>{row.reorderLevel} (حد الطلب)</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                          <div 
                            className={`h-full transition-all duration-1000 ${row.status === 'critical' ? 'bg-sys-danger' : row.status === 'warning' ? 'bg-sys-warning' : 'bg-sys-success'}`}
                            style={{ width: `${Math.min(stockRatio * 50, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {processedData.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-24 text-center text-white/20 italic">
                    <Box size={48} className="mx-auto mb-4 opacity-5" />
                    لم يتم العثور على أي أرصدة تطابق خيارات البحث الحالية لهذا الموقع.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-[#121212] font-black border-t-2 border-sys-primary sticky bottom-0 z-20 text-white uppercase text-[10px]">
              <tr>
                <td colSpan={5} className="p-4 text-left border-l border-white/5 pl-10">إجمالي القيمة المخزنية للموقع المختار</td>
                <td className="p-4 text-center bg-sys-primary/20 text-sys-primary text-sm tracking-tighter">{formatNum(summary.totalInvValue)} ج.م</td>
                <td className="p-4 no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Printable Footer */}
      <div className="hidden print:block mt-8 border-t-2 border-black pt-4 text-xs">
          <div className="flex justify-between items-center text-black">
              <div className="font-bold">نظام 3M GSC - تقرير مستويات المخزون التفصيلي</div>
              <div>تاريخ التقرير: {new Date().toLocaleString('ar-EG')}</div>
              <div>
                الموقع: {filters.branchId === 'all' ? 'كافة الفروع' : branches.find(b => b.id === filters.branchId)?.name}
              </div>
              <div className="font-bold">توقيع المسؤول: ..........................</div>
          </div>
      </div>
    </div>
  );
};

export default StockLevelsReport;
