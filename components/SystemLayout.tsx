import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { 
  LayoutDashboard, Package, ChefHat, ShoppingCart, Calculator, 
  FileText, Settings, LogOut, Menu, Bell, Search, Building2, 
  Store, ArrowRightLeft, ClipboardCheck, Edit3, Trash2, 
  Layers, PieChart, BarChart3, Lock, ShieldAlert, X, ShieldBan
} from 'lucide-react';

interface SystemLayoutProps {
  children: React.ReactNode;
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  tenantName: string;
  userName: string;
}

export const SystemLayout: React.FC<SystemLayoutProps> = ({ 
  children, activePage, onNavigate, onLogout, tenantName, userName
}) => {
  const { hasPermission } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAccessDeniedOpen, setIsAccessDeniedOpen] = useState(false);
  const [deniedModuleName, setDeniedModuleName] = useState('');
  const [shakingId, setShakingId] = useState<string | null>(null);

  const navItems = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    { id: 'pos', label: 'نقطة البيع (POS)', icon: Store },
    { id: 'inventory', label: 'إدارة المخزون', icon: Package },
    { id: 'transfers', label: 'أذونات الصرف والتحويل', icon: ArrowRightLeft },
    { id: 'stocktake', label: 'جرد المخزون', icon: ClipboardCheck },
    { id: 'recipes', label: 'الوصفات والإنتاج', icon: ChefHat },
    { id: 'production', label: 'عمليات الإنتاج', icon: Layers },
    { id: 'waste', label: 'الهالك', icon: Trash2 },
    { id: 'purchases', label: 'المشتريات', icon: ShoppingCart },
    { id: 'cost-adjustment', label: 'تعديل التكلفة', icon: Edit3 },
    { id: 'costing', label: 'محرك التكاليف', icon: Calculator },
    { id: 'menu-costing', label: 'Menu Costing', icon: PieChart },
    { id: 'menu-engineering', label: 'هندسة القائمة', icon: BarChart3 },
    { id: 'reports', label: 'التقارير', icon: FileText },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  const handleNavClick = (item: any) => {
    if (hasPermission(item.id)) {
      onNavigate(item.id);
    } else {
      setShakingId(item.id);
      setDeniedModuleName(item.label);
      setIsAccessDeniedOpen(true);
      setTimeout(() => setShakingId(null), 500);
      setTimeout(() => setIsAccessDeniedOpen(false), 3000);
    }
  };

  return (
    <div className="flex h-screen bg-sys-bg text-sys-text overflow-hidden font-sans relative">
      
      {/* Access Denied Shield Modal */}
      {isAccessDeniedOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center pointer-events-none p-6">
          <div className="bg-[#1a0a0a]/95 backdrop-blur-2xl border-2 border-sys-danger/50 rounded-[40px] p-10 shadow-[0_0_120px_rgba(239,68,68,0.4)] flex flex-col items-center gap-6 max-w-sm animate-in zoom-in duration-300 pointer-events-auto text-center">
            <div className="w-24 h-24 bg-sys-danger/20 text-sys-danger rounded-full flex items-center justify-center border border-sys-danger/40 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse">
              <ShieldBan size={56} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sys-danger font-black text-2xl uppercase tracking-tighter mb-2">وصول مقيد</h3>
              <p className="text-white/80 font-bold text-base mb-4 leading-relaxed">
                عذراً، ملفك الشخصي لا يمتلك <br/> صلاحية الدخول لقسم:
              </p>
              <div className="text-sys-danger bg-sys-danger/10 px-6 py-2 rounded-full font-black text-xl border border-sys-danger/20 inline-block shadow-lg">
                "{deniedModuleName}"
              </div>
            </div>
            <div className="w-full h-[1px] bg-white/10 my-2"></div>
            <p className="text-white/30 text-[10px] uppercase tracking-[0.2em] font-black">يرجى مراجعة مسؤول الشركة {tenantName}</p>
          </div>
          <div className="fixed inset-0 bg-sys-danger/5 pointer-events-none animate-pulse -z-10"></div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`bg-sys-surface border-l border-white/5 flex flex-col transition-all duration-300 relative z-20 ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <div className="h-20 flex items-center justify-center border-b border-white/5 bg-white/[0.01]">
          {!isSidebarCollapsed ? (
            <div className="flex flex-col items-center">
              <h1 className="text-2xl font-black bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent tracking-tighter">{tenantName}</h1>
              <span className="text-[9px] tracking-[0.3em] text-white/20 uppercase font-black">GSC SaaS Platform</span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-sys-primary flex items-center justify-center font-black text-xl text-white shadow-lg">{tenantName.substring(0,1)}</div>
          )}
        </div>

        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sys-primary to-blue-700 flex items-center justify-center text-sm font-black text-white border border-white/10 shadow-lg">
              {userName.substring(0,2).toUpperCase()}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black truncate text-white/90">{userName}</span>
                <span className="text-[9px] text-sys-success bg-sys-success/10 px-2 py-0.5 rounded-full w-fit mt-1 border border-sys-success/20 font-bold uppercase tracking-widest">متصل</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 py-6 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <ul className="space-y-1.5 px-3">
            {navItems.map((item) => {
              const allowed = hasPermission(item.id);
              const isActive = activePage === item.id;
              const isShaking = shakingId === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item)}
                    className={`
                      w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group relative
                      ${isActive 
                        ? 'bg-sys-primary text-white shadow-[0_10px_25px_-5px_rgba(59,130,246,0.5)] border border-white/10 z-10' 
                        : !allowed 
                          ? 'opacity-40 grayscale cursor-default hover:bg-sys-danger/5' 
                          : 'text-white/50 hover:bg-white/5 hover:text-white'
                      }
                      ${isSidebarCollapsed ? 'justify-center' : ''}
                      ${isShaking ? 'animate-[shake_0.4s_ease-in-out] border-sys-danger text-sys-danger opacity-100 grayscale-0' : ''}
                    `}
                  >
                    <div className="relative">
                      <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} className={`${isActive ? 'text-white' : !allowed ? 'text-white/20' : 'group-hover:text-sys-primary'}`} />
                      {!allowed && !isActive && (
                        <div className="absolute -top-2 -right-2 p-0.5 bg-sys-danger text-white rounded-full shadow-lg border border-sys-surface scale-[0.6]">
                          <Lock size={12} strokeWidth={4} />
                        </div>
                      )}
                    </div>
                    {!isSidebarCollapsed && <span className={`text-xs font-bold flex-1 text-right ${isActive ? 'text-white' : !allowed ? 'opacity-40 font-medium' : ''}`}>{item.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/5 bg-black/20">
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-sys-danger/70 hover:bg-sys-danger/10 hover:text-sys-danger transition-all font-bold text-xs">
            <LogOut size={18} />
            {!isSidebarCollapsed && <span>خروج آمن</span>}
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          50% { transform: translateX(10px); }
          75% { transform: translateX(-5px); }
        }
      `}</style>

      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
        <header className="h-20 bg-sys-surface/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2.5 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all">
              <Menu size={24} />
            </button>
            <div className="hidden lg:block text-white/20 font-black text-[10px] uppercase tracking-[0.4em]">Active Module: {activePage}</div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-sys-success/5 border border-sys-success/10 rounded-full text-[10px] text-sys-success font-black uppercase tracking-wider">
              <ShieldAlert size={14} /> <span>Security Active</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-white/20 uppercase font-black">المؤسسة</span>
                <span className="text-xs font-bold text-white">{tenantName}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner"><Building2 size={20} className="text-sys-warning" /></div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};
