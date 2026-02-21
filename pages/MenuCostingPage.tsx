
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    PieChart as PieChartIcon, TrendingUp, DollarSign, Search, Printer, 
    Download, RefreshCw, Layers, Building2, Calendar, User, Target, 
    Utensils, ShieldAlert, Zap, TrendingDown, Hash, Tag, Plus, Trash2, Package, ArrowRight,
    Settings2, Calculator, Percent, Info, Coffee, Store, Activity, ChevronDown, FileSpreadsheet, FileText, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface MenuItem {
    id: string;
    name: string;
    category: string;
    branchId: string;
    price: number;
    active: boolean;
}

interface StockItem {
    id: string;
    name: string;
    avgCost: number;
    standardCost: number;
    conversionFactor: number;
}

interface Recipe {
    menuItemId: string;
    ingredients: { stockItemId: string; qty: number }[];
}

interface PackingItem {
    id: string;
    name: string;
    cost: number;
}

interface IndirectCostItem {
    id: string;
    name: string;
    cost: number;
}

interface Branch {
    id: string;
    name: string;
}

export const MenuCostingPage: React.FC = () => {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    
    // --- Local Persistence Helpers ---
    const getSaved = (key: string, fallback: any) => {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    };

    // --- Persisted Manual Overrides for Table ---
    const [manualSideCosts, setManualSideCosts] = useState<Record<string, number>>(() => 
        getSaved('gsc_menu_manual_sides', {})
    );

    const [manualPackingCosts, setManualPackingCosts] = useState<Record<string, number>>(() =>
        getSaved('gsc_menu_manual_packing', {})
    );
    
    // --- Persisted Dynamic Metadata ---
    const [reportMeta, setReportMeta] = useState(() => 
        getSaved('gsc_menu_meta', { 
            manager: 'إدارة العمليات', 
            branchId: 'all', 
            period: 'أكتوبر 2025',
            mode: 'restaurant' 
        })
    );

    const [selectedCatForBEP, setSelectedCatForBEP] = useState<string>('');

    // --- Persisted Dynamic Sales Assumptions ---
    const [assumptions, setAssumptions] = useState(() => 
        getSaved('gsc_menu_assumptions', {
            capacity: 50,
            turnover: 3,
            avgCheck: 150,
            consumablesRatio: 1 
        })
    );

    // --- Persisted Dynamic Indirect Costs List ---
    const [indirectCosts, setIndirectCosts] = useState<IndirectCostItem[]>(() => 
        getSaved('gsc_menu_indirect_costs', [
            { id: '1', name: 'الإيجار', cost: 25000 },
            { id: '2', name: 'المرتبات', cost: 45000 },
            { id: '3', name: 'المرافق (كهرباء/مياه)', cost: 8000 }
        ])
    );

    // --- Persisted Packing Items List ---
    const [packingMaterials, setPackingMaterials] = useState<PackingItem[]>(() => 
        getSaved('gsc_menu_packing_items', [
            { id: '1', name: 'علبة وجبة', cost: 1.50 },
            { id: '2', name: 'شنطة بلاستيك', cost: 0.50 }
        ])
    );

    // --- Effects for Auto-Saving & Menus ---
    useEffect(() => localStorage.setItem('gsc_menu_manual_sides', JSON.stringify(manualSideCosts)), [manualSideCosts]);
    useEffect(() => localStorage.setItem('gsc_menu_manual_packing', JSON.stringify(manualPackingCosts)), [manualPackingCosts]);
    useEffect(() => localStorage.setItem('gsc_menu_meta', JSON.stringify(reportMeta)), [reportMeta]);
    useEffect(() => localStorage.setItem('gsc_menu_assumptions', JSON.stringify(assumptions)), [assumptions]);
    useEffect(() => localStorage.setItem('gsc_menu_indirect_costs', JSON.stringify(indirectCosts)), [indirectCosts]);
    useEffect(() => localStorage.setItem('gsc_menu_packing_items', JSON.stringify(packingMaterials)), [packingMaterials]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setIsLoading(true);
        try {
            const m = localStorage.getItem('gsc_pos_items');
            if (m) {
                const parsedItems = JSON.parse(m);
                setMenuItems(parsedItems);
                if (parsedItems.length > 0 && !selectedCatForBEP) {
                    setSelectedCatForBEP(parsedItems[0].category);
                }
            }
            const s = localStorage.getItem('gsc_items');
            if (s) setStockItems(JSON.parse(s));
            const r = localStorage.getItem('gsc_recipes');
            if (r) setRecipes(JSON.parse(r));
            const b = localStorage.getItem('gsc_branches');
            if (b) {
                const parsedBranches = JSON.parse(b);
                setBranches(parsedBranches);
                if (reportMeta.branchId === 'all' && parsedBranches.length > 0) {
                    setReportMeta((prev: any) => ({ ...prev, branchId: parsedBranches[0].id }));
                }
            }
            else setBranches([{ id: '101', name: 'الفرع الرئيسي' }, { id: '102', name: 'فرع المعادي' }]);
        } catch (e) {
            console.error("Error loading data", e);
        }
        setTimeout(() => setIsLoading(false), 400);
    };

    // --- Calculations ---
    const expectedDailySales = assumptions.capacity * assumptions.turnover * assumptions.avgCheck;
    const expectedMonthlySales = expectedDailySales * 30;
    const totalIndirectCostSum = indirectCosts.reduce((s, item) => s + item.cost, 0);
    const indirectCostRatio = expectedMonthlySales > 0 ? (totalIndirectCostSum / expectedMonthlySales) : 0;
    const totalSelectedPackingCost = packingMaterials.reduce((s, i) => s + i.cost, 0);

    const matrixData = useMemo(() => {
        const beverageKeywords = /مشروبات|عصائر|قهوة|شاى|بارد|ساخن|Drinks|Beverages|Juice|Cafe|Coffee|Tea|Soft Drink/i;
        
        return menuItems
            .filter(item => {
                if (!item.active) return false;
                if (reportMeta.branchId !== 'all' && item.branchId !== reportMeta.branchId) return false;
                const isBeverage = beverageKeywords.test(item.category) || beverageKeywords.test(item.name);
                if (reportMeta.mode === 'cafe') return isBeverage;
                if (reportMeta.mode === 'restaurant') return !isBeverage;
                return true;
            })
            .map(item => {
                const recipe = recipes.find(r => r.menuItemId === item.id);
                let mainRecipeCost = 0;
                if (recipe) {
                    mainRecipeCost = recipe.ingredients.reduce((total, ing) => {
                        const stockItem = stockItems.find(si => si.id === ing.stockItemId);
                        if (!stockItem) return total;
                        const cost = stockItem.avgCost || stockItem.standardCost || 0;
                        const factor = stockItem.conversionFactor || 1;
                        return total + ((ing.qty / factor) * cost);
                    }, 0);
                }
                const sideCost = manualSideCosts[item.id] || 0; 
                const consumables = item.price * (assumptions.consumablesRatio / 100); 
                const packing = (manualPackingCosts[item.id] ?? totalSelectedPackingCost);
                const finalDirectCost = mainRecipeCost + sideCost + consumables + packing;
                const directCostPercent = item.price > 0 ? (finalDirectCost / item.price) * 100 : 0;
                const grossProfit = item.price - finalDirectCost;
                const allocatedIndirect = item.price * indirectCostRatio;
                const totalFullCost = finalDirectCost + allocatedIndirect;
                const totalCostPercent = item.price > 0 ? (totalFullCost / item.price) * 100 : 0;
                const netProfit = item.price - totalFullCost;
                const netProfitPercent = item.price > 0 ? (netProfit / item.price) * 100 : 0;

                return {
                    ...item, mainRecipeCost, sideCost, consumables, packing, finalDirectCost,
                    directCostPercent, grossProfit, allocatedIndirect, totalFullCost,
                    totalCostPercent, netProfit, netProfitPercent
                };
            });
    }, [menuItems, stockItems, recipes, indirectCostRatio, manualSideCosts, manualPackingCosts, assumptions.consumablesRatio, reportMeta.mode, reportMeta.branchId, totalSelectedPackingCost]);

    const analysisStats = useMemo(() => {
        const categoryTotals: Record<string, any> = {};
        const global = { price: 0, direct: 0, net: 0 };
        const groups: Record<string, any[]> = {};

        matrixData.forEach(item => {
            if (!groups[item.category]) groups[item.category] = [];
            groups[item.category].push(item);
        });

        Object.entries(groups).forEach(([cat, items]) => {
            const catSum = items.reduce((acc, row) => ({
                price: acc.price + row.price,
                mainRecipeCost: acc.mainRecipeCost + row.mainRecipeCost,
                sideCost: acc.sideCost + row.sideCost,
                consumables: acc.consumables + row.consumables,
                packing: acc.packing + row.packing,
                direct: acc.direct + row.finalDirectCost,
                indirect: acc.indirect + row.allocatedIndirect,
                totalFullCost: acc.totalFullCost + row.totalFullCost,
                net: acc.net + row.netProfit,
            }), { 
                price: 0, mainRecipeCost: 0, sideCost: 0, consumables: 0, 
                packing: 0, direct: 0, indirect: 0, totalFullCost: 0, net: 0 
            });

            categoryTotals[cat] = {
                ...catSum,
                directRatio: catSum.price > 0 ? (catSum.direct / catSum.price) : 0,
                netRatio: catSum.price > 0 ? (catSum.net / catSum.price) : 0,
                count: items.length
            };

            global.price += catSum.price;
            global.direct += catSum.direct;
            global.net += catSum.net;
        });

        return {
            groups,
            categoryTotals,
            global: {
                ...global,
                directRatio: global.price > 0 ? (global.direct / global.price) * 100 : 0,
                netRatio: global.price > 0 ? (global.net / global.price) * 100 : 0,
            }
        };
    }, [matrixData]);

    const catBEPAnalysis = useMemo(() => {
        const catData = analysisStats.categoryTotals[selectedCatForBEP];
        if (!catData) return { indirectDaily: 0, avgPrice: 0, avgDirectCost: 0, avgProfit: 0, bepOrders: 0 };
        const indirectDaily = totalIndirectCostSum / 30;
        const avgPrice = catData.price / catData.count;
        const avgDirectCost = catData.directRatio * avgPrice;
        const avgProfit = avgPrice - avgDirectCost;
        const bepOrders = avgProfit > 0 ? indirectDaily / avgProfit : 0;
        return { indirectDaily, avgPrice, avgDirectCost, avgProfit, bepOrders };
    }, [analysisStats, selectedCatForBEP, totalIndirectCostSum]);

    const formatNum = (num: number) => {
        const safe = Number.isFinite(num) ? num : 0;
        return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // --- Export & Print Handlers ---
    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        setIsExportMenuOpen(false);
        const data = matrixData.map(item => ({
            'الكود': item.id,
            'اسم الصنف': item.name,
            'الفئة': item.category,
            'سعر البيع': item.price,
            'تكلفة الوصفة': item.mainRecipeCost,
            'تكلفة إضافية': item.sideCost,
            'مستهلكات': item.consumables,
            'تعبئة وتغليف': item.packing,
            'إجمالي المباشرة': item.finalDirectCost,
            'نسبة المباشرة %': item.directCostPercent.toFixed(2),
            'مجمل الربح': item.grossProfit,
            'نصيب غير المباشرة': item.allocatedIndirect,
            'صافي الربح': item.netProfit,
            'نسبة صافي الربح %': item.netProfitPercent.toFixed(2)
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Menu Costing");
        XLSX.writeFile(workbook, `Menu_Costing_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPdf = async () => {
        setIsExportMenuOpen(false);
        setIsLoading(true);
        const element = document.getElementById('costing-matrix-content');
        if (!element) return;

        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#121212' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Menu_Costing_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error("PDF Export failed", err);
        }
        setIsLoading(false);
    };

    const addIndirectCost = () => {
        const newItem: IndirectCostItem = { id: Date.now().toString(), name: 'بند جديد', cost: 0 };
        setIndirectCosts([...indirectCosts, newItem]);
    };

    const updateIndirectCost = (id: string, field: 'name' | 'cost', value: any) => {
        setIndirectCosts(indirectCosts.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const removeIndirectCost = (id: string) => {
        setIndirectCosts(indirectCosts.filter(i => i.id !== id));
    };

    const updateManualSideCost = (id: string, val: number) => {
        setManualSideCosts(prev => ({ ...prev, [id]: val }));
    };

    const updateManualPackingCost = (id: string, val: number) => {
        setManualPackingCosts(prev => ({ ...prev, [id]: val }));
    };

    return (
        <div id="costing-matrix-content" className="flex flex-col h-full gap-6 font-sans select-none" dir="rtl">
            {/* Header - REMOVED overflow-hidden to allow dropdown to show */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-sys-surface p-6 rounded-2xl border border-white/10 shadow-xl no-print relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sys-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                <div className="flex items-center gap-6 relative z-10">
                    <div className="p-4 bg-sys-primary/10 rounded-2xl text-sys-primary shadow-lg shadow-blue-900/10">
                        <PieChartIcon size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Menu Costing & Profitability Matrix</h2>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm no-print">
                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                <User size={14} className="text-sys-primary" />
                                <input type="text" value={reportMeta.manager} onChange={e => setReportMeta({...reportMeta, manager: e.target.value})} className="bg-transparent border-none outline-none text-white text-xs w-24" placeholder="المسؤول" />
                            </div>
                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                <Building2 size={14} className="text-sys-warning" />
                                <select value={reportMeta.branchId} onChange={e => setReportMeta({...reportMeta, branchId: e.target.value})} className="bg-transparent border-none outline-none text-white text-xs cursor-pointer focus:ring-0">
                                    <option value="all" className="bg-sys-surface">كافة الفروع</option>
                                    {branches.map(b => <option key={b.id} value={b.id} className="bg-sys-surface">{b.name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
                                <button onClick={() => setReportMeta({...reportMeta, mode: 'restaurant'})} className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${reportMeta.mode === 'restaurant' ? 'bg-sys-primary text-white' : 'text-white/40 hover:text-white/60'}`}><Store size={14} /> مطعم</button>
                                <button onClick={() => setReportMeta({...reportMeta, mode: 'cafe'})} className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${reportMeta.mode === 'cafe' ? 'bg-sys-warning text-black' : 'text-white/40 hover:text-white/60'}`}><Coffee size={14} /> كافيه</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button onClick={loadData} className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
                    <button onClick={handlePrint} className="p-3 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white transition-all"><Printer size={20} /></button>
                    
                    {/* Export Dropdown Section */}
                    <div className="relative" ref={exportMenuRef}>
                        <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="bg-sys-primary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95">
                            <Download size={18} /> تصدير <ChevronDown size={14} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isExportMenuOpen && (
                            <div className="absolute left-0 mt-3 w-56 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                <div className="p-2 space-y-1">
                                    <button 
                                        onClick={handleExportExcel} 
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white/70 hover:text-sys-success hover:bg-sys-success/10 transition-all group border border-transparent hover:border-sys-success/20"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileSpreadsheet size={18} className="text-sys-success group-hover:scale-110 transition-transform" />
                                            <span>ملف Excel</span>
                                        </div>
                                        <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                    </button>
                                    
                                    <button 
                                        onClick={handleExportPdf} 
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-bold text-white/70 hover:text-sys-danger hover:bg-sys-danger/10 transition-all group border border-transparent hover:border-sys-danger/20"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileText size={18} className="text-sys-danger group-hover:scale-110 transition-transform" />
                                            <span>ملف PDF</span>
                                        </div>
                                        <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                    </button>
                                </div>
                                <div className="bg-white/5 py-1.5 px-4 text-[9px] text-white/30 uppercase font-black text-center border-t border-white/5">
                                    أختر صيغة التصدير
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- Panels --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
                <div className="lg:col-span-3 bg-sys-surface border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2"><TrendingUp size={18} className="text-sys-success" /><h3 className="text-sm font-bold text-white uppercase">افتراضات حجم المبيعات</h3></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] text-white/40 uppercase font-black">1. السعة</label><input type="number" value={assumptions.capacity} onChange={e => setAssumptions({...assumptions, capacity: Number(e.target.value)})} className="w-full bg-sys-bg border border-white/10 rounded-xl p-2 text-sm text-white focus:border-sys-primary outline-none" /></div>
                        <div className="space-y-1"><label className="text-[10px] text-white/40 uppercase font-black">2. ترن اوفر</label><input type="number" value={assumptions.turnover} onChange={e => setAssumptions({...assumptions, turnover: Number(e.target.value)})} className="w-full bg-sys-bg border border-white/10 rounded-xl p-2 text-sm text-white focus:border-sys-primary outline-none" /></div>
                        <div className="space-y-1"><label className="text-[10px] text-white/40 uppercase font-black">3. متوسط الشيك</label><input type="number" value={assumptions.avgCheck} onChange={e => setAssumptions({...assumptions, avgCheck: Number(e.target.value)})} className="w-full bg-sys-bg border border-white/10 rounded-xl p-2 text-sm text-white focus:border-sys-primary outline-none" /></div>
                        <div className="space-y-1"><label className="text-[10px] text-sys-success uppercase font-black">4. متوقع مبيع اليوم</label><div className="w-full bg-sys-success/10 border border-sys-success/20 rounded-xl p-2 text-sm text-sys-success font-black h-[38px] flex items-center justify-center">{formatNum(expectedDailySales)}</div></div>
                    </div>
                    <div className="mt-2 p-3 bg-sys-primary/5 rounded-xl border border-sys-primary/10 flex justify-between items-center"><span className="text-[10px] font-bold text-white/60">متوقع مبيع الشهر (x30)</span><span className="text-sm font-black text-sys-primary">{formatNum(expectedMonthlySales)}</span></div>
                </div>

                <div className="lg:col-span-3 bg-sys-surface border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2"><div className="flex items-center gap-2"><Settings2 size={18} className="text-sys-warning" /><h3 className="text-sm font-bold text-white uppercase">المصاريف غير المباشرة</h3></div><button onClick={addIndirectCost} className="text-[10px] bg-sys-primary/10 text-sys-primary px-3 py-1 rounded-full hover:bg-sys-primary hover:text-white transition-all"><Plus size={10}/></button></div>
                    <div className="flex-1 overflow-auto max-h-[140px] custom-scrollbar space-y-2 pr-2">
                        {indirectCosts.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 bg-white/[0.02] p-2 rounded-xl border border-white/5 group">
                                <input type="text" value={item.name} onChange={e => updateIndirectCost(item.id, 'name', e.target.value)} className="flex-1 bg-transparent border-none text-xs text-white outline-none" />
                                <input type="number" value={item.cost} onChange={e => updateIndirectCost(item.id, 'cost', Number(e.target.value))} className="w-24 bg-sys-bg border border-white/10 rounded-lg p-1 text-xs text-center text-white" />
                                <button onClick={() => removeIndirectCost(item.id)} className="text-white/10 hover:text-sys-danger opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-auto pt-2 border-t border-white/5 flex justify-between items-center"><span className="text-[10px] font-bold text-white/40 uppercase">إجمالي</span><span className="text-lg font-black text-white">{formatNum(totalIndirectCostSum)} ج.م</span></div>
                </div>

                <div className="lg:col-span-3 bg-sys-surface border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col gap-4 relative overflow-hidden group">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2"><Calculator size={18} className="text-sys-primary" /><h3 className="text-sm font-bold text-white uppercase">جدول النسب التشغيلية</h3></div>
                    <div className="grid grid-cols-1 gap-3 py-1">
                        <div className="flex justify-between items-center bg-white/[0.02] p-2 rounded-xl border border-white/5"><label className="text-[10px] text-sys-primary/80 uppercase font-black">نسبة المستهلكات %</label><input type="number" value={assumptions.consumablesRatio} onChange={e => setAssumptions({...assumptions, consumablesRatio: Number(e.target.value)})} className="w-16 bg-sys-primary/10 border border-sys-primary/20 rounded-lg p-1 text-sm text-sys-primary font-black text-center" /></div>
                        <div className="flex justify-between items-center bg-white/[0.02] p-2 rounded-xl border border-white/5"><label className="text-[10px] text-white/40 uppercase font-black">غير المباشرة من المبيع</label><span className="text-sm font-black text-white">{(indirectCostRatio * 100).toFixed(2)}%</span></div>
                        <div className="flex justify-between items-center bg-sys-primary/5 p-2 rounded-xl border border-sys-primary/10"><label className="text-[10px] text-sys-primary/80 uppercase font-black">تكلفة المنيو المباشرة</label><span className="text-sm font-black text-sys-primary">{analysisStats.global.directRatio.toFixed(2)}%</span></div>
                        <div className="flex justify-between items-center bg-sys-success/5 p-2 rounded-xl border border-sys-success/10"><label className="text-[10px] text-sys-success uppercase font-black">صافي ربح المنيو</label><span className="text-sm font-black text-sys-success">{analysisStats.global.netRatio.toFixed(2)}%</span></div>
                    </div>
                </div>

                <div className="lg:col-span-3 bg-sys-surface border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sys-success/5 rounded-full blur-2xl -mr-12 -mt-12"></div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2 relative z-10"><Activity size={18} className="text-sys-success" /><h3 className="text-[11px] font-bold text-white uppercase tracking-tighter">تحليل الفئة ونقطة التعادل</h3></div>
                        <select value={selectedCatForBEP} onChange={(e) => setSelectedCatForBEP(e.target.value)} className="bg-sys-bg border border-white/10 rounded-lg text-[9px] p-1 text-sys-primary font-black outline-none relative z-10">
                            {Object.keys(analysisStats.categoryTotals).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                        </select>
                    </div>
                    <div className="flex-1 space-y-2 relative z-10">
                        <div className="flex justify-between items-center text-[10px] bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                            <span className="text-white/40">1- مصاريف غير مباشرة (يومي)</span>
                            <span className="text-white font-black">{formatNum(catBEPAnalysis.indirectDaily)}</span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                            <span className="text-white/40">2- متوسط سعر الأوردر</span>
                            <span className="text-sys-success font-black">{formatNum(catBEPAnalysis.avgPrice)}</span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                            <span className="text-white/40">3- متوسط تكلفة مباشرة</span>
                            <span className="text-sys-danger font-black">{formatNum(catBEPAnalysis.avgDirectCost)}</span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] bg-sys-primary/5 p-1.5 rounded-lg border border-sys-primary/10">
                            <span className="text-sys-primary font-black">4- متوسط ربحية مباشرة</span>
                            <span className="text-sys-primary font-black">{formatNum(catBEPAnalysis.avgProfit)}</span>
                        </div>
                    </div>
                    <div className="mt-auto p-2 bg-sys-success/10 rounded-xl border border-sys-success/20 flex flex-col items-center">
                        <span className="text-[8px] text-sys-success font-black uppercase mb-1">5- أوردرات تحقيق نقطة التعادل</span>
                        <div className="text-lg font-black text-white">{Math.ceil(catBEPAnalysis.bepOrders)} <span className="text-[10px] font-normal opacity-40">أوردر / يوم</span></div>
                    </div>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="flex-1 bg-sys-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
                <div className="p-4 border-b border-white/10 bg-white/[0.02] flex justify-between items-center no-print">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                            <input type="text" placeholder="بحث بالأصناف..." className="bg-sys-bg border border-white/10 rounded-lg py-1.5 pr-9 pl-3 text-[10px] text-white focus:border-sys-primary outline-none w-64" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-right text-[10px] border-collapse min-w-[1200px]">
                        <thead className="bg-[#1a1a1a] text-white/40 font-bold sticky top-0 z-10 uppercase tracking-tighter shadow-md">
                            <tr>
                                <th rowSpan={2} className="p-4 border-l border-white/5">كود</th>
                                <th rowSpan={2} className="p-4 border-l border-white/5 min-w-[150px]">اسم الصنف</th>
                                <th rowSpan={2} className="p-4 border-l border-white/5 text-center">سعر البيع</th>
                                <th colSpan={4} className="p-2 border-l border-white/5 text-center bg-sys-primary/5 text-sys-primary">تحليل التكلفة المباشرة</th>
                                <th rowSpan={2} className="p-4 border-l border-white/5 text-center bg-sys-primary/10 text-sys-primary font-black">إجمالي المباشرة</th>
                                <th rowSpan={2} className="p-4 border-l border-white/5 text-center text-sys-primary/60 italic">% المباشرة</th>
                                <th rowSpan={2} className="p-4 border-l border-white/5 text-center font-black bg-sys-success/5 text-sys-success">مجمل الربح</th>
                                <th rowSpan={2} className="p-4 border-l border-white/5 text-center text-sys-warning/60">غير المباشرة ({ (indirectCostRatio * 100).toFixed(1) }%)</th>
                                <th rowSpan={2} className="p-4 border-l border-white/5 text-center font-bold">إجمالي التكلفة</th>
                                <th rowSpan={2} className="p-4 border-l border-white/5 text-center font-black text-sys-success bg-sys-success/10">صافي الربح</th>
                                <th colSpan={2} className="p-2 text-center bg-white/5 text-white/60 font-bold">النسب المئوية</th>
                            </tr>
                            <tr className="bg-[#151515]">
                                <th className="p-2 border-l border-white/5 text-center opacity-60">رئيسية</th>
                                <th className="p-2 border-l border-white/5 text-center bg-sys-primary/20 text-white">سايد (يدوي)</th>
                                <th className="p-2 border-l border-white/5 text-center opacity-60">مستهلكات ({assumptions.consumablesRatio}%)</th>
                                <th className="p-2 border-l border-white/5 text-center bg-sys-primary/20 text-white">باكينج (يدوي)</th>
                                <th className="p-2 border-l border-white/5 text-center">% تكلفة/سعر</th>
                                <th className="p-2 text-center">% صافي ربح</th>
                            </tr>
                        </thead>
                        
                        <tbody className="divide-y divide-white/5">
                            {(Object.entries(analysisStats.groups) as [string, any[]][]).map(([category, items]) => (
                                <React.Fragment key={category}>
                                    <tr className="bg-sys-primary/[0.04] font-bold text-sys-primary">
                                        <td colSpan={15} className="p-3 px-6 border-y border-white/10">
                                            <div className="flex items-center gap-2"><Tag size={12} /><span>الفئة: {category} ({items.length} صنف)</span></div>
                                        </td>
                                    </tr>
                                    {items.map(row => (
                                        <tr key={row.id} className="hover:bg-white/[0.03] transition-colors group">
                                            <td className="p-4 border-l border-white/5 font-mono text-white/30 text-[9px]">{row.id}</td>
                                            <td className="p-4 border-l border-white/5 font-bold text-white">{row.name}</td>
                                            <td className="p-4 border-l border-white/5 text-center font-black text-white bg-white/[0.01]">{formatNum(row.price)}</td>
                                            <td className="p-4 border-l border-white/5 text-center text-white/50">{formatNum(row.mainRecipeCost)}</td>
                                            <td className="p-4 border-l border-white/5 text-center bg-sys-primary/[0.03]"><input type="number" value={manualSideCosts[row.id] ?? 0} onChange={e => updateManualSideCost(row.id, Number(e.target.value))} className="w-full bg-transparent border-none text-center text-white font-bold outline-none" /></td>
                                            <td className="p-4 border-l border-white/5 text-center text-white/40 italic">{formatNum(row.consumables)}</td>
                                            <td className="p-4 border-l border-white/5 text-center bg-sys-primary/5">
                                                <input
                                                    type="number"
                                                    value={manualPackingCosts[row.id] ?? totalSelectedPackingCost}
                                                    onChange={e => updateManualPackingCost(row.id, Number(e.target.value))}
                                                    className="w-full bg-transparent border-none text-center text-white font-bold outline-none"
                                                />
                                            </td>
                                            <td className="p-4 border-l border-white/5 text-center font-black text-sys-primary bg-sys-primary/[0.02]">{formatNum(row.finalDirectCost)}</td>
                                            <td className="p-4 border-l border-white/5 text-center text-sys-primary/60 italic">{row.directCostPercent.toFixed(1)}%</td>
                                            <td className="p-4 border-l border-white/5 text-center font-bold text-sys-success">{formatNum(row.grossProfit)}</td>
                                            <td className="p-4 border-l border-white/5 text-center text-sys-warning/60">{formatNum(row.allocatedIndirect)}</td>
                                            <td className="p-4 border-l border-white/5 text-center font-medium text-white/60">{formatNum(row.totalFullCost)}</td>
                                            <td className={`p-4 border-l border-white/5 text-center font-black bg-sys-success/[0.03] text-sys-success`}>{formatNum(row.netProfit)}</td>
                                            <td className="p-4 border-l border-white/5 text-center text-white/40">{row.totalCostPercent.toFixed(1)}%</td>
                                            <td className="p-4 text-center"><span className={`font-black text-xs text-sys-success`}>{row.netProfitPercent.toFixed(1)}%</span></td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>

                        <tfoot className="bg-[#121212] font-black border-t-2 border-sys-primary sticky bottom-0 z-20 text-white uppercase text-[9px]">
                             {(Object.entries(analysisStats.categoryTotals) as [string, any][]).map(([cat, totals]) => (
                                <tr key={cat} className="border-t border-white/5 bg-white/[0.01] opacity-70 hover:opacity-100 transition-opacity">
                                    <td colSpan={2} className="p-2 text-left pl-6 border-l border-white/5 text-sys-primary/80">إجمالي {cat} (Analysis)</td>
                                    <td className="p-2 border-l border-white/5 text-center text-white/60">{formatNum(totals.price)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-white/40">{formatNum(totals.mainRecipeCost)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-white/40">{formatNum(totals.sideCost)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-white/40">{formatNum(totals.consumables)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-white/40">{formatNum(totals.packing)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-sys-primary/60">{formatNum(totals.direct)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-sys-primary/30 italic">{(totals.directRatio * 100).toFixed(1)}%</td>
                                    <td className="p-2 border-l border-white/5 text-center text-sys-success/60">{formatNum(totals.price - totals.direct)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-sys-warning/40">{formatNum(totals.indirect)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-white/40">{formatNum(totals.totalFullCost)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-sys-success/60">{formatNum(totals.net)}</td>
                                    <td className="p-2 border-l border-white/5 text-center text-white/20">{(totals.price > 0 ? (totals.totalFullCost / totals.price) * 100 : 0).toFixed(1)}%</td>
                                    <td className="p-2 text-center text-sys-success/70">{(totals.netRatio * 100).toFixed(1)}%</td>
                                </tr>
                             ))}
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};
