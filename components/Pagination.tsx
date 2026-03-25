'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalCount: number
  pageSize: number
  hasMore: boolean
  onPrevPage: () => void
  onNextPage: () => void
}

export function Pagination({
  currentPage,
  totalCount,
  pageSize,
  hasMore,
  onPrevPage,
  onNextPage,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrevPage}
        disabled={currentPage <= 1}
        className="p-1 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-700"
        aria-label="Previous page"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="text-xs text-gray-400 tabular-nums">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={onNextPage}
        disabled={!hasMore}
        className="p-1 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 hover:text-white hover:bg-gray-700"
        aria-label="Next page"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
