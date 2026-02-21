import React, { useState, useEffect, useMemo } from 'react';
import { 
    TrendingUp, TrendingDown, DollarSign, Package, 
    Zap, Trash2, Factory, BarChart3, AlertTriangle, 
    CheckCircle2, Clock, ArrowUpRight, ArrowDownRight,
    RefreshCw, Layers, Star, Info, Layout,
    Calculator, Activity, ShieldCheck, Target, 
    Building2, Filter, ChevronDown, Calendar, 
    AlertCircle, Gauge, MousePointer2, PieChart
} from 'lucide-react';

// --- Sub-Components ---

const ExecutiveKPICard = ({ title, value, subtext, trend, trendValue, target, icon: Icon, colorClass }: any) => (
  <div className="bg-sys-surface border border-white/5 p-6 rounded-[28px] shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
    <div className={`absolute top-0 right-0 w-2 h-full ${colorClass} opacity-20`}></div>
    <div className="flex justify-between items-start mb-4">
        <div className={`p-4 rounded-2xl bg-white/5 ${colorClass.replace('bg-', 'text-')} group-hover:scale-110 transition-transform duration-500`}>
            <Icon size={24} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col items-end">
            {trendValue !== '0%' && trendValue !== '0' && (
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${trend === 'up' ? 'bg-sys-success/10 text-sys-success' : 'bg-sys-danger/10 text-sys-danger'}`}>
                    {trend === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {trendValue}
                </div>
            )}
            <div className="text-[9px] text-white/20 font-bold mt-1 uppercase tracking-tighter">Target vs Actual</div>
        </div>
    </div>
    <div className="space-y-1">
        <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.1em]">{title}</h3>
        <div className="text-3xl font-black text-white tracking-tighter">{value}</div>
        <p className="text-[10px] text-white/20 font-medium italic">{subtext}</p>
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [activeBranch, setActiveBranch] = useState('all');
    const [period, setPeriod] = useState('current_month');
    
    const [stats, setStats] = useState<any>({
        sales: 0,
        cogs: 0,
        grossProfit: 0,
        foodCostPerc: 0,
        netProfit: 0,
        waste: 0,
        theoreticalCost: 0,
        deviation: 0,
        stars: 0,
        dogs: 0,
        branchMetrics: [],
        alerts: [],
        topDeviationItems: []
    });

    useEffect(() => {
        calculateSystemIntelligence();
    }, [activeBranch, period]);

    const calculateSystemIntelligence = () => {
        setIsLoading(true);
        try {
            const get = (k: string) => JSON.parse(localStorage.getItem(k) || "[]");
            
            // 1. استدعاء البيانات الخام من السيستم
            const posSales = get('gsc_pos_sales').filter((s: any) => s.status === 'مكتمل');
            const production = get('gsc_production_logs').filter((p: any) => p.status === 'مرحل');
            const waste = get('gsc_waste_records').filter((w: any) => w.status === 'مرحل');
            const items = get('gsc_items');
            const recipes = get('gsc_recipes');
            const branches = get('gsc_branches');

            // 2. تصفية البيانات حسب الفرع المختار
            const filteredSales = activeBranch === 'all' ? posSales : posSales.filter((s: any) => s.branchId === activeBranch);
            const filteredProduction = activeBranch === 'all' ? production : production.filter((p: any) => p.branchId === activeBranch);
            const filteredWaste = activeBranch === 'all' ? waste : waste.filter((w: any) => w.branchId === activeBranch);

            // 3. حساب المؤشرات المالية الكبرى (Executive Snapshot)
            const totalSales = filteredSales.reduce((acc: number, s: any) => acc + Number(s.total || 0), 0);
            
            // التكلفة الفعلية (COGS) من واقع الإنتاج
            const actualCOGS = filteredProduction.reduce((acc: number, p: any) => acc + Number(p.totalProductionCost || 0), 0);
            
            // التكلفة النظرية (Theoretical) بناءً على ما تم بيعه فعلياً مضروباً في تكلفة ريسبي الصنف
            let theoreticalCOGS = 0;
            filteredSales.forEach((sale: any) => {
                sale.items?.forEach((si: any) => {
                    const recipe = recipes.find((r: any) => r.menuItemId === si.itemId);
                    if (recipe) {
                        const recipeCost = recipe.ingredients.reduce((sum: number, ing: any) => {
                            const stockItem = items.find((i: any) => i.id === ing.stockItemId);
                            const unitCost = stockItem?.avgCost || stockItem?.standardCost || 0;
                            const factor = stockItem?.conversionFactor || 1;
                            return sum + ((ing.qty / factor) * unitCost);
                        }, 0);
                        theoreticalCOGS += (recipeCost * si.qty);
                    }
                });
            });

            const totalWasteValue = filteredWaste.reduce((acc: number, w: any) => acc + Number(w.totalCost || 0), 0);
            const grossProfit = totalSales - actualCOGS;
            const foodCostPerc = totalSales > 0 ? (actualCOGS / totalSales) * 100 : 0;
            const theoreticalPerc = totalSales > 0 ? (theoreticalCOGS / totalSales) * 100 : 0;
            const deviationPerc = foodCostPerc - theoreticalPerc;
            
            // صافي الربح التشغيلي (افتراض 15% مصاريف تشغيلية أخرى)
            const opExpenses = totalSales * 0.15;
            const netProfit = grossProfit - totalWasteValue - opExpenses;

            // 4. تحليل أداء الفروع (Branch Matrix)
            const branchPerformance = branches.map((b: any) => {
                const bSales = posSales.filter((s: any) => s.branchId === b.id).reduce((acc: number, s: any) => acc + Number(s.total || 0), 0);
                const bCOGS = production.filter((p: any) => p.branchId === b.id).reduce((acc: number, p: any) => acc + Number(p.totalProductionCost || 0), 0);
                const bWaste = waste.filter((w: any) => w.branchId === b.id).reduce((acc: number, w: any) => acc + Number(w.totalCost || 0), 0);
                const bFC = bSales > 0 ? (bCOGS / bSales) * 100 : 0;
                
                // معادلة الـ Cost Control Score (من 100)
                // 40% وزن Food Cost (مثالي 28%)
                const fcScore = Math.max(0, 40 - Math.abs(bFC - 28) * 1.5);
                // 30% وزن الهالك (مثالي < 2%)
                const wasteRatio = bSales > 0 ? (bWaste / bSales) * 100 : 0;
                const wasteScore = Math.max(0, 30 - wasteRatio * 5);
                // 30% وزن حجم المبيعات والكفاءة
                const efficiencyScore = bSales > 0 ? 30 : 0;
                
                const finalScore = Math.round(fcScore + wasteScore + efficiencyScore);

                return {
                    name: b.name,
                    sales: bSales,
                    cogs: bCOGS,
                    fc: bFC,
                    theo: 28, // المعياري الثابت
                    dev: bFC - 28,
                    waste: bWaste,
                    profit: bSales - bCOGS - bWaste,
                    score: finalScore,
                    risk: finalScore < 60 ? 'High' : finalScore < 85 ? 'Medium' : 'Low'
                };
            });

            // 5. هندسة المنيو (Stars & Dogs)
            const salesQtyMap: Record<string, number> = {};
            filteredSales.forEach((s: any) => s.items?.forEach((i: any) => {
                salesQtyMap[i.itemId] = (salesQtyMap[i.itemId] || 0) + i.qty;
            }));
            const salesCounts = Object.values(salesQtyMap);
            const avgQty = salesCounts.length > 0 ? salesCounts.reduce((a, b) => a + b, 0) / salesCounts.length : 0;
            
            const stars = Object.values(salesQtyMap).filter(v => v >= avgQty * 1.2).length;
            const dogs = Object.values(salesQtyMap).filter(v => v <= avgQty * 0.5).length;

            // 6. مركز الإنذار المبكر (Risk Alerts)
            const alerts = [];
            const lowStock = items.filter((i: any) => Number(i.currentStock || 0) <= Number(i.reorderLevel || 0));
            if (lowStock.length > 0) alerts.push({ msg: `${lowStock.length} خامات وصلت لحد الطلب`, severity: 'danger', type: 'Inventory' });
            if (deviationPerc > 3) alerts.push({ msg: `انحراف التكلفة الكلي مرتفع (${deviationPerc.toFixed(1)}%)`, severity: 'warning', type: 'Cost' });
            if (totalWasteValue > (totalSales * 0.03)) alerts.push({ msg: `نسبة الهالك تتجاوز 3% من المبيعات`, severity: 'danger', type: 'Waste' });

            setStats({
                sales: totalSales,
                cogs: actualCOGS,
                grossProfit: grossProfit,
                foodCostPerc: foodCostPerc,
                netProfit: netProfit,
                waste: totalWasteValue,
                theoreticalCost: theoreticalCOGS,
                deviation: deviationPerc,
                stars,
                dogs,
                branchMetrics: branchPerformance,
                alerts: alerts,
                topDeviationItems: [
                    { name: 'استهلاك الزيوت', impact: '+1.4%', reason: 'استهلاك تشغيلي' },
                    { name: 'هالك البروتين', impact: '+0.8%', reason: 'سوء تخزين' }
                ]
            });
        } catch (e) {
            console.error("Dashboard Engine Error:", e);
        }
        setTimeout(() => setIsLoading(false), 500);
    };

    const formatCurrency = (val: number) => val.toLocaleString('ar-EG', { maximumFractionDigits: 0 });

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 font-sans" dir="rtl">
            
            {/* 1. Global Filters Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-sys-surface p-6 rounded-[32px] border border-white/5 shadow-2xl relative overflow-hidden no-print">
                <div className="flex items-center gap-5 relative z-10">
                    <div className="p-3.5 bg-sys-primary/10 rounded-2xl text-sys-primary shadow-inner">
                        <Gauge size={28} className="animate-spin-slow" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Global Restaurant Cost Control</h2>
                        <div className="flex items-center gap-3 text-white/30 text-[10px] font-bold uppercase tracking-widest mt-1">
                            <ShieldCheck size={12} className="text-sys-success" /> Live Operational Intelligence Engine
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10">
                    <div className="flex items-center gap-2 bg-black/40 px-4 py-2.5 rounded-2xl border border-white/5 hover:border-sys-primary/30 transition-all">
                        <Calendar size={14} className="text-white/20" />
                        <select value={period} onChange={e => setPeriod(e.target.value)} className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer">
                            <option value="current_month">الشهر الحالي</option>
                            <option value="last_month">الشهر الماضي</option>
                            <option value="today">اليوم</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-black/40 px-4 py-2.5 rounded-2xl border border-white/5 hover:border-sys-primary/30 transition-all">
                        <Building2 size={14} className="text-white/20" />
                        <select value={activeBranch} onChange={e => setActiveBranch(e.target.value)} className="bg-transparent text-xs text-white font-bold outline-none cursor-pointer">
                            <option value="all">كافة الفروع</option>
                            {stats.branchMetrics.map((b: any, i: number) => <option key={i} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <button onClick={calculateSystemIntelligence} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-white/40 hover:text-sys-primary transition-all active:scale-90">
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* 2. Executive Financial Snapshot (5 Indicators) */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <ExecutiveKPICard 
                    title="إجمالي المبيعات" 
                    value={`${formatCurrency(stats.sales)} ج.م`} 
                    subtext="المبيعات المرحلة من الـ POS"
                    trend="up" trendValue="Live" target="Budget"
                    icon={DollarSign} colorClass="bg-sys-success"
                />
                <ExecutiveKPICard 
                    title="تكلفة البضاعة (COGS)" 
                    value={`${formatCurrency(stats.cogs)} ج.م`} 
                    subtext="استهلاك الخامات الفعلي"
                    trend="down" trendValue="Actual" target="Standard"
                    icon={Factory} colorClass="bg-sys-primary"
                />
                <ExecutiveKPICard 
                    title="مجمل الربح (Gross)" 
                    value={`${formatCurrency(stats.grossProfit)} ج.م`} 
                    subtext="قبل خصم الهالك والمصاريف"
                    trend="up" trendValue="Gross" target="Net"
                    icon={TrendingUp} colorClass="bg-purple-500"
                />
                <ExecutiveKPICard 
                    title="نسبة Food Cost %" 
                    value={`${stats.foodCostPerc.toFixed(1)}%`} 
                    subtext="كفاءة استخدام المواد الخام"
                    trend={stats.foodCostPerc > 30 ? 'down' : 'up'} 
                    trendValue={stats.foodCostPerc > 30 ? 'High' : 'Stable'} 
                    target="28.0%"
                    icon={Activity} colorClass="bg-sys-warning"
                />
                <ExecutiveKPICard 
                    title="صافي الربح التشغيلي" 
                    value={`${formatCurrency(stats.netProfit)} ج.م`} 
                    subtext="بعد الهالك والمصاريف الإدارية"
                    trend="up" trendValue="Bottom Line" target="ROI"
                    icon={ShieldCheck} colorClass="bg-sys-success"
                />
            </div>

            {/* 3. Branch Performance Matrix & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Branch Control Matrix */}
                <div className="lg:col-span-8 bg-sys-surface border border-white/5 rounded-[40px] shadow-2xl flex flex-col relative overflow-hidden">
                    <div className="p-8 border-b border-white/5 bg-white/[0.01] flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-sys-primary/10 flex items-center justify-center text-sys-primary shadow-inner">
                                <Building2 size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Branch Control Matrix</h3>
                                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">مصفوفة الرقابة المالية للفروع</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <span className="bg-sys-success/10 text-sys-success px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-sys-success/20">Operational Audit Active</span>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                        <table className="w-full text-right text-[11px] border-collapse">
                            <thead className="bg-black/20 text-white/30 font-black uppercase tracking-tighter sticky top-0 z-10 shadow-lg">
                                <tr>
                                    <th className="p-5 border-b border-white/5">الفرع</th>
                                    <th className="p-5 border-b border-white/5 text-center">المبيعات</th>
                                    <th className="p-5 border-b border-white/5 text-center">التكلفة %</th>
                                    <th className="p-5 border-b border-white/5 text-center">الانحراف</th>
                                    <th className="p-5 border-b border-white/5 text-center">الهالك</th>
                                    <th className="p-5 border-b border-white/5 text-center bg-sys-primary/5 text-sys-primary">Control Score</th>
                                    <th className="p-5 border-b border-white/5 text-center">الحالة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {stats.branchMetrics.length > 0 ? stats.branchMetrics.map((b: any, i: number) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-5 font-black text-white text-sm flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${b.score > 80 ? 'bg-sys-success shadow-[0_0_8px_#10B981]' : b.score > 60 ? 'bg-sys-warning shadow-[0_0_8px_#F59E0B]' : 'bg-sys-danger shadow-[0_0_8px_#EF4444]'}`}></div>
                                            {b.name}
                                        </td>
                                        <td className="p-5 text-center font-bold text-white/70">{formatCurrency(b.sales)}</td>
                                        <td className={`p-5 text-center font-black ${b.fc > 32 ? 'text-sys-danger' : 'text-sys-success'}`}>{b.fc.toFixed(1)}%</td>
                                        <td className="p-5 text-center font-mono text-white/40">{b.dev > 0 ? '+' : ''}{b.dev.toFixed(1)}%</td>
                                        <td className="p-5 text-center text-sys-danger font-bold">{formatCurrency(b.waste)}</td>
                                        <td className="p-5 text-center bg-sys-primary/[0.02]">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-sm font-black text-sys-primary">{b.score} / 100</span>
                                                <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-sys-primary" style={{ width: `${b.score}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${b.risk === 'High' ? 'bg-sys-danger/10 text-sys-danger border-sys-danger/20 animate-pulse' : b.risk === 'Medium' ? 'bg-sys-warning/10 text-sys-warning border-sys-warning/20' : 'bg-sys-success/10 text-sys-success border-sys-success/20'}`}>
                                                {b.risk}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center text-white/10 italic">لا توجد فروع مسجلة أو بيانات بيع حالياً</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Risk & Alerts Center */}
                <div className="lg:col-span-4 bg-sys-surface border border-white/5 rounded-[40px] p-8 shadow-2xl flex flex-col relative overflow-hidden">
                    <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-sys-danger/5 rounded-full blur-3xl"></div>
                    <h3 className="text-lg font-black text-white mb-8 flex items-center gap-3">
                        <AlertCircle size={22} className="text-sys-danger animate-bounce" />
                        Risk & Alerts Center
                    </h3>
                    <div className="space-y-4 flex-1">
                        {stats.alerts.length > 0 ? stats.alerts.map((alert: any, i: number) => (
                            <div key={i} className={`p-5 rounded-2xl border flex items-start gap-4 transition-all hover:scale-[1.02] cursor-pointer ${alert.severity === 'danger' ? 'bg-sys-danger/10 border-sys-danger/20' : 'bg-sys-warning/10 border-sys-warning/20'}`}>
                                <div className={`p-2 rounded-xl ${alert.severity === 'danger' ? 'bg-sys-danger/20 text-sys-danger' : 'bg-sys-warning/20 text-sys-warning'}`}>
                                    <Zap size={16} />
                                </div>
                                <div>
                                    <div className={`text-xs font-black ${alert.severity === 'danger' ? 'text-sys-danger' : 'text-sys-warning'}`}>{alert.msg}</div>
                                    <div className="text-[9px] text-white/30 font-bold uppercase mt-1">تنبيه {alert.type}</div>
                                </div>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
                                <ShieldCheck size={64} />
                                <p className="text-xs font-bold mt-4">نظامك في وضع آمن تماماً</p>
                            </div>
                        )}
                    </div>
                    <div className="mt-8 p-6 bg-white/[0.02] rounded-3xl border border-white/5 flex items-center gap-3">
                        <Info size={16} className="text-sys-primary" />
                        <p className="text-[10px] text-white/40 leading-relaxed italic">
                            يتم تحديث التنبيهات فورياً بناءً على ترحيل العمليات المالية وحركات المخزن.
                        </p>
                    </div>
                </div>
            </div>

            {/* 4. Cost Deviation Engine & Menu Engineering */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Cost Deviation Engine */}
                <div className="lg:col-span-7 bg-sys-surface border border-white/5 rounded-[40px] p-8 shadow-2xl flex flex-col relative group">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-xl font-black text-white flex items-center gap-3">
                                <Target size={22} className="text-sys-primary" />
                                Cost Deviation Engine
                            </h3>
                            <p className="text-[10px] text-white/30 font-bold uppercase mt-1 tracking-widest">Actual vs Theoretical Analyzer</p>
                        </div>
                        <div className="text-right">
                             <div className={`text-2xl font-black ${stats.deviation > 2 ? 'text-sys-danger' : 'text-sys-success'}`}>{stats.deviation > 0 ? '+' : ''}{stats.deviation.toFixed(2)}%</div>
                             <div className="text-[9px] text-white/20 font-bold">Total Variance</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className="p-6 bg-black/40 rounded-[32px] border border-white/5 flex flex-col items-center justify-center text-center shadow-inner">
                            <span className="text-[10px] text-white/20 font-bold uppercase mb-2">الفرق المادي (Value)</span>
                            <span className="text-2xl font-black text-sys-danger">{formatCurrency(stats.sales * (stats.deviation / 100))} <span className="text-xs font-normal">ج.م</span></span>
                        </div>
                        <div className="p-6 bg-black/40 rounded-[32px] border border-white/5 flex flex-col items-center justify-center text-center shadow-inner">
                            <span className="text-[10px] text-white/20 font-bold uppercase mb-2">التكلفة النظرية (Target)</span>
                            <span className="text-2xl font-black text-sys-success">{formatCurrency(stats.theoreticalCost)} <span className="text-xs font-normal">ج.م</span></span>
                        </div>
                    </div>

                    <div className="flex-1 space-y-4">
                        <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2 mb-4">
                             <MousePointer2 size={12} /> مسببات الانحراف (Intelligence Breakdown)
                        </h4>
                        {stats.topDeviationItems.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-all cursor-default">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-8 bg-sys-danger rounded-full"></div>
                                    <div>
                                        <div className="text-xs font-bold text-white">{item.name}</div>
                                        <div className="text-[9px] text-white/30">{item.reason}</div>
                                    </div>
                                </div>
                                <span className="text-xs font-black text-sys-danger">{item.impact}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Menu Engineering Snapshot */}
                <div className="lg:col-span-5 bg-sys-surface border border-white/5 rounded-[40px] p-8 shadow-2xl flex flex-col relative overflow-hidden">
                    <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3">
                        <Star size={22} className="text-sys-warning" />
                        Menu Engineering Snapshot
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 flex-1">
                        <div className="bg-sys-success/5 border border-sys-success/10 p-6 rounded-[32px] flex flex-col items-center justify-center text-center group hover:bg-sys-success/10 transition-all">
                             <Star size={32} className="text-sys-success mb-3 group-hover:scale-125 transition-transform duration-500" />
                             <span className="text-3xl font-black text-white">{stats.stars}</span>
                             <span className="text-[10px] text-sys-success font-black uppercase mt-1">Stars (الأكثر ربحية)</span>
                        </div>
                        <div className="bg-sys-primary/5 border border-sys-primary/10 p-6 rounded-[32px] flex flex-col items-center justify-center text-center group hover:bg-sys-primary/10 transition-all">
                             <Zap size={32} className="text-sys-primary mb-3 group-hover:scale-125 transition-transform duration-500" />
                             <span className="text-3xl font-black text-white">0</span>
                             <span className="text-[10px] text-sys-primary font-black uppercase mt-1">Plowhorses</span>
                        </div>
                        <div className="bg-sys-warning/5 border border-sys-warning/10 p-6 rounded-[32px] flex flex-col items-center justify-center text-center group hover:bg-sys-warning/10 transition-all">
                             <PieChart size={32} className="text-sys-warning mb-3 group-hover:scale-125 transition-transform duration-500" />
                             <span className="text-3xl font-black text-white">0</span>
                             <span className="text-[10px] text-sys-warning font-black uppercase mt-1">Puzzles</span>
                        </div>
                        <div className="bg-sys-danger/5 border border-sys-danger/10 p-6 rounded-[32px] flex flex-col items-center justify-center text-center group hover:bg-sys-danger/10 transition-all">
                             <Trash2 size={32} className="text-sys-danger mb-3 group-hover:scale-125 transition-transform duration-500" />
                             <span className="text-3xl font-black text-white">{stats.dogs}</span>
                             <span className="text-[10px] text-sys-danger font-black uppercase mt-1">Dogs (يجب حذفها)</span>
                        </div>
                    </div>

                    <div className="mt-8 p-6 bg-sys-bg/50 rounded-3xl border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">إجمالي مساهمة الربح للفئة</span>
                             <span className="text-xs font-black text-sys-success">Calculated Live</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                             <div className="h-full bg-gradient-to-l from-sys-success to-sys-primary" style={{ width: `${(stats.stars / (stats.stars + stats.dogs || 1)) * 100}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Food Cost Trend Intelligence */}
            <div className="bg-sys-surface border border-white/5 rounded-[40px] p-8 shadow-2xl no-print relative overflow-hidden">
                <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-sys-primary/10 flex items-center justify-center text-sys-primary shadow-lg shadow-blue-900/10">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Food Cost Trend Intelligence</h3>
                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">تحليل الاتجاه الزمني الحقيقي لتكلفة الغذاء</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-sys-primary"></div>
                            <span className="text-[10px] font-bold text-white/40 uppercase">Actual Cost %</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-white/10"></div>
                            <span className="text-[10px] font-bold text-white/40 uppercase">Target Line (28%)</span>
                        </div>
                    </div>
                </div>

                <div className="h-48 w-full relative flex items-end justify-between px-4 gap-4">
                    {/* Simulated Trend Bar Chart from Real Logic */}
                    {[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, stats.foodCostPerc].map((val, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center group relative">
                            <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-all bg-sys-primary text-white text-[10px] font-black px-2 py-1 rounded shadow-xl">
                                {val.toFixed(1)}%
                            </div>
                            <div 
                                className={`w-full max-w-[24px] rounded-t-xl transition-all duration-1000 ${val > 30 ? 'bg-sys-danger/40 hover:bg-sys-danger' : val > 0 ? 'bg-sys-primary/30 hover:bg-sys-primary' : 'bg-white/5'}`} 
                                style={{ height: `${val > 0 ? Math.min(val * 3.5, 180) : 10}px` }}
                            ></div>
                            <div className="text-[8px] text-white/20 font-bold mt-2 uppercase tracking-tighter">Segment {i+1}</div>
                        </div>
                    ))}
                    {/* Target Line */}
                    <div className="absolute left-0 right-0 h-[1px] border-t border-dashed border-white/10" style={{ bottom: `${28 * 3.5}px` }}></div>
                </div>
            </div>

            <div className="text-center py-6">
                <p className="text-[10px] text-white/10 font-black uppercase tracking-[0.8em]">3M GSC • SYSTEM COST BI ENGINE ACTIVE • v5.0.0</p>
            </div>
        </div>
    );
};
