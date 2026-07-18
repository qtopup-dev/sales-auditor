import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import { ShiftHistoryTable } from '../components/shift/ShiftHistoryTable';

interface ShiftHistoryEntry {
  id: number;
  clockInAt: string;
  clockOutAt: string | null;
  activeSalesCount: number;
  activeSalesRevenue: string;
}

// D-14: moderator-only page (route accessible to both roles at the router level, but only
// MODERATOR_NAV links to it — Plan 07 wires the nav item). Read-only, no CTA button.
export function ShiftHistoryPage() {
  const { data: shifts = [], isLoading, isError } = useQuery<ShiftHistoryEntry[]>({
    queryKey: ['shift-history'],
    queryFn: () => api.get<ShiftHistoryEntry[]>('/shifts/history').then((r) => r.data),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Shift History</h1>
      </div>
      <ShiftHistoryTable shifts={shifts} loading={isLoading} isError={isError} />
    </div>
  );
}
