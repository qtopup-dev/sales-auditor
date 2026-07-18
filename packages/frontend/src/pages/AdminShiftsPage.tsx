import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { AdminShiftTabs } from '../components/shift/AdminShiftTabs';
import { ShiftTotalsBanner } from '../components/shift/ShiftTotalsBanner';
import { ForceClockOutConfirmDialog } from '../components/shift/ForceClockOutConfirmDialog';
import { useShiftStore } from '../stores/shiftStore';
import { phTodayString } from '../lib/shiftTime';

interface AdminShiftSaleRow {
  id: number;
  productNameSnapshot: string;
  priceSnapshot: string;
  mopNameSnapshot: string;
  receiverNameSnapshot: string;
  notes: string | null;
  status: 'active' | 'void';
  updatedAt: string;
}

interface AdminShiftTab {
  userId: number;
  username: string;
  shiftId: number;
  clockOutAt: string | null;
  activeSalesCount: number;
  activeSalesRevenue: string;
  sales: AdminShiftSaleRow[];
}

interface AdminShiftsResponse {
  date: string;
  tabs: AdminShiftTab[];
}

function formatDateTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

// D-15: admin-only oversight page — read-only (no Void/Audit here, use DashboardPage/SalesPage).
export function AdminShiftsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(phTodayString());
  const [activeShiftId, setActiveShiftId] = useState<number | null>(null);
  const { openForceClockOutDialog } = useShiftStore();

  const isToday = selectedDate === phTodayString();

  // D-17: poll every 45s while viewing today; static (no polling) for past dates.
  const { data, isLoading } = useQuery<AdminShiftsResponse>({
    queryKey: ['admin-shifts', selectedDate],
    queryFn: () => api.get<AdminShiftsResponse>(`/admin/shifts?date=${selectedDate}`).then((r) => r.data),
    refetchInterval: isToday ? 45000 : false,
  });

  const tabs = data?.tabs ?? [];

  // Reset the selected tab whenever the date changes and the previous selection no longer
  // exists in the new tab list (UI-SPEC.md §AdminShiftsPage Date Change).
  const resolvedActiveShiftId = useMemo(() => {
    if (tabs.length === 0) return null;
    if (activeShiftId !== null && tabs.some((t) => t.shiftId === activeShiftId)) return activeShiftId;
    return tabs[0].shiftId;
  }, [tabs, activeShiftId]);

  const selectedTab = tabs.find((t) => t.shiftId === resolvedActiveShiftId) ?? null;

  const handleDateChange = (value: string) => {
    setSelectedDate(value);
    setActiveShiftId(null); // reset selection — resolved fresh above once the new tabs load
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Shifts</h1>
      </div>

      <div className="flex flex-col gap-1 mb-6 w-48">
        <label className="text-sm font-normal text-gray-500 dark:text-gray-400">Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md px-3 text-sm text-gray-900 dark:text-gray-100 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Loading shifts...</p>
      ) : tabs.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-8 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No shifts recorded for this date</p>
          <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
            Select a different date, or check back once a moderator clocks in.
          </p>
        </div>
      ) : (
        <>
          <AdminShiftTabs
            tabs={tabs.map((t) => ({ shiftId: t.shiftId, username: t.username, clockOutAt: t.clockOutAt }))}
            activeShiftId={resolvedActiveShiftId}
            onSelect={setActiveShiftId}
          />
          {selectedTab && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 border-t-0 rounded-b-md p-4 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                <ShiftTotalsBanner count={selectedTab.activeSalesCount} revenue={selectedTab.activeSalesRevenue} />
                {isToday && selectedTab.clockOutAt === null && (
                  <button
                    type="button"
                    onClick={() =>
                      openForceClockOutDialog({ shiftId: selectedTab.shiftId, username: selectedTab.username })
                    }
                    className="px-4 py-2 h-10 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-md text-sm font-normal hover:bg-red-50 dark:hover:bg-red-950 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 min-h-[44px]"
                  >
                    Force Clock Out
                  </button>
                )}
              </div>

              {selectedTab.sales.length === 0 ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-8 text-center">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No sales recorded</p>
                  <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    This moderator did not enter any sales during this shift.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <th className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left">Product</th>
                          <th className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-right">Price</th>
                          <th className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left">MOP</th>
                          <th className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left">Receiver</th>
                          <th className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left">Notes</th>
                          <th className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left">Date Edited</th>
                          <th className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTab.sales.map((sale) => {
                          const isVoided = sale.status === 'void';
                          return (
                            <tr
                              key={sale.id}
                              className={
                                isVoided
                                  ? 'bg-red-50 dark:bg-red-950 border-b border-gray-200 dark:border-gray-700 hover:bg-red-100 dark:hover:bg-red-900'
                                  : 'bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }
                            >
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{sale.productNameSnapshot}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right">{sale.priceSnapshot}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{sale.mopNameSnapshot}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{sale.receiverNameSnapshot}</td>
                              <td
                                className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 line-clamp-2"
                                title={sale.notes ?? undefined}
                              >
                                {sale.notes ?? ''}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDateTime(sale.updatedAt)}</td>
                              <td className="px-4 py-3 text-sm">
                                {sale.status === 'active' ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                                    Void
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ForceClockOutConfirmDialog />
    </div>
  );
}
