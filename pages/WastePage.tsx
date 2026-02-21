
import React, { useState, useEffect } from 'react';
import { DataGrid } from '../components/DataGrid';
import { 
  Trash2, Plus, Calendar, Save, CheckCircle, Search, X, 
  Printer, ArrowLeft, Building2, AlertTriangle, FileText, 
  Check, Layers, Info, Trash, RefreshCw, Box, AlertCircle,
  Utensils, Package, ChevronRight, MapPin, DollarSign
} from 'lucide-react';

// --- Types ---

interface WasteItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  reason: string;
  cost: number;
  sourceProduct?: string;
}

interface WasteRecord {
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  status: 'مسودة' | 'مرحل';
  items: WasteItem[];
  totalCost: number;
  notes?: string;
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

export const WastePage: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<'list' | 'details'>('list');
  const [wasteRecords, setWasteRecords] = usePersistedState<WasteRecord[]>('gsc_waste_records', []);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [posItems, setPosItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  
  // داتا المواقع (مخازن وفروع)
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const [activeRecord, setActiveRecord] = useState<WasteRecord | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  
  const [confirmPostWaste, setConfirmPostWaste] = useState(false);

  // --- Load Data ---
  useEffect(() => {
    const loadData = () => {
        setInventoryItems(safeJsonParse(localStorage.getItem('gsc_items'), []));
        setPosItems(safeJsonParse(localStorage.getItem('gsc_pos_items'), []));
        setRecipes(safeJsonParse(localStorage.getItem('gsc_recipes'), []));
        setWarehouses(safeJsonParse(localStorage.getItem('gsc_warehouses_config'), []));
        setBranches(safeJsonParse(localStorage.getItem('gsc_branches'), []));
    };
    loadData();
  }, [view]);

  useEffect(() => {
    if (!confirmPostWaste) return;
    const t = setTimeout(() => setConfirmPostWaste(false), 5000);
    return () => clearTimeout(t);
  }, [confirmPostWaste]);

  // --- Actions ---

  const handlePrint = () => {
    if (!activeRecord) {
      alert('لا يوجد سجل مفتوح للطباعة');
      return;
    }

    const rowsHtml = (activeRecord.items || []).map((it, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${it.itemId}</td>
        <td>${it.name}</td>
        <td style="text-align:center;">${it.unit}</td>
        <td style="text-align:center; font-weight:bold;">${Number(it.quantity || 0).toFixed(2)}</td>
        <td style="text-align:center;">${Number(it.cost || 0).toFixed(2)}</td>
        <td style="text-align:center; font-weight:700;">${(Number(it.quantity) * Number(it.cost)).toFixed(2)}</td>
        <td>${it.reason || 'تلف عام'}</td>
      </tr>
    `).join('');

    const html = `
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>نموذج إعدام هالك - ${activeRecord.id}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#000; background:#fff; padding: 20px; line-height: 1.5; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .title-area h1 { font-size:22px; font-weight:900; margin:0; }
          .title-area h2 { font-size:16px; font-weight:700; margin:5px 0 0 0; color: #333; }
          .meta-area { font-size:12px; line-height:1.6; text-align:left; }
          table { width:100%; border-collapse:collapse; font-size:11px; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          thead { background:#f5f5f5; display:table-header-group; }
          tr { page-break-inside: avoid; }
          .footer { margin-top: 40px; font-size: 10px; color: #777; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
          .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
          .totals-box { border: 2px solid #000; padding: 10px 20px; min-width: 200px; font-size: 14px; font-weight: bold; }
          .stamp-area { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; font-size: 12px; }
          .stamp-box { width: 150px; border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>3M GSC - GLOBAL SYSTEM COST</h1>
            <h2>نموذج جرد وإعدام فاقد (WASTE)</h2>
            <div style="margin-top:8px;">رقم العملية: <b>${activeRecord.id}</b></div>
          </div>
          <div class="meta-area">
            <div>تاريخ العملية: <b>${activeRecord.date}</b></div>
            <div>الموقع المتأثر: <b>${activeRecord.branchName}</b></div>
            <div>الحالة: <b>${activeRecord.status}</b></div>
            <div>تاريخ الطباعة: <b>${new Date().toLocaleString('ar-EG')}</b></div>
          </div>
        </div>

        ${activeRecord.notes ? `<div style="font-size:12px; padding:10px; background:#f9f9f9; border-right:4px solid #EF4444; margin-bottom:15px;"><strong>ملاحظات الإدارة:</strong> ${activeRecord.notes}</div>` : ''}

        <table>
          <thead>
            <tr>
              <th style="width:30px; text-align:center;">#</th>
              <th style="width:100px;">كود الصنف</th>
              <th>اسم الصنف الخاضع للهالك</th>
              <th style="width:70px; text-align:center;">الوحدة</th>
              <th style="width:70px; text-align:center;">الكمية</th>
              <th style="width:80px; text-align:center;">التكلفة</th>
              <th style="width:100px; text-align:center;">القيمة</th>
              <th style="width:120px;">سبب الهالك</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:30px;">لا توجد أصناف في هذا السجل</td></tr>'}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-box">
             <div style="display:flex; justify-content:space-between;">
                <span>إجمالي الخسارة (EGP):</span>
                <span>${activeRecord.totalCost.toFixed(2)}</span>
             </div>
          </div>
        </div>

        <div class="stamp-area">
           <div>
              <p>أمين الموقع / الفرع</p>
              <div class="stamp-box">التوقيع</div>
           </div>
           <div>
              <p>المراجعة المالية</p>
              <div class="stamp-box">التوقيع</div>
           </div>
           <div>
              <p>اعتماد مدير العمليات</p>
              <div class="stamp-box">التوقيع</div>
           </div>
        </div>

        <div class="footer">
          طُبع بواسطة نظام 3M GSC لإدارة التكاليف والمخزون | وحدة الرقابة على الهالك والفاقد
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

  const generateSerialId = () => {
    const year = new Date().getFullYear();
    const prefix = `WST-${year}-`;
    const yearRecords = wasteRecords.filter(r => r.id.startsWith(prefix));
    let maxNum = 0;
    yearRecords.forEach(r => {
        const parts = r.id.split('-');
        const num = parseInt(parts[parts.length - 1]);
        if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    return `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
  };

  const handleCreateNew = () => {
      const defaultId = warehouses[0]?.id || branches[0]?.id || '';
      const defaultName = warehouses[0]?.name || branches[0]?.name || '';

      const newRec: WasteRecord = {
          id: generateSerialId(),
          date: new Date().toISOString().split('T')[0],
          branchId: defaultId,
          branchName: defaultName,
          status: 'مسودة',
          items: [],
          totalCost: 0,
          notes: ''
      };
      setActiveRecord(newRec);
      setView('details');
  };

  const handleOpenRecord = (record: WasteRecord) => {
      setActiveRecord({ ...record });
      setView('details');
  };

  const handleSaveDraft = () => {
      if (!activeRecord) return;
      const total = activeRecord.items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
      const updated = { ...activeRecord, totalCost: total, status: 'مسودة' as const };
      setWasteRecords(prev => {
          const exists = prev.find(r => r.id === updated.id);
          if (exists) return prev.map(r => r.id === updated.id ? updated : r);
          return [updated, ...prev];
      });
      setActiveRecord(updated);
      alert('تم حفظ المسودة بنجاح 💾');
  };

  const handlePostWaste = async (e?: any) => {
    e?.preventDefault();
    if (!activeRecord || activeRecord.status === 'مرحل') return;
    if (activeRecord.items.length === 0) return alert("لا توجد أصناف للهالك");
    if (!activeRecord.branchId) return alert("يرجى اختيار الموقع المتأثر");

    if (!confirmPostWaste) { setConfirmPostWaste(true); return; }

    const currentInv = safeJsonParse(localStorage.getItem('gsc_items'), []);
    const updatedInv = currentInv.map((stockItem: any) => {
      const waste = activeRecord.items.find(wi => wi.itemId === stockItem.id);
      if (waste) {
        return { ...stockItem, currentStock: Number(stockItem.currentStock || 0) - Number(waste.quantity) };
      }
      return stockItem;
    });

    localStorage.setItem('gsc_items', JSON.stringify(updatedInv));
    const total = activeRecord.items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
    const postedRec: WasteRecord = { ...activeRecord, status: 'مرحل', totalCost: total };

    setWasteRecords(prev => {
        const exists = prev.find(r => r.id === postedRec.id);
        if (exists) return prev.map(r => r.id === postedRec.id ? postedRec : r);
        return [postedRec, ...prev];
    });

    setActiveRecord(postedRec);
    setConfirmPostWaste(false);
    alert('تم ترحيل الهالك وتحديث المخزن بنجاح ✅');
  };

  const handleOpenAddItems = () => {
    setSelectedItemIds(new Set());
    setItemSearchTerm('');
    setIsItemModalOpen(true);
  };

  const toggleItemSelection = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItemIds(next);
  };

  const confirmAddItems = () => {
    if (!activeRecord) return;
    const newItems: WasteItem[] = [];
    selectedItemIds.forEach(id => {
      if (activeRecord.items.some(i => i.itemId === id)) return;
      const inv = inventoryItems.find(i => i.id === id);
      if (inv) {
        newItems.push({
          itemId: inv.id,
          name: inv.name,
          unit: inv.stockUnit,
          quantity: 1,
          reason: 'تلف عام',
          cost: inv.avgCost || 0
        });
      }
    });
    const updatedItems = [...activeRecord.items, ...newItems];
    const total = updatedItems.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
    setActiveRecord({ ...activeRecord, items: updatedItems, totalCost: total });
    setIsItemModalOpen(false);
  };

  const updateItemRow = (idx: number, field: keyof WasteItem, val: any) => {
    if (!activeRecord || activeRecord.status === 'مرحل') return;
    const items = [...activeRecord.items];
    items[idx] = { ...items[idx], [field]: val };
    const total = items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
    setActiveRecord({ ...activeRecord, items, totalCost: total });
  };

  const removeItem = (idx: number) => {
    if (!activeRecord || activeRecord.status === 'مرحل') return;
    const items = activeRecord.items.filter((_, i) => i !== idx);
    const total = items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
    setActiveRecord({ ...activeRecord, items, totalCost: total });
  };

  return (
    <div className="flex flex-col h-full gap-4 relative font-sans" dir="rtl">
      {view === 'list' && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 pb-4 no-print">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-sys-danger/10 rounded-full text-sys-danger"><Trash2 size={24} /></div>
                <div><h2 className="text-xl font-bold text-white">إدارة الهالك (Waste Management)</h2><p className="text-white/40 text-sm">تسجيل الفاقد والتالف وخصمه من أرصدة الفروع والمخازن</p></div>
             </div>
             <button onClick={handleCreateNew} className="bg-sys-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all">
                <Plus size={18} /> تسجيل هالك جديد
             </button>
          </div>
      )}

      <div className="flex-1 min-h-0">
          {view === 'list' && (
              <DataGrid title="سجل تاريخ الهالك" data={wasteRecords.map(r => ({...r, totalCost: Number(r.totalCost).toFixed(2)}))} columns={[{ key: 'id', label: 'رقم العملية', sortable: true }, { key: 'date', label: 'التاريخ', sortable: true }, { key: 'branchName', label: 'الموقع / المخزن' }, { key: 'status', label: 'الحالة' }, { key: 'totalCost', label: 'إجمالي التكلفة' }]} onRowClick={handleOpenRecord} />
          )}

          {view === 'details' && activeRecord && (
              <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between bg-sys-surface p-4 rounded-2xl border border-white/5 no-print shadow-sm">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {activeRecord.id} 
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${activeRecord.status === 'مرحل' ? 'border-sys-success text-sys-success bg-sys-success/10' : 'border-sys-warning text-sys-warning bg-sys-warning/10'}`}>
                                    {activeRecord.status}
                                </span>
                            </h2>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handlePrint} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-all" title="طباعة النموذج">
                                <Printer size={18} />
                            </button>
                            {activeRecord.status !== 'مرحل' && (
                                <>
                                    <button onClick={handleSaveDraft} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-bold transition-all hover:bg-white/10 flex items-center gap-2">
                                        <Save size={16} /> حفظ مسودة
                                    </button>
                                    <button onClick={handlePostWaste} className={`px-6 py-2 rounded-lg font-bold shadow-lg transition-all text-xs flex items-center gap-2 ${confirmPostWaste ? 'bg-sys-warning text-black animate-pulse' : 'bg-sys-danger text-white hover:bg-red-600 shadow-red-900/20'}`}>
                                        {confirmPostWaste ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                                        {confirmPostWaste ? 'تأكيد الترحيل النهائي' : 'ترحيل واعتماد'}
                                    </button>
                                </>
                            )}
                        </div>
                  </div>

                  <div className="bg-sys-surface border border-white/5 rounded-2xl p-6 overflow-y-auto flex-1 shadow-inner relative">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 no-print">
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold px-1">تاريخ العملية</label>
                                <div className="relative">
                                    <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20" />
                                    <input type="date" value={activeRecord.date} onChange={e => setActiveRecord({...activeRecord, date: e.target.value})} disabled={activeRecord.status === 'مرحل'} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 pr-10 text-sm text-white focus:border-sys-primary outline-none" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold px-1">الموقع المتأثر (مخزن / فرع)</label>
                                <div className="relative">
                                    <MapPin size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20" />
                                    <select value={activeRecord.branchId} onChange={e => { const loc = warehouses.find(w => w.id === e.target.value) || branches.find(b => b.id === e.target.value); if(loc) setActiveRecord({...activeRecord, branchId: loc.id, branchName: loc.name}); }} disabled={activeRecord.status === 'مرحل'} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 pr-10 text-sm text-white focus:border-sys-primary outline-none appearance-none">
                                        {warehouses.length > 0 && (<optgroup label="المخازن" className="bg-[#1e1e1e] text-sys-primary font-bold">{warehouses.map(w => <option key={w.id} value={w.id} className="text-white font-normal">{w.name}</option>)}</optgroup>)}
                                        {branches.length > 0 && (<optgroup label="الفروع" className="bg-[#1e1e1e] text-sys-warning font-bold">{branches.map(b => <option key={b.id} value={b.id} className="text-white font-normal">{b.name}</option>)}</optgroup>)}
                                        {warehouses.length === 0 && branches.length === 0 && <option value="">لا توجد مواقع مكوّدة</option>}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold px-1">ملاحظات إدارية</label>
                                <div className="relative">
                                    <FileText size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20" />
                                    <input type="text" value={activeRecord.notes || ''} onChange={e => setActiveRecord({...activeRecord, notes: e.target.value})} disabled={activeRecord.status === 'مرحل'} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 pr-10 text-sm text-white focus:border-sys-primary outline-none" placeholder="اكتب سبباً عاماً أو ملاحظات للتدقيق..." />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mb-4 no-print border-b border-white/5 pb-3">
                             <h3 className="font-bold text-white text-sm flex items-center gap-2"><Layers size={16} className="text-sys-danger" /> بنود الفاقد والهالك</h3>
                             {activeRecord.status !== 'مرحل' && (<button onClick={handleOpenAddItems} className="px-4 py-1.5 bg-sys-primary/10 border border-sys-primary/30 rounded-lg text-sys-primary text-xs font-bold hover:bg-sys-primary hover:text-white transition-all flex items-center gap-2"><Plus size={14} /> إضافة خامات</button>)}
                        </div>

                        <div className="border border-white/10 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-[#1a1a1a] text-white/30 text-[10px] uppercase font-black tracking-widest sticky top-0 z-10">
                                    <tr><th className="p-4 border-b border-white/5">الخامة / كود</th><th className="p-4 border-b border-white/5 text-center">الوحدة</th><th className="p-4 border-b border-white/5 text-center w-32">كمية الهالك</th><th className="p-4 border-b border-white/5">السبب التفصيلي</th><th className="p-4 border-b border-white/5 text-center bg-white/5">القيمة (EGP)</th><th className="p-4 border-b border-white/5 no-print w-12"></th></tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {activeRecord.items.map((item, idx) => (<tr key={idx} className="hover:bg-white/[0.01] transition-colors group"><td className="p-4"><div className="font-bold text-white text-xs">{item.name}</div><div className="text-[10px] text-white/20 font-mono mt-0.5">{item.itemId}</div></td><td className="p-4 text-center text-white/40 text-xs">{item.unit}</td><td className="p-4 text-center"><input type="number" step="0.001" value={item.quantity} onChange={e => updateItemRow(idx, 'quantity', parseFloat(e.target.value))} disabled={activeRecord.status === 'مرحل'} className="w-full bg-sys-bg border border-white/10 rounded-lg p-2 text-center text-xs font-black text-white focus:border-sys-danger outline-none disabled:bg-transparent disabled:border-none" /></td><td className="p-4"><select value={item.reason} onChange={e => updateItemRow(idx, 'reason', e.target.value)} disabled={activeRecord.status === 'مرحل'} className="bg-transparent text-white/60 text-xs border-none focus:ring-0 w-full cursor-pointer"><option value="تلف عام" className="bg-[#1a1a1a]">تلف عام / انتهاء صلاحية</option><option value="هالك إنتاج" className="bg-[#1a1a1a]">هالك مرحلة إنتاج</option><option value="كسر/فقد" className="bg-[#1a1a1a]">كسر أو فقد مادي</option><option value="تجربة/تذوق" className="bg-[#1a1a1a]">تجربة أو تذوق</option><option value="سوء تخزين" className="bg-[#1a1a1a]">سوء تخزين</option></select></td><td className="p-4 text-center bg-white/5 font-black text-sys-danger">{(item.quantity * item.cost).toFixed(2)}</td><td className="p-4 text-center no-print">{activeRecord.status !== 'مرحل' && (<button onClick={() => removeItem(idx)} className="text-white/10 hover:text-sys-danger transition-colors p-1 group-hover:opacity-100 opacity-20"><Trash2 size={16} /></button>)}</td></tr>))}
                                    {activeRecord.items.length === 0 && (<tr><td colSpan={6} className="p-16 text-center text-white/10 italic text-sm"><Trash size={48} className="mx-auto mb-4 opacity-5" />لم يتم إضافة بنود هالك لهذا السجل.</td></tr>)}
                                </tbody>
                                <tfoot className="bg-[#121212] border-t-2 border-sys-danger/30">
                                    <tr><td colSpan={4} className="p-4 text-left font-black text-[10px] text-white/40 uppercase tracking-widest pl-10">إجمالي الخسارة المادية (Total Financial Impact)</td><td className="p-4 text-center text-sys-danger text-xl font-black">{activeRecord.totalCost.toLocaleString()} <span className="text-[10px] font-normal opacity-40 mr-1">EGP</span></td><td className="no-print"></td></tr>
                                </tfoot>
                            </table>
                        </div>
                  </div>
              </div>
          )}
      </div>

      {/* --- Item Selection Modal --- */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
            <div className="bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sys-danger/10 rounded-lg text-sys-danger"><Box size={18} /></div>
                        <h3 className="font-bold text-white text-lg">اختيار خامات للهالك</h3>
                    </div>
                    <button onClick={() => setIsItemModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
                </div>
                <div className="p-4 bg-sys-surface border-b border-white/5">
                    <div className="relative group">
                        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-sys-primary transition-colors" />
                        <input type="text" placeholder="بحث باسم الصنف أو كود التعريف..." value={itemSearchTerm} onChange={e => setItemSearchTerm(e.target.value)} className="w-full bg-sys-bg border border-white/10 rounded-xl py-3 pr-10 pl-4 text-sm text-white focus:border-sys-primary outline-none shadow-inner transition-all" autoFocus />
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-3 space-y-1 custom-scrollbar">
                    {inventoryItems.filter(i => i.active === 'نعم' && (i.name.includes(itemSearchTerm) || i.id.includes(itemSearchTerm))).map(item => {
                        const isSelected = selectedItemIds.has(item.id);
                        return (<div key={item.id} onClick={() => toggleItemSelection(item.id)} className={`p-4 rounded-xl border flex justify-between items-center transition-all cursor-pointer ${isSelected ? 'bg-sys-danger/10 border-sys-danger shadow-lg shadow-red-900/10' : 'bg-transparent border-white/5 hover:border-white/20'}`}><div className="flex items-center gap-4"><div className={`w-6 h-6 rounded-lg border flex items-center justify-center ${isSelected ? 'bg-sys-danger border-sys-danger' : 'border-white/10 bg-[#121212]'}`}>{isSelected && <Check size={16} className="text-white" strokeWidth={3} />}</div><div><p className="text-white text-sm font-bold">{item.name}</p><p className="text-[10px] text-white/20 uppercase tracking-tighter">{item.id} • {item.stockUnit}</p></div></div><div className="text-right"><p className={`text-xs font-black ${item.currentStock > 0 ? 'text-sys-success' : 'text-sys-danger'}`}>رصيد: {item.currentStock || 0}</p><p className="text-[9px] text-white/30 mt-1">ت: {Number(item.avgCost || 0).toFixed(2)}</p></div></div>);
                    })}
                </div>
                <div className="p-5 bg-[#181818] border-t border-white/5 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-xs text-white/40 font-medium">تم تحديد</span>
                        <span className="text-sys-primary font-black text-xl">{selectedItemIds.size} <span className="text-[10px] font-normal text-white/20 uppercase tracking-widest">خامة</span></span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsItemModalOpen(false)} className="px-6 py-2.5 rounded-xl text-xs font-bold text-white/50 hover:text-white transition-all">إغلاق</button>
                        {/* Changed handleConfirmAddItems to confirmAddItems to fix 'Cannot find name' error */}
                        <button onClick={confirmAddItems} disabled={selectedItemIds.size === 0} className="px-8 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-all flex items-center gap-2">
                            <Plus size={16} /> إضافة المختار
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
