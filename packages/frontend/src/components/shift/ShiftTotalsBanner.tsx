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
    <div className="grid grid-cols-2 gap-6 mb-6">
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <p className="text-sm font-normal text-gray-500 mb-1">Sales This Shift</p>
        {loading ? (
          <div className="animate-pulse bg-gray-200 h-8 rounded w-24" />
        ) : (
          <p className="text-2xl font-semibold text-gray-900">{count}</p>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-md p-6">
        <p className="text-sm font-normal text-gray-500 mb-1">Revenue This Shift</p>
        {loading ? (
          <div className="animate-pulse bg-gray-200 h-8 rounded w-24" />
        ) : (
          // Pure string concat — NEVER parseFloat/Number() (CLAUDE.md Rule 6)
          <p className="text-2xl font-semibold text-gray-900">{'₱' + revenue}</p>
        )}
      </div>
    </div>
  );
}
