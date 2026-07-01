const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type PageSizeOption = typeof PAGE_SIZE_OPTIONS[number] | 'all';

interface PaginationFooterProps {
  pageSize: PageSizeOption;
  pageIndex: number;
  totalRows: number;
  onPageSizeChange: (size: PageSizeOption) => void;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function PaginationFooter({
  pageSize, pageIndex, totalRows,
  onPageSizeChange, canPrev, canNext, onPrev, onNext,
}: PaginationFooterProps) {
  const rowRangeLabel = pageSize === 'all'
    ? `All ${totalRows} rows`
    : totalRows === 0
      ? '0 rows'
      : `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, totalRows)} of ${totalRows}`;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            const val = e.target.value;
            onPageSizeChange(val === 'all' ? 'all' : (Number(val) as typeof PAGE_SIZE_OPTIONS[number]));
          }}
          className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          <option value="all">All</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">{rowRangeLabel}</span>
        {pageSize !== 'all' && (
          <>
            <button
              type="button"
              disabled={!canPrev}
              onClick={onPrev}
              className="px-3 py-1 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={onNext}
              className="px-3 py-1 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
