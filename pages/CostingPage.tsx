
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calculator, Filter, Calendar, Printer, RefreshCw, 
  AlertTriangle, Building2, Download, ChevronDown, 
  FileSpreadsheet, FileText, Loader2, X, Warehouse, Store
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Interfaces ---
interface InventoryItem {
    id: string;
    name: string;
    category: string;
    department: string;
    stockUnit: string;
    recipeUnit: string;
    conversionFactor: number;
    avgCost: number;
    currentStock: number; 
    active: string;
}

interface PurchaseOrder {
    date: string;
    status: string;
    branchId?: string;
    warehouseId?: string;
    items: { itemId: string; quantity: number; unitCost: number }[];
}

interface ProductionRecord {
    date: string;
    productId: string;
    producedQty: number;
    status: 'مسودة' | 'مرحل';
    branchId: string;
    ingredients: { stockItemId: string; requiredQty: number }[]; 
}

interface WasteRecord {
    date: string;
    status: 'مسودة' | 'مرحل';
    branchId: string;
    items: { itemId: string; quantity: number }[];
}

interface TransferRecord {
    date: string;
    status: 'مسودة' | 'مرحل';
    sourceId: string;
    sourceName: string;
    destinationId: string;
    destinationName: string;
    items: { itemId: string; quantity: number }[];
}

interface StocktakeRecord {
    id: string;
    date: string;
    status: string;
    branchId?: string;
    type: 'opening' | 'closing' | 'regular'; 
    items: { itemId: string; countedQty: number }[];
}

interface SoldItem {
    itemId: string;
    qty: number;
}

interface PosSale {
    date: string;
    items?: SoldItem[];
    status: string;
    branchId?: string;
}

interface Recipe {
    menuItemId: string;
    ingredients: { stockItemId: string; qty: number }[];
}

interface ReportRow {
    itemId: string;
    itemName: string;
    category: string;
    unit: string;
    avgCost: number;
    openingQty: number;
    openingValue: number;
    receivingQty: number; 
    receivingValue: number;
    consumptionQty: number; 
    consumptionValue: number;
    closingBookQty: number;
    closingBookValue: number;
    physicalQty: number;
    physicalValue: number;
    varianceQty: number;
    varianceValue: number;
}

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  action: () => void;
  confirmBtnText: string;
  isLoading?: boolean;
}

