import React, { useMemo, useState } from "react";
import { useReportsData } from "../reports/hooks/useReportsData";
import { useReportFilters } from "../reports/hooks/useReportFilters";
import { ReportKey } from "../reports/types";
import { reportsRegistry } from "../reports/reportsRegistry";
import { ReportsSidebar } from "../reports/components/ReportsSidebar";

export const ReportsPage: React.FC = () => {
  // الحالة المركزية لاختيار التقرير
  const [activeReport, setActiveReport] = useState<ReportKey>("stockMovement");
  
  // تحميل الفلاتر المركزية والبيانات
  const { filters, setFilters } = useReportFilters();
  const data = useReportsData();

  // جلب المكون البرمجي للتقرير النشط من السجل المركزي
  const ActiveComp = useMemo(() => reportsRegistry[activeReport], [activeReport]);

  if (data.isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-white/30 animate-pulse">
        جاري تحميل التقارير وتجهيز البيانات...
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6 font-sans" dir="rtl">
      {/* القائمة الجانبية المستقلة */}
      <ReportsSidebar activeReport={activeReport} onSelect={setActiveReport} />

      {/* منطقة عرض التقرير المختار */}
      <div className="flex-1 min-w-0">
        <ActiveComp
          {...data}
          filters={filters}
          setFilters={setFilters}
        />
      </div>
    </div>
  );
};