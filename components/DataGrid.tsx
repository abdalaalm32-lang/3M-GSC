
import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, Download, ChevronLeft, ChevronRight, SlidersHorizontal, ArrowUpDown, AlertTriangle, X, Edit, FileSpreadsheet, FileText, ChevronDown, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Column {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
}

interface DataGridProps {
  columns: Column[];
  data: any[];
  title: string;
  onAdd?: () => void;
  onRowClick?: (row: any) => void;
}

interface ConfirmationState {
  isOpen: boolean;
  title: string;
  message: string;
  action: () => void;
  confirmBtnText: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

export const DataGrid: React.FC<DataGridProps> = ({ columns, data, title, onAdd, onRowClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
    confirmBtnText: '',
  });

  const itemsPerPage = 10;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredData = data.filter(row => 
    Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const closeConfirmation = () => {
    if (confirmation.isLoading) return;
    setConfirmation(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirmAction = () => {
    confirmation.action();
  };

  const exportToExcel = (reportName: string, rows: any[]) => {
    const exportRows = rows.map(row => {
      const formattedRow: any = {};
      columns.forEach(col => {
        formattedRow[col.label] = row[col.key];
      });
      return formattedRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    
    if(!worksheet['!views']) worksheet['!views'] = [];
    worksheet['!views'].push({RTL: true});

    XLSX.writeFile(workbook, `${reportName}.xlsx`);
    setConfirmation(prev => ({ ...prev, isOpen: false }));
  };

  const exportToPdfAsImage = async (reportName: string, rows: any[]) => {
    setConfirmation(prev => ({ ...prev, isLoading: true, confirmBtnText: 'جاري المعالجة...' }));

    try {
      // 1. إنشاء عنصر DOM مؤقت للتصدير (مخفي عن المستخدم)
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '1200px'; // عرض ثابت لضمان الجودة
      container.style.padding = '40px';
      container.style.background = 'white';
      container.style.color = 'black';
      container.style.direction = 'rtl';
      container.style.fontFamily = 'Arial, sans-serif';

      // 2. بناء محتوى التقرير (Header)
      container.innerHTML = `
        <div style="text-align: center; border-bottom: 2px solid #3B82F6; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #1e1e1e; font-size: 28px;">3M GSC - Global System Cost</h1>
          <h2 style="margin: 10px 0 0; color: #3B82F6; font-size: 20px;">${reportName}</h2>
          <p style="margin: 5px 0 0; color: #666; font-size: 12px;">تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              ${columns.map(col => `<th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-size: 14px; font-weight: bold; color: #333;">${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${columns.map(col => `<td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 13px; color: #444;">${row[col.key] || '-'}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 40px; text-align: left; font-size: 10px; color: #999;">
          طُبع بواسطة نظام 3M GSC المتكامل لإدارة التكاليف والمخزون
        </div>
      `;

      document.body.appendChild(container);

      // 3. التقاط الصورة باستخدام html2canvas
      const canvas = await html2canvas(container, {
        scale: 2, // جودة عالية
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      
      // 4. توليد ملف PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`${reportName}.pdf`);

      document.body.removeChild(container);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("حدث خطأ أثناء محاولة تصدير ملف PDF.");
    } finally {
      setConfirmation(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }
  };

  const handleExportRequest = (type: 'excel' | 'pdf') => {
    setIsExportMenuOpen(false);
    setConfirmation({
      isOpen: true,
      title: 'تأكيد عملية التصدير',
      message: `هل أنت متأكد من رغبتك في تصدير (${filteredData.length}) سجل بصيغة ${type.toUpperCase()}؟ يتم تضمين كافة البيانات المفلترة حالياً في التقرير.`,
      confirmBtnText: `بدء التصدير`,
      action: () => {
        if (type === 'excel') {
          exportToExcel(title, filteredData);
        } else {
          exportToPdfAsImage(title, filteredData);
        }
      }
    });
  };

  return (
    <div className="bg-sys-surface border border-white/5 rounded-lg flex flex-col h-full shadow-lg overflow-hidden relative">
      
      {/* Confirmation Modal Overlay */}
      {confirmation.isOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#2a2a2a] border border-white/10 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100 transition-all">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle size={18} className="text-sys-warning" />
                <h3 className="font-bold text-sm">{confirmation.title}</h3>
              </div>
              {!confirmation.isLoading && (
                <button onClick={closeConfirmation} className="text-white/40 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="p-6 text-center">
              {confirmation.isLoading ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <Loader2 className="text-sys-primary animate-spin" size={40} />
                  <p className="text-white font-bold text-sm">جاري تحضير ملف الـ PDF...</p>
                  <p className="text-white/40 text-xs italic">يرجى الانتظار، قد تستغرق العملية بضع ثوانٍ للبيانات الضخمة.</p>
                </div>
              ) : (
                <p className="text-white/80 text-sm leading-relaxed font-bold">
                  {confirmation.message}
                </p>
              )}
            </div>
            {!confirmation.isLoading && (
              <div className="p-4 bg-sys-bg/50 border-t border-white/5 flex gap-3 justify-center">
                <button onClick={closeConfirmation} className="px-4 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">إلغاء</button>
                <button onClick={handleConfirmAction} className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-lg transition-all ${confirmation.isDanger ? 'bg-sys-danger hover:bg-red-600 shadow-red-900/20' : 'bg-sys-primary hover:bg-blue-600 shadow-blue-900/20'}`}>
                  {confirmation.confirmBtnText}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid Header */}
      <div className="p-4 border-b border-white/10 flex flex-wrap gap-4 justify-between items-center bg-sys-surface-elevated">
        <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60">{filteredData.length} سجل</span>
        </div>
        
        <div className="flex gap-2 items-center">
            <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input 
                    type="text" 
                    placeholder="بحث سريع..." 
                    className="bg-sys-bg border border-white/10 rounded-md py-1.5 pr-9 pl-3 text-sm text-white focus:border-sys-primary focus:outline-none w-64 placeholder:text-white/20"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <button className="p-2 hover:bg-white/5 rounded-md text-white/70 hover:text-white transition-colors" title="فلاتر متقدمة">
                <SlidersHorizontal size={18} />
            </button>
            
            <div className="h-6 w-[1px] bg-white/10 mx-1"></div>

            {/* Export Dropdown Container */}
            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 bg-sys-bg border border-white/10 rounded-md text-sm text-white/80 transition-all ${isExportMenuOpen ? 'border-sys-primary text-white bg-sys-primary/5' : 'hover:bg-white/5'}`}
              >
                  <Download size={14} />
                  <span>تصدير</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute left-0 mt-2 w-40 bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
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
                      <span>ملف PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {onAdd && (
                <button onClick={onAdd} className="bg-sys-primary hover:bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-lg shadow-blue-900/20">
                    + إضافة جديد
                </button>
            )}
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full text-right border-collapse">
            <thead className="bg-sys-bg sticky top-0 z-10 text-xs uppercase text-white/50 font-medium tracking-wider">
                <tr>
                    {columns.map((col) => (
                        <th key={col.key} className="p-4 border-b border-white/10 whitespace-nowrap group cursor-pointer hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-1">
                                {col.label}
                                {col.sortable && <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                        </th>
                    ))}
                    <th className="p-4 border-b border-white/10 w-10"></th>
                </tr>
            </thead>
            <tbody className="text-sm divide-y divide-white/5">
                {currentData.length > 0 ? (
                    currentData.map((row, idx) => (
                        <tr 
                            key={idx} 
                            onClick={() => onRowClick && onRowClick(row)}
                            className={`transition-colors group ${onRowClick ? 'cursor-pointer hover:bg-white/5' : 'hover:bg-white/[0.02]'}`}
                        >
                            {columns.map((col) => (
                                <td key={`${idx}-${col.key}`} className="p-4 text-white/80 whitespace-nowrap">
                                    {row[col.key]}
                                </td>
                            ))}
                            <td className="p-4 text-center">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if(onRowClick) onRowClick(row);
                                    }}
                                    className={`
                                        opacity-0 group-hover:opacity-100 transition-all text-xs border px-2 py-1 rounded flex items-center gap-1
                                        ${onRowClick 
                                            ? 'text-sys-warning border-sys-warning/30 hover:bg-sys-warning/10 hover:text-white' 
                                            : 'text-sys-primary border-sys-primary/30 hover:text-white'}
                                    `}
                                >
                                    {onRowClick ? <><Edit size={10} />تعديل</> : 'عرض'}
                                </button>
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr><td colSpan={columns.length + 1} className="p-12 text-center text-white/30">لا توجد بيانات مطابقة للبحث</td></tr>
                )}
            </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div className="border-t border-white/10 p-3 bg-sys-surface-elevated flex justify-between items-center text-xs text-white/50">
        <div>عرض {Math.min((currentPage - 1) * itemsPerPage + 1, filteredData.length)} - {Math.min(currentPage * itemsPerPage, filteredData.length)} من {filteredData.length}</div>
        <div className="flex gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={16} /></button>
            <span className="px-3 py-1.5 bg-sys-bg rounded border border-white/5 text-white">صفحة {currentPage}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={16} /></button>
        </div>
      </div>
    </div>
  );
};
