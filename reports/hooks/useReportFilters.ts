import { useState } from "react";

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

export function useReportFilters() {
  const [filters, setFilters] = useState<ReportFilters>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
    branchId: "all",
    destinationId: "all",
    supplierId: "all",
    searchTerm: "",
    stockFilter: "all",
  });

  return { filters, setFilters };
}