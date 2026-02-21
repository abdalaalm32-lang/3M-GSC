
import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart3, Calendar, Building2, Search, RefreshCw, Printer, 
  Flame, Snowflake, Activity, TrendingUp, AlertCircle, 
  Zap, Clock, Package, Filter, Gauge, ArrowRightCircle,
  TrendingDown, Target, ShieldCheck, Box, Info, AlertTriangle,
  History, Timer, ArrowUpRight, ShoppingCart, TrendingUp as UpIcon,
  Download, FileSpreadsheet, Loader2, Warehouse
} from 'lucide-react';
import { ReportsData } from '../hooks/useReportsData';
import { ReportFilters } from '../hooks/useReportFilters';
import * as XLSX from 'xlsx';

interface Props extends ReportsData {
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
}

const MovementAnalysisReport: React.FC<Props> = ({ 
  filters, setFilters, items, purchaseOrders, productionLogs, wasteRecords, sales, recipes, branches, reload 
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // تحميل المخازن المكوّدة فعلياً في النظام
  useEffect(() => {
    const savedWh = localStorage.getItem('gsc_warehouses_config');
    if (savedWh) setWarehouses(JSON.parse(savedWh));
  }, []);
  
  // محرك التحليل الذكي للمخزون - Strategic BI Engine
  const analysisMatrix = useMemo(() => {
    const branchMatch = (bId?: string) => filters.branchId === 'all' || bId === filters.branchId;
    const dateMatch = (date: string) => date >= filters.from && date <= filters.to;

    // حساب عدد أيام الفترة للتحليل اليومي لضمان دقة DOI
    const fromDate = new Date(filters.from);
    const toDate = new Date(filters.to);
    const dayCount = Math.max(1, (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

    // 1. إنشاء قاعدة بيانات مؤقتة لجميع الأصناف
    const stats: Record<string, any> = {};

    items.forEach(item => {
      stats[item.id] = {
        itemId: item.id,
        name: item.name,
        category: item.category,
        unit: item.stockUnit,
        currentStock: item.currentStock || 0,
        avgCost: item.avgCost || 0,
        usageQty: 0,
        usageValue: 0,
        lastMovementDate: '-',
        turnoverRatio: 0,
      };
    });

    // أ- تتبع استهلاك المبيعات (Explosion via Recipes)
    sales.forEach(sale => {
      if (sale.status === 'مكتمل' && dateMatch(sale.date) && branchMatch(sale.branchId)) {
        sale.items.forEach(si => {
          const recipe = recipes.find(r => r.menuItemId === si.itemId);
          if (recipe) {
            recipe.ingredients.forEach(ing => {
              if (stats[ing.stockItemId]) {
                const item = items.find(i => i.id === ing.stockItemId);
                const convFactor = Number(item?.conversionFactor) || 1;
                const qtyInStockUnit = (Number(si.qty) * Number(ing.qty)) / convFactor;
                
                stats[ing.stockItemId].usageQty += qtyInStockUnit;
                if (sale.date > stats[ing.stockItemId].lastMovementDate) {
                  stats[ing.stockItemId].lastMovementDate = sale.date;
                }
              }
            });
          }
        });
      }
    });

    // ب- تتبع استهلاك الإنتاج المركزي (Posted Logs)
    productionLogs.forEach(pl => {
      if (pl.status === 'مرحل' && dateMatch(pl.date) && branchMatch(pl.branchId)) {
        pl.ingredients.forEach(ing => {
          if (stats[ing.stockItemId]) {
            stats[ing.stockItemId].usageQty += Number(ing.requiredQty);
            if (pl.date > stats[ing.stockItemId].lastMovementDate) {
              stats[ing.stockItemId].lastMovementDate = pl.date;
            }
          }
        });
      }
    });

    // ج- تتبع الهالك (Posted Waste)
    wasteRecords.forEach(wr => {
      if (wr.status === 'مرحل' && dateMatch(wr.date) && branchMatch(wr.branchId)) {
        wr.items.forEach(wi => {
          if (stats[wi.itemId]) {
            stats[wi.itemId].usageQty += Number(wi.quantity);
            if (wr.date > stats[wi.itemId].lastMovementDate) {
              stats[wi.itemId].lastMovementDate = wr.date;
            }
          }
        });
      }
    });

    // 2. معالجة التصنيفات المالية (ABC) ومقاييس الدوران
    let results = Object.values(stats).map((s: any) => {
      s.usageValue = s.usageQty * s.avgCost;
      s.dailyUsage = s.usageQty / dayCount;
      // DOI: كم يوماً سيصمد المخزون؟
      s.doi = s.dailyUsage > 0 ? (s.currentStock / s.dailyUsage) : (s.currentStock > 0 ? 999 : 0);
      // Turnover: كم مرة دار المخزن خلال الفترة؟
      s.turnoverRatio = s.currentStock > 0 ? (s.usageQty / s.currentStock) : (s.usageQty > 0 ? 10 : 0);
      return s;
    });

    // تطبيق قاعدة باريتو 80/20 لتصنيف ABC
    const totalUsageValue = results.reduce((sum, r) => sum + r.usageValue, 0);
    results.sort((a, b) => b.usageValue - a.usageValue);

    let cumulativeValue = 0;
    results = results.map(r => {
      cumulativeValue += r.usageValue;
      const percent = totalUsageValue > 0 ? (cumulativeValue / totalUsageValue) * 100 : 100;
      
      let abc = 'C';
      if (percent <= 70) abc = 'A';
      else if (percent <= 90) abc = 'B';

      // تحديد نبض الحركة (Inventory Pulse)
      let velocity: 'fast' | 'stable' | 'slow' | 'dead' = 'dead';
      if (r.usageQty === 0) velocity = 'dead';
      else if (r.turnoverRatio >= 3) velocity = 'fast';
      else if (r.turnoverRatio >= 1) velocity = 'stable';
      else velocity = 'slow';

      return { ...r, abc, velocity };
    });

    // تطبيق فلتر البحث النهائي
    if (filters.searchTerm) {
      results = results.filter(r => 
        r.name.includes(filters.searchTerm) || 
        r.itemId.includes(filters.searchTerm) ||
        r.category.includes(filters.searchTerm)
      );
    }

    return results;
  }, [items, sales, recipes, productionLogs, wasteRecords, filters]);

  const summary = useMemo(() => {
    const fastMovers = analysisMatrix.filter(r => r.velocity === 'fast').length;
    const deadStock = analysisMatrix.filter(r => r.velocity === 'dead').length;
    const totalStockValue = analysisMatrix.reduce((s, r) => s + (r.currentStock * r.avgCost), 0);
    const avgTurnover = analysisMatrix.length > 0 ? analysisMatrix.reduce((s,r)=>s+r.turnoverRatio, 0) / analysisMatrix.length : 0;
    return { fastMovers, deadStock, totalStockValue, avgTurnover };
  }, [analysisMatrix]);

  const formatNum = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // --- دالة تصدير Excel ---
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      const exportData = analysisMatrix.map(r => ({
        'رتبة ABC': r.abc,
        'كود الصنف': r.itemId,
        'اسم الصنف': r.name,
        'الفئة': r.category,
        'نبض الحركة': r.velocity === 'fast' ? 'سريع' : r.velocity === 'stable' ? 'مستقر' : r.velocity === 'slow' ? 'بطيء' : 'راكد',
        'إجمالي المنصرف': r.usageQty,
        'الوحدة': r.unit,
        'قيمة الاستهلاك': r.usageValue,
        'الرصيد المتاح': r.currentStock,
        'أيام الكفاية (DOI)': r.doi > 365 ? 'سنة +' : r.doi.toFixed(1),
        'معدل الدوران': r.turnoverRatio.toFixed(2),
        'آخر حركة': r.lastMovementDate
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Movement Analysis");
      
      if(!ws['!views']) ws['!views'] = [];
      ws['!views'].push({RTL: true});

      XLSX.writeFile(wb, `Movement_Analysis_Report_${filters.from}_to_${filters.to}.xlsx`);
    } catch (error) {
      console.error("Excel Export Error", error);
      alert("حدث خطأ أثناء تصدير ملف Excel");
    } finally {
      setIsExporting(false);
    }
  };

  // --- دالة الطباعة الاحترافية ---
  const handlePrint = () => {
    const el = document.getElementById('movement-analysis-table-container');
    if (!el) return;

    const locName = filters.branchId === 'all' ? 'كافة المواقع' : (warehouses.find(w => w.id === filters.branchId)?.name || branches.find(b => b.id === filters.branchId)?.name);

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const headerHtml = `
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:15px; margin-bottom:20px; font-family: Arial, sans-serif;">
        <h1 style="margin:0; font-size:24px;">3M GSC - GLOBAL SYSTEM COST</h1>
        <h2 style="margin:5px 0; font-size:18px;">تقرير تحليل مصفوفة حركة المخزون وكفاءة الأصول</h2>
        <div style="font-size:12px;">الموقع: ${locName} | الفترة: من ${filters.from} إلى ${filters.to}</div>
      </div>
    `;

    const summaryHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-weight:bold; font-size:13px; background: #f9f9f9; padding: 15px; border: 1px solid #ddd; font-family: Arial, sans-serif;">
        <div>إجمالي قيمة المخزون: ${formatNum(summary.totalStockValue)} ج.م</div>
        <div>معدل الدوران العام: x${summary.avgTurnover.toFixed(2)}</div>
        <div>الأصناف النشطة: ${analysisMatrix.length - summary.deadStock} صنف</div>
      </div>
    `;

    const tableClone = el.cloneNode(true) as HTMLElement;
    tableClone.style.maxHeight = 'none';
    tableClone.style.overflow = 'visible';
    
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة مصفوفة تحليل الحركة</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 10px; }
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
            طُبع بواسطة نظام 3M GSC - وحدة ذكاء الأعمال | تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}
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
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-700">
      
      {/* Strategic Header & Controls */}
      <div className="bg-sys-surface p-5 rounded-2xl border border-white/5 flex flex-wrap items-end gap-4 no-print shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-sys-primary/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
        
        <div className="space-y-1 relative z-10">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-widest px-1 font-bold">
            <Calendar size={12} className="text-sys-primary" /> فترة التحليل والذكاء
          </label>
          <div className="flex items-center gap-2">
            <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none shadow-inner" />
            <span className="text-white/20 text-xs">إلى</span>
            <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none shadow-inner" />
          </div>
        </div>

        <div className="space-y-1 min-w-[180px] relative z-10">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-widest px-1 font-bold">
            <Building2 size={12} className="text-sys-primary" /> موقع التحليل (مخزن / فرع)
          </label>
          <select value={filters.branchId} onChange={e => setFilters({...filters, branchId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none shadow-inner">
            <option value="all">كافة المواقع والمستودعات</option>
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

        <div className="flex-1 min-w-[200px] space-y-1 relative z-10">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-widest px-1 font-bold">
            <Search size={12} className="text-sys-primary" /> بحث ذكي (خامة، كود، فئة)
          </label>
          <input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="ابحث في مصفوفة الحركة..." className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none shadow-inner" />
        </div>

        <div className="flex gap-2 relative z-10">
          <button onClick={reload} className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-lg hover:bg-sys-primary/10" title="تحديث التحليلات"><RefreshCw size={18} /></button>
          <button onClick={handlePrint} className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-lg hover:bg-sys-primary/10" title="طباعة المصفوفة الاستراتيجية"><Printer size={18} /></button>
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

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl shadow-xl flex items-center gap-5 group hover:border-sys-primary/30 transition-all">
          <div className="p-4 bg-sys-primary/10 text-sys-primary rounded-2xl group-hover:scale-110 transition-transform"><Activity size={28} /></div>
          <div>
            <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">إجمالي قيمة المخزون</div>
            <div className="text-2xl font-black text-white">{formatNum(summary.totalStockValue)} <span className="text-[10px] font-normal opacity-40">ج.م</span></div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl shadow-xl flex items-center gap-5 group hover:border-sys-danger/30 transition-all">
          <div className="p-4 bg-sys-danger/10 text-sys-danger rounded-2xl group-hover:scale-110 transition-transform"><Flame size={28} /></div>
          <div>
            <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">أصناف "صاروخية"</div>
            <div className="text-2xl font-black text-white">{summary.fastMovers} <span className="text-[10px] font-normal opacity-40">صنف</span></div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl shadow-xl flex items-center gap-5 group hover:border-blue-500/30 transition-all">
          <div className="p-4 bg-blue-500/10 text-blue-400 rounded-2xl group-hover:scale-110 transition-transform"><Snowflake size={28} /></div>
          <div>
            <div className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-1">أصناف "راكدة" (Dead)</div>
            <div className="text-2xl font-black text-white">{summary.deadStock} <span className="text-[10px] font-normal opacity-40">صنف</span></div>
          </div>
        </div>

        <div className="bg-sys-primary/5 border border-sys-primary/20 p-5 rounded-2xl flex flex-col justify-center shadow-lg relative overflow-hidden group">
          <div className="absolute -left-4 -bottom-4 opacity-10 group-hover:rotate-12 transition-transform"><Zap size={64} /></div>
          <div className="text-[10px] text-sys-primary font-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <ShieldCheck size={14} /> كفاءة التخطيط
          </div>
          <div className="text-xl font-black text-white">x{summary.avgTurnover.toFixed(2)}</div>
          <div className="text-[9px] text-white/40 font-medium italic">متوسط معدل الدوران العام</div>
        </div>
      </div>

      {/* Main Strategic Table */}
      <div className="flex-1 bg-sys-surface border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="p-5 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sys-primary/10 flex items-center justify-center text-sys-primary">
                <Gauge size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter">مصفوفة ذكاء حركة المخزون وكفاءة الأصول</h3>
                <p className="text-[10px] text-white/30 tracking-widest uppercase italic">Inventory Pulse & Pareto DOI Analysis</p>
              </div>
            </div>
            
            <div className="flex gap-4 no-print">
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 border border-white/10 px-3 py-1.5 rounded-full"><div className="w-2 h-2 rounded-full bg-sys-success shadow-[0_0_8px_#10B981]"></div> فئة A (70% من القيمة)</div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 border border-white/10 px-3 py-1.5 rounded-full"><div className="w-2 h-2 rounded-full bg-sys-warning shadow-[0_0_8px_#F59E0B]"></div> فئة B (20% من القيمة)</div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 border border-white/10 px-3 py-1.5 rounded-full"><div className="w-2 h-2 rounded-full bg-sys-danger shadow-[0_0_8px_#EF4444]"></div> فئة C (10% من القيمة)</div>
            </div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar" id="movement-analysis-table-container">
          <table className="w-full text-right text-[11px] border-collapse min-w-[1200px]">
            <thead className="bg-[#1a1a1a] text-white/40 font-black sticky top-0 z-10 uppercase tracking-tighter shadow-xl">
              <tr>
                <th className="p-5 border-b border-white/5 text-center">الرتبة</th>
                <th className="p-5 border-b border-white/5">المادة الخام / الكود</th>
                <th className="p-5 border-b border-white/5 text-center">نبض الحركة</th>
                <th className="p-5 border-b border-white/5 text-center">المنصرف للفترة</th>
                <th className="p-5 border-b border-white/5 text-center bg-white/[0.02]">قيمة الاستهلاك</th>
                <th className="p-5 border-b border-white/5 text-center">الرصيد المتاح</th>
                <th className="p-5 border-b border-white/5 text-center w-48">أيام الكفاية (DOI)</th>
                <th className="p-5 border-b border-white/5 no-print">إجراء مقترح / توصية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analysisMatrix.map((row) => (
                <tr key={row.itemId} className={`hover:bg-white/[0.03] transition-all group border-r-4 border-r-transparent ${row.velocity === 'dead' ? 'bg-blue-500/[0.02] border-r-blue-500/20' : 'hover:border-r-sys-primary'}`}>
                  <td className="p-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shadow-2xl mx-auto transform group-hover:scale-110 transition-transform ${row.abc === 'A' ? 'bg-sys-success/20 text-sys-success border border-sys-success/30' : row.abc === 'B' ? 'bg-sys-warning/20 text-sys-warning border border-sys-warning/30' : 'bg-sys-danger/20 text-sys-danger border border-sys-danger/30'}`}>
                      {row.abc}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-black text-white group-hover:text-sys-primary transition-colors text-sm">{row.name}</div>
                    <div className="text-[9px] text-white/20 font-mono tracking-widest mt-0.5 uppercase">{row.itemId} • {row.category}</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                        {row.velocity === 'fast' ? (
                            <div className="px-3 py-1.5 rounded-xl bg-sys-danger/10 text-sys-danger text-[9px] font-black flex items-center gap-1.5 animate-pulse border border-sys-danger/20 shadow-lg shadow-red-900/10">
                                <Flame size={12} /> سريع (Fast)
                            </div>
                        ) : row.velocity === 'stable' ? (
                            <div className="px-3 py-1.5 rounded-xl bg-sys-primary/10 text-sys-primary text-[9px] font-black flex items-center gap-1.5 border border-sys-primary/20">
                                <Activity size={12} /> مستقر (Active)
                            </div>
                        ) : row.velocity === 'slow' ? (
                            <div className="px-3 py-1.5 rounded-xl bg-sys-warning/10 text-sys-warning text-[9px] font-black flex items-center gap-1.5 border border-sys-warning/20">
                                <TrendingUp size={12} /> بطيء (Slow)
                            </div>
                        ) : (
                            <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 text-[9px] font-black flex items-center gap-1.5 border border-blue-500/20 shadow-inner">
                                <Snowflake size={12} /> راكد (Dead)
                            </div>
                        )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="font-black text-white text-sm">{row.usageQty.toLocaleString()}</div>
                    <div className="text-[9px] text-white/20 uppercase font-bold">{row.unit}</div>
                  </td>
                  <td className="p-4 text-center bg-white/[0.02]">
                    <div className="font-black text-white/90 text-sm tracking-tighter">{formatNum(row.usageValue)}</div>
                    <div className="text-[8px] text-white/20 uppercase font-bold">ج.م استهلاك مالي</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="text-sm font-black text-sys-primary tracking-tight">
                      {row.currentStock.toLocaleString()}
                    </div>
                    <div className="text-[8px] text-white/20 uppercase">رصيد متاح</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-black ${row.doi < 7 ? 'text-sys-danger animate-pulse' : 'text-white/70'}`}>
                            {row.doi > 365 ? 'سنة +' : `${row.doi.toFixed(1)} يوم`}
                          </span>
                          <Timer size={10} className="text-white/20" />
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/5">
                            <div 
                              className={`h-full transition-all duration-1000 ${row.doi < 7 ? 'bg-sys-danger' : row.doi < 30 ? 'bg-sys-warning' : 'bg-sys-success'}`} 
                              style={{ width: `${Math.min((1 / (row.doi || 1)) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                  </td>
                  <td className="p-4 no-print">
                    <div className="flex items-center gap-3">
                        {row.velocity === 'dead' ? (
                            <div className="flex items-center gap-2 p-2 bg-sys-danger/10 rounded-xl border border-sys-danger/20 text-sys-danger animate-in slide-in-from-left">
                                <AlertTriangle size={14} />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase">توصية: إيقاف طلب / تسييل</span>
                                    <span className="text-[8px] opacity-60 italic">رأس مال مجمد بدون حركة</span>
                                </div>
                            </div>
                        ) : row.doi < 5 ? (
                            <div className="flex items-center gap-2 p-2 bg-sys-success/10 rounded-xl border border-sys-success/20 text-sys-success animate-in slide-in-from-left">
                                <ShoppingCart size={14} />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase">إجراء: أمر شراء فوري</span>
                                    <span className="text-[8px] opacity-60 italic">تجاوز حد النفاد الحرج</span>
                                </div>
                            </div>
                        ) : row.turnoverRatio > 5 ? (
                            <div className="flex items-center gap-2 p-2 bg-sys-warning/10 rounded-xl border border-sys-warning/20 text-sys-warning">
                                <ArrowUpRight size={14} />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase">توصية: رفع حد الطلب</span>
                                    <span className="text-[8px] opacity-60 italic">معدل دوران مرتفع جداً</span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10 text-white/30 italic">
                                <ShieldCheck size={14} />
                                <span className="text-[9px]">وضع آمن - مراقبة دورية</span>
                            </div>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {analysisMatrix.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-32 text-center text-white/20 italic">
                    <Box size={64} className="mx-auto mb-6 opacity-5" />
                    <div className="text-xl font-black italic uppercase tracking-widest">لا توجد بيانات حركة للتحليل حالياً</div>
                    <p className="text-sm opacity-50 mt-2 uppercase">يرجى التأكد من ترحيل المبيعات، الإنتاج، أو الهالك لعرض النتائج</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Footer for BI Report */}
      <div className="hidden print:block mt-8 border-t-4 border-black pt-6">
        <div className="grid grid-cols-3 gap-8 text-[10px] font-black text-black uppercase tracking-widest">
          <div className="flex flex-col gap-1">
            <span className="border-b border-black pb-1">وحدة ذكاء الأعمال والرقابة (BI)</span>
            <span className="font-normal mt-1 italic text-gray-500">Business Intelligence & Asset Efficiency Module</span>
          </div>
          <div className="text-center flex flex-col items-center">
            <div className="w-16 h-16 border-2 border-black rounded-full flex items-center justify-center mb-2">
                <BarChart3 size={24} />
            </div>
            <span>تحليل معدلات الدوران والسيولة المالية (3M GSC)</span>
          </div>
          <div className="text-left flex flex-col gap-1">
            <span className="border-b border-black pb-1 text-left">تاريخ استخراج التقرير</span>
            <span className="font-normal mt-1">{new Date().toLocaleString('ar-EG')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovementAnalysisReport;
