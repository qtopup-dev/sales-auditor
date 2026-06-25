// DashboardPage — full admin hub (Phase 4)
// D-01: single page covering ADMIN-01 through ADMIN-12
// D-09: summary stats and charts are NOT affected by client-side filter state
// CLAUDE.md Rule 6: no float arithmetic on monetary values — string concat only

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Sale, Product, Mop, User } from '@alejinput/shared';
import { api } from '../lib/axios';
import { StatCard } from '../components/admin/StatCard';
import { SalesCharts } from '../components/admin/SalesCharts';
import { SalesFilterBar, type FilterState, applyFilters } from '../components/admin/SalesFilterBar';
import { AdminSalesTable, downloadCSV } from '../components/admin/AdminSalesTable';
import { AuditDrawer } from '../components/sales/AuditDrawer';
import { VoidConfirmDialog } from '../components/sales/VoidConfirmDialog';
import { useSalesEditStore } from '../stores/salesEditStore';

interface AdminSummary {
  totalCount: number;
  totalRevenue: string;
  trendData: Array<{ date: string; count: number }>;
  productBreakdown: Array<{ name: string; count: number; revenue: string }>;
  mopBreakdown: Array<{ name: string; count: number }>;
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
  const revenueValue = summary ? '₱' + summary.totalRevenue : '—';
  const totalSalesValue = summary ? String(summary.totalCount) : '—';

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={salesLoading || csvExporting}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {csvExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Stats banner — D-09: NOT affected by filter state */}
      <div className="grid grid-cols-2 gap-6 mb-12">
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
