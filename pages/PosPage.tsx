import React, { useState, useEffect, useMemo } from 'react';
import { DataGrid } from '../components/DataGrid';
import { 
  Store, Tag, Coffee, History, Plus, Minus, Trash2, 
  ShoppingBag, CreditCard, Receipt, Save, X, Layers, 
  Archive, RefreshCw, Edit, Filter, Calendar, 
  AlertTriangle, CheckCircle2, Box, Info, Building2,
  TrendingUp, BarChart3, CalendarDays, PieChart, 
  Clock, ArrowUpRight, Gauge, LayoutList, ChevronRight,
  DollarSign, Search, FilterX, Percent, Printer
} from 'lucide-react';

// --- Types ---
interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface PosCategory {
    id: string;
    name: string;
    branchId: string;
    active: boolean;
}

interface PosItem {
    id: string;
    name: string;
    category: string;
    branchId: string;
    price: number;
    active: boolean;
}

interface SoldItem {
    itemId: string;
    name: string;
    qty: number;
    price: number;
}

interface SalesRecord {
    id: string;
    date: string;
    total: number;
    payment: string;
    itemsSummary: string;
    items: SoldItem[];
    status: string;
    branchId: string;
    branchName?: string;
}

interface Branch {
    id: string;
    name: string;
}

// --- Helper for LocalStorage Persistence ---
const usePersistedState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      return defaultValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
};

