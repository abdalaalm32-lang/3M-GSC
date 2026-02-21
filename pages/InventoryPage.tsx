
import React, { useState, useEffect, useMemo } from 'react';
import { DataGrid } from '../components/DataGrid';
import { Package, Layers, Tag, Scale, Archive, X, Save, Check, Building2, Calculator, Info, RefreshCw, Filter, Search, Store, Warehouse, MapPin, ShieldCheck, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';

// --- Helpers ---
const safeJsonParse = (value: string | null, fallback: any) => {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

// --- Data Structures ---

const inventoryBalanceColumns = [
  { key: 'id', label: 'كود الصنف', sortable: true },
  { key: 'name', label: 'اسم الصنف', sortable: true },
  { key: 'category', label: 'الفئة', sortable: true },
  { key: 'stockUnit', label: 'الوحدة' },
  { key: 'currentStock', label: 'الرصيد الحالي', sortable: true },
  { key: 'avgCost', label: 'متوسط التكلفة', sortable: true },
  { key: 'totalValue', label: 'قيمة المخزون', sortable: true },
];

const materialCategoriesColumns = [
  { key: 'id', label: 'كود المجموعة' },
  { key: 'name', label: 'اسم المجموعة', sortable: true },
  { key: 'type', label: 'نوع التخزين' },
  { key: 'active', label: 'فعال' },
];

const departmentsColumns = [
  { key: 'id', label: 'كود القسم' },
  { key: 'name', label: 'اسم القسم', sortable: true },
  { key: 'manager', label: 'المدير المسؤول' },
  { key: 'active', label: 'الحالة' },
];

const materialItemsDefColumns = [
  { key: 'id', label: 'كود التعريف' },
  { key: 'name', label: 'اسم الخامة', sortable: true },
  { key: 'category', label: 'المجموعة' },
  { key: 'department', label: 'القسم' },
  { key: 'stockUnit', label: 'وحدة التخزين' },
  { key: 'standardCost', label: 'التكلفة المعيارية' },
  { key: 'active', label: 'الحالة' },
];

// --- Interfaces ---
interface CategoryForm {
    id: string;
    name: string;
    type: string;
    active: string;
}

interface DepartmentForm {
    id: string;
    name: string;
    manager: string;
    active: string;
}

interface ItemForm {
    id: string;
    name: string;
    category: string;
    department: string;
    stockUnit: string;
    recipeUnit: string;
    conversionFactor: number;
    minLevel: number;
    reorderLevel: number;
    maxLevel: number;
    standardCost: number | ''; 
    avgCost: number;
    active: string;
    currentStock?: number; 
}

export const InventoryPage: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<'balance' | 'materials'>('balance');
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'categories' | 'departments'>('items');
  const [showArchived, setShowArchived] = useState(false);

  const [selectedBalanceWarehouseId, setSelectedBalanceWarehouseId] = useState<string>('all');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  const [categories, setCategories] = useState<any[]>(() => safeJsonParse(localStorage.getItem('gsc_categories'), []));
  const [departments, setDepartments] = useState<any[]>(() => safeJsonParse(localStorage.getItem('gsc_departments'), []));
  const [items, setItems] = useState<any[]>(() => safeJsonParse(localStorage.getItem('gsc_items'), []));

  useEffect(() => {
    localStorage.setItem('gsc_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('gsc_departments', JSON.stringify(departments));
  }, [departments]);

  useEffect(() => {
    localStorage.setItem('gsc_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    setShowArchived(false);
    try {
        setWarehouses(safeJsonParse(localStorage.getItem('gsc_warehouses_config'), []));
    } catch (e) {
        console.error("Error loading data", e);
    }
  }, [activeSubTab, activeMainTab]);


  // 🔥 محرك الأرصدة البسيط الذي يقرأ من جدول الأصناف مباشرة 🔥
  const getBalanceData = () => {
    return items.filter(i => i.active === 'نعم').map(item => {
        const qty = Number(item.currentStock) || 0;
        const cost = Number(item.avgCost) || 0;

        return {
            ...item,
            currentStock: qty.toFixed(2),
            avgCost: cost.toFixed(2),
            totalValue: (qty * cost).toFixed(2)
        };
    });
  };

  const handleArchiveCategory = () => {
      if (!categoryForm.id) return;
      const newStatus = categoryForm.active === 'نعم' ? 'لا' : 'نعم';
      setCategories(prev => prev.map(c => c.id === categoryForm.id ? { ...c, active: newStatus } : c));
      setIsCategoryModalOpen(false);
  };

  const handleArchiveDepartment = () => {
      if (!departmentForm.id) return;
      const newStatus = departmentForm.active === 'نعم' ? 'لا' : 'نعم';
      setDepartments(prev => prev.map(d => d.id === departmentForm.id ? { ...d, active: newStatus } : d));
      setIsDepartmentModalOpen(false);
  };

  const handleArchiveItem = () => {
      if (!itemForm.id) return;
      const newStatus = itemForm.active === 'نعم' ? 'لا' : 'نعم';
      setItems(prev => prev.map(i => i.id === itemForm.id ? { ...i, active: newStatus } : i));
      setIsItemModalOpen(false);
  };

  const handleOpenAddCategory = () => {
      setCategoryForm({ id: '', name: '', type: 'مخزون عام', active: 'نعم' });
      setIsCategoryModalOpen(true);
  };
  
  const handleEditCategory = (row: any) => {
      setCategoryForm({ ...row });
      setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = () => {
      if (!categoryForm.name.trim()) return;
      if (categoryForm.id) {
          setCategories(prev => prev.map(cat => cat.id === categoryForm.id ? { ...categoryForm } : cat));
      } else {
          const newId = `CAT-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
          setCategories(prev => [...prev, { ...categoryForm, id: newId }]);
      }
      setIsCategoryModalOpen(false);
  };

  const handleOpenAddDepartment = () => {
      setIsEditingDept(false);
      setDepartmentForm({ id: '', name: '', manager: '', active: 'نعم' });
      setIsDepartmentModalOpen(true);
  };

  const handleEditDepartment = (row: any) => {
      setIsEditingDept(true);
      setDepartmentForm({ ...row });
      setIsDepartmentModalOpen(true);
  };

  const handleSaveDepartment = () => {
      if (!departmentForm.name.trim()) return;
      let finalId = departmentForm.id.trim();
      if (!isEditingDept) {
          if (!finalId) finalId = `DEP-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
          setDepartments(prev => [...prev, { ...departmentForm, id: finalId }]);
      } else {
          setDepartments(prev => prev.map(d => d.id === finalId ? { ...departmentForm } : d));
      }
      setIsDepartmentModalOpen(false);
  };

  const handleOpenAddItem = () => {
      setIsEditingItem(false);
      setItemForm({
          id: '', name: '', category: categories[0]?.name || '', department: departments[0]?.name || '',
          stockUnit: 'كيلوجرام', recipeUnit: 'جرام', conversionFactor: 1000,
          minLevel: 0, reorderLevel: 10, maxLevel: 100, standardCost: '', avgCost: 0, active: 'نعم'
      });
      setIsItemModalOpen(true);
  };

  const handleEditItem = (row: any) => {
      setIsEditingItem(true);
      setItemForm({ ...row });
      setIsItemModalOpen(true);
  };

  const handleSaveItem = () => {
      if (!itemForm.id.trim() || !itemForm.name.trim()) return alert('يرجى إكمال البيانات الأساسية');
      const finalId = itemForm.id.trim();
      const finalStandardCost = itemForm.standardCost === '' ? 0 : Number(itemForm.standardCost);

      const itemData = {
          ...itemForm,
          standardCost: finalStandardCost,
          id: finalId,
          currentStock: isEditingItem ? (items.find(i => i.id === finalId)?.currentStock || 0) : 0,
          avgCost: isEditingItem ? (items.find(i => i.id === finalId)?.avgCost || 0) : 0,
      };

      if (!isEditingItem) setItems(prev => [...prev, itemData]);
      else setItems(prev => prev.map(i => i.id === finalId ? itemData : i));
      setIsItemModalOpen(false);
  };

  const displayedItems = items.filter(i => showArchived ? i.active === 'لا' : i.active === 'نعم');
  const displayedCategories = categories.filter(c => showArchived ? c.active === 'لا' : c.active === 'نعم');
  const displayedDepartments = departments.filter(d => showArchived ? d.active === 'لا' : d.active === 'نعم');

  const getLocationName = () => {
    if (selectedBalanceWarehouseId === 'all') return "أرصدة المخازن الكلية (Global Warehouse Stock)";
    const wh = warehouses.find(w => w.id === selectedBalanceWarehouseId);
    return wh ? `أرصدة مخزن: ${wh.name}` : "أرصدة الموقع المختار";
  };

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({ id: '', name: '', type: 'مخزون عام', active: 'نعم' });
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [isEditingDept, setIsEditingDept] = useState(false);
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>({ id: '', name: '', manager: '', active: 'نعم' });
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [itemForm, setItemForm] = useState<ItemForm>({
      id: '', name: '', category: '', department: '', stockUnit: 'كيلوجرام',
      recipeUnit: 'جرام', conversionFactor: 1000, minLevel: 0, reorderLevel: 0,
      maxLevel: 0, standardCost: '', avgCost: 0, active: 'نعم'
  });

  return (
    <div className="flex flex-col h-full gap-4 relative font-sans">
      
      {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                      <h3 className="font-bold text-white flex items-center gap-2"><Layers size={18} className="text-sys-primary" /> {categoryForm.id ? 'تعديل مجموعة' : 'إضافة مجموعة جديدة'}</h3>
                      <button onClick={() => setIsCategoryModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="space-y-1"><label className="text-xs text-white/60">اسم المجموعة <span className="text-sys-danger">*</span></label><input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-sys-primary outline-none" /></div>
                      <div className="space-y-1"><label className="text-xs text-white/60">نوع التخزين</label><select value={categoryForm.type} onChange={(e) => setCategoryForm({...categoryForm, type: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-sys-primary outline-none"><option>مخزون عام</option><option>مبردات</option><option>مجمدات</option><option>مخزون استراتيجي</option><option>مستهلكات وتشغيل</option></select></div>
                  </div>
                  <div className="p-4 bg-[#181818] border-t border-white/5 flex justify-between items-center">
                    {categoryForm.id && (
                        <button onClick={handleArchiveCategory} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${categoryForm.active === 'نعم' ? 'text-sys-warning bg-sys-warning/10 hover:bg-sys-warning hover:text-black' : 'text-sys-success bg-sys-success/10 hover:bg-sys-success hover:text-white'}`}>
                            {categoryForm.active === 'نعم' ? <><Archive size={14} /> أرشفة</> : <><RefreshCw size={14} /> إعادة تفعيل</>}
                        </button>
                    )}
                    <div className="flex gap-2 mr-auto">
                        <button onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">إغلاق</button>
                        <button onClick={handleSaveCategory} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-sys-primary hover:bg-blue-600 transition-all">حفظ</button>
                    </div>
                  </div>
              </div>
          </div>
      )}

      {isDepartmentModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                      <h3 className="font-bold text-white flex items-center gap-2"><Building2 size={18} className="text-sys-primary" /> {isEditingDept ? 'تعديل قسم' : 'إضافة قسم جديد'}</h3>
                      <button onClick={() => setIsDepartmentModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={18} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="space-y-1"><label className="text-xs text-white/60">كود القسم</label><input type="text" value={departmentForm.id} onChange={(e) => setDepartmentForm({...departmentForm, id: e.target.value})} disabled={isEditingDept} placeholder="تلقائي" className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-sys-primary outline-none disabled:opacity-50" /></div>
                      <div className="space-y-1"><label className="text-xs text-white/60">اسم القسم <span className="text-sys-danger">*</span></label><input type="text" value={departmentForm.name} onChange={(e) => setDepartmentForm({...departmentForm, name: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-sys-primary outline-none" /></div>
                      <div className="space-y-1"><label className="text-xs text-white/60">المدير المسؤول</label><input type="text" value={departmentForm.manager} onChange={(e) => setDepartmentForm({...departmentForm, manager: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-sys-primary outline-none" /></div>
                  </div>
                  <div className="p-4 bg-[#181818] border-t border-white/5 flex justify-between items-center">
                    {departmentForm.id && (
                        <button onClick={handleArchiveDepartment} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${departmentForm.active === 'نعم' ? 'text-sys-warning bg-sys-warning/10 hover:bg-sys-warning hover:text-black' : 'text-sys-success bg-sys-success/10 hover:bg-sys-success hover:text-white'}`}>
                            {departmentForm.active === 'نعم' ? <><Archive size={14} /> أرشفة</> : <><RefreshCw size={14} /> إعادة تفعيل</>}
                        </button>
                    )}
                    <div className="flex gap-2 mr-auto">
                        <button onClick={() => setIsDepartmentModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">إغلاق</button>
                        <button onClick={handleSaveDepartment} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-sys-primary hover:bg-blue-600 transition-all">حفظ</button>
                    </div>
                  </div>
              </div>
          </div>
      )}

      {isItemModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
              <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden my-8">
                  <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sys-primary/10 rounded-xl text-sys-primary"><Scale size={22} /></div>
                        <div>
                            <h3 className="font-bold text-white text-lg">{isEditingItem ? 'تعديل صنف مخزون' : 'تكويد صنف مخزون جديد'}</h3>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-black">Item Master Definition & Configuration</p>
                        </div>
                    </div>
                    <button onClick={() => setIsItemModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                  </div>
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      <div className="space-y-6">
                          <div>
                              <h4 className="text-sys-primary text-[11px] font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                                  <ShieldCheck size={14} /> البيانات الأساسية والتكلفة
                              </h4>
                              <div className="grid grid-cols-1 gap-4">
                                  <div className="space-y-1.5">
                                      <label className="text-[10px] text-white/40 font-bold uppercase tracking-wide px-1">كود التعريف الفريد <span className="text-sys-danger">*</span></label>
                                      <input type="text" value={itemForm.id} onChange={(e) => setItemForm({...itemForm, id: e.target.value})} disabled={isEditingItem} className={`w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none transition-all shadow-inner ${isEditingItem ? 'opacity-50' : ''}`} placeholder="مثال: RAW-001" />
                                  </div>
                                  <div className="space-y-1.5">
                                      <label className="text-[10px] text-white/40 font-bold uppercase tracking-wide px-1">اسم الصنف <span className="text-sys-danger">*</span></label>
                                      <input type="text" value={itemForm.name} onChange={(e) => setItemForm({...itemForm, name: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none transition-all shadow-inner" placeholder="اسم الخامة باللغة العربية" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                          <label className="text-[10px] text-white/40 font-bold uppercase tracking-wide px-1">المجموعة</label>
                                          <select value={itemForm.category} onChange={(e) => setItemForm({...itemForm, category: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none shadow-inner">
                                              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                          </select>
                                      </div>
                                      <div className="space-y-1.5">
                                          <label className="text-[10px] text-white/40 font-bold uppercase tracking-wide px-1">القسم التشغيلي</label>
                                          <select value={itemForm.department} onChange={(e) => setItemForm({...itemForm, department: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none shadow-inner">
                                              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                                          </select>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div className="p-5 bg-sys-primary/5 border border-sys-primary/20 rounded-2xl space-y-4">
                              <h4 className="text-sys-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><DollarSign size={14} /> تحليل التكلفة المخططة</h4>
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase tracking-wide px-1">التكلفة المعيارية</label><div className="relative"><input type="number" step="0.01" value={itemForm.standardCost} onChange={(e) => setItemForm({...itemForm, standardCost: e.target.value === '' ? '' : parseFloat(e.target.value)})} className="w-full bg-sys-bg border border-sys-primary/30 rounded-xl p-3 pr-8 text-sm text-white focus:border-sys-primary outline-none" placeholder="0.00" /><DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" /></div></div>
                                  <div className="space-y-1.5 opacity-60"><label className="text-[10px] text-white/40 font-bold uppercase tracking-wide px-1">متوسط التكلفة الفعلي</label><div className="w-full bg-[#121212] border border-white/5 rounded-xl p-3 text-sm text-sys-success font-black text-center shadow-inner">{itemForm.avgCost.toFixed(2)} ج.م</div></div>
                              </div>
                          </div>
                      </div>
                      <div className="space-y-8">
                           <div>
                                <h4 className="text-sys-primary text-[11px] font-black uppercase tracking-wider mb-4 flex items-center gap-2"><Calculator size={14} /> الوحدات ومعامل التحويل</h4>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase tracking-wide px-1">وحدة التخزين</label><select value={itemForm.stockUnit} onChange={(e) => setItemForm({...itemForm, stockUnit: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white outline-none"><option>كيلوجرام</option><option>لتر</option><option>كرتونة</option><option>وحدة</option><option>شكارة</option></select></div>
                                    <div className="space-y-1.5"><label className="text-[10px] text-white/40 font-bold uppercase tracking-wide px-1">وحدة الوصفة</label><select value={itemForm.recipeUnit} onChange={(e) => setItemForm({...itemForm, recipeUnit: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white outline-none"><option>جرام</option><option>مليليتر</option><option>قطعة</option><option>وحدة</option></select></div>
                                </div>
                                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 flex items-center justify-between"><div className="flex flex-col"><span className="text-[10px] text-white/30 font-bold uppercase">معامل التحويل (1 {itemForm.stockUnit} يساوى)</span><input type="number" value={itemForm.conversionFactor} onChange={(e) => setItemForm({...itemForm, conversionFactor: parseFloat(e.target.value)})} className="bg-transparent border-none text-xl font-black text-sys-primary outline-none focus:ring-0 p-0 mt-1" /></div><span className="text-xs text-white/20 font-bold uppercase">{itemForm.recipeUnit}</span></div>
                           </div>
                           <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl">
                                <h4 className="text-white text-[11px] font-black uppercase tracking-wider mb-5 flex items-center gap-2"><TrendingUp size={16} className="text-sys-warning" /> مستويات المخزون (Par Levels)</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5"><label className="text-[9px] text-white/40 font-black uppercase text-center block">الحد الأدنى</label><input type="number" value={itemForm.minLevel} onChange={(e) => setItemForm({...itemForm, minLevel: parseFloat(e.target.value)})} className="w-full bg-sys-bg border border-sys-danger/20 rounded-xl p-3 text-center text-sm font-black text-sys-danger focus:border-sys-danger outline-none" /></div>
                                    <div className="space-y-1.5"><label className="text-[9px] text-white/40 font-black uppercase text-center block">إعادة الطلب</label><input type="number" value={itemForm.reorderLevel} onChange={(e) => setItemForm({...itemForm, reorderLevel: parseFloat(e.target.value)})} className="w-full bg-sys-bg border border-sys-warning/20 rounded-xl p-3 text-center text-sm font-black text-sys-warning focus:border-sys-warning outline-none" /></div>
                                    <div className="space-y-1.5"><label className="text-[9px] text-white/40 font-black uppercase text-center block">الحد الأقصى</label><input type="number" value={itemForm.maxLevel} onChange={(e) => setItemForm({...itemForm, maxLevel: parseFloat(e.target.value)})} className="w-full bg-sys-bg border border-sys-success/20 rounded-xl p-3 text-center text-sm font-black text-sys-success focus:border-sys-success outline-none" /></div>
                                </div>
                           </div>
                      </div>
                  </div>
                  <div className="p-5 bg-black/40 border-t border-white/5 flex justify-between items-center px-8">
                       {isEditingItem && (
                           <button onClick={handleArchiveItem} className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg ${itemForm.active === 'نعم' ? 'text-sys-warning bg-sys-warning/10 border border-sys-warning/20 hover:bg-sys-warning hover:text-black' : 'text-sys-success bg-sys-success/10 border border-sys-success/20 hover:bg-sys-success hover:text-white'}`}>{itemForm.active === 'نعم' ? <><Archive size={16} /> أرشفة الصنف</> : <><RefreshCw size={16} /> إعادة تفعيل</>}</button>
                       )}
                       <div className="flex gap-4 mr-auto"><button onClick={() => setIsItemModalOpen(false)} className="px-6 py-3 rounded-xl text-sm font-bold text-white/40 hover:text-white transition-all">إلغاء</button><button onClick={handleSaveItem} className="px-10 py-3 rounded-xl text-sm font-black text-white bg-sys-primary hover:bg-blue-600 shadow-xl shadow-blue-900/20 transition-all flex items-center gap-3 active:scale-95"><Save size={18} /> حفظ بيانات الصنف</button></div>
                  </div>
              </div>
          </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-4 border-b border-white/10 pb-4">
        <button onClick={() => setActiveMainTab('balance')} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${activeMainTab === 'balance' ? 'bg-sys-primary text-white border-sys-primary shadow-lg shadow-blue-900/20' : 'bg-sys-surface text-white/60 border-white/5 hover:text-white'}`}>
          <Package size={18} /><div className="text-right"><div className="font-bold text-sm">أرصدة المخزون</div><div className="text-[10px] opacity-70">Current Stock</div></div>
        </button>
        <button onClick={() => setActiveMainTab('materials')} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${activeMainTab === 'materials' ? 'bg-sys-primary text-white border-sys-primary shadow-lg shadow-blue-900/20' : 'bg-sys-surface text-white/60 border-white/5 hover:text-white'}`}>
          <Archive size={18} /><div className="text-right"><div className="font-bold text-sm">مواد المخزون</div><div className="text-[10px] opacity-70">Stock Materials</div></div>
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {activeMainTab === 'balance' && (
           <div className="flex flex-col h-full gap-4">
             <div className="bg-sys-surface p-4 rounded-xl border border-white/5 flex items-center justify-between no-print shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-sys-primary/10 rounded-lg text-sys-primary"><Warehouse size={20} /></div>
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-tight">فلترة أرصدة المواقع</h3>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest">Global Stock Distribution</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-[#121212] border border-white/10 rounded-xl px-4 py-1.5 focus-within:border-sys-primary transition-all">
                    <Filter size={14} className="text-white/30" />
                    <select value={selectedBalanceWarehouseId} onChange={(e) => setSelectedBalanceWarehouseId(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none cursor-pointer pr-8 font-bold min-w-[220px]">
                        <option value="all" className="bg-sys-surface text-white">إجمالي كافة المخازن (Global)</option>
                        {warehouses.map(w => <option key={w.id} value={w.id} className="bg-sys-surface text-white">{w.name}</option>)}
                    </select>
                </div>
             </div>

             <div className="flex-1 min-h-0">
                <DataGrid title={getLocationName()} data={getBalanceData()} columns={inventoryBalanceColumns} />
             </div>
           </div>
        )}

        {activeMainTab === 'materials' && (
          <div className="h-full flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-500">
             <div className="flex justify-between items-end">
                 <div className="flex items-center gap-2 bg-sys-surface p-1 rounded-lg border border-white/5 w-fit shadow-lg">
                    <button onClick={() => setActiveSubTab('items')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeSubTab === 'items' ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'}`}><Scale size={14} /> تكويد الأصناف</button>
                    <button onClick={() => setActiveSubTab('categories')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeSubTab === 'categories' ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'}`}><Layers size={14} /> تكويد المجموعات</button>
                    <button onClick={() => setActiveSubTab('departments')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeSubTab === 'departments' ? 'bg-white/10 text-white shadow-sm border border-white/5' : 'text-white/40 hover:text-white hover:bg-white/5'}`}><Building2 size={14} /> تكويد الأقسام</button>
                 </div>
                 <button onClick={() => setShowArchived(!showArchived)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border shadow-lg ${showArchived ? 'bg-sys-warning/10 text-sys-warning border-sys-warning/30' : 'bg-sys-surface text-white/40 border-white/5 hover:text-white hover:border-white/20'}`}><Archive size={14} /> {showArchived ? 'العودة للقائمة النشطة' : 'عرض الأرشيف والمحذوفات'}</button>
             </div>

             <div className="flex-1 min-h-0 shadow-2xl rounded-2xl overflow-hidden">
                {activeSubTab === 'items' && <DataGrid title={showArchived ? "أرشيف أصناف المخزون" : "دليل تعريف أصناف المخزون"} data={displayedItems} columns={materialItemsDefColumns} onAdd={showArchived ? undefined : handleOpenAddItem} onRowClick={handleEditItem} />}
                {activeSubTab === 'categories' && <DataGrid title={showArchived ? "أرشيف مجموعات المخزون" : "دليل مجموعات المخزون الرئيسية"} data={displayedCategories} columns={materialCategoriesColumns} onAdd={showArchived ? undefined : handleOpenAddCategory} onRowClick={handleEditCategory} />}
                {activeSubTab === 'departments' && <DataGrid title={showArchived ? "أرشيف الأقسام التشغيلية" : "دليل الأقسام التشغيلية"} data={displayedDepartments} columns={departmentsColumns} onAdd={showArchived ? undefined : handleOpenAddDepartment} onRowClick={handleEditDepartment} />}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
