
import React, { useState, useEffect } from 'react';
import { DataGrid } from '../components/DataGrid';
import { 
  ShoppingCart, Plus, Calendar, Save, CheckCircle, 
  Search, X, Trash2, ArrowLeft, Users, Printer, 
  Check, Building2, Package, Calculator, Phone, MapPin, Hash, FileText, Unlock, AlertCircle, Edit
} from 'lucide-react';

// --- Helpers ---
const safeJsonParse = (value: string | null, fallback: any) => {
  if (value == null) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

// --- Interfaces ---

interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  taxId: string;
  address: string;
  paymentTerms: string;
  notes: string;
  active: boolean;
}

interface PurchaseItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  total: number;
}

interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  status: 'مسودة' | 'مكتمل'; 
  items: PurchaseItem[];
  totalAmount: number;
  notes?: string;
  warehouseId?: string;
  isEdited?: boolean; // حقل جديد لتتبع ما إذا كانت الفاتورة قد عُدلت بعد ترحيلها
}

export const PurchasesPage: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<'invoices' | 'suppliers'>('invoices');
  const [view, setView] = useState<'list' | 'details'>('list');
  
  const [orders, setOrders] = useState<PurchaseOrder[]>(() => safeJsonParse(localStorage.getItem('gsc_purchases'), []));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => safeJsonParse(localStorage.getItem('gsc_suppliers'), []));
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  
  const [activeOrder, setActiveOrder] = useState<PurchaseOrder | null>(null);
  const [originalOrder, setOriginalOrder] = useState<PurchaseOrder | null>(null); // لتتبع التغييرات عند التعديل
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState<Supplier>({ 
    id: '', name: '', phone: '', email: '', taxId: '', address: '', paymentTerms: 'كاش', notes: '', active: true 
  });

  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [canEditCompleted, setCanEditCompleted] = useState(false);

  useEffect(() => {
    localStorage.setItem('gsc_purchases', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('gsc_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    setInventoryItems(safeJsonParse(localStorage.getItem('gsc_items'), []));
    setWarehouses(safeJsonParse(localStorage.getItem('gsc_warehouses_config'), []));
    setBranches(safeJsonParse(localStorage.getItem('gsc_branches'), []));
  }, [view]);

  const generateSupplierId = () => {
    if (suppliers.length === 0) return 'SUP-0001';
    const lastNum = suppliers
      .map(s => {
        const match = s.id.match(/SUP-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .sort((a, b) => b - a)[0];
    return `SUP-${(lastNum + 1).toString().padStart(4, '0')}`;
  };

  const handlePrint = () => {
    if (!activeOrder) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return alert('يرجى السماح بالنوافذ المنبثقة');

    const locationName = warehouses.find(w => w.id === activeOrder.warehouseId)?.name || 
                        branches.find(b => b.id === activeOrder.warehouseId)?.name || 'غير محدد';

    const itemsHtml = activeOrder.items.map(item => `
      <tr>
        <td style="padding: 12px 10px; border-bottom: 1px solid #eee;">
          <div style="font-weight: bold; font-size: 14px;">${item.name}</div>
          <div style="font-size: 10px; color: #777; margin-top: 2px;">كود الصنف: ${item.itemId}</div>
        </td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #eee; text-align:center; font-size: 14px;">${item.quantity} ${item.unit}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #eee; text-align:center; font-size: 14px;">${item.unitCost.toFixed(2)}</td>
        <td style="padding: 12px 10px; border-bottom: 1px solid #eee; text-align:left; font-weight: bold; font-size: 14px;">${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>فاتورة مشتريات - ${activeOrder.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
          body { font-family: 'Cairo', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; background: #fff; }
          .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #3B82F6; padding-bottom: 20px; margin-bottom: 30px; }
          .company-logo { font-size: 32px; font-weight: 900; color: #1e1e1e; margin: 0; }
          .modified-badge { color: #dc2626; border: 2px solid #dc2626; padding: 5px 15px; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block; }
          .meta-info { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 25px; border-radius: 15px; border: 1px solid #e2e8f0; }
          .meta-item { display: flex; align-items: center; font-size: 14px; }
          .meta-label { font-weight: bold; color: #64748b; min-width: 120px; }
          .meta-value { font-weight: bold; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f1f5f9; padding: 15px 10px; text-align: right; border-bottom: 2px solid #cbd5e1; font-weight: bold; font-size: 13px; color: #475569; }
          td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
          .notes-container { margin-top: 30px; padding: 20px; background: #f0f7ff; border-right: 6px solid #3B82F6; border-radius: 8px; }
          .notes-header { font-weight: bold; color: #3B82F6; margin-bottom: 10px; font-size: 15px; display: block; }
          .notes-body { font-size: 14px; color: #334155; white-space: pre-wrap; }
          .totals-section { margin-top: 40px; display: flex; justify-content: flex-end; }
          .total-card { background: #1e293b; color: white; padding: 20px 40px; border-radius: 15px; text-align: left; min-width: 280px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
          .total-label { font-size: 12px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; display: block; }
          .total-amount { font-size: 28px; font-weight: 900; }
          .footer { margin-top: 80px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          @media print {
            body { padding: 20px; }
            .total-card { background: #000 !important; color: #fff !important; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div>
            <h1 class="company-logo">3M GSC - فاتورة مشتريات</h1>
            <div style="margin-top: 8px; font-size: 15px; color: #64748b;">رقم القيد: <span style="color:#000; font-weight:900;">${activeOrder.id}</span></div>
          </div>
          ${activeOrder.isEdited ? '<div class="modified-badge">فاتورة معدلة</div>' : ''}
        </div>

        <div class="meta-info">
          <div class="meta-item"><span class="meta-label">المورد:</span><span class="meta-value">${activeOrder.supplierName}</span></div>
          <div class="meta-item"><span class="meta-label">تاريخ الفاتورة:</span><span class="meta-value">${activeOrder.date}</span></div>
          <div class="meta-item"><span class="meta-label">الموقع المستلم:</span><span class="meta-value">${locationName}</span></div>
          <div class="meta-item"><span class="meta-label">حالة السداد/القيد:</span><span class="meta-value">${activeOrder.status}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>الصنف / الخامة</th>
              <th style="text-align:center;">الكمية</th>
              <th style="text-align:center;">سعر الوحدة</th>
              <th style="text-align:left;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        ${activeOrder.notes ? `
          <div class="notes-container">
            <span class="notes-header">ملاحظات الفاتورة:</span>
            <div class="notes-body">${activeOrder.notes}</div>
          </div>
        ` : ''}

        <div class="totals-section">
          <div class="total-card">
            <span class="total-label">إجمالي المستحق للفاتورة</span>
            <div class="total-amount">${activeOrder.totalAmount.toFixed(2)} <span style="font-size: 14px; font-weight: normal;">ج.م</span></div>
          </div>
        </div>

        <div class="footer">
          نظام 3M GSC لإدارة التكاليف والمخزون - استخراج آلي
          <br/>
          تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}
        </div>

        <script>
          window.onload = () => {
            window.focus();
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleCreateOrder = () => {
    const nextId = `PO-${new Date().getFullYear()}-${(orders.length + 1).toString().padStart(4, '0')}`;
    const defaultLoc = warehouses[0]?.id || branches[0]?.id || '';
    setActiveOrder({ 
      id: nextId, supplierId: '', supplierName: '', date: new Date().toISOString().split('T')[0], 
      status: 'مسودة', items: [], totalAmount: 0, notes: '', warehouseId: defaultLoc 
    });
    setOriginalOrder(null);
    setCanEditCompleted(false);
    setView('details');
  };

  const handleSaveOrder = () => {
    if (!activeOrder || !activeOrder.supplierId) return alert('يرجى اختيار المورد أولاً');
    
    // إذا كانت الفاتورة مكتملة وتم تعديلها، نحتاج لتحديث المخزن بالفوارق
    if (activeOrder.status === 'مكتمل' && canEditCompleted && originalOrder) {
      updateInventoryOnEdit(originalOrder, activeOrder);
    }

    const total = activeOrder.items.reduce((s, i) => s + i.total, 0);
    // تفعيل علامة "معدلة" إذا كانت الفاتورة مكتملة وقام المستخدم بتحريرها
    const isActuallyEdited = activeOrder.status === 'مكتمل' && canEditCompleted;
    
    const updated: PurchaseOrder = { 
      ...activeOrder, 
      totalAmount: total,
      isEdited: isActuallyEdited ? true : activeOrder.isEdited 
    };
    
    setOrders(prev => { 
      const ex = prev.find(o => o.id === updated.id); 
      return ex ? prev.map(o => o.id === updated.id ? updated : o) : [updated, ...prev]; 
    });
    
    setActiveOrder(updated);
    setCanEditCompleted(false);
    alert('تم حفظ البيانات بنجاح ✅');
    setView('list'); 
  };

  const updateInventoryOnEdit = (oldOrder: PurchaseOrder, newOrder: PurchaseOrder) => {
    const currentInv = safeJsonParse(localStorage.getItem('gsc_items'), []);
    
    // 1. عكس تأثير الفاتورة القديمة
    let tempInv = currentInv.map((item: any) => {
      const oldItemMatch = oldOrder.items.find(oi => oi.itemId === item.id);
      if (oldItemMatch) {
        return { ...item, currentStock: Number(item.currentStock || 0) - Number(oldItemMatch.quantity) };
      }
      return item;
    });

    // 2. تطبيق تأثير الفاتورة الجديدة وحساب متوسط التكلفة الجديد
    const finalInv = tempInv.map((item: any) => {
      const newItemMatch = newOrder.items.find(ni => ni.itemId === item.id);
      if (newItemMatch) {
        const currentQty = Number(item.currentStock || 0);
        const currentAvg = Number(item.avgCost || 0);
        const newQty = Number(newItemMatch.quantity);
        const newPrice = Number(newItemMatch.unitCost);
        
        const totalQty = currentQty + newQty;
        const newAvg = totalQty > 0 ? ((currentQty * currentAvg) + (newQty * newPrice)) / totalQty : newPrice;
        
        return { 
          ...item, 
          currentStock: totalQty, 
          avgCost: Number(newAvg.toFixed(4)) 
        };
      }
      return item;
    });

    localStorage.setItem('gsc_items', JSON.stringify(finalInv));
    setInventoryItems(finalInv);
  };

  const handleReceiveStock = async () => {
    if (!activeOrder) return;
    if (activeOrder.status === 'مكتمل' && !canEditCompleted) return;
    if (activeOrder.items.length === 0) return alert('لا توجد أصناف للفاتورة');
    if (!activeOrder.supplierId) return alert('يرجى اختيار المورد أولاً');

    const currentInv = safeJsonParse(localStorage.getItem('gsc_items'), []);
    
    const updatedInv = currentInv.map((it: any) => {
      const match = activeOrder.items.find(x => x.itemId === it.id);
      if (match) {
        const currentQty = Number(it.currentStock || 0);
        const currentAvg = Number(it.avgCost || 0);
        const newQty = Number(match.quantity);
        const newPrice = Number(match.unitCost);
        
        const totalQty = currentQty + newQty;
        const newAvg = totalQty > 0 ? ((currentQty * currentAvg) + (newQty * newPrice)) / totalQty : newPrice;
        
        return { 
          ...it, 
          currentStock: totalQty, 
          avgCost: Number(newAvg.toFixed(4)) 
        };
      }
      return it;
    });

    localStorage.setItem('gsc_items', JSON.stringify(updatedInv));
    setInventoryItems(updatedInv);

    const completed: PurchaseOrder = { ...activeOrder, status: 'مكتمل', totalAmount: activeOrder.items.reduce((s, i) => s + i.total, 0) };
    
    setOrders(prev => {
        const exists = prev.find(o => o.id === completed.id);
        if (exists) return prev.map(o => o.id === completed.id ? completed : o);
        return [completed, ...prev];
    });

    setActiveOrder(completed);
    setCanEditCompleted(false);
    alert('تم ترحيل الفاتورة واستلام المخزن بنجاح ✅');
    setView('list');
  };

  const handleSaveSupplier = () => {
    if (!supplierForm.id || !supplierForm.name) return alert('بيانات ناقصة');
    if (isEditingSupplier) setSuppliers(prev => prev.map(s => s.id === supplierForm.id ? supplierForm : s));
    else setSuppliers(prev => [supplierForm, ...prev]);
    setIsSupplierModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full gap-4 relative font-sans" dir="rtl">
      {view === 'list' && (
          <div className="flex items-center gap-4 border-b border-white/10 pb-4 no-print">
            <button onClick={() => setActiveMainTab('invoices')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl border transition-all font-bold text-sm ${activeMainTab === 'invoices' ? 'bg-sys-primary text-white shadow-lg border-sys-primary' : 'bg-sys-surface text-white/60 border-white/5 hover:text-white'}`}><ShoppingCart size={18} /> الفواتير</button>
            <button onClick={() => setActiveMainTab('suppliers')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl border transition-all font-bold text-sm ${activeMainTab === 'suppliers' ? 'bg-sys-primary text-white shadow-lg border-sys-primary' : 'bg-sys-surface text-white/60 border-white/5 hover:text-white'}`}><Users size={18} /> الموردين</button>
          </div>
      )}

      <div className="flex-1 min-h-0">
          {view === 'list' && activeMainTab === 'invoices' && (
            <DataGrid 
              title="سجل فواتير المشتريات" 
              data={orders} 
              columns={[
                {key:'id', label:'رقم الفاتورة'},
                {key:'supplierName', label:'المورد'},
                {key:'date', label:'التاريخ'},
                {key:'status', label:'الحالة'},
                {key:'totalAmount', label:'الإجمالي'}
              ]} 
              onAdd={handleCreateOrder} 
              onRowClick={(o)=> {setActiveOrder(o); setOriginalOrder(JSON.parse(JSON.stringify(o))); setCanEditCompleted(false); setView('details');}} 
            />
          )}

          {view === 'list' && activeMainTab === 'suppliers' && (
            <DataGrid 
              title="دليل الموردين" 
              data={suppliers} 
              columns={[
                {key:'id', label:'كود المورد'},
                {key:'name', label:'الاسم'},
                {key:'taxId', label:'الرقم الضريبي'},
                {key:'phone', label:'الهاتف'}
              ]} 
              onAdd={() => { 
                setSupplierForm({ id: generateSupplierId(), name: '', phone: '', email: '', taxId: '', address: '', paymentTerms: 'كاش', notes: '', active: true });
                setIsEditingSupplier(false); 
                setIsSupplierModalOpen(true); 
              }} 
              onRowClick={(s) => { 
                setSupplierForm(s); 
                setIsEditingSupplier(true); 
                setIsSupplierModalOpen(true); 
              }} 
            />
          )}

          {view === 'details' && activeOrder && (
            <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between bg-sys-surface p-4 rounded-xl border border-white/5 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('list')} className="p-2 hover:bg-white/10 rounded-lg text-white/60 transition-colors"><ArrowLeft size={20} /></button>
                        <h2 className="text-xl font-bold text-white">
                          {activeOrder.id} 
                          <span className={`mr-2 text-xs px-2 py-0.5 rounded-full border ${activeOrder.status === 'مكتمل' ? 'border-sys-success text-sys-success bg-sys-success/10' : 'border-sys-warning text-sys-warning bg-sys-warning/10'}`}>
                            {activeOrder.status}
                          </span>
                          {activeOrder.isEdited && (
                            <span className="mr-2 text-[10px] px-2 py-0.5 rounded-full border border-sys-danger text-sys-danger bg-sys-danger/10 font-black">
                              معدلة
                            </span>
                          )}
                        </h2>
                    </div>
                    <div className="flex gap-2">
                        {activeOrder.status === 'مسودة' && (
                            <>
                                <button onClick={handleSaveOrder} className="px-4 py-2 bg-sys-bg border border-white/10 rounded-lg text-white text-xs font-bold transition-all hover:bg-white/10 flex items-center gap-2"><Save size={16} /> حفظ مسودة</button>
                                <button onClick={handleReceiveStock} className="px-6 py-2 bg-sys-success hover:bg-green-600 text-white rounded-lg font-bold shadow-lg transition-all text-xs flex items-center gap-2"><CheckCircle size={18} /> ترحيل واستلام</button>
                            </>
                        )}
                        {activeOrder.status === 'مكتمل' && (
                            <>
                                {!canEditCompleted ? (
                                    <button onClick={() => setCanEditCompleted(true)} className="px-4 py-2 bg-sys-primary/10 border border-sys-primary/30 rounded-lg text-sys-primary text-xs font-bold transition-all hover:bg-sys-primary hover:text-white flex items-center gap-2"><Edit size={16} /> تعديل الفاتورة</button>
                                ) : (
                                    <button onClick={handleSaveOrder} className="px-4 py-2 bg-sys-success text-white rounded-lg text-xs font-bold transition-all hover:bg-green-600 flex items-center gap-2"><Save size={16} /> حفظ التعديلات</button>
                                )}
                            </>
                        )}
                        <button onClick={handlePrint} className="p-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"><Printer size={18} /></button>
                    </div>
                </div>

                <div className="bg-sys-surface border border-white/5 rounded-xl p-6 flex-1 overflow-auto shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="space-y-1">
                          <label className="text-xs text-white/60 px-1">المورد</label>
                          <select 
                            value={activeOrder.supplierId} 
                            onChange={e => setActiveOrder({...activeOrder, supplierId: e.target.value, supplierName: suppliers.find(s=>s.id===e.target.value)?.name || ''})} 
                            disabled={activeOrder.status === 'مكتمل' && !canEditCompleted} 
                            className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-sys-primary outline-none"
                          >
                            <option value="">-- اختر مورد --</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/60 px-1">الموقع المستلم</label>
                          <select 
                            value={activeOrder.warehouseId} 
                            onChange={e => setActiveOrder({...activeOrder, warehouseId: e.target.value})} 
                            disabled={activeOrder.status === 'مكتمل' && !canEditCompleted} 
                            className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-sys-primary outline-none"
                          >
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/60 px-1">التاريخ</label>
                          <input type="date" value={activeOrder.date} onChange={e => setActiveOrder({...activeOrder, date: e.target.value})} disabled={activeOrder.status === 'مكتمل' && !canEditCompleted} className="w-full bg-[#121212] border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-sys-primary outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/60 px-1 font-bold">إجمالي الفاتورة</label>
                          <div className="w-full bg-sys-primary/10 border border-sys-primary/20 rounded-lg p-2.5 text-sm text-sys-primary font-black shadow-inner">
                            {activeOrder.items.reduce((s,i)=>s+i.total, 0).toFixed(2)} ج.م
                          </div>
                        </div>
                    </div>

                    <div className="space-y-2 mb-6">
                        <label className="text-xs text-white/60 px-1 flex items-center gap-1"><FileText size={14} /> ملاحظات الفاتورة</label>
                        <textarea 
                          value={activeOrder.notes || ''} 
                          onChange={e => setActiveOrder({...activeOrder, notes: e.target.value})} 
                          disabled={activeOrder.status === 'مكتمل' && !canEditCompleted} 
                          rows={2}
                          placeholder="اكتب أي ملاحظات متعلقة بعملية الشراء هنا..."
                          className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none resize-none"
                        />
                    </div>

                    <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                      <h3 className="font-bold text-white text-sm">أصناف الفاتورة (قائمة الاستلام)</h3>
                      {(activeOrder.status !== 'مكتمل' || canEditCompleted) && (
                        <button onClick={() => setIsItemModalOpen(true)} className="px-4 py-1.5 bg-sys-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-all">+ إضافة أصناف</button>
                      )}
                    </div>

                    <table className="w-full text-right text-sm border-collapse">
                        <thead className="bg-[#1a1a1a] text-white/40 uppercase text-[10px] font-bold tracking-widest">
                          <tr>
                            <th className="p-4 border-b border-white/5">الصنف / الخامة</th>
                            <th className="p-4 border-b border-white/5 text-center">الكمية</th>
                            <th className="p-4 border-b border-white/5 text-center">سعر الوحدة</th>
                            <th className="p-4 border-b border-white/5 text-center bg-white/5">الإجمالي</th>
                            <th className="p-4 border-b border-white/5 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                            {activeOrder.items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="p-4 text-white font-medium">{item.name} <span className="text-[10px] text-white/20 block">{item.itemId}</span></td>
                                  <td className="p-4">
                                    <input 
                                      type="number" 
                                      value={item.quantity} 
                                      onChange={(e)=> { 
                                        const newIt = [...activeOrder.items]; 
                                        newIt[idx].quantity = parseFloat(e.target.value) || 0; 
                                        newIt[idx].total = newIt[idx].quantity * newIt[idx].unitCost; 
                                        setActiveOrder({...activeOrder, items: newIt}); 
                                      }} 
                                      disabled={activeOrder.status === 'مكتمل' && !canEditCompleted} 
                                      className="w-24 mx-auto bg-sys-bg border border-white/10 rounded p-1.5 text-center text-white focus:border-sys-primary outline-none" 
                                    />
                                  </td>
                                  <td className="p-4 text-center">
                                    <input 
                                      type="number" 
                                      value={item.unitCost} 
                                      onChange={(e)=> { 
                                        const newIt = [...activeOrder.items]; 
                                        newIt[idx].unitCost = parseFloat(e.target.value) || 0; 
                                        newIt[idx].total = newIt[idx].quantity * newIt[idx].unitCost; 
                                        setActiveOrder({...activeOrder, items: newIt}); 
                                      }} 
                                      disabled={activeOrder.status === 'مكتمل' && !canEditCompleted} 
                                      className="w-24 mx-auto bg-sys-bg border border-white/10 rounded p-1.5 text-center text-white focus:border-sys-primary outline-none" 
                                    />
                                  </td>
                                  <td className="p-4 text-center text-sys-primary font-bold bg-white/[0.01]">{item.total.toFixed(2)}</td>
                                  <td className="p-4 text-center">
                                    {(activeOrder.status !== 'مكتمل' || canEditCompleted) && (
                                      <button onClick={()=> setActiveOrder({...activeOrder, items: activeOrder.items.filter((_,i)=>i!==idx)})} className="text-white/20 hover:text-sys-danger transition-colors"><X size={14}/></button>
                                    )}
                                  </td>
                                </tr>
                            ))}
                            {activeOrder.items.length === 0 && (
                              <tr><td colSpan={5} className="p-10 text-center text-white/10 italic">لم يتم إضافة أصناف للفاتورة بعد</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          )}
      </div>

      {/* --- Item Modal --- */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                  <h3 className="font-bold text-white flex items-center gap-2"><Package size={18} className="text-sys-primary" /> اختيار أصناف من المخزن</h3>
                  <button onClick={() => setIsItemModalOpen(false)} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
                </div>
                <div className="p-3 bg-sys-surface border-b border-white/5">
                    <div className="relative">
                        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                        <input type="text" placeholder="بحث باسم الخامة..." value={itemSearchTerm} onChange={e => setItemSearchTerm(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-xl py-2 pr-10 pl-4 text-sm text-white focus:border-sys-primary outline-none shadow-inner" autoFocus />
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1 custom-scrollbar">
                    {inventoryItems.filter(i => i.active === 'نعم' && (i.name.includes(itemSearchTerm) || i.id.includes(itemSearchTerm))).map(item => {
                        const isSelected = selectedItemIds.has(item.id);
                        return (
                          <div key={item.id} onClick={() => (isSelected ? setSelectedItemIds(prev => {const next=new Set(prev); next.delete(item.id); return next;}) : setSelectedItemIds(prev => new Set(prev).add(item.id)))} className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${isSelected ? 'bg-sys-primary/10 border-sys-primary shadow-lg shadow-blue-900/10' : 'bg-transparent border-white/5 hover:border-white/10'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-sys-primary border-sys-primary' : 'bg-[#121212] border-white/20'}`}>{isSelected && <Check size={14} className="text-white" strokeWidth={3} />}</div>
                              <div>
                                <p className="text-white text-sm font-bold">{item.name}</p>
                                <p className="text-[10px] text-white/20 font-mono">{item.id}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-white/40">{item.avgCost?.toFixed(2)} ج.م</p>
                              <p className="text-[9px] text-sys-success uppercase font-bold tracking-tighter">رصيد: {item.currentStock || 0}</p>
                            </div>
                          </div>
                        );
                    })}
                </div>
                <div className="p-4 bg-[#1a1a1a] border-t border-white/5 flex justify-end gap-3">
                  <button onClick={() => setIsItemModalOpen(false)} className="px-6 py-2 text-white/40 text-xs font-bold hover:text-white transition-all">إلغاء</button>
                  <button onClick={() => { 
                    const newItems = Array.from(selectedItemIds).map(id => { const inv = inventoryItems.find(i=>i.id===id); return { itemId: inv.id, name: inv.name, unit: inv.stockUnit, quantity: 1, unitCost: inv.avgCost || 0, total: inv.avgCost || 0 }; }); 
                    setActiveOrder({...activeOrder!, items: [...activeOrder!.items, ...newItems]}); setIsItemModalOpen(false); setSelectedItemIds(new Set()); 
                  }} className="px-8 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-all flex items-center gap-2"><Save size={16} /> إضافة المختار ({selectedItemIds.size})</button>
                </div>
            </div>
        </div>
      )}
      
      {/* --- Supplier Modal --- */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sys-primary/10 rounded-xl text-sys-primary"><Users size={18} /></div>
                    <h3 className="font-bold text-white text-lg">{isEditingSupplier ? 'تعديل بيانات مورد' : 'إضافة مورد جديد'}</h3>
                  </div>
                  <button onClick={() => setIsSupplierModalOpen(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-white/50 px-1 font-bold uppercase tracking-widest">كود المورد (تلقائي)</label>
                      <input type="text" value={supplierForm.id} disabled className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white/40 outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/50 px-1 font-bold uppercase tracking-widest">اسم المورد <span className="text-sys-danger">*</span></label>
                      <input type="text" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} placeholder="الاسم التجاري للمورد" className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-white/50 px-1 font-bold uppercase tracking-widest">رقم الهاتف</label>
                      <input type="text" value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} placeholder="01xxxxxxxxx" className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/50 px-1 font-bold uppercase tracking-widest">الرقم الضريبي</label>
                      <input type="text" value={supplierForm.taxId} onChange={e => setSupplierForm({...supplierForm, taxId: e.target.value})} placeholder="000-000-000" className="w-full bg-[#121212] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-sys-primary outline-none" />
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-[#181818] border-t border-white/5 flex justify-end gap-3">
                  <button onClick={() => setIsSupplierModalOpen(false)} className="px-6 py-2 text-white/40 text-xs font-bold hover:text-white transition-all">إلغاء</button>
                  <button onClick={handleSaveSupplier} className="px-10 py-2.5 bg-sys-primary text-white rounded-xl text-xs font-black shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-all flex items-center gap-2"><Save size={16} /> حفظ بيانات المورد</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
