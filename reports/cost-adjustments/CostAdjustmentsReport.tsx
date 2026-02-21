
import React, { useMemo, useState, useEffect } from 'react';
import { 
  Edit3, Calendar, Building2, Search, RefreshCw, Printer, 
  TrendingUp, TrendingDown, ArrowRight, ArrowUpRight, ArrowDownRight,
  AlertCircle, DollarSign, Package, Tag, Hash, FileText, PieChart, Zap,
  Download, FileSpreadsheet, Warehouse
} from 'lucide-react';
import { ReportsData } from '../hooks/useReportsData';
import { ReportFilters } from '../hooks/useReportFilters';
import * as XLSX from 'xlsx';

interface Props extends ReportsData {
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
}

const CostAdjustmentsReport: React.FC<Props> = ({ 
  filters, setFilters, adjustmentRecords, branches, reload 
}) => {
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // تحميل المخازن المكوّدة فعلياً في النظام
  useEffect(() => {
    const savedWh = localStorage.getItem('gsc_warehouses_config');
    if (savedWh) setWarehouses(JSON.parse(savedWh));
  }, []);
  
  // معالجة البيانات: فك السجلات إلى أسطر مفردة لكل صنف تم تعديله
  const processedAdjustments = useMemo(() => {
    const list: any[] = [];
    
    // تصفية السجلات المغلقة (المنفذة) فقط وضمن الفترة والموقع المختار
    const filteredRecords = adjustmentRecords.filter(rec => {
      const dateMatch = rec.date >= filters.from && rec.date <= filters.to;
      const branchMatch = filters.branchId === 'all' || rec.branchId === filters.branchId;
      return rec.status === 'مغلق' && dateMatch && branchMatch;
    });

    filteredRecords.forEach(rec => {
      rec.items.forEach(item => {
        // فلتر البحث بالاسم أو الكود
        if (filters.searchTerm !== '' && 
            !item.name.includes(filters.searchTerm) && 
            !item.itemId.includes(filters.searchTerm)) {
            return;
        }

        const diff = Number(item.newCost) - Number(item.oldCost);
        const percent = item.oldCost > 0 ? (diff / item.oldCost) * 100 : 0;

        list.push({
          recordId: rec.id,
          date: rec.date,
          branchName: rec.branchName,
          notes: rec.notes,
          ...item,
          diff,
          percent
        });
      });
    });

    // الترتيب من الأحدث للأقدم
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [adjustmentRecords, filters]);

  const summary = useMemo(() => {
    const totalItems = processedAdjustments.length;
    const avgChange = totalItems > 0 
      ? processedAdjustments.reduce((s, r) => s + r.percent, 0) / totalItems 
      : 0;
    
    const topSpike = [...processedAdjustments].sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent))[0];

    return { totalItems, avgChange, topSpike };
  }, [processedAdjustments]);

  const formatNum = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // الحصول على اسم الموقع المختار (مخزن أو فرع) بدقة
  const getSelectedLocationName = () => {
    if (filters.branchId === 'all') return 'كافة المواقع والمخازن';
    const loc = warehouses.find(w => w.id === filters.branchId) || branches.find(b => b.id === filters.branchId);
    return loc?.name || 'موقع غير معروف';
  };

  // --- دالة تصدير Excel ---
  const handleExportExcel = () => {
    const exportData = processedAdjustments.map(r => ({
      'رقم السجل': r.recordId,
      'التاريخ': r.date,
      'الموقع': r.branchName,
      'كود الصنف': r.itemId,
      'اسم الصنف': r.name,
      'الوحدة': r.unit,
      'التكلفة السابقة': r.oldCost,
      'التكلفة الجديدة': r.newCost,
      'فرق القيمة': r.diff,
      'نسبة التغير %': r.percent.toFixed(2),
      'الملاحظات': r.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cost Adjustments");
    
    if(!ws['!views']) ws['!views'] = [];
    ws['!views'].push({RTL: true});

    XLSX.writeFile(wb, `Cost_Adjustments_Report_${filters.from}_to_${filters.to}.xlsx`);
  };

  // --- دالة الطباعة ---
  const handlePrint = () => {
    const el = document.getElementById('cost-adj-table-print');
    if (!el) return;

    const branchName = getSelectedLocationName();
    
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      alert('المتصفح منع فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.');
      return;
    }

    const headerHtml = `
      <div style="text-align:center; border-bottom: 2px solid #000; padding-bottom:15px; margin-bottom:20px;">
        <h1 style="margin:0; font-size:24px;">3M GSC - GLOBAL SYSTEM COST</h1>
        <h2 style="margin:5px 0; font-size:18px;">تقرير سجل تعديلات التكلفة المعتمدة</h2>
        <div style="font-size:12px;">الموقع: ${branchName} | الفترة: من ${filters.from} إلى ${filters.to}</div>
      </div>
    `;

    const summaryHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-weight:bold; font-size:14px; background: #f9f9f9; padding: 15px; border: 1px solid #ddd;">
        <div>إجمالي الأصناف المعدلة: ${summary.totalItems}</div>
        <div>متوسط نسبة التغير: ${summary.avgChange.toFixed(2)}%</div>
      </div>
    `;

    const tableClone = el.cloneNode(true) as HTMLElement;
    tableClone.style.maxHeight = 'none';
    tableClone.style.overflow = 'visible';
    
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>طباعة تقرير تعديلات التكلفة</title>
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

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-500">
      
      {/* شريط الفلاتر المتقدم */}
      <div className="bg-sys-surface p-4 rounded-2xl border border-white/5 flex flex-wrap items-end gap-3 no-print shadow-lg">
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> من تاريخ</label>
          <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Calendar size={10}/> إلى تاريخ</label>
          <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none transition-all" />
        </div>
        <div className="space-y-1 min-w-[200px]">
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Building2 size={10}/> اختيار الموقع (مخزن / فرع)</label>
          <select value={filters.branchId} onChange={e => setFilters({...filters, branchId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none transition-all">
            <option value="all">كافة المواقع والمخازن</option>
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
          <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-wider px-1"><Search size={10}/> بحث في التعديلات</label>
          <input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="ابحث باسم الخامة أو كود السجل..." className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none shadow-inner" />
        </div>
        <div className="flex gap-2">
          <button onClick={reload} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-sm" title="تحديث السجلات"><RefreshCw size={18} /></button>
          <button onClick={handlePrint} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all shadow-sm" title="طباعة تقرير التعديلات"><Printer size={18} /></button>
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

      {/* لوحة التحكم والملخص (KPI Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-sys-primary"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-xl"><Edit3 size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">إجمالي الأصناف المعدلة</div>
              <div className="text-2xl font-black text-white">{summary.totalItems} <span className="text-[10px] font-normal opacity-40">صنف</span></div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-sys-warning"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sys-warning/10 text-sys-warning rounded-xl"><TrendingUp size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">متوسط تغير التكلفة</div>
              <div className={`text-2xl font-black ${summary.avgChange > 0 ? 'text-sys-danger' : 'text-sys-success'}`}>
                {summary.avgChange > 0 ? '+' : ''}{summary.avgChange.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <div className="bg-sys-surface border border-white/5 p-5 rounded-2xl relative overflow-hidden group shadow-xl">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-purple-500"></div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl"><Zap size={24} /></div>
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">أعلى نسبة انحراف</div>
              <div className="text-sm font-black text-white truncate max-w-[140px]">{summary.topSpike?.name || '-'}</div>
            </div>
          </div>
        </div>

        <div className="bg-sys-primary/5 border border-sys-primary/10 p-5 rounded-2xl flex flex-col justify-center shadow-lg">
          <div className="text-[10px] text-sys-primary font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
            <AlertCircle size={12} /> تقرير الرقابة السعرية
          </div>
          <div className="text-[11px] text-white/60 font-medium leading-relaxed italic">يتم رصد الفوارق بناءً على التكلفة السابقة والتكلفة الجديدة المعتمدة يدوياً.</div>
        </div>
      </div>

      {/* الجدول الرئيسي للبيانات */}
      <div className="flex-1 bg-sys-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText size={16} className="text-sys-primary" /> 
              ميزان مراجعة تعديلات التكلفة اليدوية
            </h3>
            <div className="text-[10px] text-white/30 italic uppercase tracking-wider">مرتب من الأحدث إلى الأقدم</div>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar" id="cost-adj-table-print">
          <table className="w-full text-right text-[11px] border-collapse min-w-[1100px]">
            <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase tracking-tighter shadow-md">
              <tr>
                <th className="p-4 border-b border-white/5">رقم السجل / التاريخ</th>
                <th className="p-4 border-b border-white/5">المادة الخام</th>
                <th className="p-4 border-b border-white/5">الموقع</th>
                <th className="p-4 border-b border-white/5 text-center">التكلفة السابقة</th>
                <th className="p-4 border-b border-white/5 text-center bg-white/5">التكلفة الجديدة</th>
                <th className="p-4 border-b border-white/5 text-center">فرق القيمة</th>
                <th className="p-4 border-b border-white/5 text-center">نسبة الانحراف</th>
                <th className="p-4 border-b border-white/5">البيان / السبب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {processedAdjustments.map((row, idx) => (
                <tr key={`${row.recordId}-${idx}`} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-white/80">{row.recordId}</div>
                    <div className="text-[9px] text-white/20 font-mono flex items-center gap-1"><Calendar size={10}/> {row.date}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-white group-hover:text-sys-primary transition-colors">{row.name}</div>
                    <div className="text-[9px] text-white/20 font-mono tracking-tighter">{row.itemId} • {row.unit}</div>
                  </td>
                  <td className="p-4 text-white/50">
                    <div className="flex items-center gap-1.5">
                      <Warehouse size={10} className="text-sys-primary/40" />
                      {row.branchName}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="text-white/40 line-through decoration-white/10">{formatNum(row.oldCost)}</div>
                  </td>
                  <td className="p-4 text-center bg-white/5">
                    <div className="font-black text-white text-sm tracking-tight">{formatNum(row.newCost)}</div>
                  </td>
                  <td className={`p-4 text-center font-bold ${row.diff > 0 ? 'text-sys-danger' : row.diff < 0 ? 'text-sys-success' : 'text-white/20'}`}>
                    {row.diff > 0 ? '+' : ''}{formatNum(row.diff)}
                  </td>
                  <td className="p-4 text-center">
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${row.percent > 0 ? 'bg-sys-danger/10 border-sys-danger/20 text-sys-danger' : row.percent < 0 ? 'bg-sys-success/10 border-sys-success/20 text-sys-success' : 'bg-white/5 border-white/5 text-white/20'}`}>
                      {row.percent > 0 ? <ArrowUpRight size={10}/> : row.percent < 0 ? <ArrowDownRight size={10}/> : null}
                      {Math.abs(row.percent).toFixed(1)}%
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-[10px] text-white/40 italic truncate max-w-[200px]" title={row.notes}>
                      {row.notes || 'تعديل يدوي للتكلفة'}
                    </div>
                  </td>
                </tr>
              ))}
              {processedAdjustments.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-24 text-center text-white/20 italic">
                    <PieChart size={48} className="mx-auto mb-4 opacity-5" />
                    لم يتم رصد أي عمليات تعديل تكلفة منفذة خلال هذه الفترة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* تذييل للطباعة */}
      <div className="hidden print:block mt-10 border-t-2 border-black pt-4 text-[10px]">
          <div className="flex justify-between items-center text-black font-bold">
              <div>نظام 3M GSC - وحدة التدقيق المالي (Audit Unit)</div>
              <div>تاريخ التقرير: {new Date().toLocaleString('ar-EG')}</div>
              <div>توقيع مراجع التكاليف: ..........................</div>
          </div>
          <div className="mt-4 text-[9px] text-gray-500 italic text-center">Confidential: Financial Costing Matrix Audit Trail</div>
      </div>
    </div>
  );
};

export default CostAdjustmentsReport;