export const PosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'analytics' | 'setup_cats' | 'setup_items'>('pos');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isTaxEnabled, setIsTaxEnabled] = useState(true);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

  // Archive Filter States
  const [showArchivedCats, setShowArchivedCats] = useState(false);
  const [showArchivedItems, setShowArchivedItems] = useState(false);

  // Analytics Filters
  const [analyticsBranchId, setAnalyticsBranchId] = useState<string>('all');
  const [analyticsStartDate, setAnalyticsStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [analyticsEndDate, setAnalyticsEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isFiltering, setIsFiltering] = useState(false);

  // Persisted States
  const [branches] = usePersistedState<Branch[]>('gsc_branches', []);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [categories, setCategories] = usePersistedState<PosCategory[]>('gsc_pos_categories', []);
  const [items, setItems] = usePersistedState<PosItem[]>('gsc_pos_items', []);
  const [salesHistory, setSalesHistory] = usePersistedState<SalesRecord[]>('gsc_pos_sales', []);

  // Modal States
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isEditingCat, setIsEditingCat] = useState(false);
  const [catForm, setCatForm] = useState<PosCategory>({ id: '', name: '', branchId: '', active: true });
  
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [itemForm, setItemForm] = useState<PosItem>({ id: '', name: '', category: '', branchId: '', price: 0, active: true });
  
  const [isEditSaleModalOpen, setIsEditSaleModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<SalesRecord | null>(null);

  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branches[0].id);
    }
  }, [branches]);

  // --- Filtered Menu ---
  const branchCategories = useMemo(() => {
    return categories.filter(c => c.active && c.branchId === selectedBranchId);
  }, [categories, selectedBranchId]);

  const branchItems = useMemo(() => {
    return items.filter(i => i.active && i.branchId === selectedBranchId && (selectedCategory === 'الكل' || i.category === selectedCategory));
  }, [items, selectedBranchId, selectedCategory]);

  // --- Analytics ---
  const filteredAnalytics = useMemo(() => {
    return salesHistory.filter(sale => {
      if (sale.status !== 'مكتمل') return false;
      const branchMatch = analyticsBranchId === 'all' || sale.branchId === analyticsBranchId;
      if (!branchMatch) return false;
      return sale.date >= analyticsStartDate && sale.date <= analyticsEndDate;
    });
  }, [salesHistory, analyticsBranchId, analyticsStartDate, analyticsEndDate]);

  const stats = useMemo(() => {
    const totalSales = filteredAnalytics.reduce((acc, s) => acc + s.total, 0);
    const invoiceCount = filteredAnalytics.length;
    const avgCheck = invoiceCount > 0 ? totalSales / invoiceCount : 0;
    return { totalSales, invoiceCount, avgCheck };
  }, [filteredAnalytics]);

  // --- Printing Logic ---
  const handlePrintInvoice = (sale: SalesRecord) => {
    const branchName = branches.find(b => b.id === sale.branchId)?.name || sale.branchName || 'فرع غير معروف';
    const subtotal = sale.items.reduce((s, i) => s + (i.qty * i.price), 0);
    const tax = sale.total - subtotal;

    const itemsHtml = sale.items.map(it => `
        <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                <div style="font-weight: bold;">${it.name}</div>
                <div style="font-size: 10px; color: #666;">${it.price.toFixed(2)} x ${it.qty}</div>
            </td>
            <td style="text-align: left; padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${(it.qty * it.price).toFixed(2)}</td>
        </tr>
    `).join('');

    const html = `
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="utf-8" />
            <title>3M GSC - فاتورة رقم ${sale.id}</title>
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    width: 72mm; 
                    margin: 0 auto; 
                    padding: 10px; 
                    color: #000;
                    background: #fff;
                }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
                .title { font-size: 20px; font-weight: 900; letter-spacing: -1px; }
                .branch { font-size: 12px; font-weight: bold; margin-top: 4px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                th { border-bottom: 1px solid #000; text-align: right; padding-bottom: 5px; }
                .totals { margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px; }
                .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
                .grand-total { font-size: 18px; font-weight: 900; border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; }
                .footer { text-align: center; font-size: 10px; margin-top: 25px; border-top: 1px solid #eee; padding-top: 10px; color: #666; }
                .qr-placeholder { margin: 15px auto; width: 60px; height: 60px; border: 1px solid #eee; }
                @media print { 
                    body { width: 72mm; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">3M GSC</div>
                <div style="font-size: 10px; font-weight: bold; color: #444; text-transform: uppercase;">Global System Cost Control</div>
                <div class="branch">${branchName}</div>
                <div style="font-size: 11px; margin-top: 4px;">رقم الفاتورة: <b>${sale.id}</b></div>
                <div style="font-size: 11px;">التاريخ: ${sale.date}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>الصنف / الكمية</th>
                        <th style="text-align: left;">الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            <div class="totals">
                <div class="total-row"><span>الإجمالي الفرعي:</span> <span>${subtotal.toFixed(2)}</span></div>
                ${tax > 0 ? `<div class="total-row"><span>ضريبة القيمة المضافة (14%):</span> <span>${tax.toFixed(2)}</span></div>` : ''}
                <div class="total-row grand-total"><span>الإجمالي النهائي:</span> <span>${sale.total.toFixed(2)} ج.م</span></div>
            </div>
            <div class="footer">
                شكراً لزيارتكم!<br/>
                نتمنى رؤيتكم مرة أخرى قريباً<br/>
                <div style="margin-top: 5px; font-weight: bold;">نظام 3M GSC - v5.0</div>
            </div>
            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 300);
                }
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    } else {
        alert("يرجى تفعيل النوافذ المنبثقة (Pop-ups) في متصفحك لتمكين عملية الطباعة.");
    }
  };

  // --- Archive Handlers ---
  const toggleCatStatus = () => {
    const original = categories.find(c => c.id === catForm.id);
    if (!original) return;
    const newStatus = !Boolean(original.active);
    setCategories(prev => prev.map(c => (c.id === original.id ? { ...c, active: newStatus } : c)));
    setCatForm(prev => ({ ...prev, active: newStatus }));
    setIsCatModalOpen(false);
  };

  const toggleItemStatus = () => {
    const original = items.find(i => i.id === itemForm.id);
    if (!original) return;
    const newStatus = !Boolean(original.active);
    setItems(prev => prev.map(i => (i.id === original.id ? { ...i, active: newStatus } : i)));
    setItemForm(prev => ({ ...prev, active: newStatus }));
    setIsItemModalOpen(false);
  };

  // --- History Interaction Handlers (NEW) ---
  const handleCancelSale = () => {
    if (!editingSale || editingSale.status === "ملغي") return;
    setSalesHistory(prev =>
      prev.map(s => s.id === editingSale.id ? { ...s, status: "ملغي" } : s)
    );
    setEditingSale(prev => prev ? { ...prev, status: "ملغي" } : prev);
    setIsEditSaleModalOpen(false);
  };

  const updateHistoryItemQty = (itemId: string, delta: number) => {
    if (!editingSale || editingSale.status === "ملغي") return;
    const updatedItems = editingSale.items.map(it => 
      it.itemId === itemId ? { ...it, qty: Math.max(1, it.qty + delta) } : it
    );
    const subtotal = updatedItems.reduce((s, i) => s + (i.qty * i.price), 0);
    const total = parseFloat((subtotal * 1.14).toFixed(2));
    setEditingSale({
      ...editingSale,
      items: updatedItems,
      total,
      itemsSummary: updatedItems.map(c => `${c.qty}x ${c.name}`).join(', ')
    });
  };

  const removeHistoryItem = (itemId: string) => {
    if (!editingSale || editingSale.status === "ملغي") return;
    const updatedItems = editingSale.items.filter(it => it.itemId !== itemId);
    if (updatedItems.length === 0) {
        handleCancelSale();
        return;
    }
    const subtotal = updatedItems.reduce((s, i) => s + (i.qty * i.price), 0);
    const total = parseFloat((subtotal * 1.14).toFixed(2));
    setEditingSale({
      ...editingSale,
      items: updatedItems,
      total,
      itemsSummary: updatedItems.map(c => `${c.qty}x ${c.name}`).join(', ')
    });
  };

  const saveHistoryChanges = () => {
    if (!editingSale) return;
    setSalesHistory(prev => prev.map(s => s.id === editingSale.id ? editingSale : s));
    setIsEditSaleModalOpen(false);
  };

  // --- POS Actions ---
  const addToCart = (item: PosItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  };

  const handleCheckout = () => {
    if (cart.length === 0 || !selectedBranchId) return alert("يرجى اختيار الفرع وإضافة أصناف");
    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const taxAmount = isTaxEnabled ? cartTotal * 0.14 : 0;
    const finalTotal = cartTotal + taxAmount;

    const newSale: SalesRecord = {
        id: `INV-${Date.now().toString().slice(-6)}`,
        date: transactionDate, 
        total: parseFloat(finalTotal.toFixed(2)),
        payment: 'نقدي',
        itemsSummary: cart.map(c => `${c.qty}x ${c.name}`).join(', '),
        items: cart.map(c => ({ itemId: c.id, name: c.name, qty: c.qty, price: c.price })),
        status: 'مكتمل',
        branchId: selectedBranchId,
        branchName: branches.find(b => b.id === selectedBranchId)?.name || 'فرع غير معروف'
    };

    setSalesHistory([newSale, ...salesHistory]);
    setCart([]);
    alert("تم تنفيذ البيع بنجاح ✅");
    
    // Optional: Print automatically on checkout
    if (window.confirm("هل ترغب في طباعة الفاتورة؟")) {
        handlePrintInvoice(newSale);
    }
  };

  const handleSaveCategory = () => {
    if (!catForm.name.trim() || !catForm.branchId) return alert("يرجى إكمال البيانات واختيار الفرع");
    if (isEditingCat) setCategories(prev => prev.map(c => c.id === catForm.id ? catForm : c));
    else setCategories([...categories, { ...catForm, id: `CAT-${Date.now().toString().slice(-4)}` }]);
    setIsCatModalOpen(false);
  };

  const handleSaveItem = () => {
    if (!itemForm.name.trim() || !itemForm.branchId || itemForm.price <= 0) return alert("يرجى إكمال البيانات واختيار الفرع");
    if (isEditingItem) setItems(prev => prev.map(i => i.id === itemForm.id ? itemForm : i));
    else setItems([...items, { ...itemForm, id: `ITM-${Date.now().toString().slice(-4)}` }]);
    setIsItemModalOpen(false);
  };

  const openCategoryModal = (row: any) => {
    setIsEditingCat(true);
    setCatForm({ ...row });
    setIsCatModalOpen(true);
  };

  const openItemModalForEdit = (row: any) => {
    setIsEditingItem(true);
    setItemForm({ ...row });
    setIsItemModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col gap-5 relative font-sans overflow-hidden bg-[#0f1115]" dir="rtl">
      
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sys-primary/5 rounded-full blur-[140px] -mr-80 -mt-80"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-sys-success/5 rounded-full blur-[120px] -ml-60 -mb-60"></div>
      </div>

      {/* --- Top Nav --- */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 z-10 no-print">
        <div className="flex items-center gap-2 bg-[#1a1d23]/90 backdrop-blur-xl p-1.5 rounded-2xl border border-white/5 shadow-2xl">
          <button onClick={() => setActiveTab('pos')} className={`px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'pos' ? 'bg-sys-primary text-white shadow-lg shadow-blue-900/40' : 'text-white/30 hover:text-white hover:bg-white/5'}`}><CreditCard size={18} /> شاشة البيع</button>
          <button onClick={() => setActiveTab('history')} className={`px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-sys-primary text-white shadow-lg shadow-blue-900/40' : 'text-white/30 hover:text-white hover:bg-white/5'}`}><History size={18} /> سجل الفواتير</button>
          <button onClick={() => setActiveTab('analytics')} className={`px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'analytics' ? 'bg-sys-primary text-white shadow-lg shadow-blue-900/40' : 'text-white/30 hover:text-white hover:bg-white/5'}`}><BarChart3 size={18} /> ذكاء المبيعات</button>
          <div className="w-[1px] h-6 bg-white/10 mx-2"></div>
          <button onClick={() => setActiveTab('setup_cats')} className={`px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'setup_cats' ? 'bg-sys-primary text-white shadow-lg shadow-blue-900/40' : 'text-white/30 hover:text-white hover:bg-white/5'}`}><Tag size={18} /> المجموعات</button>
          <button onClick={() => setActiveTab('setup_items')} className={`px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${activeTab === 'setup_items' ? 'bg-sys-primary text-white shadow-lg shadow-blue-900/40' : 'text-white/30 hover:text-white hover:bg-white/5'}`}><Coffee size={18} /> الأصناف</button>
        </div>
        
        <div className="hidden lg:flex items-center gap-4 bg-[#1a1d23]/80 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-white/5 shadow-xl">
             <div className="flex flex-col items-end">
                <span className="text-[9px] text-white/30 font-black uppercase tracking-widest">إجمالي المبيعات المفلترة</span>
                <span className="text-lg font-black text-sys-success leading-tight">{stats.totalSales.toLocaleString()} <span className="text-xs font-normal">ج.م</span></span>
             </div>
             <div className="w-10 h-10 rounded-xl bg-sys-success/10 flex items-center justify-center text-sys-success border border-sys-success/20">
                <TrendingUp size={20} />
             </div>
        </div>
      </div>

      {/* --- Main View --- */}
      <div className="flex-1 min-h-0 z-10">
        
        {/* VIEW: POS */}
        {activeTab === 'pos' && (
          <div className="flex flex-col lg:flex-row h-full gap-5">
            {/* Menu Grid */}
            <div className="flex-1 flex flex-col gap-5 h-[calc(100vh-180px)]">
              <div className="flex items-center gap-3 shrink-0">
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button 
                      onClick={() => setSelectedCategory('الكل')} 
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border shadow-lg ${selectedCategory === 'الكل' ? 'bg-sys-primary text-white border-sys-primary' : 'bg-[#1a1d23] text-white/30 border-white/5 hover:border-white/20'}`}
                    >الكل</button>
                    {branchCategories.map(cat => (
                      <button 
                        key={cat.id} 
                        onClick={() => setSelectedCategory(cat.name)} 
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border shadow-lg ${selectedCategory === cat.name ? 'bg-sys-primary text-white border-sys-primary' : 'bg-[#1a1d23] text-white/30 border-white/5 hover:border-white/20'}`}
                      >{cat.name}</button>
                    ))}
                  </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-1 pb-10 custom-scrollbar">
                {branchItems.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => addToCart(item)} 
                    className="bg-[#1a1d23]/80 backdrop-blur-md border border-white/5 hover:border-sys-primary/50 hover:bg-sys-primary/5 p-5 rounded-[28px] cursor-pointer transition-all active:scale-95 group flex flex-col justify-between h-[160px] shadow-xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sys-primary/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-sys-primary/10 transition-all"></div>
                    <div>
                        <h3 className="text-white font-black text-sm leading-tight mb-1 group-hover:text-sys-primary transition-colors">{item.name}</h3>
                        <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">{item.category}</span>
                    </div>
                    <div className="flex justify-between items-end relative z-10">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-white/40 font-black uppercase">السعر</span>
                            <span className="text-2xl font-black text-white">{item.price} <span className="text-xs font-normal opacity-40">ج.م</span></span>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/20 group-hover:bg-sys-primary group-hover:text-white group-hover:shadow-lg shadow-blue-900/40 transition-all">
                            <Plus size={24} />
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart & Billing Section */}
            <div className="w-full lg:w-[420px] bg-[#16181d]/95 backdrop-blur-2xl border border-white/5 rounded-[40px] flex flex-col h-[calc(100vh-180px)] shadow-[0_40px_80px_rgba(0,0,0,0.8)] overflow-hidden shrink-0 relative">
              
              <div className="p-8 border-b border-white/5 bg-white/[0.01] flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-white font-black text-xl flex items-center gap-3"><ShoppingBag size={26} className="text-sys-primary" /> تفاصيل الفاتورة</h2>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsTaxEnabled(!isTaxEnabled)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isTaxEnabled ? 'bg-sys-success/10 border-sys-success text-sys-success' : 'bg-white/5 border-white/10 text-white/30 hover:text-white/50'}`}
                        >
                            <Percent size={12} />
                            <span className="text-[9px] font-black uppercase tracking-widest">{isTaxEnabled ? 'الضريبة نشطة' : 'بدون ضريبة'}</span>
                        </button>
                        <button onClick={() => setCart([])} className="text-[10px] font-black text-sys-danger/40 hover:text-sys-danger uppercase tracking-widest transition-colors">تصفير</button>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/60 p-4 rounded-2xl border border-white/5 shadow-inner group hover:border-sys-primary/40 transition-all">
                        <label className="text-[10px] text-white/20 font-black uppercase tracking-widest flex items-center gap-2 mb-1"><Building2 size={12} className="text-sys-warning" /> الفرع النشط</label>
                        <select 
                            value={selectedBranchId} 
                            onChange={(e) => { setSelectedBranchId(e.target.value); setSelectedCategory('الكل'); setCart([]); }} 
                            className="w-full bg-transparent text-xs text-white outline-none font-black cursor-pointer"
                        >
                            {branches.map(b => <option key={b.id} value={b.id} className="bg-[#1a1d23] text-white">{b.name}</option>)}
                        </select>
                    </div>
                    <div className="bg-black/60 p-4 rounded-2xl border border-white/5 shadow-inner group hover:border-sys-primary/40 transition-all">
                        <label className="text-[10px] text-white/20 font-black uppercase tracking-widest flex items-center gap-2 mb-1"><Calendar size={12} className="text-sys-primary" /> تاريخ البيع</label>
                        <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="w-full bg-transparent text-xs text-white outline-none font-black" />
                    </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 gap-8">
                        <div className="w-32 h-32 rounded-full border-4 border-dashed border-white flex items-center justify-center animate-spin-slow"><ShoppingBag size={64} /></div>
                        <p className="text-sm font-black uppercase tracking-[0.4em] text-center leading-loose">READY TO PROCESS<br/>NEW ORDER</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <div key={item.id} className="bg-black/30 p-5 rounded-[24px] border border-white/5 flex justify-between items-center group animate-in slide-in-from-right duration-500">
                          <div className="flex-1">
                            <div className="text-white font-black text-sm mb-1">{item.name}</div>
                            <div className="text-white/20 text-[10px] font-black uppercase tracking-tighter">{item.price} ج.م / الوحدة</div>
                          </div>
                          <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl p-1.5 mx-4 shadow-inner">
                            <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all"><Minus size={16} /></button>
                            <span className="text-sm font-black w-6 text-center text-sys-primary">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all"><Plus size={16} /></button>
                          </div>
                          <div className="text-right min-w-[90px]">
                            <div className="text-base font-black text-white">{(item.price * item.qty).toFixed(2)}</div>
                            <button onClick={() => updateQty(item.id, -item.qty)} className="text-[9px] text-sys-danger/40 hover:text-sys-danger font-black uppercase tracking-widest mt-1">حذف</button>
                          </div>
                        </div>
                    ))
                )}
              </div>

              <div className="p-8 bg-[#1a1d23]/95 border-t border-white/10 space-y-6">
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-white/40 font-black text-[10px] uppercase tracking-widest px-1">
                        <span>إجمالي الأصناف (Subtotal)</span>
                        <span>{cart.reduce((s,i)=>s+(i.price*i.qty),0).toFixed(2)} ج.م</span>
                    </div>
                    {isTaxEnabled && (
                        <div className="flex justify-between items-center text-sys-warning font-black text-[10px] uppercase tracking-widest px-1 bg-sys-warning/5 py-2 rounded-xl border border-sys-warning/10">
                            <span className="flex items-center gap-2"><Info size={12} /> ضريبة القيمة المضافة 14%</span>
                            <span>{(cart.reduce((s,i)=>s+(i.price*i.qty),0) * 0.14).toFixed(2)} ج.م</span>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-end border-t border-white/5 pt-6">
                    <span className="text-xs font-black text-white/20 uppercase tracking-[0.3em]">TOTAL AMOUNT</span>
                    <span className="text-4xl font-black text-white tracking-tighter">{(cart.reduce((s,i)=>s+(i.price*i.qty),0) * (isTaxEnabled ? 1.14 : 1)).toFixed(2)} <span className="text-xs font-normal opacity-30 tracking-normal mr-1">EGP</span></span>
                </div>

                <button 
                  onClick={handleCheckout} 
                  disabled={cart.length === 0} 
                  className="w-full py-5 bg-sys-primary text-white rounded-[24px] font-black text-xl shadow-[0_25px_50px_-12px_rgba(59,130,246,0.6)] active:scale-[0.98] hover:bg-blue-600 transition-all flex items-center justify-center gap-4 disabled:opacity-10 group"
                >
                  <CreditCard size={28} className="group-hover:rotate-12 transition-transform duration-500" /> تنفيذ الدفع والطباعة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SETUP CATS */}
        {activeTab === 'setup_cats' && (
            <div className="h-full flex flex-col gap-4 animate-in fade-in duration-500">
                <div className="flex justify-between items-center no-print">
                   <div className="flex items-center gap-2 bg-[#1a1d23] border border-white/5 p-1 rounded-xl shadow-lg">
                      <button 
                        onClick={() => setShowArchivedCats(false)} 
                        className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${!showArchivedCats ? 'bg-sys-primary text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
                      >المجموعات النشطة</button>
                      <button 
                        onClick={() => setShowArchivedCats(true)} 
                        className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${showArchivedCats ? 'bg-sys-warning text-black shadow-lg' : 'text-white/30 hover:text-white'}`}
                      >الأرشيف</button>
                   </div>
                </div>
                <div className="flex-1">
                  <DataGrid 
                      title={showArchivedCats ? "أرشيف المجموعات" : "مجموعات البيع النشطة"} 
                      data={categories
                        .filter(c => (c.active === !showArchivedCats))
                        .map(c => ({
                          ...c, 
                          branchName: branches.find(b => b.id === c.branchId)?.name || 'غير محدد',
                          status: c.active ? 'نشط' : 'مؤرشف'
                      }))} 
                      columns={[{key:'id', label:'كود'}, {key:'name', label:'المجموعة'}, {key:'branchName', label:'الفرع'}, {key:'status', label:'الحالة'}]} 
                      onAdd={showArchivedCats ? undefined : () => { setIsEditingCat(false); setCatForm({id:'', name:'', branchId: selectedBranchId || (branches[0]?.id || ''), active:true}); setIsCatModalOpen(true); }}
                      onRowClick={openCategoryModal}
                  />
                </div>
            </div>
        )}

        {/* TAB: SETUP ITEMS */}
        {activeTab === 'setup_items' && (
            <div className="h-full flex flex-col gap-4 animate-in fade-in duration-500">
                <div className="flex justify-between items-center no-print">
                   <div className="flex items-center gap-2 bg-[#1a1d23] border border-white/5 p-1 rounded-xl shadow-lg">
                      <button 
                        onClick={() => setShowArchivedItems(false)} 
                        className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${!showArchivedItems ? 'bg-sys-primary text-white shadow-lg' : 'text-white/30 hover:text-white'}`}
                      >الأصناف النشطة</button>
                      <button 
                        onClick={() => setShowArchivedItems(true)} 
                        className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${showArchivedItems ? 'bg-sys-warning text-black shadow-lg' : 'text-white/30 hover:text-white'}`}
                      >الأرشيف</button>
                   </div>
                </div>
                <div className="flex-1">
                  <DataGrid 
                      title={showArchivedItems ? "أرشيف الأصناف" : "دليل أصناف البيع النشطة"} 
                      data={items
                        .filter(i => (i.active === !showArchivedItems))
                        .map(i => ({
                          ...i, 
                          branchName: branches.find(b => b.id === i.branchId)?.name || 'غير محدد',
                          status: i.active ? 'نشط' : 'مؤرشف'
                      }))} 
                      columns={[{key:'id', label:'كود'}, {key:'name', label:'الصنف'}, {key:'category', label:'الفئة'}, {key:'price', label:'السعر'}, {key:'status', label:'الحالة'}]} 
                      onAdd={showArchivedItems ? undefined : () => { setIsEditingItem(false); setItemForm({id:'', name:'', category: categories[0]?.name || '', branchId: selectedBranchId || (branches[0]?.id || ''), price:0, active:true}); setIsItemModalOpen(true); }}
                      onRowClick={openItemModalForEdit}
                  />
                </div>
            </div>
        )}

        {/* TAB: HISTORY */}
        {activeTab === 'history' && (
          <div className="h-full animate-in fade-in duration-500">
            <DataGrid 
                title="أرشيف عمليات المبيعات" 
                data={salesHistory} 
                columns={[
                    { key: 'id', label: 'رقم الفاتورة' },
                    { key: 'date', label: 'التاريخ' },
                    { key: 'branchName', label: 'الفرع' },
                    { key: 'itemsSummary', label: 'ملخص الطلب' },
                    { key: 'total', label: 'إجمالي القيمة' },
                    { key: 'status', label: 'الحالة' },
                ]} 
                onRowClick={(row) => { setEditingSale(row); setIsEditSaleModalOpen(true); }} 
            />
          </div>
        )}

        {/* TAB: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="h-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="bg-[#1a1d23]/80 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-2xl flex flex-col md:flex-row items-end gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sys-primary/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 w-full relative z-10">
                    <div className="space-y-3">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2"><Building2 size={12} className="text-sys-primary" /> فلترة حسب الفرع</label>
                        <select 
                            value={analyticsBranchId} 
                            onChange={(e) => setAnalyticsBranchId(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white font-black text-sm outline-none focus:border-sys-primary transition-all shadow-inner"
                        >
                            <option value="all">كافة الفروع</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2"><CalendarDays size={12} className="text-sys-success" /> من تاريخ</label>
                        <input type="date" value={analyticsStartDate} onChange={(e) => setAnalyticsStartDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white font-black text-sm outline-none shadow-inner"/>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2"><CalendarDays size={12} className="text-sys-danger" /> إلى تاريخ</label>
                        <input type="date" value={analyticsEndDate} onChange={(e) => setAnalyticsEndDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white font-black text-sm outline-none shadow-inner"/>
                    </div>
                </div>
                <button onClick={() => { setIsFiltering(true); setTimeout(()=>setIsFiltering(false), 600); }} className="bg-sys-primary hover:bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-sm shadow-xl flex items-center gap-3 transition-all shrink-0 relative z-10">
                    <RefreshCw size={20} className={isFiltering ? 'animate-spin' : ''} /> تحديث
                </button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#1a1d23] border border-white/5 p-8 rounded-[40px] shadow-xl group transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-sys-success/10 text-sys-success rounded-2xl"><TrendingUp size={32} /></div>
                        <div className="text-[10px] font-black text-sys-success bg-sys-success/5 px-3 py-1 rounded-full border tracking-widest">LIVE</div>
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-[10px] text-white/30 font-black uppercase tracking-widest">إجمالي المبيعات</h4>
                        <div className="text-4xl font-black text-white">{stats.totalSales.toLocaleString()} <span className="text-xs font-normal opacity-30">ج.م</span></div>
                    </div>
                </div>
                <div className="bg-[#1a1d23] border border-white/5 p-8 rounded-[40px] shadow-xl group transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-sys-primary/10 text-sys-primary rounded-2xl"><Receipt size={32} /></div>
                        <div className="text-[10px] font-black text-sys-primary bg-sys-primary/5 px-3 py-1 rounded-full border tracking-widest">VOLUME</div>
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-[10px] text-white/30 font-black uppercase tracking-widest">عدد الفواتير</h4>
                        <div className="text-4xl font-black text-white">{stats.invoiceCount} <span className="text-xs font-normal opacity-30">فاتورة</span></div>
                    </div>
                </div>
                <div className="bg-[#1a1d23] border border-white/5 p-8 rounded-[40px] shadow-xl group transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-sys-warning/10 text-sys-warning rounded-2xl"><Gauge size={32} /></div>
                        <div className="text-[10px] font-black text-sys-warning bg-sys-warning/5 px-3 py-1 rounded-full border tracking-widest">KPI</div>
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-[10px] text-white/30 font-black uppercase tracking-widest">متوسط الفاتورة</h4>
                        <div className="text-4xl font-black text-white">{stats.avgCheck.toFixed(2)} <span className="text-xs font-normal opacity-30">ج.م</span></div>
                    </div>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}

      {/* Category Modal */}
      {isCatModalOpen && (
        <div 
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in-95 duration-200"
          onClick={() => setIsCatModalOpen(false)}
        >
            <div 
              className="relative bg-[#1a1d23] border border-white/10 rounded-[36px] shadow-[0_40px_120px_rgba(0,0,0,0.9)] w-full max-md overflow-hidden p-10"
              onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-10">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4"><Tag className="text-sys-primary" size={28} /> {isEditingCat ? 'تعديل مجموعة' : 'مجموعة جديدة'}</h3>
                    <button onClick={() => setIsCatModalOpen(false)} className="text-white/20 hover:text-white transition-colors"><X size={32} /></button>
                </div>
                <div className="space-y-8">
                    <div className="space-y-2">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1">الفرع المرتبط</label>
                        <select value={catForm.branchId} onChange={e => setCatForm({...catForm, branchId: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded-[20px] p-4 text-white font-black outline-none transition-all shadow-inner">
                            {branches.map(b => <option key={b.id} value={b.id} className="bg-[#1a1d23]">{b.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1">اسم المجموعة</label>
                        <input type="text" value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded-[20px] p-4 text-white font-black outline-none transition-all shadow-inner" />
                    </div>
                    <div className="flex gap-3">
                      {isEditingCat && (
                        <button 
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCatStatus(); }}
                          className={`flex-1 py-5 rounded-[20px] font-black shadow-2xl transition-all flex items-center justify-center gap-2 ${catForm.active ? 'bg-sys-warning/10 text-sys-warning border border-sys-warning/20 hover:bg-sys-warning hover:text-black' : 'bg-sys-success/10 text-sys-success border border-sys-success/20 hover:bg-sys-success hover:text-white'}`}
                        >
                          {catForm.active ? <><Archive size={18} /> أرشفة</> : <><RefreshCw size={18} /> إعادة تفعيل</>}
                        </button>
                      )}
                      <button onClick={handleSaveCategory} className={`${isEditingCat ? 'flex-[2]' : 'w-full'} py-5 bg-sys-primary text-white rounded-[20px] font-black shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3`}><Save size={20} /> حفظ</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Item Modal */}
      {isItemModalOpen && (
        <div 
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in-95 duration-200"
          onClick={() => setIsItemModalOpen(false)}
        >
            <div 
              className="relative bg-[#1a1d23] border border-white/10 rounded-[40px] shadow-[0_40px_120px_rgba(0,0,0,0.9)] w-full max-lg overflow-hidden p-10"
              onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-10">
                    <h3 className="text-2xl font-black text-white flex items-center gap-4"><Coffee className="text-sys-primary" size={28} /> {isEditingItem ? 'تعديل الصنف' : 'صنف جديد'}</h3>
                    <button onClick={() => setIsItemModalOpen(false)} className="text-white/20 hover:text-white transition-colors"><X size={32} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1">الفرع</label>
                        <select value={itemForm.branchId} onChange={e => setItemForm({...itemForm, branchId: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded-[20px] p-4 text-white font-black outline-none transition-all">
                            {branches.map(b => <option key={b.id} value={b.id} className="bg-[#1a1d23]">{b.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1">اسم الصنف</label>
                        <input type="text" value={itemForm.name} onChange={e => setItemForm({...itemForm, name: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-[20px] p-4 text-white font-black outline-none transition-all shadow-inner" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1">المجموعة</label>
                        <select value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-[20px] p-4 text-white font-black outline-none transition-all">
                            {categories.filter(c => c.branchId === itemForm.branchId).map(c => <option key={c.id} value={c.name} className="bg-[#1a1d23]">{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest px-1">السعر</label>
                        <input type="number" value={itemForm.price} onChange={e => setItemForm({...itemForm, price: Number(e.target.value)})} className="w-full bg-[#121212] border border-white/10 rounded-[20px] p-4 text-white font-black outline-none transition-all shadow-inner" />
                    </div>
                    <div className="md:col-span-2 flex gap-4">
                      {isEditingItem && (
                        <button 
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleItemStatus(); }}
                          className={`flex-1 py-5 rounded-[24px] font-black shadow-2xl transition-all flex items-center justify-center gap-2 ${itemForm.active ? 'bg-sys-warning/10 text-sys-warning border border-sys-warning/20 hover:bg-sys-warning hover:text-black' : 'bg-sys-success/10 text-sys-success border border-sys-success/20 hover:bg-sys-success hover:text-white'}`}
                        >
                          {itemForm.active ? <><Archive size={18} /> أرشفة</> : <><RefreshCw size={18} /> إعادة تفعيل</>}
                        </button>
                      )}
                      <button onClick={handleSaveItem} className={`${isEditingItem ? 'flex-[2]' : 'w-full'} py-5 bg-sys-primary text-white rounded-[24px] font-black shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-4`}><Save size={20} /> حفظ</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Sale Edit Modal (Advanced History Management) */}
      {isEditSaleModalOpen && editingSale && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in-95 duration-300">
          <div className="bg-[#1a1d23] border border-white/10 rounded-[48px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <h3 className="text-2xl font-black text-white flex items-center gap-4"><Receipt className="text-sys-primary" size={32} /> مراجعة فاتورة: {editingSale.id}</h3>
              <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handlePrintInvoice(editingSale)}
                    className="p-3 bg-sys-primary/10 text-sys-primary rounded-2xl border border-sys-primary/20 hover:bg-sys-primary hover:text-white transition-all shadow-lg"
                    title="طباعة الفاتورة"
                  >
                    <Printer size={24} />
                  </button>
                  <button onClick={() => setIsEditSaleModalOpen(false)} className="text-white/20 hover:text-white transition-all"><X size={36} /></button>
              </div>
            </div>
            
            <div className="p-10 flex-1 overflow-auto space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-black/40 p-5 rounded-3xl border border-white/5">
                        <span className="text-[10px] text-white/20 font-black uppercase block mb-1">تاريخ العملية</span>
                        <span className="text-white font-black text-sm">{editingSale.date}</span>
                    </div>
                    <div className="bg-black/40 p-5 rounded-3xl border border-white/5">
                        <span className="text-[10px] text-white/20 font-black uppercase block mb-1">الفرع</span>
                        <span className="text-white font-black text-sm">{editingSale.branchName}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <h4 className="text-xs font-black text-sys-primary uppercase tracking-[0.2em] px-2 flex items-center gap-2"><LayoutList size={16} /> قائمة الطلبات</h4>
                    {editingSale.items.map((it, idx) => (
                        <div key={idx} className={`flex justify-between items-center p-5 bg-white/[0.02] rounded-[24px] border border-white/5 hover:bg-white/[0.04] transition-all ${editingSale.status === "ملغي" ? "opacity-40 grayscale" : ""}`}>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/20 font-black text-xs">{idx + 1}</div>
                                <div>
                                    <div className="text-white font-black text-sm">{it.name}</div>
                                    <div className="text-[10px] text-white/20 mt-1 font-black">السعر: {it.price} ج.م</div>
                                </div>
                            </div>
                            
                            {/* Controls for Quantity and Deletion (Only if not cancelled) */}
                            {editingSale.status !== "ملغي" && (
                              <div className="flex items-center gap-3 bg-black/40 rounded-xl p-1 px-2 border border-white/5 mx-4">
                                  <button onClick={() => updateHistoryItemQty(it.itemId, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"><Minus size={14} /></button>
                                  <span className="text-sm font-black w-6 text-center text-sys-primary">{it.qty}</span>
                                  <button onClick={() => updateHistoryItemQty(it.itemId, 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"><Plus size={14} /></button>
                                  <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
                                  <button onClick={() => removeHistoryItem(it.itemId)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-sys-danger/10 text-sys-danger/40 hover:text-sys-danger transition-all"><Trash2 size={14} /></button>
                              </div>
                            )}

                            <span className="text-white font-black text-lg min-w-[80px] text-left">{(it.qty * it.price).toFixed(2)}</span>
                        </div>
                    ))}
                </div>

                <div className={`p-8 rounded-[32px] border flex justify-between items-center shadow-lg ${editingSale.status === "ملغي" ? "bg-sys-danger/10 border-sys-danger/20 text-sys-danger" : "bg-sys-success/10 border-sys-success/20 text-sys-success"}`}>
                    <span className="text-xl font-black uppercase tracking-tighter">{editingSale.status === "ملغي" ? "CANCELLED" : "TOTAL PAID (INC 14% VAT)"}</span>
                    <span className="text-4xl font-black">{editingSale.total} <span className="text-lg font-normal opacity-50">EGP</span></span>
                </div>
            </div>

            <div className="p-10 bg-black/40 border-t border-white/5 flex justify-end gap-4">
                {editingSale.status !== "ملغي" && (
                  <>
                    <button 
                        onClick={() => handlePrintInvoice(editingSale)}
                        className="px-8 py-4 rounded-2xl bg-white/10 text-white font-black text-xs hover:bg-white/20 transition-all flex items-center gap-2 border border-white/10"
                    >
                        <Printer size={16} /> طباعة الفاتورة
                    </button>
                    <button 
                        onClick={saveHistoryChanges}
                        className="px-8 py-4 rounded-2xl bg-sys-primary text-white font-black text-xs hover:bg-blue-600 transition-all uppercase tracking-widest border border-white/10 shadow-lg shadow-blue-900/20"
                    >
                        حفظ التغييرات
                    </button>
                    <button 
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelSale(); }}
                        className="px-8 py-4 rounded-2xl bg-sys-danger/10 text-sys-danger font-black text-xs hover:bg-sys-danger hover:text-white transition-all uppercase border border-sys-danger/20"
                    >
                        إبطال الفاتورة
                    </button>
                  </>
                )}
                <button 
                    onClick={() => setIsEditSaleModalOpen(false)}
                    className="px-8 py-4 bg-white/5 rounded-2xl text-white/40 text-xs font-black uppercase tracking-widest hover:text-white transition-all"
                >
                    إغلاق
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
