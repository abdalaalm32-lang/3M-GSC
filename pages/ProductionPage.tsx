
import React, { useState, useEffect, useMemo } from 'react';
import { DataGrid } from '../components/DataGrid';
import { 
  Factory, Plus, Calendar, Save, CheckCircle, Search, X, 
  Printer, ArrowLeft, Building2, Layers, Info, Trash2, 
  RefreshCw, Box, AlertCircle, ListFilter, Tag, Check,
  PackagePlus, MapPin, DollarSign
} from 'lucide-react';

// --- Types ---

interface ProductionIngredient {
  stockItemId: string;
  name: string;
  unit: string;
  requiredQty: number; 
  unitCost: number;
  totalCost: number;
  isManual?: boolean;
}

interface ProductionRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  producedQty: number;
  unit: string;
  branchId: string;
  branchName: string;
  status: 'مسودة' | 'مرحل';
  ingredients: ProductionIngredient[];
  totalProductionCost: number;
  unitCost: number;
  notes?: string;
  departmentId?: string;
  categoryName?: string; 
}

// --- Helpers ---
const safeJsonParse = (value: string | null, fallback: any = null) => {
  if (value == null) return fallback;
  if (value === "undefined" || value === "null" || value === "") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

const usePersistedState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => safeJsonParse(localStorage.getItem(key), defaultValue));
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
};

