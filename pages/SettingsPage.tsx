
import React, { useState, useEffect } from 'react';
import { DataGrid } from '../components/DataGrid';
import { 
    Users, Building2, Warehouse, Shield, MapPin, Box, 
    UserPlus, Edit, Trash2, X, Save, ShieldCheck, 
    Lock, CheckCircle2, AlertCircle, LayoutDashboard, 
    Store, Package, ChefHat, ShoppingCart, Calculator, 
    FileText, Settings, ShieldAlert, KeyRound, Globe, 
    Plus, Info, MapPinned, UserCheck, Briefcase, Boxes, Tags, Check,
    Layers, Trash, Edit3, PieChart, BarChart3, AlertTriangle, RefreshCcw,
    DatabaseZap, Bomb, AlertOctagon, RotateCcw
} from 'lucide-react';

// --- Interfaces ---

interface SystemUser {
    id: string;
    name: string;
    email: string;
    role: 'مدير نظام' | 'مدير فرع' | 'محاسب تكاليف' | 'كاشير' | 'أمين مخزن';
    branchId: string;
    status: 'نشط' | 'موقف';
    permissions: string[];
}

interface Branch {
    id: string;
    name: string;
    location: string;
    managerId: string;
    status: 'نشط' | 'مغلق';
}

interface WarehouseRecord {
    id: string;
    name: string;
    type: 'رئيسي' | 'فرعي' | 'مطبخ' | 'خامات';
    branchIds: string[]; // Linked branches
    managerId: string; // Linked User
    status: 'نشط' | 'موقف';
}

// الوحدات القابلة للقفل والفتح يدوياً (لوحة التحكم مفتوحة دائماً للجميع)
const SYSTEM_MODULES = [
    { id: 'pos', label: 'نقطة البيع (POS)', icon: Store },
    { id: 'inventory', label: 'إدارة المخزون', icon: Package },
    { id: 'transfers', label: 'أذونات الصرف والتحويل', icon: Globe },
    { id: 'stocktake', label: 'جرد المخزون', icon: CheckCircle2 },
    { id: 'recipes', label: 'الوصفات والإنتاج', icon: ChefHat },
    { id: 'production', label: 'عمليات الإنتاج', icon: Layers },
    { id: 'waste', label: 'الهالك', icon: Trash },
    { id: 'purchases', label: 'المشتريات', icon: ShoppingCart },
    { id: 'cost-adjustment', label: 'تعديل التكلفة', icon: Edit3 },
    { id: 'costing', label: 'محرك التكاليف', icon: Calculator },
    { id: 'menu-costing', label: 'Menu Costing', icon: PieChart },
    { id: 'menu-engineering', label: 'هندسة القائمة', icon: BarChart3 },
    { id: 'reports', label: 'التقارير', icon: FileText },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
];

