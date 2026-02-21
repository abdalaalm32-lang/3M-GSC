import React, { useState, useEffect, useMemo } from 'react';
import { ChefHat, Plus, Trash2, Save, Search, ArrowRight, DollarSign, PieChart, AlertCircle, Scale, Building2, Filter, CheckCircle, Printer, X, FileText, Eye, EyeOff, Layers } from 'lucide-react';

// --- Interfaces ---

interface PosItem {
    id: string;
    name: string;
    category: string;
    price: number;
    active: boolean;
    branchId: string; // تم التأكد من وجود معرف الفرع
}

interface StockItem {
    id: string;
    name: string;
    stockUnit: string;
    recipeUnit: string;
    conversionFactor: number;
    avgCost: number;
    standardCost: number;
}

interface RecipeIngredient {
    stockItemId: string;
    qty: number; // In Recipe Unit
}

interface Recipe {
    menuItemId: string;
    branchId: string;
    ingredients: RecipeIngredient[];
    lastUpdated: string;
}

interface Branch {
    id: string;
    name: string;
}

const usePersistedState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(error);
    }
  }, [key, state]);

  return [state, setState];
};

export const RecipesPage: React.FC = () => {
  const [posItems, setPosItems] = useState<PosItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [recipes, setRecipes] = usePersistedState<Recipe[]>('gsc_recipes', []);
  const [activeTab, setActiveTab] = useState<'editor' | 'usage'>('editor');
  const [selectedMenuItem, setSelectedMenuItem] = useState<PosItem | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printWithCost, setPrintWithCost] = useState(false);
  const [printScope, setPrintScope] = useState<'single' | 'all'>('single');
  
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [selectedStockItemIds, setSelectedStockItemIds] = useState<Set<string>>(new Set());
  const [materialSearchId, setMaterialSearchId] = useState<string>('');

  const refreshInventoryData = () => {
    try {
        const sItems = localStorage.getItem('gsc_items');
        if (sItems) {
            const parsedItems = JSON.parse(sItems);
            setStockItems(parsedItems);
        }
    } catch (e) {
        console.error("Failed to load inventory for recipes", e);
    }
  };

  useEffect(() => {
    try {
      const pItems = localStorage.getItem('gsc_pos_items');
      if (pItems) setPosItems(JSON.parse(pItems));
      
      refreshInventoryData();
      
      const b = localStorage.getItem('gsc_branches');
      if (b) {
          const parsedBranches = JSON.parse(b);
          setBranches(parsedBranches);
          if (parsedBranches.length > 0 && !selectedBranchId) {
              setSelectedBranchId(parsedBranches[0].id);
          }
      } else {
          setBranches([{ id: '101', name: 'الفرع الرئيسي' }, { id: '102', name: 'فرع المعادي' }]);
          if (!selectedBranchId) setSelectedBranchId('101');
      }
    } catch (e) { console.error(e); }
  }, [activeTab]); 

  const getRecipe = (menuItemId: string, branchId: string) => {
      return recipes.find(r => r.menuItemId === menuItemId && r.branchId === branchId);
  };

  const getStockItem = (id: string) => stockItems.find(i => i.id === id);

  const calculateIngredientCost = (stockItemId: string, qty: number) => {
      const item = getStockItem(stockItemId);
      if (!item) return 0;
      // التعديل: الربط المباشر بمتوسط التكلفة من أرصدة المخزون فقط
      const baseCostPerStockUnit = Number(item.avgCost) || 0;
      const factor = Number(item.conversionFactor) || 1;
      const finalCost = (Number(qty) / factor) * baseCostPerStockUnit;
      return isNaN(finalCost) ? 0 : finalCost;
  };

  const calculateTotalCost = (ingredients: RecipeIngredient[]) => {
      return ingredients.reduce((sum, ing) => sum + calculateIngredientCost(ing.stockItemId, ing.qty), 0);
  };

  // --- Filtered Menu Items logic (Branch Dependent) ---
  const filteredPosItems = useMemo(() => {
    return posItems.filter(item => 
        item.name.includes(searchTerm) && 
        item.active && 
        item.branchId === selectedBranchId
    );
  }, [posItems, searchTerm, selectedBranchId]);

  // --- Printing Functions ---

  const handlePrintMaterialUsage = () => {
    if (!materialSearchId) {
      alert('يرجى اختيار خامة للطباعة');
      return;
    }

    const targetMaterial = getStockItem(materialSearchId);
    const matchedRecipes = recipes.filter(r => r.ingredients.some(i => i.stockItemId === materialSearchId));

    if (matchedRecipes.length === 0) {
      alert('هذه الخامة غير مستخدمة في أي وصفة حالياً');
      return;
    }

    const rowsHtml = matchedRecipes.map((recipe, idx) => {
      const menuItem = posItems.find(p => p.id === recipe.menuItemId);
      const ingredient = recipe.ingredients.find(i => i.stockItemId === materialSearchId);
      const ingCost = ingredient ? calculateIngredientCost(ingredient.stockItemId, ingredient.qty) : 0;
      const totalRecipeCost = calculateTotalCost(recipe.ingredients);
      const profitMargin = menuItem ? ((menuItem.price - totalRecipeCost) / menuItem.price) * 100 : 0;

      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td>${menuItem?.name || 'صنف غير معروف'}</td>
          <td style="text-align:center;">${menuItem?.category || '-'}</td>
          <td style="text-align:center; font-weight:bold;">${ingredient?.qty} ${targetMaterial?.recipeUnit}</td>
          <td style="text-align:center;">${ingCost.toFixed(2)} ج.م</td>
          <td style="text-align:center;">${menuItem?.price.toFixed(2)} ج.م</td>
          <td style="text-align:center; font-weight:bold; color: ${profitMargin < 20 ? 'red' : 'green'};">%${profitMargin.toFixed(1)}</td>
        </tr>
      `;
    }).join('');

    const html = `
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>تقرير استخدام خامة - ${targetMaterial?.name}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: Arial, sans-serif; color:#000; background:#fff; padding: 20px; line-height: 1.5; }
          .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .title { font-size:22px; font-weight:900; }
          .info { font-size:12px; margin-top:5px; }
          table { width:100%; border-collapse:collapse; font-size:12px; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background:#f2f2f2; font-weight: bold; }
          .footer { margin-top: 40px; font-size: 10px; color: #777; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
          .highlight { background: #fffde7; padding: 5px 10px; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">3M GSC - تقرير تحليل استخدام خامة</div>
            <div class="info">المادة الخام المستهدفة: <span class="highlight">${targetMaterial?.name} (${targetMaterial?.id})</span></div>
            <div class="info">متوسط تكلفة الوحدة (${targetMaterial?.stockUnit}): <b>${targetMaterial?.avgCost.toFixed(2)} ج.م</b></div>
          </div>
          <div style="text-align:left;">
            <div class="info">تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</div>
            <div class="info">إجمالي عدد الوصفات: <b>${matchedRecipes.length}</b></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">#</th>
              <th>المنتج النهائي</th>
              <th>المجموعة</th>
              <th style="text-align:center;">الكمية بالوصفة</th>
              <th style="text-align:center;">تكلفة الخامة بالطبق</th>
              <th style="text-align:center;">سعر بيع الطبق</th>
              <th style="text-align:center;">هامش الربح الكلي</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          طُبع بواسطة نظام 3M GSC لإدارة التكاليف والمخزون | وحدة تحليل الوصفات
        </div>

        <script>
          window.onload = function () {
            window.focus();
            window.print();
            window.onafterprint = function(){ window.close(); };
          };
        </script>
      </body>
    </html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('تم حجب النافذة المنبثقة! يرجى تفعيل الـ Pop-ups في متصفحك للمتابعة.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintRecipeFinal = () => {
    if (printScope === 'single' && !selectedMenuItem) {
      alert('يرجى اختيار صنف للطباعة');
      return;
    }

    const itemsToPrint = printScope === 'all' 
        ? posItems.filter(p => recipes.some(r => r.menuItemId === p.id && r.branchId === selectedBranchId && r.ingredients.length > 0))
        : [selectedMenuItem!];

    if (itemsToPrint.length === 0) {
      alert('لا توجد وصفات جاهزة للطباعة في هذا النطاق');
      return;
    }

    const branchName = branches.find(b => b.id === selectedBranchId)?.name || 'الفرع الرئيسي';

    const sectionsHtml = itemsToPrint.map((item, index) => {
      const recipe = getRecipe(item.id, selectedBranchId);
      if (!recipe) return '';

      const totalCost = calculateTotalCost(recipe.ingredients);
      const profit = item.price - totalCost;
      const margin = item.price > 0 ? (profit / item.price) * 100 : 0;

      const rowsHtml = recipe.ingredients.map((ing, idx) => {
        const stockItem = getStockItem(ing.stockItemId);
        const cost = calculateIngredientCost(ing.stockItemId, ing.qty);
        return `
          <tr>
            <td style="text-align:center;">${idx + 1}</td>
            <td>${stockItem?.name || 'مادة غير معروفة'}</td>
            <td style="text-align:center;">${stockItem?.recipeUnit || ''}</td>
            <td style="text-align:center;">${Number(ing.qty).toFixed(3)}</td>
            ${printWithCost ? `<td style="text-align:center;">${cost.toFixed(3)}</td>` : ''}
          </tr>
        `;
      }).join('');

      return `
        <div class="section ${index < itemsToPrint.length - 1 ? 'page-break' : ''}">
          <div class="recipe-header">
            <div>
              <div class="recipe-title">${item.name}</div>
              <div class="recipe-meta">كود الصنف: ${item.id} | المجموعة: ${item.category}</div>
            </div>
            <div style="text-align:left;">
              <div class="recipe-meta">سعر البيع: <b>${item.price.toFixed(2)} ج.م</b></div>
              <div class="recipe-meta">الفرع: <b>${branchName}</b></div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width:40px; text-align:center;">#</th>
                <th>المادة الخام</th>
                <th style="width:100px; text-align:center;">الوحدة</th>
                <th style="width:100px; text-align:center;">الكمية</th>
                ${printWithCost ? `<th style="width:120px; text-align:center;">التكلفة (ج.م)</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          ${printWithCost ? `
            <div class="analysis-box">
              <div class="analysis-row"><span>إجمالي تكلفة المكونات</span><b>${totalCost.toFixed(3)} ج.م</b></div>
              <div class="analysis-row"><span>صافي الربح التقديري</span><b>${profit.toFixed(3)} ج.م</b></div>
              <div class="analysis-row" style="border-top:1px solid #ddd; margin-top:5px; padding-top:5px;">
                <span>نسبة هامش الربح</span>
                <b style="color:${margin < 20 ? 'red' : 'green'};">%${margin.toFixed(1)}</b>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    const html = `
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>تقرير الوصفات - 3M GSC</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, sans-serif; color:#000; background:#fff; line-height: 1.4; }
          .main-header { text-align:center; border-bottom:3px solid #000; padding-bottom:10px; margin-bottom:20px; }
          .main-header h1 { margin:0; font-size:24px; }
          .main-header p { margin:5px 0 0; font-size:12px; color:#555; }
          .section { margin-bottom:40px; }
          .page-break { page-break-after: always; }
          .recipe-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; background:#f9f9f9; padding:10px; border:1px solid #eee; }
          .recipe-title { font-size:20px; font-weight:900; }
          .recipe-meta { font-size:12px; margin-top:3px; }
          table { width:100%; border-collapse:collapse; font-size:12px; margin-top:10px; }
          th, td { border: 1px solid #000; padding:8px; text-align:right; }
          th { background:#f2f2f2; }
          .analysis-box { margin-top:15px; border:1px solid #000; padding:10px; width:280px; margin-right:auto; }
          .analysis-row { display:flex; justify-content:space-between; font-size:12px; margin:3px 0; }
          .footer { margin-top:30px; font-size:10px; color:#999; text-align:center; border-top:1px solid #eee; padding-top:10px; }
        </style>
      </head>
      <body>
        <div class="main-header">
          <h1>3M GSC - GLOBAL SYSTEM COST</h1>
          <p>تقرير معايير الوصفات والإنتاج | تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}</p>
        </div>
        ${sectionsHtml}
        <div class="footer">طُبع بواسطة نظام 3M GSC - جميع الحقوق محفوظة</div>
        <script>
          window.onload = function() {
            window.focus();
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
    </html>`;

    const w = window.open('', '_blank', 'width=950,height=750');
    if (!w) {
      alert('المتصفح منع فتح نافذة جديدة. يرجى تفعيل الـ Pop-ups.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setIsPrintModalOpen(false);
  };

  const toggleStockItemSelection = (id: string) => {
      const newSet = new Set(selectedStockItemIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedStockItemIds(newSet);
  };

  const handleAddSelectedIngredients = () => {
      if (!selectedMenuItem || selectedStockItemIds.size === 0) return;
      const currentRecipe = getRecipe(selectedMenuItem.id, selectedBranchId);
      let updatedIngredients: RecipeIngredient[] = currentRecipe ? [...currentRecipe.ingredients] : [];
      selectedStockItemIds.forEach(id => {
          if (!updatedIngredients.some(i => i.stockItemId === id)) updatedIngredients.push({ stockItemId: id, qty: 0 });
      });
      if (currentRecipe) {
          const updatedRecipe = { ...currentRecipe, ingredients: updatedIngredients, lastUpdated: new Date().toISOString() };
          setRecipes(prev => prev.map(r => (r.menuItemId === selectedMenuItem!.id && r.branchId === selectedBranchId) ? updatedRecipe : r));
      } else {
          const newRecipe: Recipe = { menuItemId: selectedMenuItem.id, branchId: selectedBranchId, ingredients: updatedIngredients, lastUpdated: new Date().toISOString() };
          setRecipes(prev => [...prev, newRecipe]);
      }
      setIsAddModalOpen(false);
      setSelectedStockItemIds(new Set());
  };

  const handleRemoveIngredient = (stockItemId: string) => {
      if (!selectedMenuItem) return;
      setRecipes(prev => prev.map(r => {
          if (r.menuItemId === selectedMenuItem!.id && r.branchId === selectedBranchId) {
              return { ...r, ingredients: r.ingredients.filter(i => i.stockItemId !== stockItemId) };
          }
          return r;
      }));
  };

  const handleUpdateQty = (stockItemId: string, newQty: number) => {
    if (!selectedMenuItem) return;
    setRecipes(prev => prev.map(r => {
        if (r.menuItemId === selectedMenuItem!.id && r.branchId === selectedBranchId) {
            return { ...r, ingredients: r.ingredients.map(i => i.stockItemId === stockItemId ? { ...i, qty: newQty } : i) };
        }
        return r;
    }));
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 no-print">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-sys-primary/10 rounded-full text-sys-primary">
                    <ChefHat size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">إدارة الوصفات والإنتاج</h2>
                    <p className="text-white/40 text-sm">تحديد مكونات الأصناف وحساب التكاليف بناءً على متوسط تكلفة المخزون</p>
                </div>
            </div>
            <div className="flex gap-2 bg-sys-surface p-1 rounded-lg border border-white/5">
                <button onClick={() => { setPrintScope('all'); setIsPrintModalOpen(true); }} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold text-sys-primary hover:bg-sys-primary/10 transition-all border border-sys-primary/20">
                    <Printer size={14} /> طباعة كافة الوصفات
                </button>
                <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
                <button onClick={() => setActiveTab('editor')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'editor' ? 'bg-white/10 text-white shadow' : 'text-white/50 hover:text-white'}`}>تكويد الوصفات</button>
                <button onClick={() => setActiveTab('usage')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'usage' ? 'bg-white/10 text-white shadow' : 'text-white/50 hover:text-white'}`}>بحث بالخامة</button>
            </div>
        </div>

        {activeTab === 'editor' && (
            <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
                <div className="w-full md:w-80 bg-sys-surface border border-white/5 rounded-xl flex flex-col overflow-hidden shrink-0 no-print shadow-xl">
                    <div className="p-3 border-b border-white/5 bg-white/[0.02]">
                        <label className="text-[10px] text-white/40 uppercase font-black px-1 block mb-1.5">الفرع النشط</label>
                        <div className="flex items-center gap-2 bg-[#121212] px-3 py-2 rounded-lg border border-white/10 shadow-inner">
                            <Building2 size={14} className="text-sys-primary" />
                            <select value={selectedBranchId} onChange={(e) => { setSelectedBranchId(e.target.value); setSelectedMenuItem(null); }} className="w-full bg-transparent text-xs text-white focus:outline-none cursor-pointer font-bold appearance-none">
                                {branches.map(b => <option key={b.id} value={b.id} className="bg-[#121212]">{b.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="p-3 border-b border-white/5">
                        <div className="relative">
                            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
                            <input type="text" placeholder="بحث عن صنف في هذا الفرع..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-lg py-2 pr-9 pl-3 text-sm text-white focus:border-sys-primary outline-none" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {filteredPosItems.length > 0 ? filteredPosItems.map(item => {
                            const r = getRecipe(item.id, selectedBranchId);
                            const totalCost = r ? calculateTotalCost(r.ingredients) : 0;
                            const profit = item.price - totalCost;
                            const margin = item.price > 0 ? (profit / item.price) * 100 : 0;
                            return (
                                <div key={item.id} onClick={() => setSelectedMenuItem(item)} className={`p-3 rounded-lg cursor-pointer border transition-all hover:bg-white/5 ${selectedMenuItem?.id === item.id ? 'bg-sys-primary/10 border-sys-primary/50 shadow-inner' : 'bg-transparent border-transparent'}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold text-white text-sm">{item.name}</div>
                                        {r && r.ingredients.length > 0 && <CheckBadge />}
                                    </div>
                                    <div className="flex justify-between items-center mt-1 text-xs text-white/50">
                                        <span>{item.price.toFixed(0)} ج.م</span>
                                        {r ? <span className={`${margin < 30 ? 'text-sys-danger' : 'text-sys-success'}`}>{margin.toFixed(0)}% ربح</span> : <span className="text-white/20">لا توجد وصفة</span>}
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="py-20 text-center text-white/20 italic text-xs">
                                لا توجد أصناف بيع مرتبطة بهذا الفرع.
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 bg-sys-surface border border-white/5 rounded-xl flex flex-col overflow-hidden relative shadow-2xl">
                    {selectedMenuItem ? (
                        <>
                            <div className="p-5 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-sys-surface-elevated no-print">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        {selectedMenuItem.name}
                                        <span className="text-sm font-normal text-white/40 px-2 py-0.5 border border-white/10 rounded-full">{selectedMenuItem.category}</span>
                                    </h3>
                                    <div className="text-xs text-white/50 mt-1">سعر البيع: <span className="text-white font-bold">{selectedMenuItem.price.toFixed(2)} ج.م</span></div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => { setPrintScope('single'); setIsPrintModalOpen(true); }} className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition-all flex items-center gap-2 text-xs font-bold shadow-sm">
                                        <Printer size={16} className="text-sys-primary" /> طباعة الريسبي
                                    </button>
                                    <button onClick={() => { setIsAddModalOpen(true); setSelectedStockItemIds(new Set()); setIngredientSearch(''); }} className="bg-sys-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all">
                                        <Plus size={16} /> إضافة مكونات
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {(() => {
                                    const recipe = getRecipe(selectedMenuItem.id, selectedBranchId);
                                    if (!recipe || recipe.ingredients.length === 0) {
                                        return (
                                            <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                                                <Scale size={48} className="opacity-20" />
                                                <p>لم يتم إضافة مكونات لهذا الصنف في هذا الفرع.</p>
                                            </div>
                                        );
                                    }
                                    return (
                                        <table className="w-full text-right text-sm border-separate border-spacing-y-2">
                                            <thead className="text-xs text-white/40 uppercase">
                                                <tr>
                                                    <th className="px-2 pb-2">المادة الخام</th>
                                                    <th className="px-2 pb-2 text-center">الوحدة</th>
                                                    <th className="px-2 pb-2 w-32">الكمية</th>
                                                    <th className="px-2 pb-2">متوسط التكلفة</th>
                                                    <th className="px-2 pb-2">التكلفة الإجمالية</th>
                                                    <th className="px-2 pb-2 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recipe.ingredients.map((ing, idx) => {
                                                    const stockItem = getStockItem(ing.stockItemId);
                                                    const cost = calculateIngredientCost(ing.stockItemId, ing.qty);
                                                    const unitCost = Number(stockItem?.avgCost) || 0;
                                                    return (
                                                        <tr key={idx} className="bg-[#121212] hover:bg-white/[0.04] transition-colors group">
                                                            <td className="p-3 rounded-r-lg border-y border-r border-white/5">
                                                                <div className="text-white font-medium">{stockItem?.name || 'مادة غير معروفة'}</div>
                                                                <div className="text-[10px] text-white/30">{stockItem?.id}</div>
                                                            </td>
                                                            <td className="p-3 border-y border-white/5 text-center text-white/60">{stockItem?.recipeUnit}</td>
                                                            <td className="p-3 border-y border-white/5">
                                                                <input type="number" min="0" step="0.001" value={ing.qty} onChange={(e) => handleUpdateQty(ing.stockItemId, parseFloat(e.target.value))} className="w-full bg-sys-surface border border-white/10 rounded px-2 py-1 text-center text-white focus:border-sys-primary outline-none" />
                                                            </td>
                                                            <td className="p-3 border-y border-white/5 text-white/40">
                                                                {unitCost.toFixed(2)} <span className="text-[10px]">ج.م / {stockItem?.stockUnit}</span>
                                                            </td>
                                                            <td className="p-3 border-y border-white/5 text-sys-primary font-bold">
                                                                {cost.toFixed(3)} ج.م
                                                            </td>
                                                            <td className="p-3 rounded-l-lg border-y border-l border-white/5 text-center">
                                                                <button onClick={() => handleRemoveIngredient(ing.stockItemId)} className="text-white/20 hover:text-sys-danger transition-colors"><Trash2 size={16} /></button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    );
                                })()}
                            </div>

                            {(() => {
                                const recipe = getRecipe(selectedMenuItem.id, selectedBranchId);
                                const totalCost = recipe ? calculateTotalCost(recipe.ingredients) : 0;
                                const profit = selectedMenuItem.price - totalCost;
                                const margin = selectedMenuItem.price > 0 ? (profit / selectedMenuItem.price) * 100 : 0;
                                return (
                                    <div className="p-4 bg-sys-surface-elevated border-t border-white/5 grid grid-cols-4 gap-4 no-print shadow-inner">
                                        <div className="p-3 rounded-lg bg-sys-surface border border-white/5 text-center">
                                            <div className="text-xs text-white/50 mb-1">إجمالي تكلفة المكونات</div>
                                            <div className="text-xl font-bold text-white">{totalCost.toFixed(2)} <span className="text-xs font-normal">ج.م</span></div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-sys-surface border border-white/5 text-center">
                                            <div className="text-xs text-white/50 mb-1">سعر البيع الحالي</div>
                                            <div className="text-xl font-bold text-white">{selectedMenuItem.price.toFixed(2)} <span className="text-xs font-normal">ج.م</span></div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-sys-surface border border-white/5 text-center">
                                            <div className="text-xs text-white/50 mb-1">صافي الربح</div>
                                            <div className={`text-xl font-bold ${profit > 0 ? 'text-sys-success' : 'text-sys-danger'}`}>{profit.toFixed(2)} <span className="text-xs font-normal">ج.م</span></div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-sys-surface border border-white/5 text-center relative overflow-hidden">
                                            <div className={`absolute top-0 right-0 w-1 h-full ${margin > 30 ? 'bg-sys-success' : margin > 15 ? 'bg-sys-warning' : 'bg-sys-danger'}`}></div>
                                            <div className="text-xs text-white/50 mb-1">هامش الربح %</div>
                                            <div className="text-xl font-bold text-white">{margin.toFixed(1)}%</div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-white/30 no-print">
                            <ChefHat size={64} className="opacity-20 mb-4" />
                            <p className="text-lg font-medium">اختر فرعاً ثم صنفاً من القائمة لضبط المكونات</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'usage' && (
            <div className="flex-1 bg-sys-surface border border-white/5 rounded-xl flex flex-col overflow-hidden min-h-0 no-print shadow-xl">
                <div className="p-4 border-b border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center bg-sys-surface-elevated">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Filter size={20} className="text-sys-primary shrink-0" />
                        <div className="flex-1 max-w-md relative">
                            <select value={materialSearchId} onChange={(e) => setMaterialSearchId(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 pl-10 text-sm text-white focus:border-sys-primary outline-none appearance-none cursor-pointer">
                                <option value="">-- اختر مادة خام للبحث --</option>
                                {stockItems.map(item => (<option key={item.id} value={item.id}>{item.name}</option>))}
                            </select>
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                        </div>
                    </div>
                    {materialSearchId && (
                        <button onClick={handlePrintMaterialUsage} className="flex items-center gap-2 px-5 py-2.5 bg-sys-primary/10 border border-sys-primary/30 rounded-xl text-sys-primary text-sm font-bold hover:bg-sys-primary hover:text-white transition-all shadow-lg shadow-blue-900/10">
                            <Printer size={18} /> طباعة تقرير الاستخدام
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {materialSearchId ? (
                         <div className="space-y-4">
                            {(() => {
                                const matchedRecipes = recipes.filter(r => r.ingredients.some(i => i.stockItemId === materialSearchId));
                                if (matchedRecipes.length === 0) return (
                                    <div className="flex flex-col items-center justify-center p-20 text-white/20 border border-dashed border-white/10 rounded-3xl">
                                        <AlertCircle size={64} className="opacity-10 mb-4" />
                                        <p className="text-lg">هذه الخامة غير مستخدمة في أي وصفة حالياً.</p>
                                    </div>
                                );
                                return (
                                    <div className="border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                                        <table className="w-full text-right text-sm">
                                            <thead className="bg-[#1a1a1a] text-white/50 text-[10px] uppercase font-bold tracking-widest border-b border-white/10">
                                                <tr>
                                                    <th className="p-5">المنتج النهائي</th>
                                                    <th className="p-5 text-center">الكمية في الوصفة</th>
                                                    <th className="p-5 text-center">تكلفة الخامة بالطبق</th>
                                                    <th className="p-5 text-center">سعر بيع الطبق</th>
                                                    <th className="p-5 text-center bg-white/5">هامش الربح الكلي</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {matchedRecipes.map((recipe, idx) => {
                                                    const menuItem = posItems.find(p => p.id === recipe.menuItemId);
                                                    const ingredient = recipe.ingredients.find(i => i.stockItemId === materialSearchId);
                                                    const stockItem = getStockItem(materialSearchId);
                                                    const ingCost = ingredient ? calculateIngredientCost(ingredient.stockItemId, ingredient.qty) : 0;
                                                    const totalRecipeCost = calculateTotalCost(recipe.ingredients);
                                                    const profitMargin = menuItem ? ((menuItem.price - totalRecipeCost) / menuItem.price) * 100 : 0;
                                                    return (
                                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                                            <td className="p-5">
                                                                <div className="font-bold text-white text-sm">{menuItem?.name || 'غير معروف'}</div>
                                                                <div className="text-[10px] text-white/20 mt-1 uppercase font-mono">{menuItem?.id}</div>
                                                            </td>
                                                            <td className="p-5 text-center">
                                                                <span className="bg-sys-primary/10 text-sys-primary px-3 py-1.5 rounded-lg font-black text-xs">
                                                                    {ingredient?.qty} {stockItem?.recipeUnit}
                                                                </span>
                                                            </td>
                                                            <td className="p-5 text-center font-bold text-white/60">{ingCost.toFixed(2)} ج.م</td>
                                                            <td className="p-5 text-center font-bold text-white/40">{menuItem?.price.toFixed(2)} ج.م</td>
                                                            <td className="p-5 text-center bg-white/5">
                                                                <span className={`text-xs font-black px-3 py-1.5 rounded-lg border ${profitMargin < 20 ? 'bg-sys-danger/10 text-sys-danger border-sys-danger/20' : 'bg-sys-success/10 text-sys-success border-sys-success/20'}`}>
                                                                    %{profitMargin.toFixed(1)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                         </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-white/20">
                            <Layers size={80} className="opacity-5 mb-6" />
                            <h3 className="text-xl font-black uppercase tracking-widest mb-2">Cross-Reference Search</h3>
                            <p className="max-w-xs text-center text-sm leading-relaxed">اختر خامة من القائمة المنسدلة أعلاه لعرض كافة الوصفات التي تدخل في تركيبها وتكلفتها التقديرية.</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* --- Modal: Add Ingredients --- */}
        {isAddModalOpen && (
             <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <h3 className="font-bold text-white flex items-center gap-2"><Plus size={18} className="text-sys-primary" /> إضافة مكونات لـ: <span className="text-sys-primary">{selectedMenuItem?.name}</span></h3>
                        <button onClick={() => setIsAddModalOpen(false)}><ArrowRight size={18} className="text-white/40 hover:text-white"/></button>
                    </div>
                    <div className="p-4 border-b border-white/5">
                        <div className="relative">
                            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
                            <input type="text" placeholder="بحث عن مادة خام (طماطم، لحم، زيت...)" value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-lg py-2 pr-9 pl-3 text-sm text-white focus:border-sys-primary outline-none" autoFocus />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {stockItems.filter(i => i.name.includes(ingredientSearch)).map(item => (
                            <div key={item.id} onClick={() => toggleStockItemSelection(item.id)} className={`p-3 rounded-lg cursor-pointer flex justify-between items-center border transition-all mb-1 ${selectedStockItemIds.has(item.id) ? 'bg-sys-primary/10 border-sys-primary shadow-sm' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                                <div><div className="text-white font-medium text-sm">{item.name}</div><div className="text-[10px] text-white/40">الوحدة: {item.recipeUnit} • التكلفة: {item.avgCost.toFixed(2)}</div></div>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedStockItemIds.has(item.id) ? 'bg-sys-primary border-sys-primary' : 'border-white/20'}`}>{selectedStockItemIds.has(item.id) && <CheckCircle size={14} className="text-white" />}</div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-[#181818] border-t border-white/5 flex gap-3 justify-between items-center">
                         <div className="text-xs text-white/40">{selectedStockItemIds.size > 0 ? `تم تحديد ${selectedStockItemIds.size} صنف` : 'لم يتم تحديد أصناف'}</div>
                         <div className="flex gap-2">
                             <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5">إلغاء</button>
                             <button onClick={handleAddSelectedIngredients} disabled={selectedStockItemIds.size === 0} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-sys-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-900/20"><Save size={16} /> حفظ وإغلاق ({selectedStockItemIds.size})</button>
                         </div>
                    </div>
                </div>
             </div>
        )}

        {/* --- Modal: Enhanced Print Options --- */}
        {isPrintModalOpen && (
             <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in duration-200 no-print">
                <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                            <Printer size={20} className="text-sys-primary" />
                            <h3 className="font-bold text-white">إعدادات طباعة الريسبي</h3>
                        </div>
                        <button onClick={() => setIsPrintModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="bg-[#121212] p-4 rounded-xl border border-white/5">
                            <label className="text-[10px] text-white/40 uppercase mb-3 block font-bold tracking-widest">نطاق الطباعة</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setPrintScope('single')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all text-xs font-bold ${printScope === 'single' ? 'bg-sys-primary border-sys-primary text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>
                                    <FileText size={16} /> الصنف الحالي فقط
                                </button>
                                <button onClick={() => setPrintScope('all')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all text-xs font-bold ${printScope === 'all' ? 'bg-sys-primary border-sys-primary text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>
                                    <Layers size={16} /> كافة الأصناف المتاحة
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <label className="text-[10px] text-white/40 uppercase block font-bold tracking-widest">نوع التقرير</label>
                            <button onClick={() => { setPrintWithCost(false); handlePrintRecipeFinal(); }} className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-sys-warning/10 text-sys-warning rounded-lg group-hover:scale-110 transition-transform"><FileText size={20} /></div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-white">تقرير المكونات فقط</div>
                                        <div className="text-[10px] text-white/40">بدون تكاليف (للمطبخ والإنتاج)</div>
                                    </div>
                                </div>
                                <EyeOff size={18} className="text-white/20" />
                            </button>

                            <button onClick={() => { setPrintWithCost(true); handlePrintRecipeFinal(); }} className="flex items-center justify-between p-4 rounded-xl border border-sys-primary/20 bg-sys-primary/5 hover:bg-sys-primary/10 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-sys-primary/10 text-sys-primary rounded-lg group-hover:scale-110 transition-transform"><DollarSign size={20} /></div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-white">تقرير شامل بالتكلفة</div>
                                        <div className="text-[10px] text-white/40">تقرير مالي يشمل الربحية والهوامش</div>
                                    </div>
                                </div>
                                <Eye size={18} className="text-sys-primary/40" />
                            </button>
                        </div>
                    </div>
                    <div className="p-4 bg-black/40 border-t border-white/5 text-center">
                        <button onClick={() => setIsPrintModalOpen(false)} className="text-white/30 text-xs hover:text-white transition-colors">إلغاء الأمر</button>
                    </div>
                </div>
             </div>
        )}
    </div>
  );
};

const CheckBadge = () => (
    <div className="w-4 h-4 bg-sys-success rounded-full flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 text-black"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>
);