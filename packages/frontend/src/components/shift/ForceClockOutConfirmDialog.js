import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import { useShiftStore } from '../../stores/shiftStore';
export function ForceClockOutConfirmDialog() {
    const queryClient = useQueryClient();
    const { isForceClockOutDialogOpen, forceClockOutTarget, closeForceClockOutDialog } = useShiftStore();
    const forceClockOutMutation = useMutation({
        mutationFn: (shiftId) => api.post(`/admin/shifts/${shiftId}/force-clock-out`, {}).then((r) => r.data),
        onSuccess: () => {
            // Broad invalidate covers every selectedDate key the AdminShiftsPage query uses.
            queryClient.invalidateQueries({ queryKey: ['admin-shifts'] });
            closeForceClockOutDialog();
        },
    });
    const isPending = forceClockOutMutation.isPending;
    return (_jsxs(Modal, { open: isForceClockOutDialogOpen, onClose: isPending ? undefined : closeForceClockOutDialog, title: "Force Clock Out", footer: _jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: closeForceClockOutDialog, disabled: isPending, className: "px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-normal hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed", children: "Keep Shift Open" }), _jsx("button", { type: "button", disabled: isPending, onClick: () => forceClockOutTarget && forceClockOutMutation.mutate(forceClockOutTarget.shiftId), className: "px-4 py-2 bg-red-600 text-white rounded-md text-sm font-normal hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed", children: isPending ? 'Forcing Clock Out...' : 'Force Clock Out' })] }), children: [_jsxs("p", { className: "text-sm font-normal text-gray-900 dark:text-gray-100", children: ["Force clock out ", forceClockOutTarget?.username, "? Their shift will end immediately and their Sales Sheet will reset. This does not affect their sales data \u2014 all rows remain intact."] }), forceClockOutMutation.isError && (_jsx("p", { className: "text-sm font-normal text-red-600 dark:text-red-400 mt-2", children: "Failed to force clock out. Please try again." }))] }));
}
