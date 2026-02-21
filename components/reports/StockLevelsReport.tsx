import React, { useMemo } from 'react';
import { Package, Search, ListFilter, AlertTriangle, RefreshCw, Printer } from 'lucide-react';
import { StockItem, ReportFilters } from '../../types/reports';

interface Props {
    filters: ReportFilters;
    setFilters: (f: ReportFilters) => void;
    items: StockItem[];
    loadData: () => void;
}

export const StockLevelsReport: React.FC<Props> = ({ filters, setFilters, items, loadData }) => {
    const filteredStockData = useMemo(() => {
        return items.filter(item => {
            const matchesSearch = filters.searchTerm === '' || item.name.includes(filters.searchTerm) || item.id.includes(filters.searchTerm);
            const matchesStock = filters.stockFilter === 'all' || item.currentStock <= item.reorderLevel;
            return matchesSearch && matchesStock && item.active === 'نعم';
        });
    }, [items, filters.searchTerm, filters.stockFilter]);

    const totalValue = filteredStockData.reduce((s, r) => s + (r.currentStock * r.avgCost), 0);

    return (
        <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
            <div className="bg-sys-surface p-4 rounded-xl border border-white/5 flex flex-wrap items-end gap-3 no-print">
                <div className="space-y-1 min-w-[140px]"><label className="text-[10px] text-white/40 flex items-center gap-1"><ListFilter size={10}/> التصفية</label><select value={filters.stockFilter} onChange={e => setFilters({...filters, stockFilter: e.target.value as any})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-sys-primary"><option value="all">كافة الأصناف</option><option value="low">تحت حد الطلب</option></select></div>
                <div className="flex-1 min-w-[200px] space-y-1"><label className="text-[10px] text-white/40 flex items-center gap-1"><Search size={10}/> بحث سريع</label><input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="اسم الصنف أو الكود..." className="w-full bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-sys-primary" /></div>
                <div className="flex gap-2"><button onClick={loadData} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"><RefreshCw size={16} /></button><button onClick={() => window.print()} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"><Printer size={16} /></button></div>
            </div>

            <div className="bg-sys-surface border-r-4 border-r-sys-primary p-4 rounded-xl border border-white/5 shadow-sm">
                <div className="text-[10px] text-white/30 font-bold uppercase mb-1">إجمالي قيمة الأرصدة الحالية</div>
                <div className="text-xl font-black text-white">{totalValue.toLocaleString()} ج.م</div>
            </div>

            <div className="flex-1 bg-sys-surface border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-inner">
                <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-2 text-sm font-bold text-white"><Package size={16} className="text-sys-primary" /> مستويات المخزون الحالية</div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-right text-xs border-separate border-spacing-0">
                        <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase">
                            <tr><th className="p-4 border-b border-white/5">كود</th><th className="p-4 border-b border-white/5">اسم الصنف</th><th className="p-4 border-b border-white/5 text-center">الرصيد الحالي</th><th className="p-4 border-b border-white/5 text-center">حد الطلب</th><th className="p-4 border-b border-white/5 text-center">متوسط التكلفة</th><th className="p-4 border-b border-white/5 text-center bg-white/5">إجمالي القيمة</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredStockData.map((item) => {
                                const isLow = item.currentStock <= item.reorderLevel;
                                return (
                                    <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group">
                                        <td className="p-4 text-white/30 font-mono">{item.id}</td>
                                        <td className="p-4 font-bold text-white">{item.name} {isLow && <AlertTriangle size={12} className="inline text-sys-warning ml-1" />}</td>
                                        <td className={`p-4 text-center font-bold ${isLow ? 'text-sys-danger' : 'text-white'}`}>{item.currentStock.toLocaleString()}</td>
                                        <td className="p-4 text-center text-white/30">{item.reorderLevel}</td>
                                        <td className="p-4 text-center text-white/60">{item.avgCost.toFixed(2)}</td>
                                        <td className="p-4 text-center bg-white/5 font-black text-sys-primary">{(item.currentStock * item.avgCost).toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};