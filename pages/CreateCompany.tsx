
import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';

export const CreateCompany: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { createCompany } = useAuth();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    companyName: '',
    tenantCode: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    confirmPassword: ''
  });

  const [otpCode, setOtpCode] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.ownerEmail.toLowerCase() !== 'abdalaalm32@gmail.com') {
      setError('عذراً، هذا النظام مخصص لمالك واحد فقط. لا يمكن استخدام هذا البريد الإلكتروني.');
      return;
    }

    if (formData.ownerPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode.length < 5) {
      setError('Please enter a valid 5-digit code');
      return;
    }

    setLoading(true);
    try {
      await createCompany(formData);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center font-sans overflow-hidden relative" 
         style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
      
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0 opacity-15 pointer-events-none" 
           style={{ backgroundImage: "url('https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      </div>

      <div className="login-glass p-10 rounded-[20px] w-full max-w-[480px] shadow-[0_15px_35px_rgba(0,0,0,0.5)] text-center relative z-10 animate-in fade-in zoom-in duration-500">
        
        {step === 'form' ? (
          <>
            <h1 className="text-[39px] font-[900] mb-6 leading-none" 
                style={{ background: 'linear-gradient(to right, #4facfe, #00f2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                3M GSC
            </h1>
            <h2 className="text-[29px] mb-6 text-[#4facfe] font-bold">Create New Account</h2>
            
            <form onSubmit={handleRequestOtp} className="space-y-4 text-right">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-xs text-[#b8c1ec] px-1">Company Name</label>
                    <input 
                      required type="text" placeholder="اسم الشركة" value={formData.companyName}
                      onChange={e => setFormData({...formData, companyName: e.target.value})}
                      className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none focus:border-[#892cdc]"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-[#b8c1ec] px-1">Tenant Code</label>
                    <input 
                      required type="text" placeholder="الكود التعريفي" value={formData.tenantCode}
                      onChange={e => setFormData({...formData, tenantCode: e.target.value})}
                      className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none focus:border-[#892cdc]"
                    />
                </div>
              </div>

              <div className="space-y-1">
                  <label className="text-xs text-[#b8c1ec] px-1">Owner Name</label>
                  <input 
                    required type="text" placeholder="الاسم بالكامل" value={formData.ownerName}
                    onChange={e => setFormData({...formData, ownerName: e.target.value})}
                    className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none focus:border-[#892cdc]"
                  />
              </div>

              <div className="space-y-1">
                  <label className="text-xs text-[#b8c1ec] px-1">Admin Email</label>
                  <input 
                    required type="email" placeholder="البريد المعتمد" value={formData.ownerEmail}
                    onChange={e => setFormData({...formData, ownerEmail: e.target.value})}
                    className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none focus:border-[#892cdc]"
                  />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-xs text-[#b8c1ec] px-1">Password</label>
                    <input 
                      required type="password" placeholder="كلمة المرور" value={formData.ownerPassword}
                      onChange={e => setFormData({...formData, ownerPassword: e.target.value})}
                      className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none focus:border-[#892cdc]"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-[#b8c1ec] px-1">Confirm</label>
                    <input 
                      required type="password" placeholder="تأكيد" value={formData.confirmPassword}
                      onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                      className="w-full p-3 rounded-[10px] border border-white/30 bg-black/30 text-white text-sm outline-none focus:border-[#892cdc]"
                    />
                </div>
              </div>

              {error && <p className="text-[#e74c3c] bg-[#e74c3c33] p-2.5 rounded-[8px] text-[14px] border border-[#e74c3c] text-center">{error}</p>}

              <button 
                type="submit" disabled={loading}
                className="w-full p-3.5 rounded-[10px] text-[#0f0c29] font-bold text-[16px] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(79,172,254,0.4)] active:scale-95 disabled:opacity-60"
                style={{ background: 'linear-gradient(to right, #4facfe, #00f2fe)' }}
              >
                {loading ? 'Verifying Email...' : 'Request Verification Code'}
              </button>
            </form>
          </>
        ) : (
          <div className="animate-in slide-in-from-right duration-500">
            <h2 className="text-[29px] mb-2 text-[#4facfe] font-bold">Confirm Identity</h2>
            <p className="text-[#a2d2ff] text-[14px] mb-8">تم إرسال كود التحقق (5 أرقام) إلى:<br/><span className="font-bold underline">abdalaalm32@gmail.com</span></p>
            
            <form onSubmit={handleVerifyAndCreate} className="space-y-6">
              <input 
                type="text" placeholder="00000" value={otpCode} maxLength={5}
                onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full p-4 rounded-[10px] border border-white/30 bg-black/30 text-white text-[24px] font-bold tracking-[5px] text-center outline-none transition-all focus:border-[#892cdc]"
              />

              {error && <p className="text-[#e74c3c] bg-[#e74c3c33] p-2.5 rounded-[8px] text-[14px] border border-[#e74c3c] text-center">{error}</p>}

              <button 
                type="submit" disabled={loading}
                className="w-full p-3.5 rounded-[10px] text-[#0f0c29] font-bold text-[16px] transition-all hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(79,172,254,0.4)] active:scale-95 disabled:opacity-60"
                style={{ background: 'linear-gradient(to right, #4facfe, #00f2fe)' }}
              >
                {loading ? 'Activating Account...' : 'Verify & Activate'}
              </button>
              
              <div className="flex flex-col gap-2 mt-4">
                 <span className="text-xs text-[#4facfe] cursor-pointer hover:underline" onClick={() => setStep('form')}>Change Email Address</span>
                 <span className="text-[10px] text-white/30 cursor-pointer hover:text-white">لم يصلك الكود؟ إعادة الإرسال</span>
              </div>
            </form>
          </div>
        )}

        <div className="mt-6 text-xs">
          <span className="text-[#a2d2ff] cursor-pointer hover:underline" onClick={onBack}>Back to Login</span>
        </div>

        <div className="mt-8 text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">
            3M GSC • SECURE REGISTRATION PROTOCOL
        </div>
      </div>
    </div>
  );
};
