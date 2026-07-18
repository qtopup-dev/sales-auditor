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
import { useChartColors } from '../../hooks/useChartColors';

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
  const colors = useChartColors();

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4">
            <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-64 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const trendData = summary?.trendData ?? [];
  const productBreakdown = summary?.productBreakdown ?? [];
  const mopBreakdown = summary?.mopBreakdown ?? [];

  const tooltipProps = {
    contentStyle: {
      backgroundColor: colors.tooltipBg,
      border: `1px solid ${colors.tooltipBorder}`,
      color: colors.tooltipText,
    },
    labelStyle: { color: colors.tooltipText },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {/* Chart 1: Sales Over Time (LineChart) */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4">
        <p className="text-sm font-normal text-gray-900 dark:text-gray-100 mb-3">Sales Over Time</p>
        <div className="h-64">
          {trendData.length === 0 ? (
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400 flex items-center justify-center h-full">
              No data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="date" stroke={colors.grid} tick={{ fontSize: 12, fill: colors.axis }} />
                <YAxis allowDecimals={false} stroke={colors.grid} tick={{ fontSize: 12, fill: colors.axis }} />
                <Tooltip {...tooltipProps} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={colors.accent}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 2: Sales by Product (BarChart) */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4">
        <p className="text-sm font-normal text-gray-900 dark:text-gray-100 mb-3">Sales by Product</p>
        <div className="h-64">
          {productBreakdown.length === 0 ? (
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400 flex items-center justify-center h-full">
              No data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productBreakdown} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis
                  dataKey="name"
                  stroke={colors.grid}
                  tick={{ fontSize: 12, angle: -30, textAnchor: 'end', fill: colors.axis } as Record<string, unknown>}
                />
                <YAxis allowDecimals={false} stroke={colors.grid} tick={{ fontSize: 12, fill: colors.axis }} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" fill={colors.accent} radius={[3, 3, 0, 0] as [number, number, number, number]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 3: Sales by Payment Method (BarChart) */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-4">
        <p className="text-sm font-normal text-gray-900 dark:text-gray-100 mb-3">Sales by Payment Method</p>
        <div className="h-64">
          {mopBreakdown.length === 0 ? (
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400 flex items-center justify-center h-full">
              No data yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mopBreakdown} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis
                  dataKey="name"
                  stroke={colors.grid}
                  tick={{ fontSize: 12, angle: -30, textAnchor: 'end', fill: colors.axis } as Record<string, unknown>}
                />
                <YAxis allowDecimals={false} stroke={colors.grid} tick={{ fontSize: 12, fill: colors.axis }} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="count" fill={colors.accent} radius={[3, 3, 0, 0] as [number, number, number, number]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
