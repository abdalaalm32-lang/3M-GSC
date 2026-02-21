import React from 'react';
import { Edit3, Calendar, RefreshCw, Printer } from 'lucide-react';
import { CostAdjustmentRecord, ReportFilters } from '../../types/reports';

interface Props {
    filters: ReportFilters;
    setFilters: (f: ReportFilters) => void;
    adjustmentRecords: CostAdjustmentRecord[];
    loadData: () => void;
}

export const CostAdjustmentsReport: React.FC<Props> = ({ filters, setFilters, adjustmentRecords, loadData }) => {
    return (
        <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
             <div className="bg-sys-surface p-4 rounded-xl border border-white/5 flex flex-wrap items-end gap-3 no-print shadow-sm">
                <div className="space-y-1"><label className="text-[10px] text-white/40 flex items-center gap-1"><Calendar size={10}/> من تاريخ</label><input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} className="bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-sys-primary" /></div>
                <div className="space-y-1"><label className="text-[10px] text-white/40 flex items-center gap-1"><Calendar size={10}/> إلى تاريخ</label><input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} className="bg-[#121212] border border-white/10 rounded-lg p-2 text-xs text-white outline-none focus:border-sys-primary" /></div>
                <div className="flex gap-2"><button onClick={loadData} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"><RefreshCw size={16} /></button><button onClick={() => window.print()} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all"><Printer size={16} /></button></div>
            </div>
            <div className="flex-1 bg-sys-surface border border-white/5 rounded-xl overflow-hidden flex flex-col shadow-inner">
                <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-2 text-sm font-bold text-white"><Edit3 size={16} className="text-sys-primary" /> سجل تعديلات التكلفة المعتمدة</div>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-right text-xs">
                        <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase">
                            <tr><th className="p-4 border-b border-white/5">رقم السجل</th><th className="p-4 border-b border-white/5">التاريخ</th><th className="p-4 border-b border-white/5">الفرع</th><th className="p-4 border-b border-white/5 text-center">عدد الأصناف</th><th className="p-4 border-b border-white/5">ملاحظات</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {adjustmentRecords.filter(adj => adj.date >= filters.from && adj.date <= filters.to && adj.status === 'مغلق').map((adj) => (
                                <tr key={adj.id} className="hover:bg-white/[0.03] transition-colors"><td className="p-4 text-white font-bold">{adj.id}</td><td className="p-4 text-white/60">{adj.date}</td><td className="p-4 text-white/60">{adj.branchName}</td><td className="p-4 text-center font-bold text-sys-primary">{adj.items.length}</td><td className="p-4 text-white/40 italic">{adj.notes || '-'}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};