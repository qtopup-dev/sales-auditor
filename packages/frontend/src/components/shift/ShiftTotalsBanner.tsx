// UI-SPEC.md §Component Contract: ShiftTotalsBanner — reused on SalesPage (moderator's own
// current shift) and each tab of AdminShiftsPage. Visual clone of the DashboardPage stats
// banner (two StatCard-style cards side by side) — composes its own divs (not the StatCard
// import) to keep count/revenue typed distinctly per UI-SPEC.

interface ShiftTotalsBannerProps {
  count: number;
  revenue: string; // DECIMAL string, never parsed as float (CLAUDE.md Rule 6)
  loading?: boolean;
}

export function ShiftTotalsBanner({ count, revenue, loading = false }: ShiftTotalsBannerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-6">
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400 mb-1">Sales This Shift</p>
        {loading ? (
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 rounded w-24" />
        ) : (
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{count}</p>
        )}
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-6">
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400 mb-1">Revenue This Shift</p>
        {loading ? (
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 rounded w-24" />
        ) : (
          // Pure string concat — NEVER parseFloat/Number() (CLAUDE.md Rule 6)
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{'₱' + revenue}</p>
        )}
      </div>
    </div>
  );
}
