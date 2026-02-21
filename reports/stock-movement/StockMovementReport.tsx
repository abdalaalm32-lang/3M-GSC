
import React, { useMemo, useState, useEffect } from 'react';
import { History, Calendar, Building2, Search, RefreshCw, Printer, Download, FileSpreadsheet, Loader2, Warehouse, ArrowRight, DollarSign, ArrowLeftRight } from 'lucide-react';
import { ReportsData } from '../hooks/useReportsData';
import { ReportFilters } from '../hooks/useReportFilters';
import * as XLSX from 'xlsx';

interface Props extends ReportsData {
  filters: ReportFilters;
  setFilters: (f: ReportFilters) => void;
}

const StockMovementReport: React.FC<Props> = ({ 
    filters, setFilters, items, purchaseOrders, productionLogs, wasteRecords, stocktakes, sales, recipes, branches, transferRecords, reload 
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);

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

    const movementReportData = useMemo(() => {
        return items
            .filter(item => item.active === 'نعم' && (filters.searchTerm === '' || item.name.includes(filters.searchTerm) || item.id.includes(filters.searchTerm)))
            .map(item => {
                const branchMatch = (bId?: string) => filters.branchId === 'all' || bId === filters.branchId;
                const dateMatch = (date: string) => date >= filters.from && date <= filters.to;

                // 1. رصيد أول المدة (Opening Balance)
                const lastStocktakeBefore = stocktakes
                    .filter(st => st.status === 'مرحل' && st.date < filters.from && branchMatch(st.branchId))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                
                const openingQty = lastStocktakeBefore 
                    ? (lastStocktakeBefore.items.find(i => i.itemId === item.id)?.countedQty || 0)
                    : 0;

                // 2. الوارد (IN)
                let purchaseQty = 0; // مشتريات
                purchaseOrders.forEach(po => {
                    const poLocId = (po as any).warehouseId || po.branchId;
                    if (po.status === 'مكتمل' && dateMatch(po.date) && branchMatch(poLocId)) {
                        const line = po.items.find(pi => pi.itemId === item.id);
                        if (line) purchaseQty += Number(line.quantity);
                    }
                });

                let prodInQty = 0; // إنتاج (وارد)
                productionLogs.forEach(pl => {
                    if (pl.status === 'مرحل' && dateMatch(pl.date) && branchMatch(pl.branchId) && pl.productId === item.id) {
                        prodInQty += Number(pl.producedQty);
                    }
                });

                let transfersInQty = 0; // استلامات (تحويلات واردة)
                transferRecords.forEach(tr => {
                    if (tr.status === 'مرحل' && dateMatch(tr.date) && branchMatch(tr.destinationId)) {
                        const line = tr.items.find(ti => ti.itemId === item.id);
                        if (line) transfersInQty += Number(line.quantity);
                    }
                });

                // 3. المنصرف (OUT)
                let transfersOutQty = 0; // تحويلات (منصرف)
                transferRecords.forEach(tr => {
                    if (tr.status === 'مرحل' && dateMatch(tr.date) && branchMatch(tr.sourceId)) {
                        const line = tr.items.find(ti => ti.itemId === item.id);
                        if (line) transfersOutQty += Number(line.quantity);
                    }
                });

                let consumptionQty = 0; // استهلاك (مبيعات + خامات إنتاج)
                // أ- استهلاك المبيعات
                sales.forEach(sale => {
                    if (sale.status === 'مكتمل' && dateMatch(sale.date) && branchMatch(sale.branchId)) {
                        sale.items.forEach(si => {
                            const recipe = recipes.find(r => r.menuItemId === si.itemId);
                            if (recipe) {
                                const ing = recipe.ingredients.find(ri => ri.stockItemId === item.id);
                                if (ing) {
                                    consumptionQty += (Number(si.qty) * Number(ing.qty)) / (Number(item.conversionFactor) || 1);
                                }
                            }
                        });
                    }
                });
                // ب- استهلاك خامات الإنتاج
                productionLogs.forEach(pl => {
                    if (pl.status === 'مرحل' && dateMatch(pl.date) && branchMatch(pl.branchId)) {
                        const ing = pl.ingredients.find(i => i.stockItemId === item.id);
                        if (ing) consumptionQty += Number(ing.requiredQty);
                    }
                });

                let wasteQty = 0; // هالك
                wasteRecords.forEach(wr => {
                    if (wr.status === 'مرحل' && dateMatch(wr.date) && branchMatch(wr.branchId)) {
                        const line = wr.items.find(wi => wi.itemId === item.id);
                        if (line) wasteQty += Number(line.quantity);
                    }
                });

                const totalIn = purchaseQty + prodInQty + transfersInQty;
                const totalOut = transfersOutQty + consumptionQty + wasteQty;
                
                // الرصيد الدفتري
                const bookBalance = openingQty + totalIn - totalOut;

                // 4. الرصيد الفعلي (الجرد) - تم تعديل المنطق هنا بناءً على طلبك
                const currentStocktake = stocktakes
                    .filter(st => st.status === 'مرحل' && dateMatch(st.date) && branchMatch(st.branchId))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                
                // تكون بصفر إلا في حالة واحدة عند وجود جرد فعلي مسجل على السيستم لهذا الصنف
                const physicalQty = currentStocktake 
                    ? (currentStocktake.items.find(i => i.itemId === item.id)?.countedQty || 0)
                    : 0;

                const varianceQty = physicalQty - bookBalance;
                const varianceValue = varianceQty * (item.avgCost || 0);

                return { 
                    itemId: item.id, name: item.name, unit: item.stockUnit, avgCost: item.avgCost, 
                    openingQty, purchaseQty, prodInQty, transfersInQty, totalIn, 
                    transfersOutQty, consumptionQty, wasteQty, totalOut, 
                    bookBalance, physicalQty, varianceQty, varianceValue 
                };
            });
    }, [items, filters, purchaseOrders, productionLogs, wasteRecords, stocktakes, sales, recipes, transferRecords]);

    const summary = useMemo(() => {
        const totalVarValue = movementReportData.reduce((s, r) => s + r.varianceValue, 0);
        const discrepancyCount = movementReportData.filter(r => Math.abs(r.varianceQty) > 0.001).length;
        return { totalVarValue, discrepancyCount };
    }, [movementReportData]);

    const locationInfo = useMemo(() => {
        if (filters.branchId === 'all') return { name: 'كافة المواقع', type: 'إجمالي' };
        const wh = warehouses.find(w => w.id === filters.branchId);
        if (wh) return { name: wh.name, type: 'مخزن' };
        const br = branches.find(b => b.id === filters.branchId);
        if (br) return { name: br.name, type: 'فرع' };
        return { name: 'موقع غير معروف', type: '-' };
    }, [filters.branchId, warehouses, branches]);

    const formatNum = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handleExportExcel = () => {
        setIsExporting(true);
        try {
            const data = movementReportData.map(row => ({
                'الكود': row.itemId,
                'الخامة': row.name,
                'الوحدة': row.unit,
                'أول المدة': row.openingQty,
                'مشتريات': row.purchaseQty,
                'إنتاج (وارد)': row.prodInQty,
                'استلامات تحويل': row.transfersInQty,
                'تحويلات (منصرف)': row.transfersOutQty,
                'استهلاك (مبيعات/إنتاج)': row.consumptionQty,
                'هالك': row.wasteQty,
                'الدفتري': row.bookBalance,
                'الفعلي (جرد)': row.physicalQty,
                'التباين': row.varianceQty
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "حركة المخزون");
            if(!ws['!views']) ws['!views'] = [];
            ws['!views'].push({RTL: true});
            XLSX.writeFile(wb, `Movement_Report_${locationInfo.name}_${filters.to}.xlsx`);
        } catch (e) {
            alert('حدث خطأ أثناء التصدير');
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrintReport = () => {
        const rowsHtml = movementReportData.map((row, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td style="font-weight:bold;">${row.name} (${row.itemId})</td>
                <td style="text-align:center;">${row.unit}</td>
                <td style="text-align:center;">${row.openingQty.toFixed(2)}</td>
                <td style="text-align:center;">${row.purchaseQty.toFixed(2)}</td>
                <td style="text-align:center;">${row.prodInQty.toFixed(2)}</td>
                <td style="text-align:center;">${row.transfersInQty.toFixed(2)}</td>
                <td style="text-align:center;">${row.transfersOutQty.toFixed(2)}</td>
                <td style="text-align:center;">${row.consumptionQty.toFixed(2)}</td>
                <td style="text-align:center; background:#fff1f1;">${row.wasteQty.toFixed(2)}</td>
                <td style="text-align:center; background:#f9f9f9;">${row.bookBalance.toFixed(2)}</td>
                <td style="text-align:center; font-weight:bold; background:#eef2ff;">${row.physicalQty.toFixed(2)}</td>
                <td style="text-align:center; font-weight:bold; color:${row.varianceQty < 0 ? 'red' : 'green'};">${row.varianceQty.toFixed(2)}</td>
            </tr>
        `).join('');

        const html = `
            <html dir="rtl" lang="ar">
            <head>
                <title>ميزان حركة المخزون - ${locationInfo.name}</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: 'Segoe UI', sans-serif; font-size: 10px; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
                    .meta { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 5px; text-align: right; }
                    th { background: #f2f2f2; }
                    .type-badge { background: #000; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>3M GSC - GLOBAL SYSTEM COST</h1>
                    <h2>تقرير ميزان مراجعة حركة المخزون</h2>
                </div>
                <div class="meta">
                    <div>الموقع: ${locationInfo.name} <span class="type-badge">${locationInfo.type}</span></div>
                    <div>الفترة: من ${filters.from} إلى ${filters.to}</div>
                    <div>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>الخامة / الصنف</th>
                            <th>الوحدة</th>
                            <th>أول المدة</th>
                            <th>مشتريات</th>
                            <th>إنتاج (و)</th>
                            <th>استلامات</th>
                            <th>تحويلات</th>
                            <th>استهلاك</th>
                            <th>هالك</th>
                            <th>الدفتري</th>
                            <th>الفعلي</th>
                            <th>التباين</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
                <script>window.onload = () => { window.print(); window.close(); }</script>
            </body>
            </html>
        `;

        const w = window.open('', '_blank', 'width=1100,height=800');
        if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    };

    return (
        <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
            {isExporting && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center no-print">
                    <div className="bg-sys-surface p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-4 shadow-2xl">
                        <Loader2 className="text-sys-primary animate-spin" size={48} />
                        <p className="text-white font-bold animate-pulse">جاري تحضير مصفوفة البيانات...</p>
                    </div>
                </div>
            )}

            {/* Filters Bar */}
            <div className="bg-sys-surface p-4 rounded-xl border border-white/5 flex flex-wrap items-end gap-3 no-print shadow-sm">
                <div className="space-y-1">
                    <label className="text-[10px] text-white/40 flex items-center gap-1"><Calendar size={10}/> من تاريخ</label>
                    <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white focus:border-sys-primary outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-white/40 flex items-center gap-1"><Calendar size={10}/> إلى تاريخ</label>
                    <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white focus:border-sys-primary outline-none" />
                </div>
                <div className="space-y-1 min-w-[220px]">
                    <label className="text-[10px] text-white/40 flex items-center gap-1"><Building2 size={10}/> الموقع (مخزن / فرع)</label>
                    <select value={filters.branchId} onChange={e => setFilters({...filters, branchId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white focus:border-sys-primary outline-none">
                        <option value="all">كافة الفروع والمخازن</option>
                        {warehouses.length > 0 && (
                            <optgroup label="المخازن" className="bg-[#1e1e1e] text-sys-primary font-bold">
                                {warehouses.map(w => <option key={w.id} value={w.id}>📦 {w.name} (مخزن)</option>)}
                            </optgroup>
                        )}
                        {branches.length > 0 && (
                            <optgroup label="الفروع" className="bg-[#1e1e1e] text-sys-warning font-bold">
                                {branches.map(b => <option key={b.id} value={b.id}>🏪 {b.name} (فرع)</option>)}
                            </optgroup>
                        )}
                    </select>
                </div>
                <div className="flex-1 min-w-[180px] space-y-1">
                    <label className="text-[10px] text-white/40 flex items-center gap-1"><Search size={10}/> بحث سريع</label>
                    <input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="اسم الخامة أو الكود..." className="w-full bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white focus:border-sys-primary outline-none" />
                </div>
                <div className="flex gap-2">
                    <button onClick={reload} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all shadow-sm"><RefreshCw size={16} /></button>
                    <button onClick={handlePrintReport} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all shadow-sm"><Printer size={16} /></button>
                    <button onClick={handleExportExcel} className="bg-sys-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-black shadow-lg transition-all flex items-center gap-2">
                        <FileSpreadsheet size={16} /> Excel
                    </button>
                </div>
            </div>

            {/* Summaries */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
                <div className="bg-sys-surface border-r-4 border-r-sys-primary p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-[10px] text-white/30 font-bold uppercase mb-1">الموقع المختار</div>
                    <div className="text-sm font-black text-white">{locationInfo.name}</div>
                    <div className="text-[9px] text-sys-primary font-bold uppercase">{locationInfo.type} نشط</div>
                </div>
                <div className="bg-sys-surface border-r-4 border-r-sys-danger p-4 rounded-xl border border-white/5">
                    <div className="text-[10px] text-white/30 font-bold uppercase mb-1">صافي التباين المالي</div>
                    <div className={`text-xl font-black ${summary.totalVarValue < 0 ? 'text-sys-danger' : 'text-sys-success'}`}>{formatNum(summary.totalVarValue)} ج.م</div>
                </div>
                <div className="bg-sys-surface border-r-4 border-r-sys-warning p-4 rounded-xl border border-white/5">
                    <div className="text-[10px] text-white/30 font-bold uppercase mb-1">مواد بها فروقات جرد</div>
                    <div className="text-xl font-black text-white">{summary.discrepancyCount} صنف</div>
                </div>
                <div className="bg-sys-surface border-r-4 border-r-sys-success p-4 rounded-xl border border-white/5">
                    <div className="text-[10px] text-white/30 font-bold uppercase mb-1">دقة المخزون المادي</div>
                    <div className="text-xl font-black text-white">{((1 - (summary.discrepancyCount / (items.length || 1))) * 100).toFixed(1)}%</div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 bg-sys-surface border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-inner relative">
                <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><History size={16} className="text-sys-primary" /> ميزان مراجعة حركة المخزون (Inventory Audit Grid)</h3>
                    <div className="text-[10px] text-white/30 font-mono hidden md:block">دفتري = (أول + مشتريات + إنتاج + استلامات) - (تحويلات + استهلاك + هالك)</div>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-right text-[10px] border-collapse min-w-[1300px]">
                        <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase shadow-md">
                            <tr>
                                <th rowSpan={2} className="p-3 border-b border-white/10 border-l border-white/5 min-w-[150px]">الخامة / كود</th>
                                <th rowSpan={2} className="p-3 border-b border-white/10 text-center bg-white/[0.02]">أول المدة</th>
                                <th colSpan={3} className="p-2 border-b border-white/10 text-center bg-green-900/10 text-green-400">الوارد (IN)</th>
                                <th colSpan={3} className="p-2 border-b border-white/10 text-center bg-orange-900/10 text-orange-400">المنصرف (OUT)</th>
                                <th rowSpan={2} className="p-3 border-b border-white/10 text-center bg-white/5 text-white">الدفتري</th>
                                <th rowSpan={2} className="p-3 border-b border-white/10 text-center bg-sys-primary/10 text-sys-primary font-black">الفعلي (جرد)</th>
                                <th colSpan={2} className="p-2 border-b border-white/10 text-center bg-red-900/10 text-red-400">التباين</th>
                            </tr>
                            <tr className="bg-[#151515]">
                                <th className="p-2 border-b border-white/5 text-center opacity-60">مشتريات</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">إنتاج (و)</th>
                                <th className="p-2 border-b border-white/5 text-center bg-green-900/20 text-white font-bold">استلامات</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">تحويلات</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">استهلاك</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">هالك</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">كمية</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">قيمة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {movementReportData.map((row) => (
                                <tr key={row.itemId} className="hover:bg-white/[0.03] transition-colors group">
                                    <td className="p-3 border-l border-white/5">
                                        <div className="font-bold text-white group-hover:text-sys-primary transition-colors">{row.name}</div>
                                        <div className="text-[9px] text-white/20 font-mono tracking-tighter uppercase">{row.itemId} • {row.unit}</div>
                                    </td>
                                    <td className="p-3 text-center text-white/50">{formatNum(row.openingQty)}</td>
                                    <td className="p-3 text-center text-green-400/60">{formatNum(row.purchaseQty)}</td>
                                    <td className="p-3 text-center text-green-400/60">{formatNum(row.prodInQty)}</td>
                                    <td className="p-3 text-center bg-green-900/5 text-white font-bold">{formatNum(row.transfersInQty)}</td>
                                    <td className="p-3 text-center text-orange-400/60">{formatNum(row.transfersOutQty)}</td>
                                    <td className="p-3 text-center text-orange-400/60">{formatNum(row.consumptionQty)}</td>
                                    <td className="p-3 text-center text-sys-danger font-bold">{row.wasteQty > 0 ? formatNum(row.wasteQty) : '-'}</td>
                                    <td className="p-3 text-center bg-white/[0.02] font-medium text-white/70">{formatNum(row.bookBalance)}</td>
                                    <td className="p-3 text-center bg-sys-primary/5 font-black text-white">{formatNum(row.physicalQty)}</td>
                                    <td className={`p-3 text-center font-black ${row.varianceQty < 0 ? 'text-sys-danger' : row.varianceQty > 0 ? 'text-sys-success' : 'text-white/20'}`}>
                                        {row.varianceQty !== 0 ? (row.varianceQty > 0 ? '+' : '') + formatNum(row.varianceQty) : '-'}
                                    </td>
                                    <td className={`p-3 text-center font-bold ${row.varianceValue < 0 ? 'text-sys-danger bg-sys-danger/5' : row.varianceValue > 0 ? 'text-sys-success' : 'text-white/10'}`}>
                                        {row.varianceValue !== 0 ? formatNum(row.varianceValue) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockMovementReport;
