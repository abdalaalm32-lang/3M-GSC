
import { useEffect, useState } from "react";
import {
  Branch, CostAdjustmentRecord, ProductionRecord, PurchaseOrder,
  StockItem, Supplier, TransferRecord, WasteRecord, StocktakeRecord, PosSale, Recipe
} from "../types";

export type ReportsData = {
  items: StockItem[];
  purchaseOrders: PurchaseOrder[];
  productionLogs: ProductionRecord[];
  wasteRecords: WasteRecord[];
  adjustmentRecords: CostAdjustmentRecord[];
  transferRecords: TransferRecord[];
  stocktakes: StocktakeRecord[];
  sales: PosSale[];
  recipes: Recipe[];
  branches: Branch[];
  suppliers: Supplier[];
  isLoading: boolean;
  reload: () => void;
};

export function useReportsData(): ReportsData {
  const [items, setItems] = useState<StockItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionRecord[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [adjustmentRecords, setAdjustmentRecords] = useState<CostAdjustmentRecord[]>([]);
  const [transferRecords, setTransferRecords] = useState<TransferRecord[]>([]);
  const [stocktakes, setStocktakes] = useState<StocktakeRecord[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = () => {
    setIsLoading(true);
    try {
      const get = (k: string) => JSON.parse(localStorage.getItem(k) || "[]");
      
      setItems(get("gsc_items"));
      setPurchaseOrders(get("gsc_purchases"));
      setProductionLogs(get("gsc_production_logs"));
      setWasteRecords(get("gsc_waste_records"));
      setAdjustmentRecords(get("gsc_cost_adjustments"));
      setTransferRecords(get("gsc_transfers"));
      setStocktakes(get("gsc_stocktakes"));
      setSales(get("gsc_pos_sales"));
      setRecipes(get("gsc_recipes"));
      setSuppliers(get("gsc_suppliers"));
      
      // جلب الفروع المكوّدة فعلياً فقط من الإعدادات لضمان عدم وجود بيانات وهمية
      const storedBranches = get("gsc_branches");
      setBranches(storedBranches);

    } catch (e) {
      console.error("Error loading report data", e);
    } finally {
      setTimeout(() => setIsLoading(false), 300);
    }
  };

  useEffect(() => { load(); }, []);

  return {
    items, purchaseOrders, productionLogs, wasteRecords,
    adjustmentRecords, transferRecords, stocktakes, sales, recipes,
    branches, suppliers,
    isLoading,
    reload: load,
  };
}
