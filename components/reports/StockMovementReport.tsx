import React, { useMemo } from 'react';
import { History, Calendar, Building2, Search, RefreshCw, Printer } from 'lucide-react';
import { StockItem, PurchaseOrder, ProductionRecord, WasteRecord, StocktakeRecord, PosSale, Recipe, Branch, ReportFilters } from '../../types/reports';

interface Props {
    filters: ReportFilters;
    setFilters: (f: ReportFilters) => void;
    items: StockItem[];
    purchaseOrders: PurchaseOrder[];
    productionLogs: ProductionRecord[];
    wasteRecords: WasteRecord[];
    stocktakes: StocktakeRecord[];
    sales: PosSale[];
    recipes: Recipe[];
    branches: Branch[];
    loadData: () => void;
}

export const StockMovementReport: React.FC<Props> = ({ 
    filters, setFilters, items, purchaseOrders, productionLogs, wasteRecords, stocktakes, sales, recipes, branches, loadData 
}) => {
    const movementReportData = useMemo(() => {
        return items
            .filter(item => item.active === 'نعم' && (filters.searchTerm === '' || item.name.includes(filters.searchTerm) || item.id.includes(filters.searchTerm)))
            .map(item => {
                const branchMatch = (bId?: string) => filters.branchId === 'all' || bId === filters.branchId;
                const dateMatch = (date: string) => date >= filters.from && date <= filters.to;

                const lastStocktakeBefore = stocktakes
                    .filter(st => st.status === 'مرحل' && st.date < filters.from && branchMatch(st.branchId))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                
                const openingQty = lastStocktakeBefore 
                    ? (lastStocktakeBefore.items.find(i => i.itemId === item.id)?.countedQty || 0)
                    : 0;

                let purchaseQty = 0;
                purchaseOrders.forEach(po => {
                    if (po.status === 'مكتمل' && dateMatch(po.date) && branchMatch(po.branchId)) {
                        const line = po.items.find(pi => pi.itemId === item.id);
                        if (line) purchaseQty += Number(line.quantity);
                    }
                });

                let prodInQty = 0;
                productionLogs.forEach(pl => {
                    if (pl.status === 'مرحل' && dateMatch(pl.date) && branchMatch(pl.branchId) && pl.productId === item.id) {
                        prodInQty += Number(pl.producedQty);
                    }
                });

                let salesConsQty = 0;
                sales.forEach(sale => {
                    if (sale.status === 'مكتمل' && dateMatch(sale.date) && branchMatch(sale.branchId)) {
                        sale.items.forEach(si => {
                            const recipe = recipes.find(r => r.menuItemId === si.itemId);
                            if (recipe) {
                                const ing = recipe.ingredients.find(ri => ri.stockItemId === item.id);
                                if (ing) {
                                    salesConsQty += (Number(si.qty) * Number(ing.qty)) / (Number(item.conversionFactor) || 1);
                                }
                            }
                        });
                    }
                });

                let prodOutQty = 0;
                productionLogs.forEach(pl => {
                    if (pl.status === 'مرحل' && dateMatch(pl.date) && branchMatch(pl.branchId)) {
                        const ing = pl.ingredients.find(i => i.stockItemId === item.id);
                        if (ing) prodOutQty += Number(ing.requiredQty);
                    }
                });

                let wasteQty = 0;
                wasteRecords.forEach(wr => {
                    if (wr.status === 'مرحل' && dateMatch(wr.date) && branchMatch(wr.branchId)) {
                        const line = wr.items.find(wi => wi.itemId === item.id);
                        if (line) wasteQty += Number(line.quantity);
                    }
                });

                const totalIn = purchaseQty + prodInQty;
                const totalOut = salesConsQty + prodOutQty + wasteQty;
                const bookBalance = openingQty + totalIn - totalOut;

                const currentStocktake = stocktakes
                    .filter(st => st.status === 'مرحل' && dateMatch(st.date) && branchMatch(st.branchId))
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                
                const physicalQty = currentStocktake 
                    ? (currentStocktake.items.find(i => i.itemId === item.id)?.countedQty || 0)
                    : item.currentStock;

                const varianceQty = physicalQty - bookBalance;
                const varianceValue = varianceQty * (item.avgCost || 0);

                return { itemId: item.id, name: item.name, unit: item.stockUnit, avgCost: item.avgCost, openingQty, purchaseQty, prodInQty, totalIn, salesConsQty, prodOutQty, wasteQty, totalOut, bookBalance, physicalQty, varianceQty, varianceValue };
            });
    }, [items, filters, purchaseOrders, productionLogs, wasteRecords, stocktakes, sales, recipes]);

    const summary = useMemo(() => {
        const totalVarValue = movementReportData.reduce((s, r) => s + r.varianceValue, 0);
        const discrepancyCount = movementReportData.filter(r => Math.abs(r.varianceQty) > 0.001).length;
        return { totalVarValue, discrepancyCount };
    }, [movementReportData]);

    return (
        <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
            <div className="bg-sys-surface p-4 rounded-xl border border-white/5 flex flex-wrap items-end gap-3 no-print shadow-sm">
                <div className="space-y-1">
                    <label className="text-[10px] text-white/40 flex items-center gap-1"><Calendar size={10}/> من تاريخ</label>
                    <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white focus:border-sys-primary outline-none" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] text-white/40 flex items-center gap-1"><Calendar size={10}/> إلى تاريخ</label>
                    <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white focus:border-sys-primary outline-none" />
                </div>
                <div className="space-y-1 min-w-[140px]">
                    <label className="text-[10px] text-white/40 flex items-center gap-1"><Building2 size={10}/> الفرع</label>
                    <select value={filters.branchId} onChange={e => setFilters({...filters, branchId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white focus:border-sys-primary outline-none">
                        <option value="all">كافة الفروع</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div className="flex-1 min-w-[180px] space-y-1">
                    <label className="text-[10px] text-white/40 flex items-center gap-1"><Search size={10}/> بحث سريع</label>
                    <input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="اسم المادة الخام..." className="w-full bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white focus:border-sys-primary outline-none" />
                </div>
                <div className="flex gap-2">
                    <button onClick={loadData} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"><RefreshCw size={16} /></button>
                    <button onClick={() => window.print()} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"><Printer size={16} /></button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 no-print">
                <div className="bg-sys-surface border-r-4 border-r-sys-danger p-4 rounded-xl border border-white/5">
                    <div className="text-[10px] text-white/30 font-bold uppercase mb-1">صافي التباين المالي</div>
                    <div className={`text-xl font-black ${summary.totalVarValue < 0 ? 'text-sys-danger' : 'text-sys-success'}`}>{summary.totalVarValue.toLocaleString()} ج.م</div>
                </div>
                <div className="bg-sys-surface border-r-4 border-r-sys-warning p-4 rounded-xl border border-white/5">
                    <div className="text-[10px] text-white/30 font-bold uppercase mb-1">مواد بها فروقات</div>
                    <div className="text-xl font-black text-white">{summary.discrepancyCount} صنف</div>
                </div>
                <div className="bg-sys-surface border-r-4 border-r-sys-primary p-4 rounded-xl border border-white/5">
                    <div className="text-[10px] text-white/30 font-bold uppercase mb-1">دقة المخزون</div>
                    <div className="text-xl font-black text-white">{((1 - (summary.discrepancyCount / items.length)) * 100).toFixed(1)}%</div>
                </div>
            </div>

            <div className="flex-1 bg-sys-surface border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-inner">
                <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><History size={16} className="text-sys-primary" /> ميزان مراجعة حركة المخزون (Inventory Audit)</h3>
                    <div className="text-[10px] text-white/30 font-mono">الرصيد الدفتري = (أول + وارد) - (مبيعات + إنتاج + هالك)</div>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-right text-[10px] border-collapse min-w-[1200px]">
                        <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase shadow-md">
                            <tr>
                                <th rowSpan={2} className="p-3 border-b border-white/10 border-l border-white/5 min-w-[150px]">الخامة</th>
                                <th rowSpan={2} className="p-3 border-b border-white/10 text-center bg-white/[0.02]">أول المدة</th>
                                <th colSpan={2} className="p-2 border-b border-white/10 text-center bg-green-900/10 text-green-400">الوارد</th>
                                <th colSpan={3} className="p-2 border-b border-white/10 text-center bg-orange-900/10 text-orange-400">المنصرف</th>
                                <th rowSpan={2} className="p-3 border-b border-white/10 text-center bg-white/5 text-white">الدفتري</th>
                                <th rowSpan={2} className="p-3 border-b border-white/10 text-center bg-sys-primary/10 text-sys-primary font-black">الفعلي</th>
                                <th colSpan={2} className="p-2 border-b border-white/10 text-center bg-red-900/10 text-red-400">التباين</th>
                            </tr>
                            <tr className="bg-[#151515]">
                                <th className="p-2 border-b border-white/5 text-center opacity-60">مشتريات</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">إنتاج (و)</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">مبيعات</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">إنتاج (خ)</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">هالك</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">كمية</th>
                                <th className="p-2 border-b border-white/5 text-center opacity-60">قيمة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {movementReportData.map((row) => (
                                <tr key={row.itemId} className="hover:bg-white/[0.03] transition-colors group">
                                    <td className="p-3 border-l border-white/5">
                                        <div className="font-bold text-white">{row.name}</div>
                                        <div className="text-[9px] text-white/20">{row.itemId} • {row.unit}</div>
                                    </td>
                                    <td className="p-3 text-center text-white/50">{row.openingQty.toLocaleString()}</td>
                                    <td className="p-3 text-center text-green-400/60">{row.purchaseQty.toLocaleString()}</td>
                                    <td className="p-3 text-center text-green-400/60">{row.prodInQty.toLocaleString()}</td>
                                    <td className="p-3 text-center text-orange-400/60">{row.salesConsQty.toFixed(2)}</td>
                                    <td className="p-3 text-center text-orange-400/60">{row.prodOutQty.toFixed(2)}</td>
                                    <td className="p-3 text-center text-sys-danger font-bold">{row.wasteQty || '-'}</td>
                                    <td className="p-3 text-center bg-white/[0.02] font-medium text-white/70">{row.bookBalance.toFixed(2)}</td>
                                    <td className="p-3 text-center bg-sys-primary/5 font-black text-white">{row.physicalQty.toLocaleString()}</td>
                                    <td className={`p-3 text-center font-black ${row.varianceQty < 0 ? 'text-sys-danger' : row.varianceQty > 0 ? 'text-sys-success' : 'text-white/20'}`}>
                                        {row.varianceQty !== 0 ? (row.varianceQty > 0 ? '+' : '') + row.varianceQty.toFixed(2) : '-'}
                                    </td>
                                    <td className={`p-3 text-center font-bold ${row.varianceValue < 0 ? 'text-sys-danger bg-sys-danger/5' : 'text-white/10'}`}>
                                        {row.varianceValue !== 0 ? row.varianceValue.toFixed(2) : '-'}
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