// UI-SPEC.md §SalesCharts — three Recharts charts in responsive grid
// CRITICAL: ResponsiveContainer parent div MUST have explicit h-64 class
// (unsized flex parent collapses to 0px — RESEARCH.md Pitfall 1)

import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface AdminSummary {
  totalCount: number;
  totalRevenue: string;
  trendData: Array<{ date: string; count: number }>;
  productBreakdown: Array<{ name: string; count: number; revenue: string }>;
  mopBreakdown: Array<{ name: string; count: number }>;
}

interface SalesChartsProps {
  summary: AdminSummary | undefined;
  loading: boolean;
}

export function SalesCharts({ summary, loading }: SalesChartsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-md p-4">
            <div className="animate-pulse bg-gray-200 rounded h-64 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const trendData = summary?.trendData ?? [];
  const productBreakdown = summary?.productBreakdown ?? [];
  const mopBreakdown = summary?.mopBreakdown ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {/* Chart 1: Sales Over Time (LineChart) */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <p className="text-sm font-normal text-gray-900 mb-3">Sales Over Time</p>
        <div className="h-64">
          {trendData.length === 0 ? (
            <p className="text-sm font-normal text-gray-500 flex items-center justify-center h-full">
              No data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 2: Sales by Product (BarChart) */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <p className="text-sm font-normal text-gray-900 mb-3">Sales by Product</p>
        <div className="h-64">
          {productBreakdown.length === 0 ? (
            <p className="text-sm font-normal text-gray-500 flex items-center justify-center h-full">
              No data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productBreakdown} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, angle: -30, textAnchor: 'end' } as Record<string, unknown>}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0] as [number, number, number, number]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 3: Sales by Payment Method (BarChart) */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <p className="text-sm font-normal text-gray-900 mb-3">Sales by Payment Method</p>
        <div className="h-64">
          {mopBreakdown.length === 0 ? (
            <p className="text-sm font-normal text-gray-500 flex items-center justify-center h-full">
              No data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mopBreakdown} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, angle: -30, textAnchor: 'end' } as Record<string, unknown>}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[3, 3, 0, 0] as [number, number, number, number]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
