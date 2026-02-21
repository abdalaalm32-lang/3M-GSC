import React, { useState } from 'react';
import { analyzeSecurity } from '../services/geminiService';
import { Shield, Lock, Building2, User } from 'lucide-react';

interface LoginCardProps {
  onLoginSuccess: (data: { tenantName: string, userName: string }) => void;
}

export const LoginCard: React.FC<LoginCardProps> = ({ onLoginSuccess }) => {
  const [tenantCode, setTenantCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantCode.trim()) {
      setMessage("يرجى إدخال كود الشركة");
      return;
    }
    if (!email.trim()) {
      setMessage("يرجى إدخال اسم المستخدم");
      return;
    }
    if (!password) {
      setMessage("يرجى إدخال كلمة المرور");
      return;
    }

    setIsLoggingIn(true);

    try {
        // We use AI for a dynamic welcome but simulate valid login
        await analyzeSecurity(email);
        
        await new Promise(r => setTimeout(r, 600)); 
        
        setIsLoggingIn(false);
        onLoginSuccess({
            tenantName: `شركة ${tenantCode}`, // Dynamic based on input
            userName: email
        });
    } catch (err) {
        setIsLoggingIn(false);
        setMessage("خطأ في الاتصال");
    }
  };

  return (
    <div className="relative font-sans" dir="rtl">
      {message && (
        <div className="absolute -top-16 left-0 right-0 mx-auto w-max max-w-[300px] text-center bg-sys-danger text-white text-xs px-4 py-2 rounded-full border border-white/10 shadow-xl animate-bounce z-50 font-bold">
          {message}
        </div>
      )}

      <div className="relative flex justify-center items-center overflow-hidden bg-login-box rounded-[24px] w-[320px] h-[480px] shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.1)] z-[8]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sys-primary via-purple-500 to-sys-primary"></div>
        
        <div className="w-full h-full p-8 flex flex-col relative z-10">
          <form className="flex flex-col gap-5 h-full" onSubmit={handleSubmit}>
            <div className="flex flex-col items-center justify-center mb-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-black/30 border border-white/10 flex items-center justify-center mb-3">
                    <Shield size={28} className="text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">دخول النظام</h2>
            </div>

            <div className="flex flex-col gap-3">
                <div className="relative group">
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-sys-primary transition-colors">
                        <Building2 size={16} />
                    </div>
                    <input 
                        type="text" 
                        className="w-full h-11 bg-[#151515] border border-white/10 rounded-xl px-10 text-sm text-white focus:border-sys-primary focus:ring-1 focus:ring-sys-primary/50 outline-none transition-all placeholder:text-white/20 text-right"
                        placeholder="كود الشركة"
                        value={tenantCode}
                        onChange={(e) => setTenantCode(e.target.value)}
                    />
                </div>

                <div className="relative group">
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-sys-primary transition-colors">
                        <User size={16} />
                    </div>
                    <input 
                        type="text" 
                        className="w-full h-11 bg-[#151515] border border-white/10 rounded-xl px-10 text-sm text-white focus:border-sys-primary focus:ring-1 focus:ring-sys-primary/50 outline-none transition-all placeholder:text-white/20 text-right"
                        placeholder="اسم المستخدم"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                
                <div className="relative group">
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-sys-primary transition-colors">
                        <Lock size={16} />
                    </div>
                    <input 
                        type="password" 
                        className="w-full h-11 bg-[#151515] border border-white/10 rounded-xl px-10 text-sm text-white focus:border-sys-primary focus:ring-1 focus:ring-sys-primary/50 outline-none transition-all placeholder:text-white/20 text-right"
                        placeholder="كلمة المرور"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            </div>

            <button 
              type="submit"
              disabled={isLoggingIn}
              className={`mt-auto w-full h-11 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${isLoggingIn ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-sys-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-900/20'}`}
            >
              {isLoggingIn ? 'جاري التحقق...' : 'دخول'}
            </button>

            <p className="text-[10px] text-center text-white/20 mt-2">نظام 3M GSC المحمي - إدارة النظام فقط</p>
          </form>
        </div>
      </div>
    </div>
  );
};