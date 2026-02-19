
import React, { useState, useMemo } from 'react';
import { AdRow } from '../types';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';

interface DataTableProps {
  rows: AdRow[];
}

export const DataTable: React.FC<DataTableProps> = ({ rows }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // 페이지 데이터 계산
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const currentRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return rows.slice(startIndex, startIndex + rowsPerPage);
  }, [rows, currentPage, rowsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1); // 개수 변경 시 첫 페이지로 리셋
  };

  // 페이지네이션 번호 리스트 생성
  const pageNumbers = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="space-y-4">
      {/* Table Header / Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 print:hidden">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Showing {rows.length === 0 ? 0 : Math.min(rows.length, (currentPage - 1) * rowsPerPage + 1)}-{Math.min(rows.length, currentPage * rowsPerPage)} of {rows.length} records
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
            <List size={14} className="text-slate-400" />
            <select 
              value={rowsPerPage} 
              onChange={handleRowsPerPageChange}
              className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
            >
              <option value={20}>20개씩 보기</option>
              <option value={50}>50개씩 보기</option>
              <option value={100}>100개씩 보기</option>
            </select>
          </div>
        </div>
      </div>

      {/* Actual Table */}
      <div className="overflow-x-auto rounded-[2rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left text-slate-500">
          <thead className="text-[11px] text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 font-black tracking-widest">No.</th>
              <th className="px-8 py-5 font-black tracking-widest">광고상품</th>
              <th className="px-8 py-5 font-black tracking-widest">날짜</th>
              <th className="px-8 py-5 font-black tracking-widest text-right">노출수 (Imp)</th>
              <th className="px-8 py-5 font-black tracking-widest text-right">클릭수 (Click)</th>
              <th className="px-8 py-5 font-black tracking-widest text-right">CTR (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {currentRows.map((row) => (
              <tr key={`${row.date}-${row.no}`} className="hover:bg-indigo-50/30 transition-colors group">
                <td className="px-8 py-5 font-bold text-slate-900">{row.no}</td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    {row.product}
                  </span>
                </td>
                <td className="px-8 py-5 font-medium">{row.date}</td>
                <td className="px-8 py-5 text-right font-mono text-slate-700">{row.impressions.toLocaleString()}</td>
                <td className="px-8 py-5 text-right font-mono text-slate-700">{row.clicks.toLocaleString()}</td>
                <td className="px-8 py-5 text-right">
                  <span className={`font-mono font-black ${row.ctr > 0.1 ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {row.ctr.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
            {currentRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-8 py-20 text-center text-slate-300 font-bold italic">
                  No performance data available for this selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-6 print:hidden">
          <button 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Previous page"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex items-center space-x-1">
            {pageNumbers.map(number => (
              <button
                key={number}
                onClick={() => handlePageChange(number)}
                className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${
                  currentPage === number 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' 
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
                aria-current={currentPage === number ? 'page' : undefined}
              >
                {number}
              </button>
            ))}
          </div>

          <button 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Next page"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};
