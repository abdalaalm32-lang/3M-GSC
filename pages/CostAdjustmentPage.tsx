
import React, { useState, useEffect } from 'react';
import { DataGrid } from '../components/DataGrid';
import { 
  Edit3, Plus, Save, CheckCircle, Search, X, Printer, 
  ArrowLeft, Building2, Trash2, Tag, Calculator, 
  Calendar, Check, AlertTriangle, Store, Warehouse
} from 'lucide-react';

// --- Types ---

interface AdjustmentItem {
  itemId: string;
  name: string;
  unit: string;
  oldCost: number;
  newCost: number;
}

interface CostAdjustmentRecord {
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  status: 'مسودة' | 'مغلق';
  items: AdjustmentItem[];
  notes?: string;
}

// --- Helpers ---
const safeJsonParse = (value: string | null, fallback: any = null) => {
  if (value == null) return fallback;
  if (value === "undefined" || value === "null" || value === "") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

export const CostAdjustmentPage: React.FC = () => {
  // --- View State ---
  const [view, setView] = useState<'list' | 'create_step1' | 'details'>('list');
  
  // --- Data State ---
  const [adjustments, setAdjustments] = useState<CostAdjustmentRecord[]>(() => 
    safeJsonParse(localStorage.getItem('gsc_cost_adjustments'), [])
  );
  const [inventoryItems, setInventoryItems] = useState<any[]>(() => 
    safeJsonParse(localStorage.getItem('gsc_items'), [])
  );
  
  // قائمة المواقع المكوّدة فعلياً في النظام (مخازن وفروع)
  const [systemWarehouses, setSystemWarehouses] = useState<any[]>([]);
  const [systemBranches, setSystemBranches] = useState<any[]>([]);

  const [activeAdjustment, setActiveAdjustment] = useState<CostAdjustmentRecord | null>(null);
  
  const [newForm, setNewForm] = useState({
    date: new Date().toISOString().split('T')[0],
    branchId: '',
    notes: ''
  });

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedTempIds, setSelectedTempIds] = useState<Set<string>>(new Set());

  // تحميل البيانات عند فتح الصفحة
  useEffect(() => {
    const warehouses = safeJsonParse(localStorage.getItem('gsc_warehouses_config'), []);
    const branches = safeJsonParse(localStorage.getItem('gsc_branches'), []);
    
    setSystemWarehouses(warehouses);
    setSystemBranches(branches);
    
    // تعيين أول موقع متاح كافتراضي (مخزن أو فرع)
    const defaultId = warehouses[0]?.id || branches[0]?.id || '';
    if (defaultId) {
      setNewForm(prev => ({ ...prev, branchId: defaultId }));
    }
  }, [view]);

  // Sync with LocalStorage whenever adjustments change
  useEffect(() => {
    localStorage.setItem('gsc_cost_adjustments', JSON.stringify(adjustments));
  }, [adjustments]);

  // --- Actions ---

  const generateSerialId = () => {
    const year = new Date().getFullYear();
    const prefix = `CADJ-${year}-`;
    const yearRecords = adjustments.filter(a => a.id.startsWith(prefix));
    
    let maxNum = 0;
    yearRecords.forEach(a => {
      const parts = a.id.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    });
    
    return `${prefix}${(maxNum + 1).toString().padStart(4, '0')}`;
  };

  const handlePrint = () => {
    if (!activeAdjustment) {
      alert('لا يوجد سجل مفتوح للطباعة');
      return;
    }

    // بناء أسطر الجدول
    const rowsHtml = (activeAdjustment.items || []).map((it, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td>${it.itemId}</td>
        <td>${it.name}</td>
        <td>${it.unit}</td>
        <td style="text-align:center;">${Number(it.oldCost || 0).toFixed(2)}</td>
        <td style="text-align:center; font-weight:700;">${Number(it.newCost || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
    <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>طباعة تعديل تكلفة - ${activeAdjustment.id}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#000; background:#fff; padding: 20px; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
          .title-area h1 { font-size:22px; font-weight:900; margin:0; }
          .title-area h2 { font-size:16px; font-weight:700; margin:5px 0 0 0; color: #333; }
          .meta-area { font-size:12px; line-height:1.6; text-align:left; }
          table { width:100%; border-collapse:collapse; font-size:12px; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; vertical-align: middle; }
          thead { background:#f9f9f9; display:table-header-group; }
          tr { page-break-inside: avoid; }
          .footer { margin-top: 40px; font-size: 10px; color: #777; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
          .notes-box { margin-top: 15px; padding: 10px; border: 1px solid #eee; font-size: 11px; background: #fafafa; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-area">
            <h1>3M GSC - GLOBAL SYSTEM COST</h1>
            <h2>نموذج اعتماد تعديل تكلفة الأصناف</h2>
            <div style="margin-top:8px;">رقم السجل: <b>${activeAdjustment.id}</b></div>
          </div>
          <div class="meta-area">
            <div>تاريخ التعديل: <b>${activeAdjustment.date}</b></div>
            <div>الموقع المستهدف: <b>${activeAdjustment.branchName}</b></div>
            <div>الحالة: <b>${activeAdjustment.status === 'مغلق' ? 'معتمد ومنفذ' : 'مسودة'}</b></div>
            <div>تاريخ الطباعة: <b>${new Date().toLocaleString('ar-EG')}</b></div>
          </div>
        </div>

        ${activeAdjustment.notes ? `<div class="notes-box"><strong>ملاحظات الإدارة:</strong> ${activeAdjustment.notes}</div>` : ''}

        <table>
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">#</th>
              <th style="width:120px;">كود الصنف</th>
              <th>اسم الصنف</th>
              <th style="width:100px;">الوحدة</th>
              <th style="width:120px; text-align:center;">التكلفة السابقة</th>
              <th style="width:150px; text-align:center;">التكلفة الجديدة المعتمدة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding: 30px;">لا توجد أصناف في هذا السجل</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 50px; display: flex; justify-content: space-around; text-align: center; font-size: 12px;">
            <div>
                <p>إعداد القسم المالي</p>
                <div style="margin-top: 40px; border-top: 1px solid #000; width: 150px;">التوقيع</div>
            </div>
            <div>
                <p>اعتماد مدير العمليات</p>
                <div style="margin-top: 40px; border-top: 1px solid #000; width: 150px;">التوقيع</div>
            </div>
        </div>

        <div class="footer">
          طُبع بواسطة نظام 3M GSC المتكامل لإدارة التكاليف والمخزون | v5.0.0
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

  const handleStartNew = () => {
    const defaultId = systemWarehouses[0]?.id || systemBranches[0]?.id || '';
    setNewForm({
      date: new Date().toISOString().split('T')[0],
      branchId: defaultId,
      notes: ''
    });
    setView('create_step1');
  };

  const handleConfirmStep1 = () => {
    if (!newForm.branchId) {
      alert("يرجى اختيار الموقع المستهدف أولاً (يجب تكويد مخزن أو فرع في الإعدادات)");
      return;
    }
    
    // البحث عن اسم الموقع المختار في كلا القائمتين
    const selectedLocation = systemWarehouses.find(w => w.id === newForm.branchId) || 
                             systemBranches.find(b => b.id === newForm.branchId);
                             
    const newRecord: CostAdjustmentRecord = {
      id: generateSerialId(),
      date: newForm.date,
      branchId: newForm.branchId,
      branchName: selectedLocation?.name || 'موقع غير معروف',
      status: 'مسودة',
      items: [],
      notes: newForm.notes
    };
    setActiveAdjustment(newRecord);
    setView('details');
  };

  const handleOpenExisting = (record: any) => {
    const original = adjustments.find(a => a.id === record.id);
    if (original) {
      setActiveAdjustment({ ...original });
      setView('details');
    }
  };

  const handleSaveDraft = () => {
    if (!activeAdjustment) return;
    setAdjustments(prev => {
      const exists = prev.find(a => a.id === activeAdjustment.id);
      if (exists) return prev.map(a => a.id === activeAdjustment.id ? activeAdjustment : a);
      return [activeAdjustment, ...prev];
    });
    alert('تم حفظ المسودة بنجاح ✅');
  };

  const handleExecute = async (e?: any) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    if (!activeAdjustment) return;

    const payload = {
      recordId: activeAdjustment.id,
      updates: activeAdjustment.items.map(i => ({
        itemId: i.itemId,
        newCost: Number(i.newCost)
      })),
    };

    if (!payload.recordId) return alert("رقم السجل ناقص");
    if (!Array.isArray(payload.updates) || payload.updates.length === 0) return alert("لا توجد أصناف لتعديلها");

    for (const u of payload.updates) {
      if (!u?.itemId) return alert("كود الصنف ناقص");
      const costNum = Number(u.newCost);
      if (!Number.isFinite(costNum)) return alert(`التكلفة الجديدة غير صحيحة للصنف ${u.itemId}`);
    }

    try {
      // تحديث المخزون المحلي
      const currentInv = safeJsonParse(localStorage.getItem('gsc_items'), []);
      const updatedInv = currentInv.map((invItem: any) => {
        const update = payload.updates.find(u => u.itemId === invItem.id);
        if (update) {
          return { ...invItem, avgCost: update.newCost };
        }
        return invItem;
      });
      localStorage.setItem('gsc_items', JSON.stringify(updatedInv));
      setInventoryItems(updatedInv);

      const closedRecord: CostAdjustmentRecord = { ...activeAdjustment, status: 'مغلق' };
      
      setAdjustments(prev => {
        const exists = prev.find(a => a.id === closedRecord.id);
        if (exists) {
          return prev.map(a => a.id === closedRecord.id ? closedRecord : a);
        }
        return [closedRecord, ...prev];
      });

      setActiveAdjustment(closedRecord);
      alert("تم تنفيذ التعديل وتحديث المخزون وإغلاق السجل بنجاح ✅");
    } catch (err: any) {
      alert(`فشل التنفيذ ❌: ${err?.message || "خطأ غير معروف"}`);
    }
  };

  const handleDelete = async () => {
    if (!activeAdjustment) return;
    if (activeAdjustment.status === 'مغلق') {
      alert('لا يمكن حذف سجل تم تنفيذه وإغلاقه');
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذه المسودة؟')) return;
    setAdjustments(prev => prev.filter(a => a.id !== activeAdjustment.id));
    setView('list');
    setActiveAdjustment(null);
  };

  const openItemModal = () => {
    setSelectedTempIds(new Set());
    setItemSearch('');
    setIsItemModalOpen(true);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedTempIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTempIds(next);
  };

  const addItemsToGrid = () => {
    if (!activeAdjustment) return;
    const newItems: AdjustmentItem[] = [];
    selectedTempIds.forEach(id => {
      if (activeAdjustment.items.some(i => i.itemId === id)) return;
      const inv = inventoryItems.find(i => i.id === id);
      if (inv) {
        newItems.push({
          itemId: inv.id,
          name: inv.name,
          unit: inv.stockUnit,
          oldCost: inv.avgCost || 0,
          newCost: inv.avgCost || 0
        });
      }
    });
    setActiveAdjustment({ ...activeAdjustment, items: [...activeAdjustment.items, ...newItems] });
    setIsItemModalOpen(false);
  };

  const updateNewCost = (idx: number, cost: number) => {
    if (!activeAdjustment || activeAdjustment.status === 'مغلق') return;
    const items = [...activeAdjustment.items];
    items[idx].newCost = isNaN(cost) ? 0 : cost;
    setActiveAdjustment({ ...activeAdjustment, items });
  };

  const removeRow = (idx: number) => {
    if (!activeAdjustment || activeAdjustment.status === 'مغلق') return;
    const items = activeAdjustment.items.filter((_, i) => i !== idx);
    setActiveAdjustment({ ...activeAdjustment, items });
  };

  return (
    <div className="h-full flex flex-col gap-4 relative font-sans" dir="rtl">
      {/* List View */}
      {view === 'list' && (
        <>
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sys-primary/10 rounded-full text-sys-primary">
                <Edit3 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">تعديل تكلفة الأصناف</h2>
                <p className="text-white/40 text-xs">ضبط يدوي لمتوسط تكلفة المواد الخام</p>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <DataGrid 
              title="سجلات تعديلات التكلفة"
              columns={[
                { key: 'id', label: 'رقم السجل' },
                { key: 'date', label: 'التاريخ' },
                { key: 'branchName', label: 'الموقع المستهدف' },
                { key: 'status', label: 'الحالة' },
                { key: 'itemsCount', label: 'الأصناف' }
              ]}
              data={adjustments.map(a => ({ 
                ...a, 
                itemsCount: a.items.length,
                status: a.status === 'مغلق' ? 'مغلق (منفذ)' : 'مسودة'
              }))}
              onAdd={handleStartNew}
              onRowClick={handleOpenExisting}
            />
          </div>
        </>
      )}

      {/* Step 1 Form */}
      {view === 'create_step1' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-sys-surface border border-white/5 p-8 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-sys-primary/10 rounded-full text-sys-primary">
                    <Building2 size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">بدء سجل جديد</h3>
                    <p className="text-white/40 text-[10px]">تحديد المخزن أو الفرع وتاريخ التعديل</p>
                </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-white/50 px-1">المخزن أو الفرع المستهدف</label>
                <select 
                  value={newForm.branchId}
                  onChange={e => setNewForm({...newForm, branchId: e.target.value})}
                  className="w-full bg-sys-bg border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none"
                >
                  {systemWarehouses.length > 0 && (
                    <optgroup label="المخازن والمستودعات" className="bg-[#1e1e1e] text-sys-primary font-bold">
                        {systemWarehouses.map(w => <option key={w.id} value={w.id} className="text-white font-normal">{w.name}</option>)}
                    </optgroup>
                  )}
                  {systemBranches.length > 0 && (
                    <optgroup label="الفروع ومراكز البيع" className="bg-[#1e1e1e] text-sys-warning font-bold">
                        {systemBranches.map(b => <option key={b.id} value={b.id} className="text-white font-normal">{b.name}</option>)}
                    </optgroup>
                  )}
                  {systemWarehouses.length === 0 && systemBranches.length === 0 && <option value="">يرجى تكويد المواقع أولاً</option>}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/50 px-1">تاريخ السجل</label>
                <input 
                  type="date" 
                  value={newForm.date}
                  onChange={e => setNewForm({...newForm, date: e.target.value})}
                  className="w-full bg-sys-bg border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/50 px-1">ملاحظات إدارية</label>
                <input 
                  type="text" 
                  value={newForm.notes}
                  onChange={e => setNewForm({...newForm, notes: e.target.value})}
                  placeholder="مثال: تصحيح أسعار الموردين..."
                  className="w-full bg-sys-bg border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setView('list')} 
                className="flex-1 py-3 bg-white/5 text-white/60 rounded-xl hover:bg-white/10 text-xs font-medium border border-white/5 transition-all"
              >
                إلغاء
              </button>
              <button 
                onClick={handleConfirmStep1} 
                className="flex-1 py-3 bg-sys-primary text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-all text-xs"
              >
                إنشاء السجل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details View */}
      {view === 'details' && activeAdjustment && (
        <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between bg-sys-surface p-4 rounded-xl border border-white/5 no-print shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  {activeAdjustment.id}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${activeAdjustment.status === 'مغلق' ? 'bg-sys-success/20 text-sys-success' : 'bg-sys-warning/20 text-sys-warning'}`}>
                    {activeAdjustment.status === 'مغلق' ? 'منفذ ومغلق' : 'مسودة قيد التعديل'}
                  </span>
                </h2>
                <div className="text-[10px] text-white/40 flex items-center gap-2 mt-1">
                    <Calendar size={12} /> {activeAdjustment.date}
                    <span className="w-1 h-1 rounded-full bg-white/10"></span>
                    <Building2 size={12} /> {activeAdjustment.branchName}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={handlePrint} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors" title="طباعة">
                <Printer size={18} />
              </button>
              {activeAdjustment.status === 'مسودة' && (
                <>
                  <button 
                    type="button"
                    onClick={handleSaveDraft} 
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-bold hover:bg-white/10 flex items-center gap-2 transition-all"
                  >
                    <Save size={16} /> حفظ
                  </button>
                  <button 
                    type="button" 
                    onClick={handleExecute} 
                    className="px-5 py-2 bg-sys-primary text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-900/20 flex items-center gap-2 hover:bg-blue-600 transition-all"
                  >
                    <CheckCircle size={18} /> تنفيذ التعديل
                  </button>
                  <button 
                    type="button"
                    onClick={handleDelete}
                    className="p-2 bg-sys-danger/10 border border-sys-danger/20 rounded-lg text-sys-danger hover:bg-sys-danger hover:text-white transition-all"
                    title="حذف نهائي"
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 bg-sys-surface border border-white/5 rounded-xl flex flex-col overflow-hidden shadow-inner">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02] no-print">
              <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-sys-primary" />
                  <h3 className="text-xs font-bold text-white">قائمة الأصناف المختارة</h3>
              </div>
              {activeAdjustment.status === 'مسودة' && (
                <button 
                    onClick={openItemModal} 
                    className="px-3 py-1.5 bg-sys-primary text-white text-[10px] font-bold rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/10"
                >
                    <Plus size={14} /> إضافة أصناف من المخزون
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10">
                  <tr>
                    <th className="p-4 border-b border-white/5">كود</th>
                    <th className="p-4 border-b border-white/5">اسم الصنف</th>
                    <th className="p-4 border-b border-white/5">الوحدة</th>
                    <th className="p-4 border-b border-white/5 text-center">التكلفة السابقة</th>
                    <th className="p-4 border-b border-white/5 text-center bg-sys-primary/10 text-sys-primary">التكلفة الجديدة المعتمدة</th>
                    <th className="p-4 border-b border-white/5 no-print w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeAdjustment.items.map((item, idx) => (
                    <tr key={item.itemId} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-4 text-white/30 font-mono">{item.itemId}</td>
                      <td className="p-4 text-white font-medium">{item.name}</td>
                      <td className="p-4 text-white/50">{item.unit}</td>
                      <td className="p-4 text-center text-white/40">{item.oldCost.toFixed(2)}</td>
                      <td className="p-4 bg-sys-primary/[0.03]">
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.newCost}
                          onChange={e => updateNewCost(idx, parseFloat(e.target.value))}
                          disabled={activeAdjustment.status === 'مغلق'}
                          className="w-full bg-sys-bg border border-white/10 rounded-lg p-2 text-center text-white font-bold outline-none focus:border-sys-primary disabled:bg-transparent disabled:border-none focus:bg-sys-primary/10 transition-all"
                        />
                      </td>
                      <td className="p-4 no-print text-center">
                        {activeAdjustment.status === 'مسودة' && (
                          <button onClick={() => removeRow(idx)} className="text-white/20 hover:text-sys-danger transition-colors">
                              <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {activeAdjustment.items.length === 0 && (
                    <tr>
                        <td colSpan={6} className="p-24 text-center text-white/20 italic text-sm">
                            <AlertTriangle size={48} className="mx-auto mb-4 opacity-10" />
                            لم يتم إضافة أصناف بعد. اضغط على "إضافة أصناف" للبدء.
                        </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="font-bold text-white flex items-center gap-2">
                  <Plus size={18} className="text-sys-primary" /> 
                  اختيار خامات تعديل التكلفة
              </h3>
              <button onClick={() => setIsItemModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-4 bg-sys-surface border-b border-white/5">
              <div className="relative">
                <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="text" 
                  placeholder="بحث باسم الصنف أو الكود..." 
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  className="w-full bg-sys-bg border border-white/10 rounded-xl py-3 pr-10 pl-4 text-sm text-white focus:border-sys-primary outline-none shadow-inner"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-2 space-y-1 custom-scrollbar">
              {inventoryItems
                .filter(i => i.active === 'نعم' && (i.name.includes(itemSearch) || i.id.includes(itemSearch)))
                .map(item => {
                  const isSelected = selectedTempIds.has(item.id);
                  const alreadyAdded = activeAdjustment?.items.some(ai => ai.itemId === item.id);
                  return (
                    <div 
                      key={item.id}
                      onClick={() => !alreadyAdded && toggleSelect(item.id)}
                      className={`
                        p-4 rounded-xl border flex justify-between items-center transition-all cursor-pointer
                        ${alreadyAdded 
                            ? 'bg-white/5 border-white/5 opacity-30 cursor-not-allowed' 
                            : isSelected 
                                ? 'bg-sys-primary/10 border-sys-primary shadow-lg shadow-blue-900/10' 
                                : 'bg-transparent border-white/5 hover:border-white/20 hover:bg-white/[0.02]'
                        }
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-sys-primary border-sys-primary' : 'border-white/20 bg-[#121212]'}`}>
                          {isSelected && <Check size={14} className="text-white" />}
                        </div>
                        <div>
                          <p className="text-white text-sm font-bold">{item.name}</p>
                          <p className="text-[10px] text-white/30 uppercase tracking-tighter">{item.id} • {item.stockUnit}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white/60">{item.avgCost?.toFixed(2)} <span className="text-[10px] font-normal">ج.م</span></p>
                        {alreadyAdded && <span className="text-[9px] text-sys-warning">مضاف مسبقاً للسجل</span>}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-4 bg-[#1a1a1a] border-t border-white/5 flex justify-between items-center">
              <span className="text-xs text-white/40 font-medium">تم تحديد <span className="text-sys-primary font-bold">{selectedTempIds.size}</span> صنف</span>
              <div className="flex gap-3">
                <button 
                    type="button"
                    onClick={() => setIsItemModalOpen(false)} 
                    className="px-5 py-2.5 rounded-xl text-xs font-medium text-white/60 hover:bg-white/5 transition-all"
                >
                    إلغاء
                </button>
                <button 
                  type="button"
                  onClick={addItemsToGrid}
                  disabled={selectedTempIds.size === 0}
                  className="px-6 py-2.5 bg-sys-primary text-white font-bold rounded-xl disabled:opacity-30 text-xs shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-all flex items-center gap-2"
                >
                  <Save size={16} />
                  إضافة وحفظ ({selectedTempIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
