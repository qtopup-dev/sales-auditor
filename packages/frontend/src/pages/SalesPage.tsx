import { useQuery } from '@tanstack/react-query';
import type { Sale } from '@alejinput/shared';
import { api } from '../lib/axios';
import { useSalesEditStore } from '../stores/salesEditStore';
import { useAuthStore } from '../stores/authStore';
import { SalesTable } from '../components/sales/SalesTable';
import { AuditDrawer } from '../components/sales/AuditDrawer';
import { VoidConfirmDialog } from '../components/sales/VoidConfirmDialog';
import { ClockOutConfirmDialog } from '../components/shift/ClockOutConfirmDialog';
import { ShiftTotalsBanner } from '../components/shift/ShiftTotalsBanner';
import { formatLongDatePH } from '../lib/shiftTime';

interface CurrentShiftWithTotals {
  id: number;
  clockInAt: string;
  clockOutAt: string | null;
  activeSalesCount: number;
  activeSalesRevenue: string;
}

export function SalesPage() {
  const { user } = useAuthStore();
  const { isAddRowOpen, openAddRow } = useSalesEditStore();
  const isModerator = user?.role === 'moderator';

  // D-05: admins never have a shift — this query is disabled for admin sessions so the
  // admin's Sales Sheet retains its EXACT pre-Phase-7 behavior below.
  const { data: currentShift } = useQuery<CurrentShiftWithTotals | null>({
    queryKey: ['current-shift'],
    queryFn: () => api.get<CurrentShiftWithTotals | null>('/shifts/current').then((r) => r.data),
    enabled: isModerator,
  });

  // Admin: EXACT pre-Phase-7 query — full history, unconditional (D-05, unchanged capability).
  const { data: adminSales = [], isLoading: adminLoading, isError: adminError } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: () => api.get<Sale[]>('/sales').then((r) => r.data),
    enabled: !isModerator,
  });

  // Moderator: D-11 true reset — only runs once a shift exists; query key distinct from ['sales']
  // so React Query never conflates shift-scoped and full-history data (UI-SPEC.md).
  const { data: shiftSales = [], isLoading: shiftLoading, isError: shiftError } = useQuery<Sale[]>({
    queryKey: ['sales', 'current-shift'],
    queryFn: () => api.get<Sale[]>(`/sales?shiftId=${currentShift!.id}`).then((r) => r.data),
    enabled: isModerator && !!currentShift,
  });

  // Pre-fetch catalog data to warm React Query cache before Add Row is opened (D-07, unrelated
  // to Phase 7 — keep untouched).
  useQuery<Array<{ id: number; name: string; price: string }>>({
    queryKey: ['catalog-products'],
    queryFn: () => api.get('/catalog/products').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['catalog-mops'],
    queryFn: () => api.get('/catalog/mops').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const hasActiveShift = !!currentShift;
  // D-03: Add Row gating applies ONLY to moderators — admins retain their existing capability.
  const addRowDisabled = isModerator ? !hasActiveShift || isAddRowOpen : isAddRowOpen;

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 md:mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sales Sheet</h1>
          {isModerator && (
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400 mt-1">{formatLongDatePH()}</p>
          )}
        </div>
        <button
          type="button"
          disabled={addRowDisabled}
          title={isModerator && !hasActiveShift ? 'Clock in to add a new sale.' : undefined}
          onClick={openAddRow}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Row
        </button>
      </div>

      {isModerator && hasActiveShift && (
        <ShiftTotalsBanner
          count={currentShift!.activeSalesCount}
          revenue={currentShift!.activeSalesRevenue}
        />
      )}

      <div className="flex-1 min-h-0 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        {isModerator ? (
          !hasActiveShift ? (
            // State A (D-12): not clocked in — true reset, no rows queried at all.
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Clock in to start a shift</p>
              <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
                Use the Clock In button in the sidebar to begin your shift and start entering sales.
              </p>
            </div>
          ) : shiftLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Loading sales...</p>
            </div>
          ) : shiftError ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Failed to load sales. Please refresh the page.</p>
            </div>
          ) : shiftSales.length === 0 && !isAddRowOpen ? (
            // State B (D-12): clocked in, zero rows this shift.
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No sales yet this shift</p>
              <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
                Click &apos;Add Row&apos; to enter your first sale.
              </p>
            </div>
          ) : (
            // State C: clocked in, has shift sales.
            <SalesTable sales={shiftSales} />
          )
        ) : adminLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Loading sales...</p>
          </div>
        ) : adminError ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Failed to load sales. Please refresh the page.</p>
          </div>
        ) : adminSales.length === 0 && !isAddRowOpen ? (
          // Admin: EXACT pre-Phase-7 empty state, unchanged.
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No sales yet</p>
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
              Click &apos;Add Row&apos; to enter the first sale.
            </p>
          </div>
        ) : (
          <SalesTable sales={adminSales} />
        )}
      </div>

      {user?.role === 'admin' && <AuditDrawer />}
      <VoidConfirmDialog />
      {isModerator && <ClockOutConfirmDialog />}
    </div>
  );
}
