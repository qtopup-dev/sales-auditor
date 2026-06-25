// UI-SPEC.md §StatCard — stats banner card for DashboardPage
// Displays a single KPI: label (gray-500) + value (text-2xl/semibold)
// Loading: animate-pulse skeleton in value position

interface StatCardProps {
  label: string;
  value: string;
  loading?: boolean;
}

export function StatCard({ label, value, loading = false }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-6">
      <p className="text-sm font-normal text-gray-500 mb-1">{label}</p>
      {loading ? (
        <div className="animate-pulse bg-gray-200 h-8 rounded w-24" />
      ) : (
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
      )}
    </div>
  );
}