export const ProductionPage: React.FC = () => {
  const [view, setView] = useState<'list' | 'details'>('list');
  const [productionLogs, setProductionLogs] = usePersistedState<ProductionRecord[]>('gsc_production_logs', []);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const [activeLog, setActiveLog] = useState<ProductionRecord | null>(null);
  const [confirmPost, setConfirmPost] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSearchTerm, setManualSearchTerm] = useState('');
  const [selectedManualIds, setSelectedManualIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = () => {
        setInventoryItems(safeJsonParse(localStorage.getItem('gsc_items'), []));
        setRecipes(safeJsonParse(localStorage.getItem('gsc_recipes'), []));
        setDepartments(safeJsonParse(localStorage.getItem('gsc_departments'), []));
        setWarehouses(safeJsonParse(localStorage.getItem('gsc_warehouses_config'), []));
        setBranches(safeJsonParse(localStorage.getItem('gsc_branches'), []));
    };
    loadData();
  }, [view]);

  const availableCategories = useMemo(() => {
    if (!activeLog?.departmentId) return [];
    const deptName = departments.find(d => d.id === activeLog.departmentId)?.name;
    if (!deptName) return [];
    const uniqueCats = new Set<string>();
    inventoryItems.forEach(item => {
        if (item.department === deptName && item.category && item.active === 'نعم') {
            uniqueCats.add(item.category);
        }
    });
    return Array.from(uniqueCats);
  }, [activeLog?.departmentId, inventoryItems, departments]);

  useEffect(() => {
    if (!confirmPost) return;
    const t = setTimeout(() => setConfirmPost(false), 5000);
    return () => clearTimeout(t);
  }, [confirmPost]);

  const generateSerialId = () => {
    const year = new Date().getFullYear();
    const prefix = `PRD-${year}-`;
    const yearRecords = productionLogs.filter(l => l.id.startsWith(prefix));
    let nextNum = 1;
    if (yearRecords.length > 0) {
      const nums = yearRecords.map(l => {
        const parts = l.id.split('-');
        return parseInt(parts[parts.length - 1], 10);
      }).filter(n => !isNaN(n));
      if (nums.length > 0) nextNum = Math.max(...nums) + 1;
    }
    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
  };

  const handlePrintProduction = () => {
    if (!activeLog) return;
    const rowsHtml = (activeLog.ingredients || []).map((ing, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${ing.stockItemId}</td>
        <td>${ing.name}${ing.isManual ? ' (يدوي)' : ''}</td>
        <td style="text-align:center;">${ing.unit}</td>
        <td style="text-align:center;">${Number(ing.requiredQty || 0).toFixed(4)}</td>
        <td style="text-align:center;">${Number(ing.unitCost || 0).toFixed(2)}</td>
        <td style="text-align:center; font-weight:700;">${Number(ing.totalCost || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>طباعة تشغيلة إنتاج - ${activeLog.id}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#000; background:#fff; padding: 20px; line-height: 1.5; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .title-area h1 { font-size:22px; font-weight:900; margin:0; }
          .title-area h2 { font-size:16px; font-weight:700; margin:5px 0 0 0; color: #333; }
          .meta-area { font-size:12px; line-height:1.7; text-align:left; }
          table { width:100%; border-collapse:collapse; font-size:11px; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          thead { background:#f5f5f5; display:table-header-group; }
          tr { page-break-inside: avoid; }
          .totals { margin-top:20px; display:flex; justify-content:flex-end; }
          .totals .box { min-width:300px; border:2px solid #000; padding:15px; font-size:14px; background: #fafafa; font-weight: bold; }
          .totals .row { display:flex; justify-content:space-between; margin:6px 0; }
          .footer { margin-top: 50px; font-size: 10px; color: #666; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
          .badge { display:inline-block; padding:2px 8px; border:1px solid #000; border-radius:999px; font-size:10px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>3M GSC - GLOBAL SYSTEM COST</h1>
            <h2>نموذج تشغيلة إنتاج خامات (Production)</h2>
            <div style="margin-top:8px;">رقم العملية: <b>${activeLog.id}</b> <span class="badge">${activeLog.status}</span></div>
          </div>
          <div class="meta-area">
            <div>تاريخ التشغيلة: <b>${activeLog.date}</b></div>
            <div>المنتج النهائي: <b>${activeLog.productName || 'غير محدد'}</b></div>
            <div>الكمية المنتجة: <b>${Number(activeLog.producedQty || 0).toFixed(2)}</b> ${activeLog.unit}</div>
            <div>الموقع المسؤول: <b>${activeLog.branchName || ''}</b></div>
          </div>
        </div>
        ${activeLog.notes ? `<div style="font-size:12px; background:#f9f9f9; padding:10px; border-right:4px solid #3B82F6; margin-bottom:15px;"><strong>ملاحظات:</strong> ${activeLog.notes}</div>` : ''}
        <table>
          <thead>
            <tr>
              <th style="width:30px; text-align:center;">#</th>
              <th style="width:100px;">كود الخامة</th>
              <th>اسم الخامة المستهلكة</th>
              <th style="width:70px; text-align:center;">الوحدة</th>
              <th style="width:100px; text-align:center;">الكمية المستهلكة</th>
              <th style="width:100px; text-align:center;">تكلفة الوحدة</th>
              <th style="width:100px; text-align:center;">إجمالي القيمة</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="totals">
          <div class="box">
            <div class="row"><span>إجمالي تكلفة التشغيلة</span><span>${Number(activeLog.totalProductionCost || 0).toFixed(2)} ج.م</span></div>
            <div class="row" style="border-top:1px solid #000; padding-top:8px; margin-top:8px;"><span>تكلفة الوحدة الواحدة</span><span>${Number(activeLog.unitCost || 0).toFixed(2)} ج.م</span></div>
          </div>
        </div>
        <div class="footer">طُبع بواسطة نظام 3M GSC v5.0</div>
        <script>window.onload = function () { window.print(); window.onafterprint = function(){ window.close(); }; };</script>
      </body>
    </html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  const recalculateCosts = (log: ProductionRecord): ProductionRecord => {
    const total = log.ingredients.reduce((s, i) => s + i.totalCost, 0);
    return { ...log, totalProductionCost: total, unitCost: log.producedQty > 0 ? total / log.producedQty : 0 };
  };

  const handleCreateNew = () => {
      const defaultLoc = warehouses[0] || branches[0] || { id: '', name: 'موقع غير محدد' };
      const newRec: ProductionRecord = {
          id: generateSerialId(),
          date: new Date().toISOString().split('T')[0],
          productId: '', productName: '', producedQty: 1, unit: 'قطعة', branchId: defaultLoc.id,
          branchName: defaultLoc.name, status: 'مسودة', ingredients: [], totalProductionCost: 0,
          unitCost: 0, notes: '', departmentId: '', categoryName: ''
      };
      setActiveLog(newRec);
      setView('details');
  };

  const handleSelectProduct = (prodId: string) => {
      if (!activeLog) return;
      const itemInStock = inventoryItems.find(i => i.id === prodId);
      const recipe = recipes.find(r => r.menuItemId === prodId); 
      if (!recipe) {
          alert("تنبيه: هذا الصنف لا يحتوي على وصفة مسجلة.");
          setActiveLog(recalculateCosts({ ...activeLog, productId: prodId, productName: itemInStock?.name || '', ingredients: [] }));
          return;
      }
      const explodedIngredients: ProductionIngredient[] = recipe.ingredients.map((ing: any) => {
          const stockItem = inventoryItems.find(i => i.id === ing.stockItemId);
          const cost = Number(stockItem?.avgCost) || 0;
          const factor = stockItem?.conversionFactor || 1;
          const requiredQty = (ing.qty / factor) * activeLog.producedQty;
          return {
              stockItemId: ing.stockItemId, name: stockItem?.name || 'صنف غير معروف', unit: stockItem?.stockUnit || '',
              requiredQty: parseFloat(requiredQty.toFixed(4)), unitCost: cost, totalCost: requiredQty * cost
          };
      });
      setActiveLog(recalculateCosts({ ...activeLog, productId: prodId, productName: itemInStock?.name || '', ingredients: explodedIngredients }));
  };

  const handleUpdateQty = (qty: number) => {
      if (!activeLog || !activeLog.productId) {
          setActiveLog(prev => prev ? { ...prev, producedQty: qty } : null);
          return;
      }
      const recipe = recipes.find(r => r.menuItemId === activeLog.productId);
      const updatedIngredients = activeLog.ingredients.map(ing => {
          const recipeIng = recipe?.ingredients?.find((ri: any) => ri.stockItemId === ing.stockItemId);
          if (recipeIng && !ing.isManual) {
              const stockItem = inventoryItems.find(i => i.id === ing.stockItemId);
              const factor = stockItem?.conversionFactor || 1;
              const newRequiredQty = (recipeIng.qty / factor) * qty;
              return { ...ing, requiredQty: parseFloat(newRequiredQty.toFixed(4)), totalCost: newRequiredQty * ing.unitCost };
          }
          return ing;
      });
      setActiveLog(recalculateCosts({ ...activeLog, producedQty: qty, ingredients: updatedIngredients }));
  };

  const handleUpdateIngredientQty = (idx: number, qty: number) => {
      if (!activeLog || activeLog.status === 'مرحل') return;
      const updated = [...activeLog.ingredients];
      updated[idx] = { ...updated[idx], requiredQty: qty, totalCost: qty * updated[idx].unitCost };
      setActiveLog(recalculateCosts({ ...activeLog, ingredients: updated }));
  };

  const handleRemoveIngredient = (idx: number) => {
      if (!activeLog || activeLog.status === 'مرحل') return;
      const updated = activeLog.ingredients.filter((_, i) => i !== idx);
      setActiveLog(recalculateCosts({ ...activeLog, ingredients: updated }));
  };

  const handleSaveDraft = () => {
      if (!activeLog) return;
      const draftLog: ProductionRecord = { ...activeLog, status: 'مسودة' };
      setProductionLogs(prev => {
          const exists = prev.find(l => l.id === draftLog.id);
          if (exists) return prev.map(l => l.id === draftLog.id ? draftLog : l);
          return [draftLog, ...prev];
      });
      setActiveLog(draftLog);
      alert('تم حفظ المسودة بنجاح 💾');
  };

  const handlePostProduction = () => {
      if (!activeLog || activeLog.status === 'مرحل') return;
      if (activeLog.ingredients.length === 0) return alert('لا توجد مكونات للإنتاج');
      if (!activeLog.branchId) return alert('يرجى اختيار الموقع');

      if (!confirmPost) {
          setConfirmPost(true);
          return;
      }

      const currentInv = safeJsonParse(localStorage.getItem('gsc_items'), []);
      const updatedInv = currentInv.map((stockItem: any) => {
          const ingredientMatch = activeLog.ingredients.find(ing => ing.stockItemId === stockItem.id);
          
          if (ingredientMatch) {
              return { ...stockItem, currentStock: Number(stockItem.currentStock || 0) - Number(ingredientMatch.requiredQty) };
          }
          
          if (stockItem.id === activeLog.productId) {
              const isManufactured = stockItem.category === 'المصنعات';
              const newAvgCost = isManufactured ? Number(activeLog.unitCost) : Number(stockItem.avgCost || 0);
              
              return { 
                ...stockItem, 
                currentStock: Number(stockItem.currentStock || 0) + Number(activeLog.producedQty),
                avgCost: Number(newAvgCost.toFixed(4))
              };
          }
          return stockItem;
      });

      localStorage.setItem('gsc_items', JSON.stringify(updatedInv));
      setInventoryItems(updatedInv);
      
      const postedLog: ProductionRecord = { ...activeLog, status: 'مرحل' };
      setProductionLogs(prev => {
          const exists = prev.find(l => l.id === postedLog.id);
          if (exists) return prev.map(l => l.id === postedLog.id ? postedLog : l);
          return [postedLog, ...prev];
      });
      setActiveLog(postedLog);
      setConfirmPost(false);
      alert('تم الاعتماد والترحيل وتحديث متوسط التكلفة بنجاح ✅');
  };

  const handleManualItemToggle = (id: string) => {
      const next = new Set(selectedManualIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedManualIds(next);
  };

  const handleConfirmManualItems = () => {
      if (!activeLog) return;
      const newItems: ProductionIngredient[] = [];
      selectedManualIds.forEach(id => {
          const inv = inventoryItems.find(i => i.id === id);
          if (inv) {
              const cost = Number(inv.avgCost) || 0;
              newItems.push({ stockItemId: inv.id, name: inv.name, unit: inv.stockUnit, requiredQty: 1, unitCost: cost, totalCost: cost, isManual: true });
          }
      });
      setActiveLog(recalculateCosts({ ...activeLog, ingredients: [...activeLog.ingredients, ...newItems] }));
      setIsManualModalOpen(false);
      setSelectedManualIds(new Set());
  };

  return (
    <div className="flex flex-col h-full gap-4 relative font-sans" dir="rtl">
      {view === 'list' && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 no-print">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-sys-primary/10 rounded-full text-sys-primary"><Factory size={24} /></div>
                <div><h2 className="text-xl font-bold text-white">عمليات الإنتاج والتصنيع</h2><p className="text-white/40 text-sm">تتبع تشغيلات الإنتاج والخصم من أرصدة المواقع والمخازن</p></div>
             </div>
             <button onClick={handleCreateNew} className="bg-sys-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all">
                <Plus size={18} /> بدء تشغيلة جديدة
             </button>
          </div>
      )}

      <div className="flex-1 min-h-0">
          {view === 'list' && (
              <DataGrid 
                title="سجل تاريخ الإنتاج" 
                data={productionLogs.map(l => ({ ...l, statusText: l.status }))} 
                columns={[
                    { key: 'id', label: 'رقم العملية' },
                    { key: 'date', label: 'التاريخ' },
                    { key: 'productName', label: 'المنتج المصنع' },
                    { key: 'branchName', label: 'الموقع' },
                    { key: 'statusText', label: 'الحالة' },
                    { key: 'totalProductionCost', label: 'إجمالي التكلفة' }
                ]} 
                onRowClick={(row) => { setActiveLog(row); setView('details'); }}
              />
          )}

          {view === 'details' && activeLog && (
              <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between bg-sys-surface p-4 rounded-xl border border-white/5 no-print shadow-sm">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {activeLog.id}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${activeLog.status === 'مرحل' ? 'border-sys-success text-sys-success bg-sys-success/10' : 'border-sys-warning text-sys-warning bg-sys-warning/10'}`}>{activeLog.status}</span>
                            </h2>
                        </div>
                        <div className="flex gap-2">
                            {activeLog.status === 'مسودة' && (
                                <>
                                    <button onClick={handleSaveDraft} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-bold transition-all hover:bg-white/10"><Save size={16} /> حفظ مسودة</button>
                                    <button onClick={handlePostProduction} className={`px-6 py-2 rounded-lg font-bold shadow-lg transition-all text-xs flex items-center gap-2 ${confirmPost ? 'bg-sys-warning text-black animate-pulse' : 'bg-sys-primary text-white hover:bg-blue-600'}`}>{confirmPost ? <AlertCircle size={18} /> : <CheckCircle size={18} />}{confirmPost ? 'تأكيد الترحيل' : 'اعتماد وترحيل الإنتاج'}</button>
                                </>
                            )}
                            <button onClick={handlePrintProduction} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors" title="طباعة التشغيلة"><Printer size={18} /></button>
                        </div>
                  </div>

                  <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
                      <div className="w-full md:w-80 bg-sys-surface border border-white/5 rounded-2xl p-6 flex flex-col gap-6 shadow-sm overflow-y-auto no-print">
                          <div className="space-y-4">
                              <h3 className="text-xs font-bold text-sys-primary uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2"><ListFilter size={14} /> تعريف المنتج النهائي</h3>
                              <div className="space-y-1">
                                  <label className="text-[10px] text-white/40 px-1 font-bold flex items-center gap-1"><MapPin size={10} className="text-sys-primary"/> الموقع (مخزن / فرع) <span className="text-sys-danger">*</span></label>
                                  <select value={activeLog.branchId} onChange={e => { const loc = warehouses.find(w => w.id === e.target.value) || branches.find(b => b.id === e.target.value); if (loc) setActiveLog({...activeLog, branchId: loc.id, branchName: loc.name}); }} disabled={activeLog.status === 'مرحل'} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none">
                                      {warehouses.length > 0 && (<optgroup label="المخازن" className="bg-[#1e1e1e] text-sys-primary font-bold">{warehouses.map(w => <option key={w.id} value={w.id} className="text-white font-normal">{w.name}</option>)}</optgroup>)}
                                      {branches.length > 0 && (<optgroup label="الفروع" className="bg-[#1e1e1e] text-sys-warning font-bold">{branches.map(b => <option key={b.id} value={b.id} className="text-white font-normal">{b.name}</option>)}</optgroup>)}
                                  </select>
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[10px] text-white/40 px-1 font-bold">1. اختيار القسم</label>
                                  <select value={activeLog.departmentId} onChange={e => setActiveLog({...activeLog, departmentId: e.target.value, categoryName: '', productId: '', ingredients: [], totalProductionCost: 0, unitCost: 0})} disabled={activeLog.status === 'مرحل'} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none">
                                      <option value="">-- اختر القسم --</option>
                                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                  </select>
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[10px] text-white/40 px-1 font-bold">2. اختيار المجموعة</label>
                                  <select value={activeLog.categoryName} onChange={e => setActiveLog({...activeLog, categoryName: e.target.value, productId: '', ingredients: [], totalProductionCost: 0, unitCost: 0})} disabled={activeLog.status === 'مرحل' || !activeLog.departmentId} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none">
                                      <option value="">-- اختر المجموعة المكوّدة --</option>
                                      {availableCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                  </select>
                              </div>
                              <div className="space-y-1">
                                  <label className="text-[10px] text-white/40 px-1 font-bold">3. المنتج النهائي</label>
                                  <select value={activeLog.productId} onChange={e => handleSelectProduct(e.target.value)} disabled={activeLog.status === 'مرحل' || !activeLog.categoryName} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none font-bold">
                                      <option value="">-- اختر المنتج --</option>
                                      {inventoryItems.filter(item => { const deptName = departments.find(d => d.id === activeLog?.departmentId)?.name; return (!deptName || item.department === deptName) && (!activeLog.categoryName || item.category === activeLog.categoryName) && item.active === 'نعم'; }).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                              </div>
                              <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                                    <div className="space-y-1"><label className="text-[10px] text-white/40 px-1 font-bold">الكمية</label><input type="number" step="0.01" value={activeLog.producedQty} onChange={e => handleUpdateQty(parseFloat(e.target.value))} disabled={activeLog.status === 'مرحل'} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none" /></div>
                                    <div className="space-y-1"><label className="text-[10px] text-white/40 px-1 font-bold">الوحدة</label><select value={activeLog.unit} onChange={e => setActiveLog({...activeLog, unit: e.target.value})} disabled={activeLog.status === 'مرحل'} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none"><option value="قطعة">قطعة</option><option value="كيلو جرام">كيلو جرام</option><option value="لتر">لتر</option></select></div>
                              </div>
                          </div>
                          <div className="mt-auto space-y-2 pt-4 border-t border-white/5">
                                <div className="p-4 bg-sys-primary/10 rounded-2xl border border-sys-primary/20"><div className="text-[10px] text-sys-primary font-bold uppercase mb-1">تكلفة الوحدة</div><div className="text-xl font-black text-white">{activeLog.unitCost.toFixed(2)} <span className="text-[10px] font-normal opacity-40">ج.م</span></div></div>
                          </div>
                      </div>
                      <div className="flex-1 bg-sys-surface border border-white/5 rounded-2xl flex flex-col overflow-hidden shadow-sm">
                          <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center no-print">
                              <h3 className="text-xs font-bold text-white flex items-center gap-2"><Layers size={14} className="text-sys-primary" /> تفكيك المكونات (Explosion Analysis)</h3>
                              {activeLog.status !== 'مرحل' && activeLog.productId && <button onClick={() => { setManualSearchTerm(''); setSelectedManualIds(new Set()); setIsManualModalOpen(true); }} className="px-4 py-1.5 bg-sys-primary/10 border border-sys-primary/30 rounded-lg text-sys-primary text-[10px] font-bold hover:bg-sys-primary hover:text-white transition-all flex items-center gap-2"><PackagePlus size={14} /> إضافة خامات يدوية</button>}
                          </div>
                          <div className="flex-1 overflow-auto custom-scrollbar">
                              <table className="w-full text-right text-xs border-collapse">
                                  <thead className="bg-[#1a1a1a] text-white/30 text-[10px] uppercase font-bold sticky top-0 z-10">
                                      <tr><th className="p-4 border-b border-white/5">الخامة</th><th className="p-4 border-b border-white/5 text-center">الوحدة</th><th className="p-4 border-b border-white/5 text-center w-32">الكمية</th><th className="p-4 border-b border-white/5 text-center">التكلفة</th><th className="p-4 border-b border-white/5 text-center bg-white/5">القيمة</th><th className="p-4 border-b border-white/5 w-10 no-print"></th></tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5">
                                      {activeLog.ingredients.map((ing, idx) => (
                                          <tr key={idx} className="hover:bg-white/[0.01] transition-colors group">
                                              <td className="p-4"><div className="flex items-center gap-2">{ing.isManual && <span className="p-1 bg-sys-warning/20 text-sys-warning rounded text-[8px] font-bold uppercase">يدوي</span>}<div className="font-bold text-white">{ing.name}</div></div><div className="text-[9px] text-white/20 font-mono">{ing.stockItemId}</div></td>
                                              <td className="p-4 text-center text-white/40">{ing.unit}</td>
                                              <td className="p-4 text-center"><input type="number" step="0.001" value={ing.requiredQty} onChange={e => handleUpdateIngredientQty(idx, parseFloat(e.target.value))} disabled={activeLog.status === 'مرحل'} className="w-full bg-sys-bg border border-white/10 rounded-lg p-1.5 text-center font-bold text-white focus:border-sys-primary outline-none" /></td>
                                              <td className="p-4 text-center text-white/40">{ing.unitCost.toFixed(2)}</td>
                                              <td className="p-4 text-center bg-white/5 text-sys-primary font-bold">{ing.totalCost.toFixed(2)}</td>
                                              <td className="p-4 text-center no-print">{activeLog.status !== 'مرحل' && <button onClick={() => handleRemoveIngredient(idx)} className="text-white/10 hover:text-sys-danger transition-colors"><Trash2 size={14}/></button>}</td>
                                          </tr>
                                      ))}
                                      {activeLog.ingredients.length === 0 && <tr><td colSpan={6} className="p-20 text-center text-white/20 italic text-sm">يرجى اختيار المنتج النهائي لظهور قائمة المكونات.</td></tr>}
                                  </tbody>
                              </table>
                          </div>
                          <div className="p-5 bg-[#1a1a1a] border-t border-white/5 flex justify-between items-center no-print">
                              <div className="flex flex-col"><span className="text-[9px] text-white/30 uppercase font-bold tracking-widest mb-1">إجمالي تكلفة المكونات</span><span className="text-xl font-black text-sys-primary">{activeLog.totalProductionCost.toLocaleString()} <span className="text-[10px] font-normal opacity-40">ج.م</span></span></div>
                              <div className="flex items-center gap-2 px-4 py-2 bg-sys-success/10 border border-sys-success/30 rounded-xl text-sys-success text-xs font-bold"><Check size={16} /> ترحيل التكلفة مفعل</div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {isManualModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
            <div className="bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]"><div className="flex items-center gap-3"><div className="p-2 bg-sys-primary/10 rounded-lg text-sys-primary"><Tag size={18} /></div><h3 className="font-bold text-white text-lg">إضافة خامات إضافية</h3></div><button onClick={() => setIsManualModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button></div>
                <div className="p-4 bg-sys-surface border-b border-white/5"><div className="relative group"><Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-sys-primary transition-colors" /><input type="text" placeholder="بحث باسم الخامة..." value={manualSearchTerm} onChange={e => setManualSearchTerm(e.target.value)} className="w-full bg-sys-bg border border-white/10 rounded-xl py-3 pr-10 pl-4 text-sm text-white focus:border-sys-primary outline-none" autoFocus /></div></div>
                <div className="flex-1 overflow-auto p-3 space-y-1 custom-scrollbar">{inventoryItems.filter(i => i.active === 'نعم' && (i.name.includes(manualSearchTerm) || i.id.includes(manualSearchTerm))).map(item => { const isSelected = selectedManualIds.has(item.id); const alreadyIn = activeLog?.ingredients.some(ing => ing.stockItemId === item.id); return (<div key={item.id} onClick={() => !alreadyIn && handleManualItemToggle(item.id)} className={`p-4 rounded-xl border flex justify-between items-center transition-all cursor-pointer ${isSelected ? 'bg-sys-primary/10 border-sys-primary' : alreadyIn ? 'opacity-30 border-white/5' : 'bg-transparent border-white/5 hover:border-white/20'}`}><div className="flex items-center gap-4"><div className={`w-6 h-6 rounded-lg border flex items-center justify-center ${isSelected ? 'bg-sys-primary border-sys-primary' : 'border-white/10 bg-[#121212]'}`}>{isSelected && <Check size={16} className="text-white" strokeWidth={3} />}</div><div><p className="text-white text-sm font-bold">{item.name}</p><p className="text-[10px] text-white/20 uppercase tracking-tighter">{item.id} • {item.stockUnit}</p></div></div><div className="text-right"><p className="text-xs font-black text-sys-success">المتاح: {item.currentStock || 0}</p></div></div>); })}</div>
                <div className="p-5 bg-[#181818] border-t border-white/5 flex justify-end gap-3"><button onClick={() => setIsManualModalOpen(false)} className="px-6 py-2.5 rounded-xl text-xs font-bold text-white/50 hover:text-white transition-all">أغلاق</button><button onClick={handleConfirmManualItems} disabled={selectedManualIds.size === 0} className="px-8 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-all flex items-center gap-2"><Save size={16} /> حفظ وإضافة</button></div>
            </div>
        </div>
      )}
    </div>
  );
};
