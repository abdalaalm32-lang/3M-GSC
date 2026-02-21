
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    BarChart3, TrendingUp, TrendingDown, HelpCircle, 
    Star, Target, Zap, AlertTriangle, Search, 
    Calendar, RefreshCw, Printer, Download, Filter,
    Building2, Info, ChevronDown, FileSpreadsheet, FileText, X, Loader2,
    Check, FilterX, MousePointerClick, SlidersHorizontal, ArrowRight,
    Activity
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

interface Recipe {
    menuItemId: string;
    ingredients: { stockItemId: string; qty: number }[];
}

interface StockItem {
    id: string;
    name: string;
    avgCost: number;
    standardCost: number;
    conversionFactor: number;
}

interface SaleRecord {
    items: { itemId: string; qty: number }[];
    status: string;
    date: string;
    branchId?: string;
}

interface Branch {
    id: string;
    name: string;
}

export const MenuEngineeringPage: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const filterMenuRef = useRef<HTMLDivElement>(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    
    // Filters State
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMatrixCategory, setFilterMatrixCategory] = useState<string | null>(null);
    const [filterMenuCategory, setFilterMenuCategory] = useState<string | null>(null);

    useEffect(() => {
        loadData();
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setIsFilterMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadData = () => {
        setIsLoading(true);
        try {
            const m = localStorage.getItem('gsc_pos_items');
            if (m) setMenuItems(JSON.parse(m));
            const s = localStorage.getItem('gsc_pos_sales');
            if (s) setSales(JSON.parse(s));
            const r = localStorage.getItem('gsc_recipes');
            if (r) setRecipes(JSON.parse(r));
            const st = localStorage.getItem('gsc_items');
            if (st) setStockItems(JSON.parse(st));
            const b = localStorage.getItem('gsc_branches');
            if (b) setBranches(JSON.parse(b));
        } catch (e) {
            console.error(e);
        }
        setTimeout(() => setIsLoading(false), 500);
    };

    const categoriesList = useMemo(() => {
        const cats = new Set(menuItems.map(i => i.category));
        return Array.from(cats);
    }, [menuItems]);

    // --- Calculation Logic ---
    const analysisData = useMemo(() => {
        const salesMap: Record<string, number> = {};
        
        sales.forEach(sale => {
            const dateMatch = sale.date >= startDate && sale.date <= endDate;
            const branchMatch = selectedBranchId === 'all' || sale.branchId === selectedBranchId;
            
            if (sale.status === 'مكتمل' && dateMatch && branchMatch) {
                sale.items.forEach(item => {
                    salesMap[item.itemId] = (salesMap[item.itemId] || 0) + item.qty;
                });
            }
        });

        const totalQtySold = Object.values(salesMap).reduce((a, b) => a + b, 0);
        const avgPopularity = menuItems.length > 0 ? (totalQtySold / menuItems.length) * 0.7 : 0;

        const itemsWithStats = menuItems.map(item => {
            const qtySold = salesMap[item.id] || 0;
            const recipe = recipes.find(r => r.menuItemId === item.id);
            
            let cost = 0;
            if (recipe) {
                cost = recipe.ingredients.reduce((acc, ing) => {
                    const si = stockItems.find(s => s.id === ing.stockItemId);
                    if (!si) return acc;
                    const c = si.avgCost || si.standardCost || 0;
                    const factor = si.conversionFactor || 1;
                    return acc + ((ing.qty / factor) * c);
                }, 0);
            }

            const margin = item.price - cost;
            const totalContribution = margin * qtySold;

            return {
                ...item,
                qtySold,
                cost,
                margin,
                totalContribution,
                popularity: qtySold > 0 ? (qtySold / totalQtySold) * 100 : 0
            };
        });

        const avgMargin = itemsWithStats.length > 0 
            ? itemsWithStats.reduce((a, b) => a + b.margin, 0) / itemsWithStats.length 
            : 0;

        let processed = itemsWithStats.map(item => {
            const isHighProfit = item.margin >= avgMargin;
            const isHighPopularity = item.qtySold >= avgPopularity;

            let category: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog';
            let colorClass: string;
            let icon: any;
            let label: string;

            if (isHighProfit && isHighPopularity) {
                category = 'Star';
                colorClass = 'text-sys-success bg-sys-success/10 border-sys-success/20';
                icon = Star;
                label = 'نجم (Star)';
            } else if (!isHighProfit && isHighPopularity) {
                category = 'Plowhorse';
                colorClass = 'text-sys-primary bg-sys-primary/10 border-sys-primary/20';
                icon = Zap;
                label = 'فرس رهان (Plowhorse)';
            } else if (isHighProfit && !isHighPopularity) {
                category = 'Puzzle';
                colorClass = 'text-sys-warning bg-sys-warning/10 border-sys-warning/20';
                icon = HelpCircle;
                label = 'لغز (Puzzle)';
            } else {
                category = 'Dog';
                colorClass = 'text-sys-danger bg-sys-danger/10 border-sys-danger/20';
                icon = AlertTriangle;
                label = 'ضعيف (Dog)';
            }

            return { ...item, category, colorClass, icon, label, avgMargin, avgPopularity };
        });

        if (searchQuery) {
            processed = processed.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        if (filterMatrixCategory) {
            processed = processed.filter(i => i.category === filterMatrixCategory);
        }
        if (filterMenuCategory) {
            processed = processed.filter(i => i.category === filterMenuCategory);
        }

        return processed.sort((a, b) => b.totalContribution - a.totalContribution);

    }, [menuItems, sales, recipes, stockItems, searchQuery, filterMatrixCategory, filterMenuCategory, startDate, endDate, selectedBranchId]);

    const summary = useMemo(() => {
        return {
            stars: analysisData.filter(i => i.category === 'Star').length,
            plowhorses: analysisData.filter(i => i.category === 'Plowhorse').length,
            puzzles: analysisData.filter(i => i.category === 'Puzzle').length,
            dogs: analysisData.filter(i => i.category === 'Dog').length,
            totalContribution: analysisData.reduce((a, b) => a + b.totalContribution, 0)
        };
    }, [analysisData]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) return;

        const branchName = selectedBranchId === 'all' ? 'كافة الفروع' : branches.find(b => b.id === selectedBranchId)?.name;

        const html = `
            <html dir="rtl" lang="ar">
            <head>
                <title>تقرير هندسة القائمة - 3M GSC</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #fff; color: #000; }
                    .header { text-align: center; border-bottom: 2px solid #3B82F6; padding-bottom: 15px; margin-bottom: 30px; }
                    .header h1 { margin: 0; color: #1e1e1e; font-size: 28px; }
                    .header p { margin: 5px 0; color: #666; font-size: 14px; }
                    .summary-grid { display: grid; grid-template-cols: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
                    .summary-card { border: 1px solid #ddd; padding: 15px; text-align: center; border-radius: 10px; background: #f9f9f9; }
                    .summary-card b { display: block; font-size: 20px; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    .badge { padding: 4px 8px; border-radius: 99px; font-size: 10px; font-weight: bold; }
                    @media print { @page { size: A4 landscape; margin: 10mm; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>3M GSC - GLOBAL SYSTEM COST</h1>
                    <h2>تقرير تحليل هندسة القائمة (Strategic Menu Matrix)</h2>
                    <p>الموقع: ${branchName} | الفترة: من ${startDate} إلى ${endDate}</p>
                </div>
                <div class="summary-grid">
                    <div class="summary-card">نجوم (Stars) <b>${summary.stars}</b></div>
                    <div class="summary-card">فرس رهان (Plowhorses) <b>${summary.plowhorses}</b></div>
                    <div class="summary-card">ألغاز (Puzzles) <b>${summary.puzzles}</b></div>
                    <div class="summary-card">ضعيف (Dogs) <b>${summary.dogs}</b></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>التصنيف</th>
                            <th>اسم الصنف</th>
                            <th>الكمية المباعة</th>
                            <th>السعر</th>
                            <th>هامش الربح</th>
                            <th>المساهمة الإجمالية</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analysisData.map(item => `
                            <tr>
                                <td>${item.label}</td>
                                <td>${item.name}</td>
                                <td style="text-align:center">${item.qtySold}</td>
                                <td style="text-align:center">${item.price.toFixed(2)}</td>
                                <td style="text-align:center">${item.margin.toFixed(2)}</td>
                                <td style="text-align:center; font-weight:bold">${item.totalContribution.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; font-size: 10px; text-align: center; color: #999;">
                    طُبع بواسطة نظام 3M GSC - تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}
                </div>
                <script>window.onload = () => { window.print(); window.close(); }</script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleExportExcel = () => {
        setIsExportMenuOpen(false);
        if (analysisData.length === 0) return alert('لا توجد بيانات لتصديرها');
        const exportRows = analysisData.map(item => ({
            'كود الصنف': item.id,
            'اسم الصنف': item.name,
            'الفئة': item.category,
            'الكمية المباعة': item.qtySold,
            'سعر البيع': item.price,
            'التكلفة التقديرية': item.cost.toFixed(2),
            'هامش الربح': item.margin.toFixed(2),
            'إجمالي المساهمة': item.totalContribution.toFixed(2),
            'الشعبية %': item.popularity.toFixed(1) + '%',
            'التصنيف التحليلي': item.label
        }));
        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Menu Analysis");
        if(!ws['!views']) ws['!views'] = [];
        ws['!views'].push({RTL: true});
        XLSX.writeFile(wb, `Menu_Engineering_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPdf = async () => {
        setIsExportMenuOpen(false);
        setIsExportingPdf(true);
        try {
            const container = document.createElement('div');
            container.style.position = 'absolute'; container.style.left = '-9999px'; container.style.width = '1000pt';
            container.style.padding = '30pt'; container.style.background = 'white'; container.style.color = 'black';
            container.style.direction = 'rtl'; container.style.fontFamily = 'Arial, sans-serif';
            const headerHtml = `<div style="text-align: center; border-bottom: 2pt solid #3B82F6; padding-bottom: 15px; margin-bottom: 25px;"><h1>3M GSC</h1><h2>تقرير هندسة القائمة</h2></div>`;
            let tableRows = analysisData.map(item => `<tr><td>${item.label}</td><td>${item.name}</td><td style="text-align:center">${item.qtySold}</td><td style="text-align:center">${item.price.toFixed(2)}</td><td style="text-align:center">${item.margin.toFixed(2)}</td><td style="text-align:center">${item.totalContribution.toLocaleString()}</td></tr>`).join('');
            const tableHtml = `<table style="width: 100%; border-collapse: collapse;"><thead><tr style="background-color: #f8f9fa;"><th>التصنيف</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الهامش</th><th>المساهمة</th></tr></thead><tbody>${tableRows}</tbody></table>`;
            container.innerHTML = headerHtml + tableHtml;
            document.body.appendChild(container);
            const canvas = await html2canvas(container, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
            doc.addImage(imgData, 'PNG', 20, 40, doc.internal.pageSize.getWidth() - 40, (canvas.height * (doc.internal.pageSize.getWidth() - 40)) / canvas.width);
            doc.save(`Menu_Engineering_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.removeChild(container);
        } catch (err) { alert("خطأ في التصدير"); } finally { setIsExportingPdf(false); }
    };

    const resetFilters = () => {
        setSearchQuery('');
        setFilterMatrixCategory(null);
        setFilterMenuCategory(null);
        setIsFilterMenuOpen(false);
    };

    return (
        <div className="flex flex-col h-full gap-6 font-sans" dir="rtl">
            {/* Loading Overlay */}
            {isExportingPdf && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-sys-surface p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-4 shadow-2xl">
                        <Loader2 className="text-sys-primary animate-spin" size={48} />
                        <p className="text-white font-bold animate-pulse">جاري تحضير ملف الـ PDF...</p>
                    </div>
                </div>
            )}

            {/* Header / Filter Bar */}
            <div className="bg-sys-surface border border-white/10 p-6 rounded-3xl shadow-2xl no-print relative overflow-visible">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sys-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-sys-primary/10 rounded-2xl text-sys-primary shadow-lg shadow-blue-900/10">
                            <BarChart3 size={32} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">Menu Engineering BI</h2>
                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                                <Activity size={12} className="text-sys-success" /> Strategic Menu Matrix Analyzer
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-black/20 p-2 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex items-center gap-2 px-3 border-l border-white/10">
                            <Building2 size={16} className="text-sys-warning" />
                            <select 
                                value={selectedBranchId} 
                                onChange={e => setSelectedBranchId(e.target.value)}
                                className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer pr-4"
                            >
                                <option value="all">كافة الفروع</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 px-3 border-l border-white/10">
                            <Calendar size={16} className="text-sys-success" />
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="bg-transparent text-xs text-white font-bold outline-none"
                            />
                            <span className="text-white/20 px-1">إلى</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="bg-transparent text-xs text-white font-bold outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={loadData} className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /></button>
                            <button onClick={handlePrint} className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all"><Printer size={18} /></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative" ref={filterMenuRef}>
                            <button 
                                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black border transition-all ${isFilterMenuOpen || filterMatrixCategory || filterMenuCategory ? 'bg-sys-warning text-black border-sys-warning' : 'bg-white/5 text-white/60 border-white/10'}`}
                            >
                                <SlidersHorizontal size={18} />
                                <span className="text-xs">فلترة التحليل</span>
                            </button>
                            {isFilterMenuOpen && (
                                <div className="absolute right-0 lg:left-0 mt-3 w-72 bg-[#1c1c1c]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-[100] p-5 animate-in zoom-in-95 duration-200">
                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <label className="text-[9px] text-white/40 font-black uppercase tracking-widest block px-1">تصنيف المصفوفة</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {['Star', 'Plowhorse', 'Puzzle', 'Dog'].map(cat => (
                                                    <button 
                                                        key={cat}
                                                        onClick={() => setFilterMatrixCategory(filterMatrixCategory === cat ? null : cat)}
                                                        className={`px-2 py-2 rounded-lg text-[10px] font-black border transition-all ${filterMatrixCategory === cat ? 'bg-sys-primary border-sys-primary text-white' : 'bg-white/5 border-white/5 text-white/30 hover:border-white/20'}`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] text-white/40 font-black uppercase tracking-widest block px-1">فئة المنيو</label>
                                            <select 
                                                value={filterMenuCategory || ''}
                                                onChange={e => setFilterMenuCategory(e.target.value || null)}
                                                className="w-full bg-[#121212] border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-sys-primary outline-none"
                                            >
                                                <option value="">الكل</option>
                                                {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={resetFilters} className="flex-1 py-2 text-[10px] font-black text-sys-danger bg-sys-danger/10 rounded-lg">إعادة تعيين</button>
                                            <button onClick={() => setIsFilterMenuOpen(false)} className="flex-1 py-2 text-[10px] font-black text-white bg-sys-primary rounded-lg">تطبيق</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="relative" ref={exportMenuRef}>
                            <button 
                                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                                className="bg-sys-primary hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                            >
                                <Download size={18} /> <span className="text-xs">تصدير</span>
                            </button>
                            {isExportMenuOpen && (
                                <div className="absolute right-0 mt-3 w-48 bg-[#1c1c1c] border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in duration-150">
                                    <button onClick={handleExportExcel} className="w-full flex items-center justify-between p-4 text-xs font-bold text-white/70 hover:bg-sys-success/10 hover:text-sys-success transition-all border-b border-white/5">
                                        <span>ملف Excel</span>
                                        <FileSpreadsheet size={16} />
                                    </button>
                                    <button onClick={handleExportPdf} className="w-full flex items-center justify-between p-4 text-xs font-bold text-white/70 hover:bg-sys-danger/10 hover:text-sys-danger transition-all">
                                        <span>ملف PDF</span>
                                        <FileText size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quadrant Visual Map */}
                <div className="lg:col-span-1 bg-sys-surface border border-white/10 rounded-3xl p-8 shadow-2xl no-print flex flex-col h-full min-h-[480px]">
                    <div className="flex justify-between items-center mb-8">
                         <h3 className="text-xs font-black text-white/40 uppercase tracking-widest flex items-center gap-2"><Star size={14} className="text-sys-primary" /> Strategic Matrix</h3>
                         <Info size={14} className="text-white/20" />
                    </div>
                    <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 relative border-2 border-white/5 rounded-2xl p-4 bg-black/20 shadow-inner">
                         <div className="absolute -left-12 top-1/2 -rotate-90 text-[10px] font-black text-white/10 uppercase tracking-[0.5em] pointer-events-none">Profitability</div>
                         <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-white/10 uppercase tracking-[0.5em] pointer-events-none">Popularity</div>

                         <div onClick={() => setFilterMatrixCategory(filterMatrixCategory === 'Puzzle' ? null : 'Puzzle')} className={`border rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer p-2 text-center group ${filterMatrixCategory === 'Puzzle' ? 'bg-sys-warning border-sys-warning ring-4 ring-sys-warning/20' : 'bg-sys-warning/5 border-white/5 hover:bg-sys-warning/10'}`}>
                            <HelpCircle size={32} className={`transition-transform ${filterMatrixCategory === 'Puzzle' ? 'text-black scale-110' : 'text-sys-warning/40'}`} />
                            <span className={`text-[10px] font-black mt-3 uppercase tracking-widest ${filterMatrixCategory === 'Puzzle' ? 'text-black' : 'text-sys-warning'}`}>Puzzles</span>
                            <span className={`text-[18px] font-black mt-1 ${filterMatrixCategory === 'Puzzle' ? 'text-black' : 'text-white'}`}>{summary.puzzles}</span>
                         </div>
                         
                         <div onClick={() => setFilterMatrixCategory(filterMatrixCategory === 'Star' ? null : 'Star')} className={`border rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer p-2 text-center group ${filterMatrixCategory === 'Star' ? 'bg-sys-success border-sys-success ring-4 ring-sys-success/20' : 'bg-sys-success/5 border-white/5 hover:bg-sys-success/10'}`}>
                            <Star size={32} className={`transition-transform ${filterMatrixCategory === 'Star' ? 'text-black scale-110' : 'text-sys-success/60'}`} />
                            <span className={`text-[10px] font-black mt-3 uppercase tracking-widest ${filterMatrixCategory === 'Star' ? 'text-black' : 'text-sys-success'}`}>Stars</span>
                            <span className={`text-[18px] font-black mt-1 ${filterMatrixCategory === 'Star' ? 'text-black' : 'text-white'}`}>{summary.stars}</span>
                         </div>

                         <div onClick={() => setFilterMatrixCategory(filterMatrixCategory === 'Dog' ? null : 'Dog')} className={`border rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer p-2 text-center group ${filterMatrixCategory === 'Dog' ? 'bg-sys-danger border-sys-danger ring-4 ring-sys-danger/20' : 'bg-sys-danger/5 border-white/5 hover:bg-sys-danger/10'}`}>
                            <AlertTriangle size={32} className={`transition-transform ${filterMatrixCategory === 'Dog' ? 'text-black scale-110' : 'text-sys-danger/40'}`} />
                            <span className={`text-[10px] font-black mt-3 uppercase tracking-widest ${filterMatrixCategory === 'Dog' ? 'text-black' : 'text-sys-danger'}`}>Dogs</span>
                            <span className={`text-[18px] font-black mt-1 ${filterMatrixCategory === 'Dog' ? 'text-black' : 'text-white'}`}>{summary.dogs}</span>
                         </div>

                         <div onClick={() => setFilterMatrixCategory(filterMatrixCategory === 'Plowhorse' ? null : 'Plowhorse')} className={`border rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer p-2 text-center group ${filterMatrixCategory === 'Plowhorse' ? 'bg-sys-primary border-sys-primary ring-4 ring-sys-primary/20' : 'bg-sys-primary/5 border-white/5 hover:bg-sys-primary/10'}`}>
                            <Zap size={32} className={`transition-transform ${filterMatrixCategory === 'Plowhorse' ? 'text-black scale-110' : 'text-sys-primary/40'}`} />
                            <span className={`text-[10px] font-black mt-3 uppercase tracking-widest ${filterMatrixCategory === 'Plowhorse' ? 'text-black' : 'text-sys-primary'}`}>Plowhorses</span>
                            <span className={`text-[18px] font-black mt-1 ${filterMatrixCategory === 'Plowhorse' ? 'text-black' : 'text-white'}`}>{summary.plowhorses}</span>
                         </div>
                    </div>
                </div>

                {/* Main Table */}
                <div className="lg:col-span-2 bg-sys-surface border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-5 border-b border-white/10 bg-white/[0.02] flex justify-between items-center no-print">
                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-sys-primary transition-colors" />
                                <input 
                                    type="text" 
                                    placeholder="بحث سريع بالأصناف..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="bg-sys-bg border border-white/10 rounded-xl py-2.5 pr-10 pl-4 text-xs text-white focus:border-sys-primary outline-none w-64 shadow-inner" 
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar relative">
                         <table className="w-full text-right text-[11px] border-separate border-spacing-0">
                            <thead className="bg-[#1a1a1a] text-white/40 font-black sticky top-0 z-10 uppercase tracking-tighter shadow-md">
                                <tr>
                                    <th className="p-5 border-b border-white/5">التحليل الإستراتيجي</th>
                                    <th className="p-5 border-b border-white/5">اسم الصنف</th>
                                    <th className="p-5 border-b border-white/5 text-center">الكمية</th>
                                    <th className="p-5 border-b border-white/5 text-center">السعر</th>
                                    <th className="p-5 border-b border-white/5 text-center">هامش الربح</th>
                                    <th className="p-5 border-b border-white/5 text-center font-black bg-sys-primary/5 text-sys-primary">المساهمة الإجمالية</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {analysisData.map((item, idx) => (
                                    <tr key={idx} className={`hover:bg-white/[0.02] transition-colors group ${item.category === 'Dog' ? 'bg-sys-danger/[0.01]' : ''}`}>
                                        <td className="p-5">
                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black w-fit shadow-sm ${item.colorClass}`}>
                                                <item.icon size={12} />
                                                {item.label}
                                            </div>
                                        </td>
                                        <td className="p-5 font-bold text-white group-hover:text-sys-primary transition-colors text-sm">
                                            {item.name}
                                            <div className="text-[9px] text-white/20 font-normal mt-1 uppercase">{item.category}</div>
                                        </td>
                                        <td className="p-5 text-center font-black text-white/60 text-sm">{item.qtySold}</td>
                                        <td className="p-5 text-center font-bold text-white/40">{item.price.toFixed(2)}</td>
                                        <td className={`p-5 text-center font-black text-sm ${item.margin > item.avgMargin ? 'text-sys-success' : 'text-sys-danger'}`}>
                                            {item.margin.toFixed(2)}
                                        </td>
                                        <td className="p-5 text-center font-black bg-sys-primary/[0.02] text-white text-sm">
                                            {item.totalContribution.toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                         </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
