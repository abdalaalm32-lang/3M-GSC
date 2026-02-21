import React from 'react';
import { BarChart3 } from 'lucide-react';
import StockMovementReport from './stock-movement/StockMovementReport';
import PurchaseAnalysisReport from './purchase-analysis/PurchaseAnalysisReport';
import StockLevelsReport from './stock-levels/StockLevelsReport';
import ProductionOperationsReport from './production-operations/ProductionOperationsReport';
import WasteReport from './waste-report/WasteReport';
import CostAdjustmentsReport from './cost-adjustments/CostAdjustmentsReport';
import TransfersReport from './transfers/TransfersReport';
import MovementAnalysisReport from './movement-analysis/MovementAnalysisReport';

// Placeholder for missing components if any
const ReportPlaceholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-white/20 gap-4 bg-sys-surface rounded-xl border border-white/5 border-dashed">
      <BarChart3 size={64} className="opacity-10" />
      <div className="text-center">
          <h3 className="text-lg font-bold text-white/40">{title}</h3>
          <p className="text-sm">سيتم نقل منطق هذا التقرير إلى موديول مستقل لضمان استقرار النظام.</p>
      </div>
  </div>
);

export const reportsRegistry: Record<string, React.FC<any>> = {
  stockMovement: StockMovementReport,
  purchaseAnalysis: PurchaseAnalysisReport,
  stockLevels: StockLevelsReport,
  productionOperations: ProductionOperationsReport,
  wasteReport: WasteReport,
  costAdjustments: CostAdjustmentsReport,
  transfers: TransfersReport,
  movementAnalysis: MovementAnalysisReport,
};