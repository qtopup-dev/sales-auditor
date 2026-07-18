// KpiCard — D-06: 4-period KPI card with 2×2 grid layout
// UI-SPEC.md §Component Contract: KpiCard
// CLAUDE.md Rule 6: isCurrency uses string concat "₱" + String(value) — no parseFloat, no Number()
// Shell matches StatCard: bg-white border border-gray-200 rounded-md p-6
// Loading skeleton: h-6 (text-xl line height); w-16 today/yesterday, w-20 month slots

// Pure string manipulation — no float conversion (Rule 6)
function addThousandsSep(moneyStr: string): string {
  const [int, dec] = moneyStr.split('.');
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${withCommas}.${dec}` : withCommas;
}

interface KpiPeriods {
  today: string | number;
  yesterday: string | number;
  thisMonth: string | number;
  lastMonth: string | number;
}

interface KpiCardProps {
  label: string;
  periods: KpiPeriods;
  loading?: boolean;
  isCurrency?: boolean;
}

// Period grid order: Today (top-left), Yesterday (top-right), This Month (bottom-left), Last Month (bottom-right)
// Full label text — no abbreviations (UI-SPEC.md §Copywriting Contract)
const PERIODS: { key: keyof KpiPeriods; label: string; skeletonWidth: string }[] = [
  { key: 'today',     label: 'Today',      skeletonWidth: 'w-16' },
  { key: 'yesterday', label: 'Yesterday',  skeletonWidth: 'w-16' },
  { key: 'thisMonth', label: 'This Month', skeletonWidth: 'w-20' },
  { key: 'lastMonth', label: 'Last Month', skeletonWidth: 'w-20' },
];

export function KpiCard({ label, periods, loading = false, isCurrency = false }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-6">
      {/* Card header — text-sm font-normal text-gray-500 mb-4 (mb-4 not mb-1 unlike StatCard — needs room before 2×2 grid) */}
      <p className="text-sm font-normal text-gray-500 dark:text-gray-400 mb-4">{label}</p>
      <div className="grid grid-cols-2 gap-4">
        {PERIODS.map(({ key, label: periodLabel, skeletonWidth }) => (
          <div key={key} className="flex flex-col">
            {/* Sub-period label — text-xs font-normal text-gray-400 mb-1 */}
            <p className="text-xs font-normal text-gray-400 dark:text-gray-500 mb-1">{periodLabel}</p>
            {loading ? (
              // Skeleton height h-6 matches text-xl line height; width varies by period type
              <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 h-6 rounded ${skeletonWidth}`} />
            ) : (
              // text-xl font-semibold (not text-2xl — 4 values share card space per UI-SPEC §Typography)
              // isCurrency: string concat only — Rule 6 prohibits parseFloat on monetary values
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {isCurrency ? '₱' + addThousandsSep(String(periods[key])) : String(periods[key])}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
