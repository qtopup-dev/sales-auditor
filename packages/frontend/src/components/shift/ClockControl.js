import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { useShiftStore } from '../../stores/shiftStore';
import { formatClockTime } from '../../lib/shiftTime';
// D-07: mirrors the existing username/logout block shell exactly (AuthenticatedLayout.tsx).
// Rendered ONLY for role === 'moderator' by the caller (Plan 07 wires this conditional).
export function ClockControl() {
    const queryClient = useQueryClient();
    const { openClockOutDialog } = useShiftStore();
    const { data: currentShift } = useQuery({
        queryKey: ['current-shift'],
        queryFn: () => api.get('/shifts/current').then((r) => r.data),
    });
    const clockInMutation = useMutation({
        mutationFn: () => api.post('/shifts/clock-in', {}).then((r) => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['current-shift'] });
        },
    });
    return (_jsx("div", { className: "px-4 py-4 border-t border-gray-200 dark:border-gray-800", children: currentShift ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-xs font-normal text-gray-500 dark:text-gray-400 mb-2", children: ["Clocked in at ", formatClockTime(currentShift.clockInAt)] }), _jsx("button", { type: "button", onClick: openClockOutDialog, className: "w-full h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-normal hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 min-h-[44px]", children: "Clock Out" })] })) : (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", disabled: clockInMutation.isPending, onClick: () => clockInMutation.mutate(), className: "w-full h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]", children: clockInMutation.isPending ? 'Clocking In...' : 'Clock In' }), clockInMutation.isError && (_jsx("p", { className: "text-xs text-red-600 dark:text-red-400 mt-1", children: "Failed to clock in. Please try again." }))] })) }));
}