export const CostingPage: React.FC = () => {
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(''); // تم تغيير المسمى ليعبر عن مخزن أو فرع
  const [isLoading, setIsLoading] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
    confirmBtnText: '',
  });

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionRecord[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [transferRecords, setTransferRecords] = useState<TransferRecord[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stocktakes, setStocktakes] = useState<StocktakeRecord[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [branches, setBranches] = useState<{id: string, name: string}[]>([]);
  const [warehouses, setWarehouses] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    try {
        const get = (k: string) => JSON.parse(localStorage.getItem(k) || "[]");
        setItems(get('gsc_items'));
        setDepartments(get('gsc_departments'));
        setBranches(get('gsc_branches'));
        setWarehouses(get('gsc_warehouses_config'));
        setPurchases(get('gsc_purchases'));
        setProductionLogs(get('gsc_production_logs'));
        setWasteRecords(get('gsc_waste_records'));
        setTransferRecords(get('gsc_transfers'));
        setSales(get('gsc_pos_sales'));
        setRecipes(get('gsc_recipes'));
        setStocktakes(get('gsc_stocktakes'));
    } catch (e) { console.error("Data load error", e); }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const reportData: ReportRow[] = useMemo(() => {
    const rows: ReportRow[] = [];
    const filteredItems = items.filter(i => i.active === 'نعم' && (!selectedDept || i.department === selectedDept));
    const locationMatch = (locId?: string) => !selectedLocationId || locId === selectedLocationId;
    const dateRangeMatch = (date: string) => date >= startDate && date <= endDate;

    const openingStocktake = stocktakes
        .filter(st => st.status === 'مرحل' && (st.type === 'closing' || st.type === 'opening') && st.date < startDate && locationMatch(st.branchId))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    filteredItems.forEach(item => {
        const cost = item.avgCost || 0;
        const factor = item.conversionFactor || 1;
        let openingQty = openingStocktake?.items.find(si => si.itemId === item.id)?.countedQty || 0;
        const openingValue = openingQty * cost;

        // --- حساب الوارد (Receiving) لهذا الموقع ---
        let receivingQty = 0;
        
        // 1. المشتريات (سواء فرع أو مخزن)
        purchases.forEach(po => {
            if (po.status === 'مكتمل' && dateRangeMatch(po.date) && (locationMatch(po.branchId) || locationMatch(po.warehouseId))) {
                const poItem = po.items.find(pi => pi.itemId === item.id);
                if (poItem) receivingQty += Number(poItem.quantity);
            }
        });

        // 2. مخرجات الإنتاج
        productionLogs.forEach(prd => {
            if (prd.status === 'مرحل' && dateRangeMatch(prd.date) && locationMatch(prd.branchId) && prd.productId === item.id) {
                receivingQty += Number(prd.producedQty);
            }
        });

        // 3. التحويلات الواردة (Inbound Transfers)
        transferRecords.forEach(tr => {
            if (tr.status === 'مرحل' && dateRangeMatch(tr.date) && locationMatch(tr.destinationId)) {
                const trItem = tr.items.find(ti => ti.itemId === item.id);
                if (trItem) receivingQty += Number(trItem.quantity);
            }
        });

        const receivingValue = receivingQty * cost;

        // --- حساب المنصرف (Consumption / Out) لهذا الموقع ---
        let totalConsumptionQty = 0;
        
        // 1. مبيعات الـ POS (فقط إذا كان الموقع فرعاً)
        sales.forEach(sale => {
            if (sale.status === 'مكتمل' && dateRangeMatch(sale.date) && locationMatch(sale.branchId) && sale.items) {
                sale.items.forEach(soldItem => {
                    const recipe = recipes.find(r => r.menuItemId === soldItem.itemId);
                    const ingredient = recipe?.ingredients.find(ing => ing.stockItemId === item.id);
                    if (ingredient) totalConsumptionQty += (soldItem.qty * ingredient.qty) / factor;
                });
            }
        });

        // 2. استهلاك المكونات في عملية الإنتاج
        productionLogs.forEach(prd => {
            if (prd.status === 'مرحل' && dateRangeMatch(prd.date) && locationMatch(prd.branchId)) {
                const ingMatch = prd.ingredients?.find(ing => ing.stockItemId === item.id);
                if (ingMatch) totalConsumptionQty += Number(ingMatch.requiredQty);
            }
        });

        // 3. الهالك
        wasteRecords.forEach(wst => {
            if (wst.status === 'مرحل' && dateRangeMatch(wst.date) && locationMatch(wst.branchId)) {
                const wasteMatch = wst.items?.find(wi => wi.itemId === item.id);
                if (wasteMatch) totalConsumptionQty += Number(wasteMatch.quantity);
            }
        });

        // 4. التحويلات الصادرة (Outbound Transfers)
        transferRecords.forEach(tr => {
            if (tr.status === 'مرحل' && dateRangeMatch(tr.date) && locationMatch(tr.sourceId)) {
                const trItem = tr.items.find(ti => ti.itemId === item.id);
                if (trItem) totalConsumptionQty += Number(trItem.quantity);
            }
        });

        const consumptionValue = totalConsumptionQty * cost;
        const closingBookQty = openingQty + receivingQty - totalConsumptionQty;
        const closingBookValue = closingBookQty * cost;

        let physicalQty = 0;
        let hasPhysicalCount = false;
        const currentStocktake = stocktakes
            .filter(st => st.status === 'مرحل' && dateRangeMatch(st.date) && st.type !== 'opening' && locationMatch(st.branchId))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (currentStocktake) {
            const countedItem = currentStocktake.items.find(si => si.itemId === item.id);
            if (countedItem) {
                physicalQty = countedItem.countedQty;
                hasPhysicalCount = true;
            }
        }
        const physicalValue = physicalQty * cost;
        const varianceQty = hasPhysicalCount ? physicalQty - closingBookQty : 0;
        const varianceValue = varianceQty * cost;

        rows.push({
            itemId: item.id, itemName: item.name, category: item.category, unit: item.stockUnit, avgCost: cost,
            openingQty, openingValue, receivingQty, receivingValue, consumptionQty: totalConsumptionQty, consumptionValue,
            closingBookQty, closingBookValue, physicalQty, physicalValue, varianceQty, varianceValue
        });
    });
    return rows;
  }, [items, purchases, productionLogs, wasteRecords, transferRecords, sales, recipes, stocktakes, startDate, endDate, selectedDept, selectedLocationId]);

  const groupedData: Record<string, ReportRow[]> = useMemo(() => {
      const groups: Record<string, ReportRow[]> = {};
      reportData.forEach(row => {
          if (!groups[row.category]) groups[row.category] = [];
          groups[row.category].push(row);
      });
      return groups;
  }, [reportData]);

  const handlePrintReport = () => {
    const el = document.getElementById('printable-report');
    if (!el) {
      alert('منطقة التقرير غير موجودة للطباعة');
      return;
    }

    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.overflow = 'visible';
    clone.style.maxHeight = 'none';
    clone.style.height = 'auto';

    clone.querySelectorAll<HTMLElement>('.print\\:block').forEach(n => {
      n.style.display = 'block';
    });
    clone.querySelectorAll<HTMLElement>('.hidden').forEach(n => {
      if (n.classList.contains('print:block') || n.classList.contains('print\\:block')) {
        n.style.display = 'block';
      }
    });

    clone.querySelectorAll<HTMLElement>('[class*="sticky"]').forEach(n => {
      n.style.position = 'static';
      n.style.top = 'auto';
      n.style.bottom = 'auto';
      n.style.zIndex = 'auto';
    });

    clone.querySelectorAll<HTMLElement>('.no-print').forEach(n => {
      n.style.display = 'none';
    });

    const header = document.createElement('div');
    header.style.marginBottom = '14px';
    header.style.paddingBottom = '10px';
    header.style.borderBottom = '2px solid #000';
    header.style.textAlign = 'center';
    const locName = warehouses.find(w => w.id === selectedLocationId)?.name || branches.find(b => b.id === selectedLocationId)?.name || 'كل المواقع';
    header.innerHTML = `
      <div style="font-size:18px;font-weight:900;">3M GSC - GLOBAL SYSTEM COST</div>
      <div style="font-size:13px;font-weight:800;margin-top:4px;">تقرير محرك التكاليف وتحليل حركة المواد</div>
      <div style="font-size:11px;font-weight:700;margin-top:6px;">
        الفترة: من ${startDate} إلى ${endDate} | الموقع: ${locName} | تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.appendChild(header);
    wrapper.appendChild(clone);

    const printWindow = window.open('', '_blank', 'width=1100,height=750');
    if (!printWindow) {
      alert('المتصفح منع نافذة الطباعة (Pop-up). فعّل السماح بالـ Pop-ups ثم جرّب مرة أخرى.');
      return;
    }

    const html = wrapper.outerHTML;

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>طباعة تقرير محرك التكاليف</title>
          <style>
            body { margin: 0; padding: 18px; background: #fff; color: #000; font-family: Arial, Tahoma, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 6px; font-size: 10px; }
            th { background: #f2f2f2; color: #000; }
            * { box-sizing: border-box; }
            @page { size: A4 landscape; margin: 10mm; }
          </style>
        </head>
        <body>
          ${html}
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

  const exportToExcel = () => {
    const dataForExport = reportData.map(r => ({
      'كود الصنف': r.itemId,
      'اسم الصنف': r.itemName,
      'الفئة': r.category,
      'الوحدة': r.unit,
      'متوسط التكلفة': r.avgCost,
      'أول المدة (كمية)': r.openingQty,
      'أول المدة (قيمة)': r.openingValue,
      'الوارد (كمية)': r.receivingQty,
      'الوارد (قيمة)': r.receivingValue,
      'المنصرف (كمية)': r.consumptionQty,
      'المنصرف (قيمة)': r.consumptionValue,
      'الرصيد الدفتري (كمية)': r.closingBookQty,
      'الرصيد الدفتري (قيمة)': r.closingBookValue,
      'الجرد الفعلي (كمية)': r.physicalQty,
      'الجرد الفعلي (قيمة)': r.physicalValue,
      'التباين (كمية)': r.varianceQty,
      'التباين (قيمة)': r.varianceValue,
    }));

    const ws = XLSX.utils.json_to_sheet(dataForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Costing Report");
    if(!ws['!views']) ws['!views'] = [];
    ws['!views'].push({RTL: true});
    XLSX.writeFile(wb, `Costing_Report_${endDate}.xlsx`);
    setConfirmation(prev => ({ ...prev, isOpen: false }));
  };

  const exportToPdfAsImage = async () => {
    setConfirmation(prev => ({ ...prev, isLoading: true, confirmBtnText: 'جاري المعالجة...' }));

    try {
      const exportContainer = document.createElement('div');
      exportContainer.style.position = 'absolute';
      exportContainer.style.left = '-9999px';
      exportContainer.style.width = '1200pt'; 
      exportContainer.style.padding = '30pt';
      exportContainer.style.background = 'white';
      exportContainer.style.color = 'black';
      exportContainer.style.direction = 'rtl';
      exportContainer.style.fontFamily = 'Arial, sans-serif';

      const locName = warehouses.find(w => w.id === selectedLocationId)?.name || branches.find(b => b.id === selectedLocationId)?.name || 'كل المواقع';

      const headerHtml = `
        <div style="text-align: center; border-bottom: 2pt solid black; padding-bottom: 15px; margin-bottom: 25px;">
          <h1 style="margin: 0; font-size: 24pt; color: black; font-weight: 900;">3M GSC - GLOBAL SYSTEM COST</h1>
          <h2 style="margin: 5px 0; font-size: 16pt; color: #1e1e1e; font-weight: 700;">تقرير محرك التكاليف وتحليل حركة المواد</h2>
          <p style="margin: 5px 0 0; font-size: 10pt; color: black;">الفترة: من ${startDate} إلى ${endDate} | الموقع: ${locName} | تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}</p>
        </div>
      `;

      let tableHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 7pt; border: 0.6pt solid #3c3c3c; color: black !important; table-layout: fixed;">
          <thead>
            <tr style="background-color: rgb(230, 230, 230); font-weight: bold; color: black !important;">
              <th rowspan="2" style="border: 0.6pt solid #3c3c3c; padding: 4pt; width: 50pt;">كود</th>
              <th rowspan="2" style="border: 0.6pt solid #3c3c3c; padding: 4pt; width: 120pt; text-align: right;">اسم الصنف</th>
              <th rowspan="2" style="border: 0.6pt solid #3c3c3c; padding: 4pt; text-align: center; width: 40pt;">الوحدة</th>
              <th colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 4pt; text-align: center; background-color: #f8f9fa;">1. أول المدة</th>
              <th colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 4pt; text-align: center; background-color: #f8f9fa;">2. الوارد</th>
              <th colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 4pt; text-align: center; background-color: #f8f9fa;">3. المنصرف</th>
              <th colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 4pt; text-align: center; background-color: #f8f9fa;">4. الدفتري</th>
              <th colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 4pt; text-align: center; background-color: #f8f9fa;">5. الجرد</th>
              <th colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 4pt; text-align: center; background-color: #f8f9fa;">6. التباين</th>
            </tr>
            <tr style="background-color: rgb(240, 240, 240); font-weight: bold; color: black !important;">
              <th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">كمية</th><th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">قيمة</th>
              <th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">كمية</th><th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">قيمة</th>
              <th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">كمية</th><th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">قيمة</th>
              <th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">كمية</th><th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">قيمة</th>
              <th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">كمية</th><th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">قيمة</th>
              <th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">كمية</th><th style="border: 0.6pt solid #3c3c3c; padding: 2pt; text-align: center;">قيمة</th>
            </tr>
          </thead>
          <tbody>
      `;

      Object.entries(groupedData).forEach(([category, rows]) => {
        tableHtml += `
          <tr style="background-color: #efefef; font-weight: bold;">
            <td colspan="15" style="border: 0.6pt solid #3c3c3c; padding: 6pt; color: black !important;">مجموعة: ${category}</td>
          </tr>
        `;
        rows.forEach(r => {
          tableHtml += `
            <tr style="color: black !important;">
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center;">${r.itemId}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; font-weight: bold;">${r.itemName}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center;">${r.unit}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center;">${r.openingQty.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center; color: #666;">${r.openingValue.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center;">${r.receivingQty.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center; color: #666;">${r.receivingValue.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center; font-weight: bold;">${r.consumptionQty.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center; color: #666;">${r.consumptionValue.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center;">${r.closingBookQty.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center; color: #666;">${r.closingBookValue.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center;">${r.physicalQty.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center; color: #666;">${r.physicalValue.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center; font-weight: bold; color: ${r.varianceQty < 0 ? '#d32f2f' : '#2e7d32'};">${r.varianceQty.toFixed(1)}</td>
              <td style="border: 0.6pt solid #3c3c3c; padding: 3pt; text-align: center; font-weight: bold; color: ${r.varianceValue < 0 ? '#d32f2f' : '#2e7d32'};">${r.varianceValue.toFixed(1)}</td>
            </tr>
          `;
        });
      });

      const totalOpVal = reportData.reduce((s, r) => s + r.openingValue, 0);
      const totalRecVal = reportData.reduce((s, r) => s + r.receivingValue, 0);
      const totalConsVal = reportData.reduce((s, r) => s + r.consumptionValue, 0);
      const totalVarVal = reportData.reduce((s, r) => s + r.varianceValue, 0);

      tableHtml += `
          </tbody>
          <tfoot style="background-color: #efefef; font-weight: bold;">
            <tr>
              <td colspan="3" style="border: 0.6pt solid #3c3c3c; padding: 8pt; text-align: left; font-size: 8pt;">الخلاصة المالية (GRAND TOTAL)</td>
              <td colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 8pt; text-align: center;">${totalOpVal.toLocaleString()}</td>
              <td colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 8pt; text-align: center;">${totalRecVal.toLocaleString()}</td>
              <td colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 8pt; text-align: center; background-color: #fff3e0;">${totalConsVal.toLocaleString()}</td>
              <td colspan="4" style="border: 0.6pt solid #3c3c3c; padding: 8pt; text-align: left;">إجمالي التباين المالي (EGP)</td>
              <td colspan="2" style="border: 0.6pt solid #3c3c3c; padding: 8pt; text-align: center; font-size: 9pt; color: ${totalVarVal < 0 ? 'red' : 'green'};">${totalVarVal.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      `;

      exportContainer.innerHTML = headerHtml + tableHtml + `<p style="font-size: 8pt; margin-top: 30pt; text-align: left; color: #777;">طُبع بواسطة نظام 3M GSC - وحدة الرقابة المالية</p>`;
      document.body.appendChild(exportContainer);

      const canvas = await html2canvas(exportContainer, { 
        scale: 3, 
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 24; 
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      doc.addImage(imgData, 'PNG', margin, 40, imgWidth, imgHeight);
      doc.save(`Costing_Engine_Report_${endDate}.pdf`);

      document.body.removeChild(exportContainer);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("فشل تصدير التقرير، يرجى المحاولة مرة أخرى.");
    } finally {
      setConfirmation(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }
  };

  const handleExportRequest = (type: 'excel' | 'pdf') => {
    setIsExportMenuOpen(false);
    setConfirmation({
      isOpen: true,
      title: 'تأكيد تصدير البيانات',
      message: `هل أنت متأكد من رغبتك في استخراج التقرير بصيغة ${type.toUpperCase()}؟ سيتم تضمين كافة أعمدة الكميات والقيم المالية لضمان دقة التحليل.`,
      confirmBtnText: `تصدير الآن`,
      action: () => {
        if (type === 'excel') exportToExcel();
        else exportToPdfAsImage();
      }
    });
  };

  const formatNum = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  return (
    <div className="flex flex-col h-full gap-4 relative font-sans">
      
      {/* نافذة التأكيد والمعالجة */}
      {confirmation.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#2a2a2a] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle size={18} className="text-sys-warning" />
                <h3 className="font-bold text-sm">{confirmation.title}</h3>
              </div>
              {!confirmation.isLoading && (
                <button onClick={() => setConfirmation(p => ({...p, isOpen: false}))} className="text-white/40 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="p-6 text-center">
              {confirmation.isLoading ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <Loader2 className="text-sys-primary animate-spin" size={40} />
                  <p className="text-white font-bold text-sm uppercase tracking-widest">Processing Data Grid...</p>
                  <p className="text-white/30 text-[10px] italic">يتم الآن بناء مصفوفة البيانات الكاملة (كمية وقيمة)</p>
                </div>
              ) : (
                <p className="text-white/80 text-sm leading-relaxed font-bold">{confirmation.message}</p>
              )}
            </div>
            {!confirmation.isLoading && (
              <div className="p-4 bg-sys-bg/50 border-t border-white/5 flex gap-3 justify-center">
                <button onClick={() => setConfirmation(p => ({...p, isOpen: false}))} className="px-4 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white transition-colors">إلغاء</button>
                <button onClick={confirmation.action} className="px-6 py-2 rounded-lg text-xs font-bold text-white bg-sys-primary hover:bg-blue-600 shadow-lg shadow-blue-900/20 transition-all">
                  {confirmation.confirmBtnText}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-4 no-print">
          <div className="flex items-center gap-4">
              <div className="p-3 bg-sys-primary/10 rounded-full text-sys-primary">
                  <Calculator size={24} />
              </div>
              <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">محرك التكاليف (Cost Engine)</h2>
                  <p className="text-white/40 text-sm">تحليل حركة المخزون المجمعة (مخازن وفروع)</p>
              </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 bg-sys-surface p-3 rounded-xl border border-white/5 shadow-sm">
              <div className="space-y-1 min-w-[200px]">
                  <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-widest px-1"><Building2 size={10} /> اختيار الموقع (مخزن / فرع)</label>
                  <select value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)} className="w-full bg-[#121212] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-sys-primary outline-none">
                      <option value="">كافة المواقع (إجمالي)</option>
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
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-widest px-1"><Calendar size={10} /> من تاريخ</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-[#121212] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-sys-primary outline-none" />
              </div>
              <div className="space-y-1">
                  <label className="text-[10px] text-white/40 flex items-center gap-1 uppercase tracking-widest px-1"><Calendar size={10} /> إلى تاريخ</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-[#121212] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-sys-primary outline-none" />
              </div>
              <div className="flex gap-2 relative" ref={exportMenuRef}>
                  <button onClick={handlePrintReport} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2" title="طباعة التقرير">
                    <Printer size={16} /> طباعة
                  </button>
                  
                  <div className="relative">
                    <button 
                      onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                      className={`flex items-center gap-2 px-4 py-2 bg-sys-primary text-white rounded-lg text-sm font-bold shadow-lg transition-all hover:bg-blue-600 ${isExportMenuOpen ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <Download size={16} />
                      <span>تصدير</span>
                      <ChevronDown size={14} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isExportMenuOpen && (
                      <div className="absolute left-0 mt-2 w-48 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-1.5 space-y-1">
                          <button 
                            onClick={() => handleExportRequest('excel')}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-white/70 hover:text-sys-success hover:bg-sys-success/10 transition-all group"
                          >
                            <FileSpreadsheet size={16} className="text-white/20 group-hover:text-sys-success" />
                            <span>ملف Excel</span>
                          </button>
                          <button 
                            onClick={() => handleExportRequest('pdf')}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-white/70 hover:text-sys-danger hover:bg-sys-danger/10 transition-all group"
                          >
                            <FileText size={16} className="text-white/20 group-hover:text-sys-danger" />
                            <span>ملف PDF (Full Grid)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button onClick={() => { setIsLoading(true); setTimeout(() => setIsLoading(false), 400); }} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-2 rounded-lg transition-all flex items-center gap-2">
                      <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  </button>
              </div>
          </div>
      </div>

      <div className="flex-1 overflow-auto bg-sys-surface border border-white/5 rounded-2xl relative custom-scrollbar" id="printable-report">
          <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
              <h1 className="text-2xl font-black text-black">3M GSC - GLOBAL SYSTEM COST</h1>
              <h2 className="text-xl font-bold mt-1 text-black">تقرير تحليل حركة ومراقبة تكاليف المواد</h2>
              <p className="text-sm font-medium text-black mt-2">الفترة: من {startDate} إلى {endDate} | الموقع: {warehouses.find(w => w.id === selectedLocationId)?.name || branches.find(b => b.id === selectedLocationId)?.name || 'كل المواقع'}</p>
          </div>

          <table className="w-full text-right border-collapse text-[10px]">
              <thead className="bg-[#1a1a1a] text-white/70 sticky top-0 z-10 font-bold shadow-sm">
                  <tr className="uppercase tracking-tighter">
                      <th rowSpan={2} className="p-3 border-b border-white/10 border-l border-white/5">كود</th>
                      <th rowSpan={2} className="p-3 border-b border-white/10 border-l border-white/5 min-w-[140px]">اسم الصنف</th>
                      <th rowSpan={2} className="p-3 border-b border-white/10 border-l border-white/5 text-center">الوحدة</th>
                      <th colSpan={2} className="p-2 border-b border-white/10 border-l border-white/5 text-center bg-blue-900/20 text-blue-300">1. أول المدة</th>
                      <th colSpan={2} className="p-2 border-b border-white/10 border-l border-white/5 text-center bg-green-900/20 text-green-300">2. الوارد</th>
                      <th colSpan={2} className="p-2 border-b border-white/10 border-l border-white/5 text-center bg-orange-900/20 text-orange-400">3. المنصرف</th>
                      <th colSpan={2} className="p-2 border-b border-white/10 border-l border-white/5 text-center bg-gray-800/50 text-white">4. الدفتري</th>
                      <th colSpan={2} className="p-2 border-b border-white/10 border-l border-white/5 text-center bg-purple-900/20 text-purple-300">5. الجرد</th>
                      <th colSpan={2} className="p-2 border-b border-white/10 text-center bg-red-900/20 text-red-300">6. التباين</th>
                  </tr>
                  <tr className="bg-[#151515] text-[9px] font-black">
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-blue-900/10">كمية</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-blue-900/10 text-white/30">قيمة</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-green-900/10">كمية</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-green-900/10 text-white/30">قيمة</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-orange-900/10">كمية</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-orange-900/10 text-white/30">قيمة</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-gray-800/30">كمية</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-gray-800/30 text-white/30">قيمة</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-purple-900/10">كمية</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-purple-900/10 text-white/30">قيمة</th>
                      <th className="p-1 border-b border-white/10 border-l border-white/5 bg-red-900/10">كمية</th>
                      <th className="p-1 border-b border-white/10 bg-red-900/10 text-white/30">قيمة</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                  {Object.entries(groupedData).map(([category, rows]) => {
                      return (
                        <React.Fragment key={category}>
                            <tr className="bg-sys-primary/[0.04] font-bold text-sys-primary">
                                <td colSpan={15} className="p-2 border-y border-white/10 bg-gradient-to-l from-sys-primary/10 to-transparent">مجموعة: {category}</td>
                            </tr>
                            {rows.map(row => (
                                <tr key={row.itemId} className="hover:bg-white/[0.03] text-white/80 transition-colors group">
                                    <td className="p-2 border-l border-white/5 font-mono text-[9px] opacity-40 group-hover:opacity-100">{row.itemId}</td>
                                    <td className="p-2 border-l border-white/5 font-bold group-hover:text-sys-primary">{row.itemName}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-white/40">{row.unit}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-blue-500/[0.02]">{row.openingQty.toFixed(2)}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-blue-500/[0.02] text-white/20 font-mono">{row.openingValue.toFixed(2)}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-green-500/[0.02]">{row.receivingQty.toFixed(2)}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-green-500/[0.02] text-white/20 font-mono">{row.receivingValue.toFixed(2)}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-orange-500/[0.02] font-black text-orange-400">{row.consumptionQty.toFixed(2)}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-orange-500/[0.02] text-white/20 font-mono">{row.consumptionValue.toFixed(2)}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-gray-500/5">{row.closingBookQty.toFixed(2)}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-gray-500/5 text-white/20 font-mono">{row.closingBookValue.toFixed(2)}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-purple-500/[0.02] font-black text-purple-300">{row.physicalQty.toFixed(2)}</td>
                                    <td className="p-2 border-l border-white/5 text-center bg-purple-500/[0.02] text-white/20 font-mono">{row.physicalValue.toFixed(2)}</td>
                                    <td className={`p-2 border-l border-white/5 text-center font-black ${row.varianceQty < 0 ? 'text-sys-danger' : row.varianceQty > 0 ? 'text-sys-success' : 'text-white/20'}`}>{row.varianceQty.toFixed(2)}</td>
                                    <td className={`p-2 text-center font-bold ${row.varianceValue < 0 ? 'text-sys-danger' : 'text-white/30'}`}>{row.varianceValue.toFixed(2)}</td>
                                </tr>
                            ))}
                        </React.Fragment>
                      );
                  })}
              </tbody>
              <tfoot className="bg-[#121212] text-white font-black border-t-2 border-sys-primary sticky bottom-0 z-20 shadow-2xl">
                  <tr className="text-xs uppercase tracking-tight">
                      <td colSpan={3} className="p-4 text-center border-l border-white/5">الخلاصة المالية (GRAND TOTAL)</td>
                      <td colSpan={2} className="p-4 text-center text-blue-300 bg-blue-900/10">{reportData.reduce((s, r) => s + r.openingValue, 0).toLocaleString()}</td>
                      <td colSpan={2} className="p-4 text-center text-green-300 bg-green-900/10">{reportData.reduce((s, r) => s + r.receivingValue, 0).toLocaleString()}</td>
                      <td colSpan={2} className="p-4 text-center text-orange-300 bg-orange-900/10 font-black">{reportData.reduce((s, r) => s + r.consumptionValue, 0).toLocaleString()}</td>
                      <td colSpan={2} className="p-4 text-center text-white/50 bg-gray-800/20">{reportData.reduce((s, r) => s + r.closingBookValue, 0).toLocaleString()}</td>
                      <td colSpan={2} className="p-4 text-center text-purple-300 bg-purple-900/10">{reportData.reduce((s, r) => s + r.physicalValue, 0).toLocaleString()}</td>
                      <td colSpan={2} className={`p-4 text-center ${reportData.reduce((s, r) => s + r.varianceValue, 0) < 0 ? 'bg-sys-danger/20 text-sys-danger' : 'bg-sys-success/20 text-sys-success'}`}>{reportData.reduce((s, r) => s + r.varianceValue, 0).toLocaleString()}</td>
                  </tr>
              </tfoot>
          </table>

          {reportData.length === 0 && (
              <div className="flex flex-col items-center justify-center h-80 text-white/10 gap-6">
                  <AlertTriangle size={80} className="opacity-10" />
                  <div className="text-center">
                    <p className="text-xl font-bold">لا توجد حركات مخزنية مرحلة</p>
                    <p className="text-sm opacity-50 mt-1">تأكد من ترحيل المشتريات، المبيعات، أو الجرد في الفترة المحددة.</p>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
