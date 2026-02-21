
import React, { useMemo, useState } from 'react';
import { 
  ShoppingCart, Calendar, Briefcase, Search, RefreshCw, Printer, 
  TrendingUp, Award, PieChart, ArrowUpRight, ArrowDownRight, 
  Tag, Hash, Target, ChevronDown, Download, FileSpreadsheet, Loader2
} from 'lucide-react';
import { ReportsData } from '../hooks/useReportsData';
import { ReportFilters } from '../hooks/useReportFilters';
import * as XLSX from 'xlsx';

interface Props extends ReportsData {
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
}

const PurchaseAnalysisReport: React.FC<Props> = ({ 
  filters, setFilters, purchaseOrders, items, suppliers, branches, reload 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const analysisData = useMemo(() => {
    const aggregated: Record<string, any> = {};
    let grandTotalSpend = 0;
    let totalPurchaseOccurrences = 0;

    // تصفية الفواتير حسب التاريخ والمورد والفرع
    const filteredOrders = purchaseOrders.filter(po => {
      const dateMatch = po.date >= filters.from && po.date <= filters.to;
      const supplierMatch = filters.supplierId === 'all' || po.supplierId === filters.supplierId;
      const branchMatch = filters.branchId === 'all' || po.branchId === filters.branchId;
      return po.status === 'مكتمل' && dateMatch && supplierMatch && branchMatch;
    });

    filteredOrders.forEach(po => {
      po.items.forEach(pItem => {
        const stockItem = items.find(i => i.id === pItem.itemId);
        const name = pItem.name || stockItem?.name || 'صنف غير معرف';
        const category = stockItem?.category || 'بدون فئة';
        
        if (!aggregated[pItem.itemId]) {
          aggregated[pItem.itemId] = {
            itemId: pItem.itemId,
            name,
            category,
            unit: pItem.unit,
            totalQty: 0,
            totalCost: 0,
            purchaseCount: 0, 
            supplierFrequency: {} as Record<string, number>,
            lastPrice: pItem.unitCost,
            standardCost: stockItem?.standardCost || 0
          };
        }

        aggregated[pItem.itemId].totalQty += Number(pItem.quantity);
        aggregated[pItem.itemId].totalCost += Number(pItem.total);
        aggregated[pItem.itemId].purchaseCount += 1;
        
        grandTotalSpend += Number(pItem.total);
        totalPurchaseOccurrences += 1;

        const sName = po.supplierName || 'مورد مجهول';
        aggregated[pItem.itemId].supplierFrequency[sName] = (aggregated[pItem.itemId].supplierFrequency[sName] || 0) + 1;
      });
    });

    let results = Object.values(aggregated).map(row => {
      const avgCost = row.totalQty > 0 ? row.totalCost / row.totalQty : 0;
      const spendRatio = grandTotalSpend > 0 ? (row.totalCost / grandTotalSpend) * 100 : 0;
      const frequencyImportance = totalPurchaseOccurrences > 0 ? (row.purchaseCount / totalPurchaseOccurrences) * 100 : 0;
      const topSupplier = Object.entries(row.supplierFrequency)
        .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || '-';
      const priceDiff = row.standardCost > 0 ? (avgCost - row.standardCost) : 0;
      const variancePercent = row.standardCost > 0 ? (priceDiff / row.standardCost) * 100 : 0;

      return { 
        ...row, 
        avgCost, 
        spendRatio, 
        frequencyImportance,
        topSupplier, 
        priceDiff,
        variancePercent,
        grandTotalSpend 
      };
    });

    // تطبيق فلتر البحث بالاسم أو الكود
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      results = results.filter(r => 
        r.name.toLowerCase().includes(term) || 
        r.itemId.toLowerCase().includes(term)
      );
    }

    return results.sort((a, b) => b.totalCost - a.totalCost);
  }, [purchaseOrders, items, filters]);

  const summary = useMemo(() => {
    const total = analysisData.reduce((s, r) => s + r.totalCost, 0);
    const uniqueItems = analysisData.length;
    const mostExpensive = analysisData[0]?.name || '-';
    return { total, uniqueItems, mostExpensive };
  }, [analysisData]);

  const formatNum = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- دالة تصدير Excel ---
  const handleExportExcel = () => {
    setIsProcessing(true);
    try {
        const exportData = analysisData.map(r => ({
          'كود الخامة': r.itemId,
          'اسم الصنف': r.name,
          'الفئة': r.category,
          'إجمالي الكمية المشتراة': r.totalQty,
          'الوحدة': r.unit,
          'التكلفة المعيارية': r.standardCost,
          'متوسط تكلفة الشراء': r.avgCost,
          'فرق التكلفة': r.priceDiff,
          'نسبة التباين %': r.variancePercent.toFixed(2),
          'إجمالي القيمة الموردة': r.totalCost,
          'المورد الأكثر تعاملاً': r.topSupplier
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Purchase Analysis");
        if(!ws['!views']) ws['!views'] = [];
        ws['!views'].push({RTL: true});
        XLSX.writeFile(wb, `Purchase_Analysis_Report_${filters.from}_to_${filters.to}.xlsx`);
    } catch (error) {
        console.error("Excel Export Error:", error);
        alert("حدث خطأ أثناء تصدير ملف Excel");
    } finally {
        setIsProcessing(false);
    }
  };

  // --- دالة الطباعة الاحترافية ---
  const handlePrint = () => {
    const el = document.getElementById('purchase-analysis-table');
    if (!el) return;

    const supplierName = filters.supplierId === 'all' ? 'كافة الموردين' : suppliers.find(s => s.id === filters.supplierId)?.name;
    const branchName = filters.branchId === 'all' ? 'كافة الفروع' : branches.find(b => b.id === filters.branchId)?.name;
    
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('المتصفح منع فتح نافذة الطباعة. يرجى تفعيل الـ Pop-ups.');
      return;
    }

    const headerHtml = `
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:15px; margin-bottom:20px;">
        <h1 style="margin:0; font-size:24px;">3M GSC - GLOBAL SYSTEM COST</h1>
        <h2 style="margin:5px 0; font-size:18px;">تقرير تحليل مصفوفة المشتريات الاستراتيجية</h2>
        <div style="font-size:12px;">المورد: ${supplierName} | الفرع: ${branchName} | الفترة: من ${filters.from} إلى ${filters.to}</div>
      </div>
    `;

    const summaryHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-weight:bold; font-size:14px; background: #f9f9f9; padding: 15px; border: 1px solid #ddd;">
        <div>إجمالي قيمة المشتريات: ${formatNum(summary.total)} ج.م</div>
        <div>عدد الأصناف الموردة: ${summary.uniqueItems}</div>
        <div>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</div>
      </div>
    `;

    const tableClone = el.cloneNode(true) as HTMLElement;
    tableClone.style.maxHeight = 'none';
    tableClone.style.overflow = 'visible';
    
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة تقرير المشتريات</title>
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
            طُبع بواسطة نظام 3M GSC لإدارة التكاليف
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
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
      
      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center no-print">
          <div className="bg-sys-surface p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="text-sys-primary animate-spin" size={48} />
            <p className="text-white font-bold animate-pulse">جاري تحضير ملف الـ Excel...</p>
          </div>
        </div>
      )}

      {/* Filters Area */}
      <div className="bg-sys-surface p-4 rounded-2xl border border-white/5 flex flex-wrap items-end gap-3 no-print shadow-sm">
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> الفترة من</label>
          <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2 text-xs text-white focus:border-sys-primary outline-none" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> إلى</label>
          <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2 text-xs text-white focus:border-sys-primary outline-none" />
        </div>
        <div className="space-y-1 min-w-[140px]">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Briefcase size={10}/> المورد</label>
          <select value={filters.supplierId} onChange={e => setFilters({...filters, supplierId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-2 text-xs text-white focus:border-sys-primary outline-none">
            <option value="all">كل الموردين</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px] space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Search size={10}/> بحث بالخامة أو الكود</label>
          <input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="ابحث عن خامة محددة أو كود..." className="w-full bg-[#121212] border border-white/10 rounded-xl p-2 text-xs text-white focus:border-sys-primary outline-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={reload} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all" title="تحديث البيانات"><RefreshCw size={18} /></button>
          <button onClick={handlePrint} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all" title="طباعة التقرير"><Printer size={18} /></button>
          
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="bg-sys-surface border border-white/5 p-4 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 h-full bg-sys-primary"></div>
          <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-xl"><ShoppingCart size={20} /></div>
          <div>
            <div className="text-[10px] text-white/40 font-bold uppercase">إجمالي المشتريات</div>
            <div className="text-xl font-black text-white">{summary.total.toLocaleString()} <span className="text-[10px] font-normal opacity-40">ج.م</span></div>
          </div>
        </div>
        <div className="bg-sys-surface border border-white/5 p-4 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 h-full bg-sys-success"></div>
          <div className="p-3 bg-sys-success/10 text-sys-success rounded-xl"><Hash size={20} /></div>
          <div>
            <div className="text-[10px] text-white/40 font-bold uppercase">كثافة التوريد</div>
            <div className="text-xl font-black text-white">{analysisData.reduce((s,r)=>s+r.purchaseCount,0)} <span className="text-[10px] font-normal opacity-40">مرة</span></div>
          </div>
        </div>
        <div className="bg-sys-surface border border-white/5 p-4 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 h-full bg-sys-warning"></div>
          <div className="p-3 bg-sys-warning/10 text-sys-warning rounded-xl"><Award size={20} /></div>
          <div>
            <div className="text-[10px] text-white/40 font-bold uppercase">الأكثر قيمة</div>
            <div className="text-sm font-black text-white truncate max-w-[120px]">{summary.mostExpensive}</div>
          </div>
        </div>
        <div className="bg-sys-surface border border-white/5 p-4 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 h-full bg-purple-500"></div>
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl"><PieChart size={20} /></div>
          <div>
            <div className="text-[10px] text-white/40 font-bold uppercase">تحليل ABC</div>
            <div className="text-xs font-black text-white">تصنيف استراتيجي فعال</div>
          </div>
        </div>
      </div>

      {/* Main Analysis Table */}
      <div className="flex-1 bg-sys-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center no-print">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-sys-primary" /> 
              تحليل مصفوفة المشتريات الاستراتيجية
            </h3>
            <div className="text-[10px] text-white/30 italic">الترتيب حسب إجمالي قيمة التوريد</div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar" id="purchase-analysis-table">
          <table className="w-full text-right text-[11px] border-collapse min-w-[1100px]">
            <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase tracking-tighter shadow-md">
              <tr>
                <th className="p-4 border-b border-white/5 text-center">أهمية التكرار %</th>
                <th className="p-4 border-b border-white/5">الخامة / الكود</th>
                <th className="p-4 border-b border-white/5">الفئة</th>
                <th className="p-4 border-b border-white/5 text-center">إجمالي الكمية</th>
                <th className="p-4 border-b border-white/5 text-center">التكلفة المعيارية</th>
                <th className="p-4 border-b border-white/5 text-center">متوسط التكلفة</th>
                <th className="p-4 border-b border-white/5 text-center bg-sys-danger/5">فرق السعر</th>
                <th className="p-4 border-b border-white/5 text-center bg-white/5">إجمالي القيمة</th>
                <th className="p-4 border-b border-white/5">المورد المفضل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analysisData.map((row) => {
                const isFrequent = row.frequencyImportance > 10; 
                return (
                  <tr key={row.itemId} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="p-4 text-center">
                      <div className={`text-[10px] font-black px-2 py-1 rounded-full w-fit mx-auto flex items-center gap-1 ${isFrequent ? 'bg-sys-primary text-white' : 'bg-white/5 text-white/40'}`}>
                        <Hash size={10} />
                        {row.frequencyImportance.toFixed(1)}%
                      </div>
                      <div className="text-[8px] text-white/20 mt-1">({row.purchaseCount} مرة)</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white group-hover:text-sys-primary transition-colors">{row.name}</div>
                      <div className="text-[9px] text-white/20 font-mono">{row.itemId}</div>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-white/40">
                        <Tag size={10} className="text-sys-primary/50" />
                        {row.category}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                        <div className="font-black text-white">{row.totalQty.toLocaleString()}</div>
                        <div className="text-[9px] text-white/20">{row.unit}</div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-white/40">
                        <Target size={10} />
                        {formatNum(row.standardCost)}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="font-bold text-white">{formatNum(row.avgCost)}</div>
                      <div className="text-[9px] text-white/20">آخر سعر: {formatNum(row.lastPrice)}</div>
                    </td>
                    <td className={`p-4 text-center bg-sys-danger/[0.02] font-bold ${row.priceDiff > 0 ? 'text-sys-danger' : row.priceDiff < 0 ? 'text-sys-success' : 'text-white/10'}`}>
                        <div className="flex flex-col items-center">
                            <span>{row.priceDiff !== 0 ? formatNum(row.priceDiff) : '-'}</span>
                            {row.variancePercent !== 0 && (
                                <span className="text-[9px] opacity-60 flex items-center gap-0.5">
                                    {row.variancePercent > 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
                                    {Math.abs(row.variancePercent).toFixed(1)}%
                                </span>
                            )}
                        </div>
                    </td>
                    <td className="p-4 text-center bg-white/5 font-black text-sys-primary text-sm tracking-tight">{formatNum(row.totalCost)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-sys-success/40"></div>
                        <span className="text-white/60 text-[10px]">{row.topSupplier}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {analysisData.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-20 text-center text-white/20 italic">
                    <Search size={48} className="mx-auto mb-4 opacity-5" />
                    لا توجد بيانات مشتريات مطابقة للفلاتر المختارة.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-[#121212] font-black border-t-2 border-sys-primary sticky bottom-0 z-10 text-white uppercase text-[10px]">
              <tr>
                <td colSpan={7} className="p-4 text-left pl-10 border-l border-white/5">الإجمالي الكلي للقيمة الموردة</td>
                <td className="p-4 text-center bg-sys-primary/20 text-sys-primary text-sm">{formatNum(summary.total)} ج.م</td>
                <td className="p-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      {/* Legend for Management */}
      <div className="hidden print:flex justify-between items-center p-4 border-t-2 border-black mt-8 text-[10px] bg-gray-50 text-black">
        <div className="flex gap-6">
          <span className="font-bold">مفاتيح التقرير:</span>
          <span>(%) أهمية التكرار: نسبة عدد مرات شراء الصنف من إجمالي العمليات</span>
          <span>(ج.م) فرق السعر: الفرق المادي بين متوسط الشراء الفعلي والتكلفة المعيارية</span>
        </div>
        <div className="font-bold">نظام 3M GSC - تقرير ذكاء المشتريات</div>
      </div>
    </div>
  );
};

export default PurchaseAnalysisReport;
