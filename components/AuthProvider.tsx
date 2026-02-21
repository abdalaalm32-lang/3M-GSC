
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  tenantId: string;
  tenantCode: string;
  status: 'نشط' | 'موقف';
  permissions: string[];
};

type AuthState = {
  isReady: boolean;
  token: string | null;
  user: User | null;
  permissionKeys: string[];
};

interface AuthContextType {
  auth: AuthState;
  login: (tenantCode: string, email: string, password: string) => Promise<void>;
  createCompany: (data: any) => Promise<void>;
  logout: () => void;
  hasPermission: (key: string) => boolean;
}

const AuthCtx = createContext<AuthContextType>({} as any);

const ALWAYS_ALLOWED = new Set(["dashboard"]);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    isReady: false,
    token: localStorage.getItem("gcs_token"),
    user: null,
    permissionKeys: [],
  });

  const syncCurrentUser = () => {
    const token = localStorage.getItem("gcs_token");
    if (!token) {
        setAuth(a => ({ ...a, isReady: true, token: null, user: null, permissionKeys: [] }));
        return;
    }

    try {
        const users = JSON.parse(localStorage.getItem("gsc_system_users") || "[]");
        const currentEmail = (localStorage.getItem("gsc_current_user_email") || "").trim().toLowerCase();
        const sessionData = JSON.parse(localStorage.getItem("gsc_current_user") || "null");

        const foundUser = users.find((u: any) => (u.email || "").trim().toLowerCase() === currentEmail);

        if (foundUser && sessionData) {
            setAuth({
                isReady: true,
                token,
                user: { ...sessionData, status: foundUser.status, permissions: foundUser.permissions },
                permissionKeys: foundUser.permissions || ["dashboard"],
            });
        } else if (!currentEmail && sessionData) {
            // Fallback for initial migration
            localStorage.setItem("gsc_current_user_email", sessionData.email);
            syncCurrentUser();
        } else {
            // No user found in DB but token exists - possible deletion or error
            setAuth(a => ({ ...a, isReady: true }));
        }
    } catch (e) {
        console.error("Auth sync error", e);
        setAuth(a => ({ ...a, isReady: true }));
    }
  };

  useEffect(() => {
    syncCurrentUser();

    const onSync = () => syncCurrentUser();
    window.addEventListener('gsc:auth-sync', onSync);
    window.addEventListener('storage', onSync);

    return () => {
      window.removeEventListener('gsc:auth-sync', onSync);
      window.removeEventListener('storage', onSync);
    };
  }, []);

  const hasPermission = (key: string) => {
    if (ALWAYS_ALLOWED.has(key)) return true;
    
    // Check dynamic state from synchronized user
    if (!auth.user) return false;
    if (auth.user.status !== "نشط") return false;
    if (auth.user.role === "مدير نظام") return true;

    return Array.isArray(auth.permissionKeys) && auth.permissionKeys.includes(key);
  };

  const login = async (tenantCode: string, email: string, password: string) => {
    const users = JSON.parse(localStorage.getItem("gsc_system_users") || "[]");
    const tenants = JSON.parse(localStorage.getItem("gsc_tenants") || "[]");
    
    const tenant = tenants.find((t: any) => t.code.toLowerCase() === tenantCode.toLowerCase());
    if (!tenant) throw new Error("كود الشركة غير صحيح");

    const user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.tenantId === tenant.id);
    if (!user) throw new Error("بيانات الدخول غير صحيحة");
    if (user.status !== "نشط") throw new Error("هذا الحساب موقف حالياً");

    const token = `jwt_mock_${Date.now()}`;
    const userData = {
      id: user.id,
      fullName: user.name,
      email: user.email,
      role: user.role,
      tenantId: tenant.id,
      tenantCode: tenant.code
    };

    localStorage.setItem("gcs_token", token);
    localStorage.setItem("gsc_current_user", JSON.stringify(userData));
    localStorage.setItem("gsc_current_user_email", user.email);
    localStorage.setItem("gsc_is_logged_in", "true");

    // إطلاق حدث المزامنة الفوري
    window.dispatchEvent(new CustomEvent('gsc:auth-sync'));
  };

  const createCompany = async (data: any) => {
    const tenants = JSON.parse(localStorage.getItem("gsc_tenants") || "[]");
    const users = JSON.parse(localStorage.getItem("gsc_system_users") || "[]");

    const newTenant = {
      id: `TEN-${Math.random().toString(36).substr(2, 9)}`,
      name: data.companyName,
      code: data.tenantCode || `GSC-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString()
    };

    const newAdmin = {
      id: `USR-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: newTenant.id,
      name: data.ownerName,
      email: data.ownerEmail,
      role: "مدير نظام",
      permissions: ['pos', 'inventory', 'transfers', 'stocktake', 'recipes', 'production', 'waste', 'purchases', 'cost-adjustment', 'costing', 'menu-costing', 'menu-engineering', 'reports', 'settings'],
      status: "نشط"
    };

    localStorage.setItem("gsc_tenants", JSON.stringify([...tenants, newTenant]));
    localStorage.setItem("gsc_system_users", JSON.stringify([...users, newAdmin]));
    
    await login(newTenant.code, newAdmin.email, data.ownerPassword);
  };

  const logout = () => {
    localStorage.removeItem("gcs_token");
    localStorage.removeItem("gsc_current_user");
    localStorage.removeItem("gsc_current_user_email");
    localStorage.removeItem("gsc_is_logged_in");
    setAuth({ isReady: true, token: null, user: null, permissionKeys: [] });
  };

  const value = useMemo(() => ({ auth, login, createCompany, logout, hasPermission }), [auth]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => useContext(AuthCtx);
