
import React, { useState, useEffect } from 'react';
import { DataGrid } from '../components/DataGrid';
import { ClipboardCheck, Plus, Save, CheckCircle, Search, X, Printer, ArrowLeft, Building2, AlertTriangle, FileText, Filter, Calendar, Trash2, Tag, DollarSign, Calculator, Store, Warehouse } from 'lucide-react';

// --- Types ---

interface StocktakeItem {
  itemId: string;
  name: string;
  unit: string;
  category: string;
  systemQty: number; // Snapshot of Stock at time of adding
  countedQty: number; // User input
  avgCost: number;
  variance: number; // counted - system
  varianceCost: number; // variance * avgCost
}

interface StocktakeRecord {
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  type: 'opening' | 'closing' | 'regular'; // New: To identify Opening/Closing Stock
  status: 'مسودة' | 'مرحل';
  items: StocktakeItem[];
  totalVarianceCost: number;
  notes?: string;
}

// --- SAFE JSON PARSE HELPER ---
const safeJsonParse = (value: string | null, fallback: any) => {
  if (value === null || value === undefined) return fallback;
  if (value === "undefined" || value === "null" || value === "") return fallback;
  try {
    const result = JSON.parse(value);
    return result === null ? fallback : result;
  } catch (error) {
    console.warn("Recovered from JSON Parse Error:", error);
    return fallback;
  }
};

// --- Helper Hook ---
const usePersistedState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => {
    return safeJsonParse(localStorage.getItem(key), defaultValue);
  });

  useEffect(() => {
    try {
      if (state === undefined) return;
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error("Storage Save Error:", error);
    }
  }, [key, state]);

  return [state, setState];
};

