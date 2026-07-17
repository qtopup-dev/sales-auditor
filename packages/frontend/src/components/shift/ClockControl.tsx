import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { useShiftStore } from '../../stores/shiftStore';

interface CurrentShift {
  id: number;
  clockInAt: string; // ISO 8601 UTC
}

// D-08: 12-hour AM/PM display derived from UTC hour/minute components (NOT browser-local time)
// — keeps CLAUDE.md Rule 7 (UTC everywhere) while satisfying the human-readable format.
// This is the ONE exception to the app's 24-hour UTC table-column convention (UI-SPEC.md
// §Component Contract: ClockControl §Time Display) — justified because this is a glanceable
// sidebar status readout, not an audit-grade record.
function formatClockTime(iso: string): string {
  const d = new Date(iso);
  let hours = d.getUTCHours();
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

// D-07: mirrors the existing username/logout block shell exactly (AuthenticatedLayout.tsx).
// Rendered ONLY for role === 'moderator' by the caller (Plan 07 wires this conditional).
export function ClockControl() {
  const queryClient = useQueryClient();
  const { openClockOutDialog } = useShiftStore();

  const { data: currentShift } = useQuery<CurrentShift | null>({
    queryKey: ['current-shift'],
    queryFn: () => api.get<CurrentShift | null>('/shifts/current').then((r) => r.data),
  });

  const clockInMutation = useMutation({
    mutationFn: () => api.post('/shifts/clock-in').then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-shift'] });
    },
  });

  return (
    <div className="px-4 py-4 border-t border-gray-200">
      {currentShift ? (
        <>
          <p className="text-xs font-normal text-gray-500 mb-2">
            Clocked in at {formatClockTime(currentShift.clockInAt)}
          </p>
          <button
            type="button"
            onClick={openClockOutDialog}
            className="w-full h-10 border border-gray-300 bg-white text-gray-700 rounded-md text-sm font-normal hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px]"
          >
            Clock Out
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={clockInMutation.isPending}
            onClick={() => clockInMutation.mutate()}
            className="w-full h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {clockInMutation.isPending ? 'Clocking In...' : 'Clock In'}
          </button>
          {clockInMutation.isError && (
            <p className="text-xs text-red-600 mt-1">Failed to clock in. Please try again.</p>
          )}
        </>
      )}
    </div>
  );
}
