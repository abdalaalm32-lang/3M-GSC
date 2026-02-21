
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { SystemLayout } from './components/SystemLayout';
import { CreateCompany } from './pages/CreateCompany';
import { Dashboard } from './pages/Dashboard';
import { SettingsPage } from './pages/SettingsPage';
import { PosPage } from './pages/PosPage';
import { InventoryPage } from './pages/InventoryPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { RecipesPage } from './pages/RecipesPage';
import { TransfersPage } from './pages/TransfersPage';
import { StocktakePage } from './pages/StocktakePage';
import { CostingPage } from './pages/CostingPage';
import { CostAdjustmentPage } from './pages/CostAdjustmentPage';
import { ReportsPage } from './pages/ReportsPage';
import { WastePage } from './pages/WastePage';
import { ProductionPage } from './pages/ProductionPage';
import { MenuCostingPage } from './pages/MenuCostingPage';
import { MenuEngineeringPage } from './pages/MenuEngineeringPage';

const LoginPage: React.FC<{ onCreateCompany: () => void }> = ({ onCreateCompany }) => {
  const { login } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [tenantCode, setTenantCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const allowedUsers = ['admin', 'mustafa', 'ahmed', 'sara', 'manager'];

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!allowedUsers.includes(username.trim().toLowerCase())) {
      setError("عذراً، هذا المستخدم غير مصرح له بالدخول. يرجى التواصل مع الإدارة.");
      return;
    }

    if (!validateEmail(email)) {
      setError("يرجى إدخال بريد إلكتروني صحيح.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccessMsg(`تم إرسال الكود إلى: ${email}`);
      setStep(2);
      setTimeout(() => setSuccessMsg(''), 4000);
    }, 1500);
  };

  const handleFinalLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otpCode.length < 4) {
      setError("الرجاء إدخال الكود كاملاً.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Logic from AuthProvider: requires tenantCode, email (username), password
      await login(tenantCode, username, password);
    } catch (err: any) {
      setError(err.message || 'Login Failed 🔥');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center font-sans overflow-hidden relative" 
         style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)', backgroundSize: '400% 400%' }}>
      
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0 opacity-15 pointer-events-none" 
           style={{ backgroundImage: "url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      </div>

      <div className="login-glass p-10 rounded-[20px] w-full max-w-[450px] shadow-[0_15px_35px_rgba(0,0,0,0.5)] text-center relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="mb-2">
            <h1 className="text-[39px] font-[900] mb-1 leading-none tracking-tight" 
                style={{ background: 'linear-gradient(to right, #4facfe, #00f2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 0 20px rgba(79,172,254,0.3)' }}>
                3M GSC
            </h1>
            <div className="text-[16px] text-[#a2d2ff] font-semibold mb-6 opacity-90 border-b border-[#a2d2ff33] pb-[15px] bg-black/20 px-5 py-2.5 rounded-full inline-block w-[90%]">
                تحليل وترتيب كل مصروفاتك في مكان واحد
            </div>
        </div>

        <h2 className="text-[29px] mb-6 text-[#4facfe] font-bold">
            {step === 1 ? 'نظام إدارة التكاليف' : 'تأكيد الهوية'}
        </h2>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="space-y-5 text-right animate-fade-in-up">
            <div className="space-y-1.5">
                <label className="text-[14px] text-[#b8c1ec] block px-1">الاسم الكامل</label>
                <input 
                  required type="text" placeholder="أدخل اسمك هنا" value={fullName} onChange={e => setFullName(e.target.value)}
                  className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none transition-all focus:border-[#892cdc] focus:bg-black/50"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[14px] text-[#b8c1ec] block px-1">(User) اسم المستخدم</label>
                <input 
                  required type="text" placeholder="أدخل اسم المستخدم المعتمد" value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none transition-all focus:border-[#892cdc] focus:bg-black/50"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[14px] text-[#b8c1ec] block px-1">كود الشركة</label>
                <input 
                  required type="text" placeholder="Code" value={tenantCode} onChange={e => setTenantCode(e.target.value)}
                  className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none transition-all focus:border-[#892cdc] focus:bg-black/50"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[14px] text-[#b8c1ec] block px-1">رقم الهاتف</label>
                <input 
                  required type="tel" pattern="[0-9]{11}" placeholder="01xxxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none transition-all focus:border-[#892cdc] focus:bg-black/50"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[14px] text-[#b8c1ec] block px-1">البريد الإلكتروني</label>
                <input 
                  required type="email" placeholder="@email.com" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none transition-all focus:border-[#892cdc] focus:bg-black/50"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-[14px] text-[#b8c1ec] block px-1">كلمة المرور</label>
                <input 
                  required type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none transition-all focus:border-[#892cdc] focus:bg-black/50"
                />
            </div>

            {error && <p className="text-[#e74c3c] bg-[#e74c3c33] p-2.5 rounded-[8px] text-[14px] border border-[#e74c3c] text-center">{error}</p>}
            {successMsg && <p className="text-[#2ecc71] bg-[#2ecc7133] p-2.5 rounded-[8px] text-[14px] border border-[#2ecc71] text-center">{successMsg}</p>}

            <button 
              type="submit" disabled={loading}
              className="w-full p-3.5 rounded-[10px] text-[#0f0c29] font-bold text-[16px] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(79,172,254,0.4)] active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(to right, #4facfe, #00f2fe)' }}
            >
              {loading ? 'جاري التحقق...' : 'LOGIN'}
            </button>
          </form>
        ) : (
          <div className="space-y-6 text-right animate-fade-in-up">
            <p className="text-[#a2d2ff] text-[14px] text-center mb-4">تم إرسال كود مكون من 4 أرقام إلى بريدك الإلكتروني</p>
            
            <div className="space-y-1.5">
                <label className="text-[14px] text-[#b8c1ec] block px-1 text-center">كود التأكيد</label>
                <input 
                  type="text" maxLength={4} value={otpCode} onChange={e => setOtpCode(e.target.value)}
                  placeholder="0000"
                  className="w-full p-4 rounded-[10px] border border-white/30 bg-black/30 text-white text-[20px] font-bold tracking-[5px] text-center outline-none transition-all focus:border-[#892cdc] focus:bg-black/50"
                  autoFocus
                />
            </div>

            {error && <p className="text-[#e74c3c] bg-[#e74c3c33] p-2.5 rounded-[8px] text-[14px] border border-[#e74c3c] text-center">{error}</p>}

            <button 
              onClick={() => handleFinalLogin()} disabled={loading}
              className="w-full p-3.5 rounded-[10px] text-[#0f0c29] font-bold text-[16px] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(79,172,254,0.4)] active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(to right, #4facfe, #00f2fe)' }}
            >
              {loading ? 'جاري التحقق...' : 'تأكيد الدخول'}
            </button>

            <button 
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-[#a2d2ff] text-[13px] hover:underline cursor-pointer"
            >
                رجوع للبيانات الأساسية
            </button>
          </div>
        )}

        <div className="flex justify-between mt-6 text-xs text-[#a2d2ff]">
          <span className="cursor-pointer hover:underline" onClick={onCreateCompany}>Create New Account</span>
        </div>

        <div className="mt-8 text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">
            POWERED BY MOHAMED ABDELAL
        </div>
      </div>
    </div>
  );
};

const MainApp: React.FC = () => {
  const { auth, logout } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'pos': return <PosPage />;
      case 'inventory': return <InventoryPage />;
      case 'transfers': return <TransfersPage />;
      case 'stocktake': return <StocktakePage />;
      case 'production': return <ProductionPage />;
      case 'waste': return <WastePage />;
      case 'purchases': return <PurchasesPage />;
      case 'settings': return <SettingsPage />;
      case 'recipes': return <RecipesPage />;
      case 'costing': return <CostingPage />;
      case 'menu-costing': return <MenuCostingPage />;
      case 'menu-engineering': return <MenuEngineeringPage />;
      case 'cost-adjustment': return <CostAdjustmentPage />;
      case 'reports': return <ReportsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <SystemLayout 
      activePage={activePage} 
      onNavigate={setActivePage} 
      onLogout={logout} 
      tenantName={auth.user?.tenantCode || ''} 
      userName={auth.user?.fullName || ''}
    >
      {renderContent()}
    </SystemLayout>
  );
};

const AppRoot: React.FC = () => {
  const { auth } = useAuth();
  const [view, setView] = useState<'auth' | 'create_company'>('auth');

  if (!auth.isReady) return null;

  if (auth.token) {
    return <MainApp />;
  }

  if (view === 'create_company') {
    return <CreateCompany onBack={() => setView('auth')} />;
  }

  return <LoginPage onCreateCompany={() => setView('create_company')} />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
};

export default App;