export const SettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'branches' | 'warehouses' | 'reset'>('users');
    const [isLoading, setIsLoading] = useState(false);
    const [confirmResetText, setConfirmResetText] = useState('');

    // --- State Persistence ---
    const [users, setUsers] = useState<SystemUser[]>(() => {
        const saved = localStorage.getItem('gsc_system_users');
        return saved ? JSON.parse(saved) : [];
    });

    const [branches, setBranches] = useState<Branch[]>(() => {
        const saved = localStorage.getItem('gsc_branches');
        return saved ? JSON.parse(saved) : [];
    });

    const [warehouses, setWarehouses] = useState<WarehouseRecord[]>(() => {
        const saved = localStorage.getItem('gsc_warehouses_config');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('gsc_system_users', JSON.stringify(users));
    }, [users]);

    useEffect(() => {
        localStorage.setItem('gsc_branches', JSON.stringify(branches));
    }, [branches]);

    useEffect(() => {
        localStorage.setItem('gsc_warehouses_config', JSON.stringify(warehouses));
    }, [warehouses]);

    // --- Modal States ---
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [userModalTab, setUserModalTab] = useState<'general' | 'permissions'>('general');
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [userForm, setUserForm] = useState<SystemUser>({
        id: '', name: '', email: '', role: 'كاشير', branchId: '', status: 'نشط', permissions: ['pos']
    });

    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [isEditingBranch, setIsEditingBranch] = useState(false);
    const [branchForm, setBranchForm] = useState<Branch>({
        id: '', name: '', location: '', managerId: '', status: 'نشط'
    });

    const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
    const [isEditingWarehouse, setIsEditingWarehouse] = useState(false);
    const [warehouseForm, setWarehouseForm] = useState<WarehouseRecord>({
        id: '', name: '', type: 'رئيسي', branchIds: [], managerId: '', status: 'نشط'
    });

    // --- Handlers: Users ---
    const handleOpenAddUser = () => {
        setIsEditingUser(false);
        setUserForm({
            id: `USR-${Date.now().toString().slice(-4)}`,
            name: '', email: '', role: 'كاشير', 
            branchId: branches[0]?.id || '', 
            status: 'نشط', permissions: ['pos']
        });
        setUserModalTab('general');
        setIsUserModalOpen(true);
    };

    const handleEditUser = (row: any) => {
        const target = users.find(u => u.id === row.id);
        if (target) {
            setUserForm({ ...target });
            setIsEditingUser(true);
            setUserModalTab('general');
            setIsUserModalOpen(true);
        }
    };

    const handleSaveUser = () => {
        if (!userForm.name || !userForm.email) return alert('يرجى إكمال البيانات الأساسية');
        if (isEditingUser) setUsers(prev => prev.map(u => u.id === userForm.id ? userForm : u));
        else setUsers(prev => [userForm, ...prev]);
        setIsUserModalOpen(false);
        
        // إطلاق حدث لمزامنة الصلاحيات ديناميكياً
        window.dispatchEvent(new CustomEvent('gsc:auth-sync'));
    };

    // --- Handlers: Branches ---
    const handleOpenAddBranch = () => {
        setIsEditingBranch(false);
        setBranchForm({
            id: `BRN-${Math.floor(100 + Math.random() * 900)}`,
            name: '', location: '', managerId: '', status: 'نشط'
        });
        setIsBranchModalOpen(true);
    };

    const handleEditBranch = (row: any) => {
        const target = branches.find(b => b.id === row.id);
        if (target) {
            setBranchForm({ ...target });
            setIsEditingBranch(true);
            setIsBranchModalOpen(true);
        }
    };

    const handleSaveBranch = () => {
        if (!branchForm.name || !branchForm.id) return alert('يرجى إدخال كود واسم الفرع');
        if (isEditingBranch) setBranches(prev => prev.map(b => b.id === branchForm.id ? branchForm : b));
        else setBranches(prev => [...prev, branchForm]);
        setIsBranchModalOpen(false);
    };

    // --- Handlers: Warehouses ---
    const handleOpenAddWarehouse = () => {
        setIsEditingWarehouse(false);
        setWarehouseForm({
            id: `WH-${Math.floor(1000 + Math.random() * 9000)}`,
            name: '', type: 'رئيسي', branchIds: [], managerId: '', status: 'نشط'
        });
        setIsWarehouseModalOpen(true);
    };

    const handleEditWarehouse = (row: any) => {
        const target = warehouses.find(w => w.id === row.id);
        if (target) {
            setWarehouseForm({ ...target });
            setIsEditingWarehouse(true);
            setIsWarehouseModalOpen(true);
        }
    };

    const handleSaveWarehouse = () => {
        if (!warehouseForm.name || !warehouseForm.id) return alert('يرجى إدخال كود واسم المخزن');
        if (isEditingWarehouse) setWarehouses(prev => prev.map(w => w.id === warehouseForm.id ? warehouseForm : w));
        else setWarehouses(prev => [...prev, warehouseForm]);
        setIsWarehouseModalOpen(false);
    };

    const toggleBranchLink = (branchId: string) => {
        setWarehouseForm(prev => {
            const exists = prev.branchIds.includes(branchId);
            const next = exists ? prev.branchIds.filter(id => id !== branchId) : [...prev.branchIds, branchId];
            return { ...prev, branchIds: next };
        });
    };

    const handleDeleteWarehouse = (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذا المخزن؟')) {
            setWarehouses(prev => prev.filter(w => w.id !== id));
            setIsWarehouseModalOpen(false);
        }
    };

    // --- Logic: Reset System Data (MODIFIED) ---
    const handleResetSystemData = () => {
        if (confirmResetText !== 'CONFIRM RESET') {
            alert('يرجى كتابة العبارة التأكيدية بشكل صحيح');
            return;
        }

        setIsLoading(true);
        try {
            // المفاتيح التي سيتم مسحها (بيانات الإدخال والعمليات فقط)
            const dataKeysToClear = [
                'gsc_items',              // المواد الخام
                'gsc_categories',         // مجموعات المخزن
                'gsc_departments',        // الأقسام
                'gsc_recipes',            // الوصفات
                'gsc_pos_categories',     // مجموعات المنيو
                'gsc_pos_items',          // أصناف المنيو
                'gsc_pos_sales',          // المبيعات
                'gsc_purchases',          // المشتريات
                'gsc_transfers',          // التحويلات
                'gsc_stocktakes',         // الجرد
                'gsc_production_logs',    // الإنتاج
                'gsc_waste_records',      // الهالك
                'gsc_cost_adjustments',   // تعديلات التكلفة
                'gsc_suppliers',          // الموردين
                'gsc_menu_manual_sides',  // تكاليف إضافية للمنيو
                'gsc_menu_meta',          // بيانات تقارير المنيو
                'gsc_menu_assumptions',   // افتراضات المنيو
                'gsc_menu_indirect_costs',// تكاليف غير مباشرة
                'gsc_menu_packing_items'  // بنود التعبئة
                // ملاحظة: لم يتم إضافة gsc_branches و gsc_warehouses_config و gsc_system_users 
                // للحفاظ على بنية السيستم والمستخدمين.
            ];

            dataKeysToClear.forEach(key => localStorage.removeItem(key));
            
            // إعادة تحميل الصفحة لتحديث كافة الحالات (States)
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error(e);
            alert('حدث خطأ أثناء محاولة تصفير البيانات');
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'users':
                return (
                    <div className="flex flex-col h-full gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                            <div className="bg-sys-surface border border-white/5 p-4 rounded-xl flex items-center gap-4 shadow-sm">
                                <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-lg"><Users size={20} /></div>
                                <div>
                                    <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">إجمالي المستخدمين</div>
                                    <div className="text-xl font-bold text-white">{users.length}</div>
                                </div>
                            </div>
                            <div className="bg-sys-surface border border-white/5 p-4 rounded-xl flex items-center gap-4 shadow-sm">
                                <div className="p-3 bg-sys-success/10 text-sys-success rounded-lg"><CheckCircle2 size={20} /></div>
                                <div>
                                    <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">مستخدمين نشطين</div>
                                    <div className="text-xl font-bold text-white">{users.filter(u => u.status === 'نشط').length}</div>
                                </div>
                            </div>
                            <div className="bg-sys-surface border border-white/5 p-4 rounded-xl flex items-center justify-end">
                                <button onClick={handleOpenAddUser} className="bg-sys-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"><UserPlus size={18} /> إضافة مستخدم</button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <DataGrid 
                                title="إدارة مستخدمي النظام" 
                                data={users.map(u => ({
                                    ...u,
                                    branchName: branches.find(b => b.id === u.branchId)?.name || 'غير محدد'
                                }))} 
                                columns={[
                                    { key: 'id', label: 'كود' },
                                    { key: 'name', label: 'الاسم الكامل', sortable: true },
                                    { key: 'role', label: 'الدور الوظيفي' },
                                    { key: 'branchName', label: 'الفرع التابع' },
                                    { key: 'status', label: 'الحالة' },
                                ]} 
                                onRowClick={handleEditUser}
                            />
                        </div>
                    </div>
                );
            case 'branches':
                return (
                    <div className="flex flex-col h-full gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                            <div className="bg-sys-surface border border-white/5 p-4 rounded-xl flex items-center gap-4 shadow-sm">
                                <div className="p-3 bg-sys-warning/10 text-sys-warning rounded-lg"><Building2 size={20} /></div>
                                <div>
                                    <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">إجمالي الفروع</div>
                                    <div className="text-xl font-bold text-white">{branches.length}</div>
                                </div>
                            </div>
                            <div className="bg-sys-surface border border-white/5 p-4 rounded-xl flex items-center gap-4 shadow-sm">
                                <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-lg"><MapPinned size={20} /></div>
                                <div>
                                    <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">التغطية الجغرافية</div>
                                    <div className="text-xl font-bold text-white">{new Set(branches.map(b => b.location)).size} <span className="text-xs font-normal opacity-40">مناطق</span></div>
                                </div>
                            </div>
                            <div className="bg-sys-surface border border-white/5 p-4 rounded-xl flex items-center justify-end">
                                <button onClick={handleOpenAddBranch} className="bg-sys-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"><Plus size={18} /> إضافة فرع</button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <DataGrid 
                                title="دليل الفروع ومراكز التكلفة" 
                                data={branches.map(b => ({
                                    ...b,
                                    managerName: users.find(u => u.id === b.managerId)?.name || 'لم يحدد'
                                }))} 
                                columns={[
                                    { key: 'id', label: 'كود الفرع', sortable: true },
                                    { key: 'name', label: 'اسم الفرع', sortable: true },
                                    { key: 'location', label: 'الموقع/العنوان' },
                                    { key: 'managerName', label: 'مدير الفرع' },
                                    { key: 'status', label: 'الحالة' },
                                ]} 
                                onRowClick={handleEditBranch}
                            />
                        </div>
                    </div>
                );
            case 'warehouses':
                return (
                    <div className="flex flex-col h-full gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                            <div className="bg-sys-surface border border-white/5 p-4 rounded-xl flex items-center gap-4 shadow-sm">
                                <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-lg"><Warehouse size={20} /></div>
                                <div>
                                    <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">إجمالي المخازن</div>
                                    <div className="text-xl font-bold text-white">{warehouses.length}</div>
                                </div>
                            </div>
                            <div className="bg-sys-surface border border-white/5 p-4 rounded-xl flex items-center gap-4 shadow-sm">
                                <div className="p-3 bg-sys-success/10 text-sys-success rounded-lg"><Boxes size={20} /></div>
                                <div>
                                    <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">سلسلة التوريد</div>
                                    <div className="text-xl font-bold text-white">{warehouses.reduce((acc, w) => acc + w.branchIds.length, 0)} <span className="text-xs font-normal opacity-40">روابط فروع</span></div>
                                </div>
                            </div>
                            <div className="bg-sys-surface border border-white/5 p-4 rounded-xl flex items-center justify-end">
                                <button onClick={handleOpenAddWarehouse} className="bg-sys-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"><Plus size={18} /> إضافة مخزن جديد</button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <DataGrid 
                                title="دليل المخازن ومواقع التخزين" 
                                data={warehouses.map(w => ({
                                    ...w,
                                    managerName: users.find(u => u.id === w.managerId)?.name || 'لم يحدد',
                                    linkedBranchesCount: `${w.branchIds.length} فروع`
                                }))} 
                                columns={[
                                    { key: 'id', label: 'كود المخزن', sortable: true },
                                    { key: 'name', label: 'اسم المخزن', sortable: true },
                                    { key: 'type', label: 'التصنيف' },
                                    { key: 'managerName', label: 'أمين المخزن' },
                                    { key: 'linkedBranchesCount', label: 'الفروع المرتبطة' },
                                    { key: 'status', label: 'حالة العمل' },
                                ]} 
                                onRowClick={handleEditWarehouse}
                            />
                        </div>
                    </div>
                );
            case 'reset':
                return (
                    <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in duration-300">
                        <div className="w-full max-w-2xl bg-sys-surface border-2 border-sys-danger/20 rounded-[32px] p-10 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-sys-danger/40"></div>
                            
                            <div className="flex flex-col items-center text-center gap-6">
                                <div className="w-24 h-24 bg-sys-danger/10 rounded-full flex items-center justify-center text-sys-danger shadow-[0_0_40px_rgba(239,68,68,0.2)] animate-pulse">
                                    <AlertOctagon size={56} />
                                </div>
                                
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">تصفير مدخلات النظام</h2>
                                    <p className="text-white/40 text-sm font-medium max-w-md mx-auto leading-relaxed">
                                        هذا الإجراء سيقوم بمسح **كافة البيانات والمدخلات والعمليات** (خامات، وصفات، مبيعات، مشتريات) نهائياً. 
                                        <br/> <span className="text-sys-success font-bold">سيتم الحفاظ على الفروع والمخازن والمستخدمين المسجلين.</span>
                                    </p>
                                </div>

                                <div className="w-full h-[1px] bg-white/5 my-4"></div>

                                <div className="w-full space-y-4">
                                    <div className="bg-black/20 p-6 rounded-2xl border border-white/5 space-y-3">
                                        <label className="text-xs text-white/60 font-bold uppercase tracking-widest block">لتأكيد العملية، يرجى كتابة (CONFIRM RESET) أدناه:</label>
                                        <input 
                                            type="text" 
                                            value={confirmResetText}
                                            onChange={e => setConfirmResetText(e.target.value)}
                                            placeholder="اكتب هنا CONFIRM RESET..."
                                            className="w-full bg-sys-bg border border-sys-danger/30 rounded-xl p-4 text-center text-white font-black tracking-widest focus:border-sys-danger outline-none transition-all placeholder:text-white/10"
                                        />
                                    </div>

                                    <button 
                                        disabled={confirmResetText !== 'CONFIRM RESET' || isLoading}
                                        onClick={handleResetSystemData}
                                        className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-4 transition-all shadow-xl ${confirmResetText === 'CONFIRM RESET' ? 'bg-sys-danger text-white hover:bg-red-600 shadow-red-900/30' : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'}`}
                                    >
                                        {isLoading ? (
                                            <>
                                                <RotateCcw className="animate-spin" size={24} />
                                                جاري تصفير البيانات...
                                            </>
                                        ) : (
                                            <>
                                                <DatabaseZap size={24} />
                                                تصفير المدخلات والعمليات
                                            </>
                                        )}
                                    </button>
                                </div>

                                <p className="text-[10px] text-white/20 uppercase font-black tracking-[0.3em]">3M GSC SECURITY PROTOCOL ACTIVE</p>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-100px)] font-sans" dir="rtl">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 flex flex-col gap-2 shrink-0 no-print">
                <div className="p-4 bg-sys-surface border border-white/5 rounded-xl mb-2 shadow-sm">
                    <h2 className="text-white font-bold text-lg mb-1">الإعدادات</h2>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-black">Control Hub</p>
                </div>

                <nav className="flex flex-col gap-1">
                    <button onClick={() => setActiveTab('users')} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${activeTab === 'users' ? 'bg-sys-primary text-white border-sys-primary shadow-lg shadow-blue-900/20' : 'bg-sys-surface border-white/5 text-white/60 hover:text-white hover:bg-white/5'}`}>
                        <div className={`p-2 rounded-lg ${activeTab === 'users' ? 'bg-white/20' : 'bg-white/5'}`}><Users size={18} /></div>
                        <div className="text-right flex-1"><div className="font-bold text-xs">المستخدمين</div><div className="text-[9px] opacity-60">تحديد صلاحيات الفتح والقفل</div></div>
                    </button>
                    <button onClick={() => setActiveTab('branches')} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${activeTab === 'branches' ? 'bg-sys-primary text-white border-sys-primary shadow-lg shadow-blue-900/20' : 'bg-sys-surface border-white/5 text-white/60 hover:text-white hover:bg-white/5'}`}>
                        <div className={`p-2 rounded-lg ${activeTab === 'branches' ? 'bg-white/20' : 'bg-white/5'}`}><Building2 size={18} /></div>
                        <div className="text-right flex-1"><div className="font-bold text-xs">الفروع</div><div className="text-[9px] opacity-60">تكويد المواقع ومراكز البيع</div></div>
                    </button>
                    <button onClick={() => setActiveTab('warehouses')} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${activeTab === 'warehouses' ? 'bg-sys-primary text-white border-sys-primary shadow-lg shadow-blue-900/20' : 'bg-sys-surface border-white/5 text-white/60 hover:text-white hover:bg-white/5'}`}>
                        <div className={`p-2 rounded-lg ${activeTab === 'warehouses' ? 'bg-white/20' : 'bg-white/5'}`}><Warehouse size={18} /></div>
                        <div className="text-right flex-1"><div className="font-bold text-xs">المخازن</div><div className="text-[9px] opacity-60">تكويد وربط المستودعات</div></div>
                    </button>
                    
                    <div className="h-[1px] bg-white/5 my-2"></div>

                    <button onClick={() => setActiveTab('reset')} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${activeTab === 'reset' ? 'bg-sys-danger text-white border-sys-danger shadow-lg shadow-red-900/30' : 'bg-sys-surface border-white/5 text-sys-danger/40 hover:text-sys-danger hover:bg-sys-danger/5'}`}>
                        <div className={`p-2 rounded-lg ${activeTab === 'reset' ? 'bg-white/20' : 'bg-sys-danger/5'}`}><Bomb size={18} /></div>
                        <div className="text-right flex-1"><div className="font-bold text-xs">تصفير البيانات</div><div className="text-[9px] opacity-60">مسح شامل لمدخلات النظام</div></div>
                    </button>
                </nav>
                
                <div className="mt-auto p-4 bg-sys-surface-elevated rounded-xl border border-sys-warning/20">
                    <div className="flex items-center gap-2 text-sys-warning mb-2 justify-end"><span className="text-[10px] font-black uppercase tracking-widest">إدارة الصلاحيات</span><ShieldAlert size={14} /></div>
                    <p className="text-[9px] text-white/40 leading-relaxed italic text-right">سيتم فتح الأيقونات التي تحددها فقط للمستخدم، بينما تظل باقي العمليات مغلقة تماماً لضمان سرية البيانات.</p>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 min-w-0 h-full overflow-hidden">{renderContent()}</div>

            {/* --- WAREHOUSE MODAL --- */}
            {isWarehouseModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-sys-primary/10 rounded-xl text-sys-primary"><Warehouse size={22} /></div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">{isEditingWarehouse ? 'تعديل بيانات مخزن' : 'تكويد مخزن جديد'}</h3>
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest">Warehouse Definition & Network Mapping</p>
                                </div>
                            </div>
                            <button onClick={() => setIsWarehouseModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-1 text-right block">كود المخزن (Unique ID)</label>
                                    <input 
                                        type="text" 
                                        value={warehouseForm.id} 
                                        onChange={e => setWarehouseForm({...warehouseForm, id: e.target.value})}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none transition-all shadow-inner text-right"
                                        placeholder="مثال: WH-MAIN"
                                        disabled={isEditingWarehouse}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-1 text-right block">اسم المخزن</label>
                                    <input 
                                        type="text" 
                                        value={warehouseForm.name} 
                                        onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none transition-all shadow-inner text-right"
                                        placeholder="مثال: مخزن الخامات الرئيسي"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-1 text-right block">تصنيف المخزن</label>
                                    <select 
                                        value={warehouseForm.type} 
                                        onChange={e => setWarehouseForm({...warehouseForm, type: e.target.value as any})}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none text-right"
                                    >
                                        <option value="رئيسي">مخزن رئيسي</option>
                                        <option value="فرعي">مخزن فرعي</option>
                                        <option value="مطبخ">مطبخ / إنتاج</option>
                                        <option value="خامات">مخزن خامات أولية</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-1 text-right block">أمين المخزن المسؤول</label>
                                    <select 
                                        value={warehouseForm.managerId} 
                                        onChange={e => setWarehouseForm({...warehouseForm, managerId: e.target.value})}
                                        className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none text-right"
                                    >
                                        <option value="">-- اختر أمين مخزن --</option>
                                        {users.filter(u => u.status === 'نشط' && (u.role === 'أمين مخزن' || u.role === 'مدير نظام')).map(u => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-2 space-y-3">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-row-reverse">
                                        <label className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-1 flex items-center gap-2"><Building2 size={12}/> ربط المخزن بالفروع</label>
                                        <span className="text-[10px] text-sys-primary bg-sys-primary/10 px-2 py-0.5 rounded-full font-bold">تم ربط {warehouseForm.branchIds.length} فروع</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {branches.map(branch => {
                                            const isSelected = warehouseForm.branchIds.includes(branch.id);
                                            return (
                                                <button 
                                                    key={branch.id}
                                                    onClick={() => toggleBranchLink(branch.id)}
                                                    className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-right flex-row-reverse ${isSelected ? 'bg-sys-primary/10 border-sys-primary text-white shadow-lg shadow-blue-900/10' : 'bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5'}`}
                                                >
                                                    <div className={`w-3 h-3 rounded border flex items-center justify-center ${isSelected ? 'bg-sys-primary border-sys-primary' : 'border-white/20'}`}>
                                                        {isSelected && <Check size={8} className="text-white" strokeWidth={4} />}
                                                    </div>
                                                    <span className="text-[11px] font-bold truncate flex-1 text-right">{branch.name}</span>
                                                </button>
                                            );
                                        })}
                                        {branches.length === 0 && <div className="col-span-3 py-4 text-center text-white/20 text-[10px] italic">يرجى تكويد الفروع أولاً لتتمكن من ربط المخزن بها</div>}
                                    </div>
                                </div>

                                <div className="md:col-span-2 bg-white/[0.03] p-4 rounded-xl border border-white/5 flex items-center justify-between mt-4 flex-row-reverse">
                                    <div className="flex flex-col text-right">
                                        <span className="text-sm font-bold text-white">حالة المخزن التشغيلية</span>
                                        <span className="text-[10px] text-white/40">تحديد ما إذا كان المخزن متاحاً للصرف والاستلام</span>
                                    </div>
                                    <button 
                                        onClick={() => setWarehouseForm(prev => ({...prev, status: prev.status === 'نشط' ? 'موقف' : 'نشط'}))}
                                        className={`w-12 h-6 rounded-full relative transition-colors ${warehouseForm.status === 'نشط' ? 'bg-sys-success' : 'bg-sys-danger/30'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${warehouseForm.status === 'نشط' ? 'left-7' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 bg-black/40 border-t border-white/5 flex justify-between items-center flex-row-reverse">
                            <div className="flex gap-3">
                                <button 
                                    onClick={handleSaveWarehouse}
                                    className="px-10 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-black shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-all flex items-center gap-2"
                                >
                                    <Save size={16} /> {isEditingWarehouse ? 'حفظ التعديلات' : 'إنشاء المخزن'}
                                </button>
                                <button onClick={() => setIsWarehouseModalOpen(false)} className="px-6 py-2.5 text-white/40 text-xs font-bold hover:text-white transition-all">إلغاء</button>
                            </div>
                            {isEditingWarehouse && (
                                <button onClick={() => handleDeleteWarehouse(warehouseForm.id)} className="px-4 py-2 text-sys-danger text-xs font-bold hover:bg-sys-danger/10 rounded-lg flex items-center gap-2 transition-all"><Trash2 size={14} /> حذف المخزن</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- BRANCH MODAL --- */}
            {isBranchModalOpen && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-sys-warning/10 rounded-xl text-sys-warning"><Building2 size={22} /></div>
                                <h3 className="font-bold text-white text-lg">{isEditingBranch ? 'تعديل فرع' : 'تكويد فرع جديد'}</h3>
                            </div>
                            <button onClick={() => setIsBranchModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase text-right block">كود الفرع</label><input type="text" value={branchForm.id} onChange={e => setBranchForm({...branchForm, id: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white text-right" disabled={isEditingBranch} /></div>
                                <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase text-right block">اسم الفرع</label><input type="text" value={branchForm.name} onChange={e => setBranchForm({...branchForm, name: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white text-right" /></div>
                                <div className="space-y-1.5 md:col-span-2"><label className="text-[10px] text-white/40 font-bold uppercase text-right block">العنوان</label><input type="text" value={branchForm.location} onChange={e => setBranchForm({...branchForm, location: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white text-right" /></div>
                                <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase text-right block">المدير</label><select value={branchForm.managerId} onChange={e => setBranchForm({...branchForm, managerId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white text-right"><option value="">-- اختر مدير --</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                                <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase text-right block">الحالة</label><select value={branchForm.status} onChange={e => setBranchForm({...branchForm, status: e.target.value as any})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white text-right"><option value="نشط">نشط</option><option value="مغلق">مغلق</option></select></div>
                            </div>
                        </div>
                        <div className="p-5 bg-black/40 border-t border-white/5 flex justify-end gap-3"><button onClick={() => setIsBranchModalOpen(false)} className="px-6 py-2.5 text-white/40 text-xs font-bold">إلغاء</button><button onClick={handleSaveBranch} className="px-10 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-black shadow-lg"><Save size={16} className="ml-2 inline" /> حفظ</button></div>
                    </div>
                </div>
            )}

            {/* --- USER MODAL --- */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-sys-primary/10 rounded-xl text-sys-primary"><KeyRound size={22} /></div>
                                <h3 className="font-bold text-white text-lg">{isEditingUser ? 'تعديل مستخدم' : 'تكويد مستخدم جديد'}</h3>
                            </div>
                            <button onClick={() => setIsUserModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <div className="flex border-b border-white/5 bg-black/20">
                            <button onClick={() => setUserModalTab('general')} className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${userModalTab === 'general' ? 'border-sys-primary text-sys-primary bg-sys-primary/5' : 'border-transparent text-white/30 hover:text-white/60'}`}><UserPlus size={14} /> بيانات الحساب</button>
                            <button onClick={() => setUserModalTab('permissions')} className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${userModalTab === 'permissions' ? 'border-sys-primary text-sys-primary bg-sys-primary/5' : 'border-transparent text-white/30 hover:text-white/60'}`}><ShieldCheck size={14} /> صلاحيات الوصول</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {userModalTab === 'general' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2 p-4 bg-sys-warning/5 border border-sys-warning/20 rounded-2xl flex items-start gap-3">
                                        <AlertTriangle size={20} className="text-sys-warning shrink-0 mt-1" />
                                        <p className="text-[10px] text-sys-warning leading-relaxed font-bold">
                                            تنبيه هام: سيتم قفل كافة الأيقونات غير المحددة في تبويب "صلاحيات الوصول" فور حفظ البيانات، عدا لوحة التحكم المتاحة دائماً.
                                        </p>
                                    </div>
                                    <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase text-right block">الاسم الكامل</label><input type="text" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white text-right focus:border-sys-primary outline-none transition-all" /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase text-right block">اسم المستخدم (Login Email)</label><input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white text-right focus:border-sys-primary outline-none transition-all" /></div>
                                    <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase text-right block">الدور الوظيفي</label><select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as any})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white text-right focus:border-sys-primary outline-none"><option value="مدير نظام">مدير نظام</option><option value="مدير فرع">مدير فرع</option><option value="محاسب تكاليف">محاسب تكاليف</option><option value="أمين مخزن">أمين مخزن</option><option value="كاشير">كاشير</option></select></div>
                                    <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase text-right block">الفرع التابع</label><select value={userForm.branchId} onChange={e => setUserForm({...userForm, branchId: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white text-right focus:border-sys-primary outline-none"><option value="">-- اختر فرع --</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                    <div className="md:col-span-2 bg-white/[0.03] p-4 rounded-xl border border-white/5 flex items-center justify-between flex-row-reverse"><div><span className="text-sm font-bold text-white">حالة الحساب</span></div><button onClick={() => setUserForm(prev => ({...prev, status: prev.status === 'نشط' ? 'موقف' : 'نشط'}))} className={`w-12 h-6 rounded-full relative transition-colors ${userForm.status === 'نشط' ? 'bg-sys-success' : 'bg-sys-danger/30'}`}><div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${userForm.status === 'نشط' ? 'left-7' : 'left-1'}`}></div></button></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="md:col-span-2 bg-sys-primary/10 p-3 rounded-xl border border-sys-primary/20 mb-2">
                                        <p className="text-[10px] text-sys-primary font-bold text-center uppercase tracking-widest flex items-center justify-center gap-2">
                                            <LayoutDashboard size={12} /> لوحة التحكم مفتوحة تلقائياً للجميع
                                        </p>
                                    </div>
                                    {SYSTEM_MODULES.map(module => {const isSelected = userForm.permissions.includes(module.id);return (<button key={module.id} onClick={() => setUserForm(prev => ({ ...prev, permissions: isSelected ? prev.permissions.filter(p => p !== module.id) : [...prev.permissions, module.id] }))} className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-right flex-row-reverse ${isSelected ? 'bg-sys-primary/10 border-sys-primary text-white' : 'bg-white/[0.02] border-white/5 text-white/40'}`}><div className={`p-2 rounded-lg ${isSelected ? 'bg-sys-primary text-white' : 'bg-white/5'}`}><module.icon size={16} /></div><span className="text-xs font-bold flex-1 text-right">{module.label}</span>{isSelected && <CheckCircle2 size={14} className="text-sys-primary" />}</button>);})}
                                </div>
                            )}
                        </div>
                        <div className="p-5 bg-black/40 border-t border-white/5 flex justify-end gap-3"><button onClick={() => setIsUserModalOpen(false)} className="px-6 py-2.5 text-white/40 text-xs font-bold">إلغاء</button><button onClick={handleSaveUser} className="px-10 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-black shadow-lg"><Save size={16} /> حفظ الصلاحيات</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};
