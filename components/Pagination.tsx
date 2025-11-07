'use client';

import { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  maxPageButtons?: number;
}

export default memo(function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  maxPageButtons = 5
}: PaginationProps) {

  // 총 페이지 수 계산
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // 현재 페이지 항목 범위 계산
  const { startItem, endItem } = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);
    return { startItem: start, endItem: end };
  }, [currentPage, itemsPerPage, totalItems]);

  // 표시할 페이지 번호 범위 계산
  const pageNumbers = useMemo(() => {
    const halfButtons = Math.floor(maxPageButtons / 2);
    let startPage = Math.max(1, currentPage - halfButtons);
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    // 끝에서 시작 조정
    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i
    );
  }, [currentPage, totalPages, maxPageButtons]);

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  // 항목이 없으면 렌더링하지 않음
  if (totalItems === 0) {
    return null;
  }

  return (
    <nav
      className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 py-3 sm:py-4 gap-2 sm:gap-0 border-t border-gray-200 bg-white"
      aria-label="페이지네이션"
    >
      {/* 왼쪽: 항목 범위 표시 (모바일에서는 숨김) */}
      <div className="hidden sm:block text-sm text-gray-600">
        <span className="font-medium">{startItem}-{endItem}</span>
        <span className="text-gray-400 mx-1">/</span>
        <span>전체 {totalItems}개</span>
      </div>

      {/* 가운데: 페이지 번호 */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {/* 처음 페이지로 (모바일에서는 숨김) */}
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
          className="hidden sm:block p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="처음 페이지"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* 이전 페이지 */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 sm:p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="이전 페이지"
        >
          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* 첫 페이지 + 생략 표시 */}
        {pageNumbers[0] > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded hover:bg-gray-100 transition-colors"
              aria-label="페이지 1"
            >
              1
            </button>
            {pageNumbers[0] > 2 && (
              <span className="px-1 sm:px-2 text-gray-400 text-xs sm:text-sm">...</span>
            )}
          </>
        )}

        {/* 페이지 번호 버튼들 */}
        {pageNumbers.map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => handlePageChange(pageNum)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded transition-colors ${
              currentPage === pageNum
                ? 'bg-blue-600 text-white font-medium'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            aria-label={`페이지 ${pageNum}`}
            aria-current={currentPage === pageNum ? 'page' : undefined}
          >
            {pageNum}
          </button>
        ))}

        {/* 마지막 페이지 + 생략 표시 */}
        {pageNumbers[pageNumbers.length - 1] < totalPages && (
          <>
            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
              <span className="px-1 sm:px-2 text-gray-400 text-xs sm:text-sm">...</span>
            )}
            <button
              onClick={() => handlePageChange(totalPages)}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded hover:bg-gray-100 transition-colors"
              aria-label={`페이지 ${totalPages}`}
            >
              {totalPages}
            </button>
          </>
        )}

        {/* 다음 페이지 */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 sm:p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="다음 페이지"
        >
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* 마지막 페이지로 (모바일에서는 숨김) */}
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="hidden sm:block p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="마지막 페이지"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* 오른쪽: 페이지 정보 */}
      <div className="text-xs sm:text-sm text-gray-600">
        <span className="font-medium">{currentPage}</span>
        <span className="text-gray-400 mx-1">/</span>
        <span>{totalPages} 페이지</span>
        {/* 모바일에서 항목 범위 표시 */}
        <span className="sm:hidden text-gray-400 mx-1">·</span>
        <span className="sm:hidden text-gray-500">{startItem}-{endItem}/{totalItems}</span>
      </div>
    </nav>
  );
});
