// DashboardPage — full admin hub (Phase 4)
// D-01: single page covering ADMIN-01 through ADMIN-12
// D-09: summary stats and charts are NOT affected by client-side filter state
// CLAUDE.md Rule 6: no float arithmetic on monetary values — string concat only

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Sale, Product, Mop, User } from '@alejinput/shared';
import { api } from '../lib/axios';
import { StatCard } from '../components/admin/StatCard';
import { KpiCard } from '../components/admin/KpiCard';
import { SalesCharts } from '../components/admin/SalesCharts';
import { SalesFilterBar, type FilterState, applyFilters } from '../components/admin/SalesFilterBar';
import { AdminSalesTable, downloadCSV } from '../components/admin/AdminSalesTable';
import { AuditDrawer } from '../components/sales/AuditDrawer';
import { VoidConfirmDialog } from '../components/sales/VoidConfirmDialog';
import { useSalesEditStore } from '../stores/salesEditStore';

// Extended in Phase 6 to include kpiData — D-05, D-06, D-07
interface KpiPeriodCount {
  today: number;
  yesterday: number;
  thisMonth: number;
  lastMonth: number;
}

interface KpiPeriodMoney {
  today: string;
  yesterday: string;
  thisMonth: string;
  lastMonth: string;
}

interface AdminSummary {
  totalCount: number;
  totalRevenue: string;
  trendData: Array<{ date: string; count: number }>;
  productBreakdown: Array<{ name: string; count: number; revenue: string }>;
  mopBreakdown: Array<{ name: string; count: number }>;
  kpiData: {
    transactions: KpiPeriodCount;
    profit: KpiPeriodMoney;
    turnover: KpiPeriodMoney;
  };
}

// ADMIN-01 through ADMIN-12
export function DashboardPage() {
  const { openVoidDialog } = useSalesEditStore();

  // Filter state — D-06: all nulls = no filter (show all rows)
  const [filters, setFilters] = useState<FilterState>({
    startDate: null,
    endDate: null,
    productId: null,
    mopId: null,
    createdById: null,
  });

  // Summary stats + chart data (D-07 — NOT affected by client-side filters per D-09)
  const { data: summary, isLoading: summaryLoading } = useQuery<AdminSummary>({
    queryKey: ['admin-summary'],
    queryFn: () => api.get<AdminSummary>('/admin/summary').then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 minutes — summary aggregates don't need real-time refresh
  });

  // All sales rows (D-04: client-side filtering — fetch all, filter in-memory)
  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: () => api.get<Sale[]>('/sales').then((r) => r.data),
  });

  // Catalog data for filter bar dropdowns
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get<Product[]>('/products').then((r) => r.data),
  });
  const { data: mops = [] } = useQuery<Mop[]>({
    queryKey: ['mops'],
    queryFn: () => api.get<Mop[]>('/mops').then((r) => r.data),
  });
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users').then((r) => r.data),
  });

  // Client-side filter application (D-04) — memoized to avoid re-computation on unrelated renders
  const filteredRows = useMemo(() => applyFilters(sales, filters), [sales, filters]);

  // CSV export handler
  const [csvExporting, setCsvExporting] = useState(false);
  const handleExportCSV = () => {
    setCsvExporting(true);
    try {
      downloadCSV(filteredRows);
    } finally {
      setCsvExporting(false);
    }
  };

  // Filter bar dropdown options — use ALL loaded items (active + inactive for completeness)
  const productOptions = products.map((p) => ({ id: p.id, name: p.name }));
  const mopOptions = mops.map((m) => ({ id: m.id, name: m.name }));
  const userOptions = users.map((u) => ({ id: u.id, username: u.username }));

  // Revenue label: string concat only — no float arithmetic (CLAUDE.md Rule 6)
  const revenueValue = summary
    ? '₱' + summary.totalRevenue.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : '—';
  const totalSalesValue = summary ? String(summary.totalCount) : '—';

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={salesLoading || csvExporting}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {csvExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* KPI summary cards — D-06, D-07: period-specific KPIs above all-time stats */}
      {/* grid-cols-3: Transactions | Profit | Turnover left-to-right */}
      {/* mb-8: 32px gap separating KPI section from stats banner below */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
        <KpiCard
          label="Transactions"
          periods={summary?.kpiData?.transactions ?? { today: 0, yesterday: 0, thisMonth: 0, lastMonth: 0 }}
          loading={summaryLoading}
        />
        <KpiCard
          label="Profit"
          periods={summary?.kpiData?.profit ?? { today: '0.00', yesterday: '0.00', thisMonth: '0.00', lastMonth: '0.00' }}
          loading={summaryLoading}
          isCurrency
        />
        <KpiCard
          label="Turnover"
          periods={summary?.kpiData?.turnover ?? { today: '0.00', yesterday: '0.00', thisMonth: '0.00', lastMonth: '0.00' }}
          loading={summaryLoading}
          isCurrency
        />
      </div>

      {/* Stats banner — D-09: NOT affected by filter state */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-12">
        <StatCard
          label="Total Sales"
          value={totalSalesValue}
          loading={summaryLoading}
        />
        <StatCard
          label="Total Revenue"
          value={revenueValue}
          loading={summaryLoading}
        />
      </div>

      {/* Charts — D-09: NOT affected by filter state */}
      <SalesCharts summary={summary} loading={summaryLoading} />

      {/* Filter bar — D-05: always-visible, live filter, no Apply button */}
      <SalesFilterBar
        filters={filters}
        onFilterChange={setFilters}
        products={productOptions}
        mops={mopOptions}
        users={userOptions}
      />

      {/* Admin sales table — filteredRows drives table and CSV export */}
      <AdminSalesTable
        rows={filteredRows}
        loading={salesLoading}
        onVoid={(saleId) => openVoidDialog(saleId)}
      />

      {/* AuditDrawer — renders at page level; opened via useSalesEditStore().openAuditDrawer(id) */}
      <AuditDrawer />

      {/* VoidConfirmDialog — reads voidTargetSaleId from Zustand; calls POST /api/sales/:id/void internally */}
      <VoidConfirmDialog />
    </div>
  );
}
