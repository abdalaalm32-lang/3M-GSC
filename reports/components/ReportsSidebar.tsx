import React from 'react';
import { 
  FileText, Package, History, ShoppingCart, 
  ArrowRightLeft, Edit3, Trash2, ChefHat, BarChart3, AlertTriangle, TrendingUp
} from 'lucide-react';
import { ReportKey } from '../types';

interface Props {
  activeReport: ReportKey;
  onSelect: (key: ReportKey) => void;
}

export const ReportsSidebar: React.FC<Props> = ({ activeReport, onSelect }) => {
  const reportsList = [
    { id: 'stockMovement', label: 'حركة المخزون', icon: History, desc: 'ميزان مراجعة الخامات (Audit)' },
    { id: 'purchaseAnalysis', label: 'تحليل المشتريات', icon: ShoppingCart, desc: 'حركة الخامات وتكاليف التوريد' },
    { id: 'stockLevels', label: 'مستويات المخزون', icon: Package, desc: 'الكميات الحالية وتكلفتها' },
    { id: 'productionOperations', label: 'عمليات الإنتاج', icon: ChefHat, desc: 'سجل استهلاك الوصفات' },
    { id: 'wasteReport', label: 'تقرير الهالك', icon: Trash2, desc: 'الخسائر المباشرة والفاقد' },
    { id: 'costAdjustments', label: 'تعديل التكلفة', icon: Edit3, desc: 'سجل التغييرات اليدوية' },
    { id: 'transfers', label: 'الصرف والتحويل', icon: ArrowRightLeft, desc: 'حركة المخازن البينية' },
    { id: 'movementAnalysis', label: 'تحليل الحركة', icon: BarChart3, desc: 'معدل الدوران والركود' },
  ];

  return (
    <div className="w-64 flex flex-col gap-2 shrink-0 no-print">
      <div className="p-4 bg-sys-surface border border-white/5 rounded-xl mb-2">
        <h2 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
          <FileText size={20} className="text-sys-primary" /> التقارير
        </h2>
        <p className="text-white/40 text-[10px]">مركز ذكاء الأعمال والرقابة</p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
        {reportsList.map((rep) => (
          <button 
            key={rep.id} 
            onClick={() => onSelect(rep.id as ReportKey)} 
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${activeReport === rep.id ? 'bg-sys-primary text-white border-sys-primary shadow-lg shadow-blue-900/20' : 'bg-sys-surface border-white/5 text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <div className={`p-2 rounded-lg ${activeReport === rep.id ? 'bg-white/20' : 'bg-white/5'}`}>
              <rep.icon size={18} />
            </div>
            <div className="text-right">
              <div className="font-bold text-xs">{rep.label}</div>
              <div className="text-[9px] opacity-60 truncate max-w-[130px]">{rep.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="p-4 bg-sys-surface-elevated rounded-xl border border-sys-warning/20">
        <div className="flex items-center gap-2 text-sys-warning mb-1">
          <AlertTriangle size={14} />
          <span className="text-[10px] font-bold">دقة البيانات</span>
        </div>
        <p className="text-[9px] text-white/40 leading-relaxed">
          جميع التقارير تعتمد على العمليات المرحلة فقط لضمان دقة الحسابات المالية.
        </p>
      </div>
    </div>
  );
};