export const StocktakePage: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<'list' | 'create_step1' | 'details'>('list');
  const [stocktakes, setStocktakes] = usePersistedState<StocktakeRecord[]>('gsc_stocktakes', []);
  
  // Data Sources الحقيقية فقط
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]); 
  const [branches, setBranches] = useState<any[]>([]);

  // Working State
  const [activeStocktake, setActiveStocktake] = useState<StocktakeRecord | null>(null);
  
  // Creation Form
  const [newStocktakeForm, setNewStocktakeForm] = useState<{date: string, branchId: string, type: 'opening'|'closing'|'regular', notes: string}>({ 
      date: new Date().toISOString().split('T')[0], 
      branchId: '',
      type: 'regular',
      notes: ''
  });

  // Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // --- Effects ---
  useEffect(() => {
    // تحميل داتا المخازن والفروع والمواد والاقسام المكوّدة فعلياً
    setInventoryItems(safeJsonParse(localStorage.getItem('gsc_items'), []));
    setDepartments(safeJsonParse(localStorage.getItem('gsc_departments'), []));
    setWarehouses(safeJsonParse(localStorage.getItem('gsc_warehouses_config'), []));
    setBranches(safeJsonParse(localStorage.getItem('gsc_branches'), []));
  }, [view]);

  // --- Actions ---

  const generateSerialId = () => {
    const year = new Date().getFullYear();
    const prefix = `STK-${year}-`;
    const yearRecords = stocktakes.filter(s => s.id.startsWith(prefix));
    let maxNum = 0;
    yearRecords.forEach(s => {
      const parts = s.id.split('-');
      const num = parseInt(parts[parts.length - 1]);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    return `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
  };

  const handlePrint = () => {
    const el = document.getElementById('printable-area');
    if (!el) {
      alert('منطقة الطباعة غير موجودة');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=650');
    if (!printWindow) {
      alert('المتصفح منع فتح نافذة جديدة (Pop-up blocked). فعّل Popups وجرب تاني.');
      return;
    }

    const html = `
    <html dir="rtl" lang="ar">
      <head>
        <title>طباعة جرد المخزون - 3M GSC</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#000; background:#fff; padding: 20px; }
          h1, h2, h3 { margin: 0 0 10px 0; }
          .print-header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background-color: #f5f5f5 !important; font-weight: bold; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          .no-print { display:none !important; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .footer { margin-top: 30px; font-size: 10px; color: #666; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        ${el.innerHTML}
        <div class="footer">
          طُبع بواسطة نظام 3M GSC لإدارة التكاليف والمخزون | تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}
        </div>
        <script>
          window.onload = function () {
            window.focus();
            window.print();
            window.onafterprint = function () { window.close(); };
          };
        </script>
      </body>
    </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleStartCreate = () => {
      // اختيار أول موقع متاح كافتراضي (سواء كان مخزن أو فرع)
      const defaultId = warehouses[0]?.id || branches[0]?.id || '';
      setNewStocktakeForm({ 
          date: new Date().toISOString().split('T')[0], 
          branchId: defaultId,
          type: 'regular',
          notes: ''
      });
      setView('create_step1');
  };

  const handleCreateConfirm = () => {
      if (!newStocktakeForm.branchId) { alert('يرجى اختيار الفرع / المخزن للمتابعة'); return; }
      
      // البحث عن اسم الموقع المختار في كلا القائمتين
      const selectedLocation = warehouses.find(w => w.id === newStocktakeForm.branchId) || 
                               branches.find(b => b.id === newStocktakeForm.branchId);
      
      const branchName = selectedLocation?.name || 'موقع غير معروف';
      
      const newRecord: StocktakeRecord = {
          id: generateSerialId(),
          date: newStocktakeForm.date,
          branchId: newStocktakeForm.branchId,
          branchName: branchName,
          type: newStocktakeForm.type,
          status: 'مسودة',
          items: [],
          totalVarianceCost: 0,
          notes: newStocktakeForm.notes
      };

      setActiveStocktake(newRecord);
      setView('details');
  };

  const handleOpenStocktake = (record: StocktakeRecord) => {
      setActiveStocktake({ ...record });
      setView('details');
  };

  const handleSaveDraft = () => {
      if (!activeStocktake) return;
      
      const totalVar = activeStocktake.items.reduce((sum, item) => sum + (item.varianceCost || 0), 0);
      const updatedRecord = { ...activeStocktake, totalVarianceCost: totalVar, status: 'مسودة' as const };

      setStocktakes(prev => {
          const exists = prev.find(s => s.id === updatedRecord.id);
          if (exists) return prev.map(s => s.id === updatedRecord.id ? updatedRecord : s);
          return [updatedRecord, ...prev];
      });
      setActiveStocktake(updatedRecord);
      alert('تم حفظ الجرد كمسودة. يمكنك تعديل الكميات لاحقاً.');
  };

  const handlePostStocktake = async (e: any) => {
    e?.preventDefault?.();
    if (!activeStocktake) return;
    const items = activeStocktake.items;

    try {
      const inventoryList: any[] = safeJsonParse(localStorage.getItem('gsc_items'), []);
      
      const updatedInventory = inventoryList.map(invItem => {
          const match = items.find(i => i.itemId === invItem.id);
          if (match) {
              return { ...invItem, currentStock: Number(match.countedQty) };
          }
          return invItem;
      });
      localStorage.setItem('gsc_items', JSON.stringify(updatedInventory));

      const totalVariance = items.reduce((sum, item) => sum + (item.varianceCost || 0), 0);
      const postedRecord: StocktakeRecord = { 
          ...activeStocktake, 
          status: 'مرحل', 
          totalVarianceCost: totalVariance 
      };

      // تحديث القائمة الرئيسية مباشرة عند الترحيل لضمان ظهور العملية في الواجهة
      setStocktakes(prev => {
          const exists = prev.find(s => s.id === postedRecord.id);
          if (exists) return prev.map(s => s.id === postedRecord.id ? postedRecord : s);
          return [postedRecord, ...prev];
      });
      
      setActiveStocktake(postedRecord);

      alert("تم الاعتماد والترحيل وتحديث الأرصدة ✅");
    } catch (err: any) {
      alert(`فشل الترحيل ❌: ${err?.message || "Unknown error"}`);
    }
  };

  const handleOpenAddItems = () => {
      setSelectedItemIds(new Set());
      setSelectedDeptFilter('');
      setIsItemModalOpen(true);
  };

  const toggleItemSelection = (id: string) => {
      const newSet = new Set(selectedItemIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedItemIds(newSet);
  };

  const handleSelectAllInDept = () => {
      const itemsInDept = inventoryItems.filter(i => !selectedDeptFilter || i.department === selectedDeptFilter);
      const newSet = new Set(selectedItemIds);
      itemsInDept.forEach(i => newSet.add(i.id));
      setSelectedItemIds(newSet);
  };

  const confirmAddItems = () => {
      if (!activeStocktake) return;
      const newItems: StocktakeItem[] = [];
      selectedItemIds.forEach(id => {
          if (activeStocktake.items.some(i => i.itemId === id)) return;
          const invItem = inventoryItems.find(i => i.id === id);
          if (invItem) {
              const sysQty = invItem.currentStock || 0;
              const cost = invItem.avgCost || 0;
              newItems.push({
                  itemId: invItem.id,
                  name: invItem.name,
                  unit: invItem.stockUnit,
                  category: invItem.category,
                  systemQty: sysQty,
                  countedQty: sysQty, 
                  avgCost: cost,
                  variance: 0,
                  varianceCost: 0
              });
          }
      });
      setActiveStocktake({ ...activeStocktake, items: [...activeStocktake.items, ...newItems] });
      setIsItemModalOpen(false);
  };

  const updateCountedQty = (index: number, val: number) => {
      if (!activeStocktake || activeStocktake.status === 'مرحل') return;
      const safeVal = isNaN(val) ? 0 : val;
      const updatedItems = [...activeStocktake.items];
      updatedItems[index] = { ...updatedItems[index] }; 
      updatedItems[index].countedQty = safeVal;
      updatedItems[index].variance = safeVal - updatedItems[index].systemQty;
      updatedItems[index].varianceCost = updatedItems[index].variance * updatedItems[index].avgCost;
      setActiveStocktake({ ...activeStocktake, items: updatedItems });
  };

  const removeItem = (index: number) => {
      if (!activeStocktake || activeStocktake.status === 'مرحل') return;
      const updatedItems = activeStocktake.items.filter((_, i) => i !== index);
      setActiveStocktake({ ...activeStocktake, items: updatedItems });
  };

  const listColumns = [
      { key: 'id', label: 'رقم الجرد', sortable: true },
      { key: 'date', label: 'تاريخ الجرد', sortable: true },
      { key: 'branchName', label: 'الفرع / المخزن' },
      { key: 'status', label: 'الحالة' },
      { key: 'totalVarianceCost', label: 'قيمة الفروقات' },
  ];

  const getTypeName = (type: string) => {
      switch(type) {
          case 'opening': return 'رصيد أول المدة';
          case 'closing': return 'رصيد آخر المدة';
          default: return 'جرد دوري';
      }
  };

  const getTotalActualValue = () => {
      if(!activeStocktake) return 0;
      return activeStocktake.items.reduce((sum, item) => sum + (item.countedQty * item.avgCost), 0);
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      {view === 'list' && (
          <>
             <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                 <div className="p-3 bg-sys-primary/10 rounded-full text-sys-primary"><ClipboardCheck size={24} /></div>
                 <div><h2 className="text-xl font-bold text-white">جرد المخزون (Stocktaking)</h2><p className="text-white/40 text-sm">تسجيل الجرد الفعلي، الأرصدة الافتتاحية، وتسوية الفروقات</p></div>
             </div>
             <div className="flex-1 min-h-0">
                 <DataGrid title="سجلات الجرد السابقة" data={stocktakes.map(s => ({ ...s, totalVarianceCost: Number(s.totalVarianceCost).toFixed(2) }))} columns={listColumns} onAdd={handleStartCreate} onRowClick={handleOpenStocktake} />
             </div>
          </>
      )}

      {view === 'create_step1' && (
          <div className="flex flex-col items-center justify-center h-full">
              <div className="bg-sys-surface border border-white/5 rounded-xl p-8 w-full max-w-md shadow-2xl">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><ClipboardCheck size={24} className="text-sys-primary" /> بدء جرد جديد</h3>
                  <div className="space-y-4">
                      <div className="space-y-1"><label className="text-sm text-white/60">تاريخ الجرد</label><input type="date" value={newStocktakeForm.date} onChange={e => setNewStocktakeForm({...newStocktakeForm, date: e.target.value})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-3 text-white focus:border-sys-primary outline-none" /></div>
                      
                      <div className="space-y-1">
                        <label className="text-sm text-white/60">الفرع / المخزن المراد جرده</label>
                        <select 
                            value={newStocktakeForm.branchId} 
                            onChange={e => setNewStocktakeForm({...newStocktakeForm, branchId: e.target.value})} 
                            className="w-full bg-[#121212] border border-white/10 rounded-lg p-3 text-white focus:border-sys-primary outline-none"
                        >
                            {warehouses.length > 0 && (
                                <optgroup label="المخازن والمستودعات" className="bg-[#1e1e1e] text-sys-primary font-bold">
                                    {warehouses.map(w => <option key={w.id} value={w.id} className="text-white font-normal">{w.name}</option>)}
                                </optgroup>
                            )}
                            {branches.length > 0 && (
                                <optgroup label="الفروع ومراكز البيع" className="bg-[#1e1e1e] text-sys-warning font-bold">
                                    {branches.map(b => <option key={b.id} value={b.id} className="text-white font-normal">{b.name}</option>)}
                                </optgroup>
                            )}
                            {warehouses.length === 0 && branches.length === 0 && <option value="">لا توجد مواقع مكوّدة</option>}
                        </select>
                      </div>

                      <div className="space-y-1"><label className="text-sm text-white/60">نوع الجرد</label><select value={newStocktakeForm.type} onChange={e => setNewStocktakeForm({...newStocktakeForm, type: e.target.value as any})} className="w-full bg-[#121212] border border-white/10 rounded-lg p-3 text-white focus:border-sys-primary outline-none"><option value="regular">جرد دوري / مفاجئ</option><option value="opening">رصيد أول المدة</option><option value="closing">رصيد آخر المدة</option></select></div>
                  </div>
                  <div className="flex gap-3 mt-8">
                      <button onClick={() => setView('list')} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5">إلغاء</button>
                      <button onClick={handleCreateConfirm} className="flex-1 py-2.5 rounded-lg bg-sys-primary text-white font-bold hover:bg-blue-600 shadow-lg">بدء الجرد</button>
                  </div>
              </div>
          </div>
      )}

      {view === 'details' && activeStocktake && (
          <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
             <div className="flex items-center justify-between bg-sys-surface p-4 rounded-xl border border-white/5 no-print shadow-sm">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
                    <div><h2 className="text-xl font-bold text-white flex items-center gap-2">{activeStocktake.id} <span className={`text-xs px-2 py-0.5 rounded-full border ${activeStocktake.status === 'مرحل' ? 'border-sys-success text-sys-success bg-sys-success/10' : 'border-sys-warning text-sys-warning bg-sys-warning/10'}`}>{activeStocktake.status}</span></h2><div className="text-xs text-white/40 flex items-center gap-2 mt-1"><Calendar size={12} /> {activeStocktake.date} <span className="w-1 h-1 rounded-full bg-white/20"></span> <Building2 size={12} /> {activeStocktake.branchName}</div></div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"><Printer size={18} /></button>
                    {activeStocktake.status !== 'مرحل' && (<><button onClick={handleSaveDraft} className="flex items-center gap-2 px-4 py-2 bg-sys-surface border border-white/10 rounded-lg text-white hover:bg-white/5 transition-colors"><Save size={16} /> حفظ مؤقت</button><button type="button" onClick={handlePostStocktake} className="flex items-center gap-2 px-6 py-2 bg-sys-success hover:bg-green-600 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-colors"><CheckCircle size={18} /> اعتماد وترحيل</button></>)}
                 </div>
             </div>
             <div id="printable-area" className="flex-1 bg-sys-surface border border-white/5 rounded-xl p-6 overflow-y-auto">
                 {/* Print Header (يظهر في الطباعة فقط عبر CSS) */}
                 <div className="hidden print:block mb-4">
                    <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: '900' }}>3M GSC - GLOBAL SYSTEM COST</div>
                            <div style={{ fontSize: '16px', marginTop: '4px', fontWeight: 'bold' }}>نموذج جرد مخزون رسمي</div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>رقم الجرد: <span className="font-bold">{activeStocktake.id}</span></div>
                        </div>

                        <div style={{ textAlign: 'left', fontSize: '12px' }}>
                            <div>التاريخ: <span className="font-bold">{activeStocktake.date}</span></div>
                            <div>الموقع: <span className="font-bold">{activeStocktake.branchName}</span></div>
                            <div>النوع: <span className="font-bold">{getTypeName(activeStocktake.type || 'regular')}</span></div>
                            <div>الحالة: <span className="font-bold">{activeStocktake.status}</span></div>
                        </div>
                    </div>

                    {activeStocktake.notes && (
                        <div style={{ marginTop: '8px', fontSize: '12px' }}>
                            <strong>ملاحظات:</strong> {activeStocktake.notes}
                        </div>
                    )}
                 </div>

                 <div className="grid grid-cols-3 gap-4 mb-4 no-print"><div className="p-3 bg-[#121212] rounded-lg border border-white/10"><div className="text-xs text-white/50 mb-1">نوع الجرد</div><div className="text-sm font-medium text-white flex items-center gap-2"><Tag size={14} className="text-sys-primary" /> {getTypeName(activeStocktake.type || 'regular')}</div></div><div className="p-3 bg-[#121212] rounded-lg border border-white/10"><div className="text-xs text-white/50 mb-1">إجمالي قيمة المخزون (الفعلي)</div><div className="text-sm font-bold text-sys-success flex items-center gap-2"><DollarSign size={14} /> {getTotalActualValue().toFixed(2)} ج.م</div></div><div className="p-3 bg-[#121212] rounded-lg border border-white/10"><div className="text-xs text-white/50 mb-1">ملاحظات</div><div className="text-sm text-white/80"><input type="text" value={activeStocktake.notes || ''} onChange={e => setActiveStocktake({...activeStocktake, notes: e.target.value})} disabled={activeStocktake.status === 'مرحل'} className="w-full bg-transparent border-none p-0 focus:ring-0 text-white placeholder:text-white/20" placeholder="أضف ملاحظات..." /></div></div></div>
                 <div className="flex justify-between items-center mb-4 no-print"><h3 className="font-bold text-white">قائمة الأصناف المجرودة</h3>{activeStocktake.status !== 'مرحل' && (<button onClick={handleOpenAddItems} className="flex items-center gap-2 px-4 py-2 bg-sys-primary text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"><Plus size={16} /> إضافة خامات للجرد</button>)}</div>
                 <table className="w-full text-right text-sm border-collapse"><thead className="bg-sys-surface-elevated text-white/50 text-xs uppercase sticky top-0"><tr><th className="p-3 border-b border-white/5">اسم الصنف</th><th className="p-3 border-b border-white/5">الوحدة</th><th className="p-3 border-b border-white/5">الدفتري</th><th className="p-3 border-b border-white/5 bg-sys-primary/10">الفعلي</th><th className="p-3 border-b border-white/5">متوسط التكلفة</th><th className="p-3 border-b border-white/5 text-sys-success">القيمة</th><th className="p-3 border-b border-white/5">الفارق</th><th className="p-3 border-b border-white/5 no-print"></th></tr></thead><tbody className="divide-y divide-white/5">
                         {activeStocktake.items.map((item, idx) => (<tr key={idx} className="hover:bg-white/[0.02]"><td className="p-3 text-white"><div className="font-medium">{item.name}</div><div className="text-[10px] text-white/40">{item.itemId}</div></td><td className="p-3 text-white/60">{item.unit}</td><td className="p-3">{item.systemQty}</td><td className="p-3 bg-sys-primary/[0.03]"><input type="number" step="0.1" value={item.countedQty} onChange={e => updateCountedQty(idx, parseFloat(e.target.value))} disabled={activeStocktake.status === 'مرحل'} className="w-full bg-sys-surface border border-white/10 rounded p-1.5 text-center text-white font-bold no-print" /> <span className="hidden print:inline font-bold">{item.countedQty}</span></td><td className="p-3">{item.avgCost.toFixed(2)}</td><td className="p-3 text-sys-success">{(item.countedQty * item.avgCost).toFixed(2)}</td><td className={`p-3 font-medium ${item.variance < 0 ? 'text-sys-danger' : 'text-sys-success'}`}>{item.variance.toFixed(2)}</td><td className="p-3 text-center no-print">{activeStocktake.status !== 'مرحل' && (<button onClick={() => removeItem(idx)} className="text-white/20 hover:text-sys-danger"><Trash2 size={16} /></button>)}</td></tr>))}
                     </tbody></table>
             </div>
          </div>
      )}

      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 no-print"><div className="bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"><div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]"><h3 className="font-bold text-white">إضافة خامات للجرد</h3><button onClick={() => setIsItemModalOpen(false)}><X size={18} className="text-white/40 hover:text-white"/></button></div><div className="p-4 bg-sys-surface border-b border-white/5"><select value={selectedDeptFilter} onChange={e => setSelectedDeptFilter(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-sys-primary outline-none"><option value="">-- كل الأقسام --</option>{departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}</select></div><div className="flex-1 overflow-y-auto p-2"><div className="space-y-1">{inventoryItems.filter(i => i.active === 'نعم' && (!selectedDeptFilter || i.department === selectedDeptFilter)).map(item => (<div key={item.id} onClick={() => toggleItemSelection(item.id)} className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${selectedItemIds.has(item.id) ? 'bg-sys-primary/20 border-sys-primary' : 'bg-[#121212] border-white/5 hover:border-white/20'}`}><div><div className="text-white font-medium text-sm">{item.name}</div><div className="text-[10px] text-white/40">{item.id} • {item.department}</div></div><div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedItemIds.has(item.id) ? 'bg-sys-primary border-sys-primary' : 'border-white/20'}`}>{selectedItemIds.has(item.id) && <CheckCircle size={14} className="text-white" />}</div></div>))}</div></div><div className="p-4 bg-[#181818] border-t border-white/5 flex justify-between gap-3 items-center"><button onClick={handleSelectAllInDept} className="text-xs text-sys-primary hover:underline">تحديد الكل</button><div className="flex gap-2"><button onClick={() => setIsItemModalOpen(false)} className="px-4 py-2 rounded-lg text-sm text-white/60">إلغاء</button><button onClick={confirmAddItems} disabled={selectedItemIds.size === 0} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-sys-primary">إضافة ({selectedItemIds.size})</button></div></div></div></div>
      )}
    </div>
  );
};
