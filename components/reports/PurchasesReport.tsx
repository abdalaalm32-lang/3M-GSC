import React, { useMemo } from 'react';
import { ShoppingCart, Calendar, Briefcase, Search, RefreshCw, Printer } from 'lucide-react';
import { PurchaseOrder, Supplier, ReportFilters } from '../../types/reports';

interface Props {
    filters: ReportFilters;
    setFilters: (f: ReportFilters) => void;
    purchaseOrders: PurchaseOrder[];
    suppliers: Supplier[];
    loadData: () => void;
}

export const PurchasesReport: React.FC<Props> = ({ filters, setFilters, purchaseOrders, suppliers, loadData }) => {
    const purchaseReportData = useMemo(() => {
        const aggregated: Record<string, any> = {};
        purchaseOrders
            .filter(po => po.status === 'مكتمل' && po.date >= filters.from && po.date <= filters.to && (filters.supplierId === 'all' || po.supplierId === filters.supplierId))
            .forEach(po => {
                po.items.forEach(item => {
                    if (filters.searchTerm === '' || item.name.includes(filters.searchTerm)) {
                        if (!aggregated[item.itemId]) aggregated[item.itemId] = { itemId: item.itemId, name: item.name, unit: item.unit, totalQty: 0, totalCost: 0 };
                        aggregated[item.itemId].totalQty += item.quantity;
                        aggregated[item.itemId].totalCost += item.total;
                    }
                });
            });
        return Object.values(aggregated).map((row: any) => ({ ...row, avgCost: row.totalQty > 0 ? row.totalCost / row.totalQty : 0 }));
    }, [purchaseOrders, filters]);

    const totalValue = purchaseReportData.reduce((s, r) => s + r.totalCost, 0);

    return (
        <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
            <div className="bg-sys-surface p-4 rounded-xl border border-white/5 flex flex-wrap items-end gap-3 no-print">
                <div className="space-y-1"><label className="text-[10px] text-white/40 flex items-center gap-1"><Calendar size={10}/> من تاريخ</label><input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-sys-primary" /></div>
                <div className="space-y-1"><label className="text-[10px] text-white/40 flex items-center gap-1"><Calendar size={10}/> إلى تاريخ</label><input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-sys-primary" /></div>
                <div className="space-y-1 min-w-[140px]"><label className="text-[10px] text-white/40 flex items-center gap-1"><Briefcase size={10}/> المورد</label><select value={filters.supplierId} onChange={e => setFilters({...filters, supplierId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-sys-primary"><option value="all">كل الموردين</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div className="flex-1 min-w-[180px] space-y-1"><label className="text-[10px] text-white/40 flex items-center gap-1"><Search size={10}/> بحث بالخامة</label><input type="text" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})} placeholder="اسم الخامة..." className="w-full bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-sys-primary" /></div>
                <div className="flex gap-2"><button onClick={loadData} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"><RefreshCw size={16} /></button><button onClick={() => window.print()} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"><Printer size={16} /></button></div>
            </div>
            
            <div className="bg-sys-surface border-r-4 border-r-sys-success p-4 rounded-xl border border-white/5 shadow-sm">
                <div className="text-[10px] text-white/30 font-bold uppercase mb-1">إجمالي قيمة المشتريات للفترة</div>
                <div className="text-xl font-black text-white">{totalValue.toLocaleString()} ج.م</div>
            </div>

            <div className="flex-1 bg-sys-surface border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-inner">
                <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-2 text-sm font-bold text-white"><ShoppingCart size={16} className="text-sys-primary" /> تحليل المشتريات حسب الخامة</div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-right text-[11px] border-separate border-spacing-0">
                        <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase">
                            <tr><th className="p-4 border-b border-white/5">كود</th><th className="p-4 border-b border-white/5">الخامة</th><th className="p-4 border-b border-white/5 text-center">الوحدة</th><th className="p-4 border-b border-white/5 text-center">الكمية المشتراة</th><th className="p-4 border-b border-white/5 text-center">متوسط التكلفة</th><th className="p-4 border-b border-white/5 text-center bg-white/5">إجمالي القيمة</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {purchaseReportData.map((row: any) => (
                                <tr key={row.itemId} className="hover:bg-white/[0.03] transition-colors"><td className="p-4 text-white/30 font-mono">{row.itemId}</td><td className="p-4 font-bold text-white">{row.name}</td><td className="p-4 text-center text-white/40">{row.unit}</td><td className="p-4 text-center font-bold text-white">{row.totalQty.toLocaleString()}</td><td className="p-4 text-center text-sys-success font-medium">{row.avgCost.toFixed(2)}</td><td className="p-4 text-center bg-white/5 text-sys-warning font-black">{row.totalCost.toLocaleString()}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};