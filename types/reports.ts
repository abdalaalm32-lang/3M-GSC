export interface StockItem {
  id: string;
  name: string;
  category: string;
  stockUnit: string;
  currentStock: number;
  avgCost: number;
  /* Add missing standardCost property for consistency */
  standardCost: number;
  minLevel: number;
  reorderLevel: number;
  active: string;
  department: string;
  conversionFactor?: number;
}

export interface PurchaseItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  status: "مسودة" | "مكتمل";
  items: PurchaseItem[];
  totalAmount: number;
  branchId?: string;
}

export interface ProductionIngredient {
  stockItemId: string;
  name: string;
  unit: string;
  requiredQty: number;
  unitCost: number;
  totalCost: number;
}

export interface ProductionRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  producedQty: number;
  unit: string;
  branchId: string;
  branchName: string;
  status: "مسودة" | "مرحل";
  ingredients: ProductionIngredient[];
  totalProductionCost: number;
  unitCost: number;
}

export interface WasteItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
  reason: string;
  cost: number;
  sourceProduct?: string;
}

export interface WasteRecord {
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  status: "مسودة" | "مرحل";
  items: WasteItem[];
  totalCost: number;
  notes?: string;
}

export interface AdjustmentItem {
  itemId: string;
  name: string;
  unit: string;
  oldCost: number;
  newCost: number;
}

export interface CostAdjustmentRecord {
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  status: "مسودة" | "مغلق";
  items: AdjustmentItem[];
  notes?: string;
}

export interface TransferItem {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface TransferRecord {
  id: string;
  date: string;
  sourceId: string;
  sourceName: string;
  destinationId: string;
  destinationName: string;
  status: "مسودة" | "مرحل";
  items: TransferItem[];
  notes?: string;
}

/** 
 * Added missing types requested by report components 
 */

export interface StocktakeRecord {
  id: string;
  date: string;
  branchId: string;
  status: string;
  type: 'opening' | 'closing' | 'regular';
  items: { itemId: string; countedQty: number }[];
}

export interface PosSale {
  id: string;
  date: string;
  status: string;
  branchId?: string;
  items: { itemId: string; qty: number }[];
}

export interface Recipe {
  menuItemId: string;
  ingredients: { stockItemId: string; qty: number }[];
}

export interface Branch { 
  id: string; 
  name: string; 
}

export interface Supplier { 
  id: string; 
  name: string; 
}

export type StockFilter = "all" | "low";

export type ReportFilters = {
  from: string;
  to: string;
  branchId: string;
  destinationId: string;
  supplierId: string;
  searchTerm: string;
  stockFilter: StockFilter;
};
