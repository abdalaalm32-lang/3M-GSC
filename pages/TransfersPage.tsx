
import React, { useState, useEffect, useMemo } from 'react';
import { DataGrid } from '../components/DataGrid';
import { 
  ArrowRightLeft, Plus, Calendar, Save, CheckCircle, Search, X, 
  Trash2, Printer, ArrowLeft, Truck, MapPin, Package, 
  AlertTriangle, FileText, Check, Layers, Info, AlertCircle, Building2, Store, Warehouse, DollarSign
} from 'lucide-react';

// --- Types ---

interface TransferItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface TransferRecord {
  id: string;
  date: string;
  sourceId: string;
  sourceName: string;
  destinationId: string;
  destinationName: string;
  status: 'مسودة' | 'مرحل';
  items: TransferItem[];
  totalValue?: number;
  notes?: string;
}

// --- Helper for LocalStorage Persistence ---
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

export const TransfersPage: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<'list' | 'details'>('list');
  const [transfers, setTransfers] = usePersistedState<TransferRecord[]>('gsc_transfers', []);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]); 
  
  // داتا المواقع الحقيقية (مخازن وفروع)
  const [warehouses, setWarehouses] = useState<any[]>([]); 
  const [branches, setBranches] = useState<any[]>([]);

  // Active Transfer State
  const [activeTransfer, setActiveTransfer] = useState<TransferRecord | null>(null);
  
  // Item Selection Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Post Confirmation State
  const [confirmPostTransfer, setConfirmPostTransfer] = useState(false);

  // --- Effects ---
  useEffect(() => {
    const loadData = () => {
        try {
            const items = localStorage.getItem('gsc_items');
            if (items) setInventoryItems(JSON.parse(items));

            // تحميل المخازن والفروع المكوّدة فعلياً
            setWarehouses(safeJsonParse(localStorage.getItem('gsc_warehouses_config'), []));
            setBranches(safeJsonParse(localStorage.getItem('gsc_branches'), []));
        } catch (e) { console.error(e); }
    };
    loadData();
  }, [view]);

  useEffect(() => {
    if (!confirmPostTransfer) return;
    const t = setTimeout(() => setConfirmPostTransfer(false), 5000);
    return () => clearTimeout(t);
  }, [confirmPostTransfer]);

  // 🔥 محرك احتساب رصيد الصنف في موقع محدد 🔥
  const calculateLocationStock = (itemId: string, locationId: string) => {
    if (!locationId) return 0;
    
    const get = (k: string) => safeJsonParse(localStorage.getItem(k), []);
    const allStocktakes = get('gsc_stocktakes');
    const allPurchases = get('gsc_purchases');
    const allTransfers = get('gsc_transfers');
    const allWaste = get('gsc_waste_records');
    const allProduction = get('gsc_production_logs');
    const allSales = get('gsc_pos_sales');
    const allRecipes = get('gsc_recipes');
    const item = inventoryItems.find(i => i.id === itemId);

    // 1. العثور على آخر جرد مرحل لهذا الموقع
    const lastST = allStocktakes
      .filter((st: any) => st.status === 'مرحل' && st.branchId === locationId)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    let currentQty = 0;
    let refDate = '1970-01-01';

    if (lastST) {
      currentQty = lastST.items.find((si: any) => si.itemId === itemId)?.countedQty || 0;
      refDate = lastST.date;
    }

    // 2. إضافة الوارد (مشتريات + تحويلات واردة + إنتاج منتج)
    allPurchases.forEach((po: any) => {
      if (po.status === 'مكتمل' && po.date >= refDate && (po.warehouseId === locationId || po.branchId === locationId)) {
        const line = po.items.find((pi: any) => pi.itemId === itemId);
        if (line) currentQty += Number(line.quantity);
      }
    });

    allTransfers.forEach((tr: any) => {
      if (tr.status === 'مرحل' && tr.date >= refDate && tr.destinationId === locationId) {
        const line = tr.items.find((ti: any) => ti.itemId === itemId);
        if (line) currentQty += Number(line.quantity);
      }
    });

    allProduction.forEach((pl: any) => {
        if (pl.status === 'مرحل' && pl.date >= refDate && pl.branchId === locationId && pl.productId === itemId) {
            currentQty += Number(pl.producedQty);
        }
    });

    // 3. خصم المنصرف (تحويلات صادرة + هالك + استهلاك مبيعات + استهلاك خامات إنتاج)
    allTransfers.forEach((tr: any) => {
      if (tr.status === 'مرحل' && tr.date >= refDate && tr.sourceId === locationId) {
        const line = tr.items.find((ti: any) => ti.itemId === itemId);
        if (line) currentQty -= Number(line.quantity);
      }
    });

    allWaste.forEach((wr: any) => {
      if (wr.status === 'مرحل' && wr.date >= refDate && wr.branchId === locationId) {
        const line = wr.items.find((wi: any) => wi.itemId === itemId);
        if (line) currentQty -= Number(line.quantity);
      }
    });

    allProduction.forEach((pl: any) => {
        if (pl.status === 'مرحل' && pl.date >= refDate && pl.branchId === locationId) {
            const ing = pl.ingredients.find((i: any) => i.stockItemId === itemId);
            if (ing) currentQty -= Number(ing.requiredQty);
        }
    });

    allSales.forEach((sale: any) => {
        if (sale.status === 'مكتمل' && sale.date >= refDate && sale.branchId === locationId) {
            sale.items.forEach((si: any) => {
                const recipe = allRecipes.find((r: any) => r.menuItemId === si.itemId);
                if (recipe) {
                    const ri = recipe.ingredients.find((ing: any) => ing.stockItemId === itemId);
                    if (ri && item) {
                        currentQty -= (Number(si.qty) * Number(ri.qty)) / (Number(item.conversionFactor) || 1);
                    }
                }
            });
        }
    });

    return Math.max(0, currentQty);
  };

  const generateSerialId = () => {
    const year = 2026; 
    const prefix = `TRN-${year}-`;
    const yearTransfers = transfers.filter(t => t.id.startsWith(prefix));
    
    let nextNumber = 1;
    if (yearTransfers.length > 0) {
      const numbers = yearTransfers.map(t => {
        const parts = t.id.split('-');
        return parseInt(parts[parts.length - 1], 10);
      }).filter(n => !isNaN(n));
      
      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }
    
    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  };

  const handlePrint = () => {
    const el = document.getElementById('printable-area');
    if (!el) {
      alert('منطقة الطباعة غير موجودة');
      return;
    }

    const clone = el.cloneNode(true) as HTMLElement;

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.gap = '12px';
    header.style.marginBottom = '16px';
    header.style.paddingBottom = '12px';
    header.style.borderBottom = '2px solid #eee';

    header.innerHTML = `
      <div>
        <div style="font-size:18px;font-weight:900;">3M GSC</div>
        <div style="font-size:12px;color:#555;font-weight:700;">إذن تحويل / صرف مخزون (مالي)</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:12px;color:#555;font-weight:700;">رقم الإذن: ${activeTransfer?.id || ''}</div>
        <div style="font-size:12px;color:#555;font-weight:700;">التاريخ: ${activeTransfer?.date || ''}</div>
      </div>
    `;

    clone.prepend(header);

    const originalSelects = el.querySelectorAll('select');
    const clonedSelects = clone.querySelectorAll('select');

    clonedSelects.forEach((sel, idx) => {
      const orig = originalSelects[idx] as HTMLSelectElement | undefined;
      const selectedText =
        orig?.selectedOptions?.[0]?.text?.trim() ||
        (idx === 0 ? (activeTransfer?.sourceName || '') : (activeTransfer?.destinationName || '')) ||
        '—';

      const replacement = document.createElement('div');
      replacement.textContent = selectedText;
      replacement.style.padding = '10px 12px';
      replacement.style.border = '1px solid #ddd';
      replacement.style.borderRadius = '10px';
      replacement.style.background = '#fff';
      replacement.style.color = '#000';
      replacement.style.fontSize = '14px';
      replacement.style.fontWeight = '700';

      sel.replaceWith(replacement);
    });

    clone.querySelectorAll<HTMLInputElement>('input').forEach((inp) => {
      const type = (inp.getAttribute('type') || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        if (inp.checked) inp.setAttribute('checked', 'checked');
        else inp.removeAttribute('checked');
      } else {
        inp.setAttribute('value', inp.value ?? '');
      }
    });

    clone.querySelectorAll<HTMLTextAreaElement>('textarea').forEach((ta) => {
      ta.textContent = ta.value ?? '';
    });

    const html = clone.outerHTML;

    const printWindow = window.open('', '_blank', 'width=900,height=650');
    if (!printWindow) {
      alert('المتصفح منع نافذة الطباعة (Pop-up). فعّل السماح بالـ Pop-ups ثم جرّب مرة أخرى.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>طباعة إذن تحويل - ${activeTransfer?.id || ''}</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, Tahoma, sans-serif; background: #fff; color: #000; }
            #printable-area { overflow: visible !important; height: auto !important; background: #fff !important; color: #000 !important; }
            .no-print { display: none !important; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; text-align: right; }
            th { background: #f5f5f5; }
            input, textarea { color: #000 !important; background: #fff !important; border: 1px solid #ddd !important; }
            .total-box { margin-top: 20px; border: 2px solid #000; padding: 10px; width: 250px; margin-right: auto; text-align: left; font-weight: 900; }
            @page { margin: 12mm; }
          </style>
        </head>
        <body>
          ${html}
          <div class="total-box">إجمالي قيمة التحويل: ${activeTransfer?.totalValue?.toFixed(2)} ج.م</div>
          <script>
            window.onload = function () {
              window.focus();
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCreateTransfer = () => {
      const nextId = generateSerialId();
      const defaultSource = warehouses[0] || branches[0] || null;
      
      const newTransfer: TransferRecord = {
          id: nextId,
          date: new Date().toISOString().split('T')[0],
          sourceId: defaultSource?.id || '', 
          sourceName: defaultSource?.name || '',
          destinationId: '',
          destinationName: '',
          status: 'مسودة',
          items: [],
          totalValue: 0
      };
      setActiveTransfer(newTransfer);
      setView('details');
  };

  const handleOpenTransfer = (record: TransferRecord) => {
      setActiveTransfer({ ...record });
      setView('details');
  };

  const calculateTransferTotal = (items: TransferItem[]) => {
      return items.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  };

  const handleSaveDraft = () => {
      if (!activeTransfer) return;
      if (!activeTransfer.destinationId) { alert('يرجى اختيار الموقع المستلم (إلى)'); return; }
      if (activeTransfer.sourceId === activeTransfer.destinationId) { alert('لا يمكن التحويل لنفس الموقع'); return; }

      const totalValue = calculateTransferTotal(activeTransfer.items);
      const updatedTransfer = { ...activeTransfer, totalValue };

      setTransfers(prev => {
          const exists = prev.find(t => t.id === updatedTransfer.id);
          if (exists) return prev.map(t => t.id === updatedTransfer.id ? updatedTransfer : t);
          return [updatedTransfer, ...prev];
      });
      setActiveTransfer(updatedTransfer);
      alert('تم حفظ الإذن كمسودة بنجاح ✅');
  };

  const handlePostTransfer = (e?: React.MouseEvent) => {
      e?.preventDefault();
      if (!activeTransfer) return;
      if (activeTransfer.status === 'مرحل') return;
      if (activeTransfer.items.length === 0) { alert('لا توجد أصناف في الإذن'); return; }
      if (!activeTransfer.destinationId) { alert('يرجى اختيار الوجهة'); return; }
      if (activeTransfer.sourceId === activeTransfer.destinationId) { alert('لا يمكن التحويل لنفس الموقع'); return; }

      if (!confirmPostTransfer) {
        setConfirmPostTransfer(true);
        return;
      }

      // التحقق من الرصيد الفعلي في المصدر قبل الترحيل
      let validationError = '';
      for (const tItem of activeTransfer.items) {
          const actualStock = calculateLocationStock(tItem.itemId, activeTransfer.sourceId);
          if (actualStock < tItem.quantity) {
              validationError = `رصيد غير كافٍ في "${activeTransfer.sourceName}" للصنف: ${tItem.name} (المتاح: ${actualStock.toFixed(2)})`;
              break;
          }
      }

      if (validationError) {
          alert(validationError);
          setConfirmPostTransfer(false);
          return;
      }

      // تنفيذ خصم الإجمالي من المخزن (لأغراض المزامنة الكلية)
      const currentInventory = safeJsonParse(localStorage.getItem('gsc_items'), []);
      const updatedInventory = currentInventory.map((stockItem: any) => {
          const transferItem = activeTransfer.items.find(ti => ti.itemId === stockItem.id);
          if (transferItem) {
              // ملاحظة: الأرصدة الإجمالية لا تتأثر بالتحويلات البينية في النظام الموحد عادة 
              // لكننا نترك المنطق كما هو لضمان التوافق مع باقي الموديولات
              return { ...stockItem, currentStock: (stockItem.currentStock || 0) };
          }
          return stockItem;
      });

      localStorage.setItem('gsc_items', JSON.stringify(updatedInventory));

      const totalValue = calculateTransferTotal(activeTransfer.items);
      const postedTransfer: TransferRecord = { ...activeTransfer, status: 'مرحل', totalValue };

      setTransfers(prev => {
          const exists = prev.find(t => t.id === postedTransfer.id);
          if (exists) return prev.map(t => t.id === postedTransfer.id ? postedTransfer : t);
          return [postedTransfer, ...prev];
      });
      
      setActiveTransfer(postedTransfer);
      setConfirmPostTransfer(false);
      alert('تم ترحيل إذن الصرف بنجاح وتم تحديث أرصدة المواقع 📦✅');
  };

  const handleDeleteTransfer = () => {
    if (!activeTransfer) return;
    if (activeTransfer.status === 'مرحل') { alert('لا يمكن حذف إذن تم ترحيله.'); return; }
    if (!window.confirm('هل أنت متأكد من حذف هذا الإذن؟')) return;
    
    setTransfers(prev => prev.filter(t => t.id !== activeTransfer.id));
    setView('list');
    setActiveTransfer(null);
  };

  const toggleItemSelection = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItemIds(next);
  };

  const handleConfirmAddItems = () => {
    if (!activeTransfer) return;
    const newItems: TransferItem[] = [];
    selectedItemIds.forEach(id => {
      if (activeTransfer.items.some(i => i.itemId === id)) return;
      const invItem = inventoryItems.find(i => i.id === id);
      if (invItem) {
        const cost = invItem.avgCost || 0;
        newItems.push({ 
            itemId: invItem.id, 
            name: invItem.name, 
            unit: invItem.stockUnit, 
            quantity: 1,
            unitCost: cost,
            totalCost: cost
        });
      }
    });
    const updatedItems = [...activeTransfer.items, ...newItems];
    setActiveTransfer({ 
        ...activeTransfer, 
        items: updatedItems,
        totalValue: calculateTransferTotal(updatedItems)
    });
    setIsItemModalOpen(false);
    setSelectedItemIds(new Set());
  };

  const updateItemQty = (index: number, qty: number) => {
      if (!activeTransfer || activeTransfer.status === 'مرحل') return;
      const updatedItems = [...activeTransfer.items];
      const safeQty = isNaN(qty) ? 0 : qty;
      updatedItems[index].quantity = safeQty;
      updatedItems[index].totalCost = safeQty * updatedItems[index].unitCost;
      
      setActiveTransfer({ 
          ...activeTransfer, 
          items: updatedItems,
          totalValue: calculateTransferTotal(updatedItems)
      });
  };

  const removeItem = (index: number) => {
      if (!activeTransfer || activeTransfer.status === 'مرحل') return;
      const updatedItems = activeTransfer.items.filter((_, i) => i !== index);
      setActiveTransfer({ 
          ...activeTransfer, 
          items: updatedItems,
          totalValue: calculateTransferTotal(updatedItems)
      });
  };

  return (
    <div className="flex flex-col h-full gap-4 relative font-sans" dir="rtl">
       <style>{`
        @media print {
            body * { visibility: hidden; }
            #printable-area, #printable-area * { visibility: visible; }
            #printable-area { position: absolute; left: 0; top: 0; width: 100%; background: white; color: black; padding: 20px; }
            .no-print { display: none !important; }
        }
      `}</style>

      {view === 'list' && (
          <div className="flex items-center gap-4 border-b border-white/10 pb-4">
             <div className="p-3 bg-sys-primary/10 rounded-full text-sys-primary"><ArrowRightLeft size={24} /></div>
             <div><h2 className="text-xl font-bold text-white">أذونات الصرف والتحويل</h2><p className="text-white/40 text-sm">إدارة حركة المخزون بين المخازن والفروع</p></div>
          </div>
      )}

      <div className="flex-1 min-h-0">
          {view === 'list' && (
              <DataGrid 
                title="سجل التحويلات" 
                data={transfers.map(t => ({...t, itemCount: t.items.length, totalValue: Number(t.totalValue || 0).toFixed(2)}))} 
                columns={[
                    { key: 'id', label: 'رقم الإذن', sortable: true },
                    { key: 'date', label: 'التاريخ', sortable: true },
                    { key: 'sourceName', label: 'من (المصدر)' },
                    { key: 'destinationName', label: 'إلى (المستلم)' },
                    { key: 'status', label: 'الحالة' },
                    { key: 'totalValue', label: 'إجمالي التكلفة' }
                ]} 
                onAdd={handleCreateTransfer}
                onRowClick={handleOpenTransfer}
              />
          )}

          {view === 'details' && activeTransfer && (
              <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between bg-sys-surface p-4 rounded-xl border border-white/5 no-print shadow-sm">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {activeTransfer.id}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${activeTransfer.status === 'مرحل' ? 'border-sys-success text-sys-success bg-sys-success/10' : 'border-sys-warning text-sys-warning bg-sys-warning/10'}`}>{activeTransfer.status}</span>
                            </h2>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handlePrint} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white transition-all"><Printer size={18} /></button>
                            {activeTransfer.status !== 'مرحل' && (
                                <>
                                    <button onClick={handleSaveDraft} className="px-4 py-2 bg-sys-surface border border-white/10 rounded-lg text-white text-xs font-bold transition-all"><Save size={16} /> حفظ مسودة</button>
                                    <button onClick={handlePostTransfer} className={`px-6 py-2 rounded-lg font-bold shadow-lg transition-all text-xs ${confirmPostTransfer ? 'bg-sys-danger animate-pulse scale-105' : 'bg-sys-success hover:bg-green-600'} text-white`}>
                                        {confirmPostTransfer ? 'تأكيد الترحيل' : 'ترحيل واعتماد'}
                                    </button>
                                    <button onClick={handleDeleteTransfer} className="p-2 bg-sys-danger/10 border border-sys-danger/30 rounded-lg text-sys-danger hover:bg-sys-danger hover:text-white transition-colors"><Trash2 size={18} /></button>
                                </>
                            )}
                        </div>
                  </div>

                  <div id="printable-area" className="bg-sys-surface border border-white/5 rounded-xl p-6 overflow-y-auto flex-1 shadow-inner">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/50 uppercase tracking-wider px-1">التاريخ</label>
                                <input type="date" value={activeTransfer.date} onChange={e => setActiveTransfer({...activeTransfer, date: e.target.value})} disabled={activeTransfer.status === 'مرحل'} className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/50 uppercase tracking-wider px-1 font-bold flex items-center gap-1"><MapPin size={10} className="text-sys-primary" /> من (موقع المصدر)</label>
                                <select 
                                    value={activeTransfer.sourceId}
                                    onChange={e => {
                                        const loc = warehouses.find(w => w.id === e.target.value) || branches.find(b => b.id === e.target.value);
                                        if(loc) setActiveTransfer({...activeTransfer, sourceId: loc.id, sourceName: loc.name});
                                    }}
                                    disabled={activeTransfer.status === 'مرحل'}
                                    className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none"
                                >
                                    {warehouses.length > 0 && <optgroup label="المخازن والمستودعات" className="bg-[#1e1e1e] text-sys-primary font-bold">{warehouses.map(w => <option key={w.id} value={w.id} className="text-white font-normal">{w.name}</option>)}</optgroup>}
                                    {branches.length > 0 && <optgroup label="الفروع ومراكز البيع" className="bg-[#1e1e1e] text-sys-warning font-bold">{branches.map(b => <option key={b.id} value={b.id} className="text-white font-normal">{b.name}</option>)}</optgroup>}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/50 uppercase tracking-wider px-1 font-bold flex items-center gap-1"><Truck size={10} className="text-sys-success" /> إلى (موقع الاستلام)</label>
                                <select 
                                    value={activeTransfer.destinationId}
                                    onChange={e => {
                                        const loc = warehouses.find(w => w.id === e.target.value) || branches.find(b => b.id === e.target.value);
                                        if(loc) setActiveTransfer({...activeTransfer, destinationId: loc.id, destinationName: loc.name});
                                    }}
                                    disabled={activeTransfer.status === 'مرحل'}
                                    className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none"
                                >
                                    <option value="">-- اختر الوجهة --</option>
                                    {warehouses.length > 0 && <optgroup label="المخازن والمستودعات" className="bg-[#1e1e1e] text-sys-primary font-bold">{warehouses.filter(w => w.id !== activeTransfer.sourceId).map(w => <option key={w.id} value={w.id} className="text-white font-normal">{w.name}</option>)}</optgroup>}
                                    {branches.length > 0 && <optgroup label="الفروع ومراكز البيع" className="bg-[#1e1e1e] text-sys-warning font-bold">{branches.filter(b => b.id !== activeTransfer.sourceId).map(b => <option key={b.id} value={b.id} className="text-white font-normal">{b.name}</option>)}</optgroup>}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-white/50 uppercase tracking-wider px-1 font-bold flex items-center gap-1"><DollarSign size={10} className="text-sys-primary" /> إجمالي قيمة الإذن</label>
                                <div className="w-full bg-sys-primary/10 border border-sys-primary/20 rounded-xl p-3 text-sm text-sys-primary font-black shadow-inner">
                                    {activeTransfer.totalValue?.toFixed(2)} ج.م
                                </div>
                            </div>
                        </div>

                        <div className="border border-white/5 rounded-xl overflow-hidden mb-6 bg-white/[0.02]">
                            <div className="bg-sys-surface-elevated px-4 py-3 flex justify-between items-center no-print border-b border-white/5">
                                <h3 className="font-bold text-xs text-white/70 flex items-center gap-2"><Package size={14} className="text-sys-primary" /> قائمة الأصناف المحولة</h3>
                                {activeTransfer.status !== 'مرحل' && <button onClick={() => { setItemSearchTerm(''); setSelectedItemIds(new Set()); setIsItemModalOpen(true); }} className="px-4 py-1.5 bg-sys-primary/10 border border-sys-primary/30 rounded-lg text-sys-primary text-[10px] font-bold transition-all flex items-center gap-2"><Plus size={14} /> إضافة أصناف</button>}
                            </div>
                            <table className="w-full text-right text-sm">
                                <thead className="bg-[#1a1a1a] text-white/30 text-[10px] uppercase font-bold tracking-widest">
                                    <tr>
                                        <th className="p-4 border-b border-white/5">الصنف</th>
                                        <th className="p-4 border-b border-white/5 text-center">الوحدة</th>
                                        <th className="p-4 border-b border-white/5 text-center">التكلفة / الوحدة</th>
                                        <th className="p-4 border-b border-white/5 text-center w-32">الكمية</th>
                                        <th className="p-4 border-b border-white/5 text-center bg-white/5">إجمالي التكلفة</th>
                                        <th className="p-4 border-b border-white/5 no-print w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {activeTransfer.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-white text-xs">{item.name}</div>
                                                <div className="text-[10px] text-white/20 font-mono mt-0.5">{item.itemId}</div>
                                            </td>
                                            <td className="p-4 text-center text-white/40 text-xs">{item.unit}</td>
                                            <td className="p-4 text-center text-white/60 font-mono text-xs">{item.unitCost.toFixed(2)}</td>
                                            <td className="p-4 text-center">
                                                <input type="number" step="0.01" value={item.quantity} onChange={e => updateItemQty(idx, parseFloat(e.target.value))} disabled={activeTransfer.status === 'مرحل'} className="w-full bg-sys-bg border border-white/10 rounded-lg p-2 text-center text-sm font-bold outline-none text-white focus:border-sys-primary" />
                                            </td>
                                            <td className="p-4 text-center bg-white/5 font-black text-sys-primary">{item.totalCost.toFixed(2)}</td>
                                            <td className="p-4 text-center no-print">
                                                {activeTransfer.status !== 'مرحل' && <button onClick={() => removeItem(idx)} className="text-white/20 hover:text-sys-danger transition-colors p-1"><Trash2 size={16} /></button>}
                                            </td>
                                        </tr>
                                    ))}
                                    {activeTransfer.items.length === 0 && <tr><td colSpan={6} className="p-16 text-center text-white/20 italic text-sm">لم يتم إضافة أصناف بعد.</td></tr>}
                                </tbody>
                                <tfoot className="bg-[#121212] border-t border-white/10">
                                    <tr className="font-bold">
                                        <td colSpan={4} className="p-4 text-left pl-10 text-white/40 uppercase text-[10px]">إجمالي القيمة المنقولة</td>
                                        <td className="p-4 text-center text-sys-primary text-lg">{activeTransfer.totalValue?.toFixed(2)} ج.م</td>
                                        <td className="no-print"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="space-y-1"><label className="text-[10px] text-white/50 flex items-center gap-1 uppercase tracking-wider px-1"><FileText size={10}/> ملاحظات</label><textarea rows={3} value={activeTransfer.notes || ''} onChange={e => setActiveTransfer({...activeTransfer, notes: e.target.value})} disabled={activeTransfer.status === 'مرحل'} className="w-full bg-[#121212] border border-white/10 rounded-xl p-4 text-sm text-white focus:border-sys-primary focus:outline-none placeholder:text-white/10 resize-none shadow-inner" placeholder="شرح لسبب التحويل أو تفاصيل إضافية..." /></div>
                  </div>
              </div>
          )}
      </div>

      {isItemModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
            <div className="bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]"><div className="flex items-center gap-3"><div className="p-2 bg-sys-primary/10 rounded-lg text-sys-primary"><Layers size={18} /></div><h3 className="font-bold text-white text-lg">اختيار أصناف من المخزون</h3></div><button onClick={() => setIsItemModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button></div>
                <div className="p-4 bg-sys-surface border-b border-white/5"><div className="relative group"><Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-sys-primary transition-colors" /><input type="text" placeholder="بحث باسم الصنف أو كود التعريف..." value={itemSearchTerm} onChange={e => setItemSearchTerm(e.target.value)} className="w-full bg-sys-bg border border-white/10 rounded-xl py-3 pr-10 pl-4 text-sm text-white focus:border-sys-primary outline-none shadow-inner transition-all" autoFocus /></div></div>
                <div className="flex-1 overflow-auto p-3 space-y-1 custom-scrollbar">
                    {inventoryItems.filter(i => i.active === 'نعم' && (i.name.includes(itemSearchTerm) || i.id.includes(itemSearchTerm))).map(item => {
                        const isSelected = selectedItemIds.has(item.id);
                        const locStock = calculateLocationStock(item.id, activeTransfer?.sourceId || '');
                        return (<div key={item.id} onClick={() => toggleItemSelection(item.id)} className={`p-4 rounded-xl border flex justify-between items-center transition-all cursor-pointer ${isSelected ? 'bg-sys-primary/10 border-sys-primary shadow-lg' : 'bg-transparent border-white/5 hover:border-white/20'}`}><div className="flex items-center gap-4"><div className={`w-6 h-6 rounded-lg border flex items-center justify-center ${isSelected ? 'bg-sys-primary border-sys-primary' : 'border-white/10 bg-[#121212]'}`}>{isSelected && <Check size={16} className="text-white" strokeWidth={3} />}</div><div><p className="text-white text-sm font-bold">{item.name}</p><p className="text-[10px] text-white/30 uppercase tracking-tighter">{item.id} • {item.stockUnit}</p></div></div><div className="text-right"><p className={`text-xs font-black ${locStock > 0 ? 'text-sys-success' : 'text-sys-danger'}`}>رصيد الموقع: {locStock.toFixed(2)}</p><p className="text-[9px] text-white/30 mt-1">ت: {Number(item.avgCost || 0).toFixed(2)}</p></div></div>);
                    })}
                </div>
                <div className="p-5 bg-[#181818] border-t border-white/5 flex justify-between items-center"><div><span className="text-xs text-white/40 font-medium">تم تحديد </span><span className="text-sys-primary font-black text-lg">{selectedItemIds.size}</span></div><div className="flex gap-3"><button onClick={() => setIsItemModalOpen(false)} className="px-6 py-2.5 rounded-xl text-xs font-bold text-white/50 hover:text-white transition-all">أغلاق</button><button onClick={handleConfirmAddItems} disabled={selectedItemIds.size === 0} className="px-8 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-all flex items-center gap-2"><Save size={16} /> حفظ</button></div></div>
            </div>
        </div>
      )}
    </div>
  );
};
