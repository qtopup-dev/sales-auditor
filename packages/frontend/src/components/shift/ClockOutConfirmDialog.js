import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { api } from '../../lib/axios';
import { useShiftStore } from '../../stores/shiftStore';
export function ClockOutConfirmDialog() {
    const queryClient = useQueryClient();
    const { isClockOutDialogOpen, closeClockOutDialog } = useShiftStore();
    const clockOutMutation = useMutation({
        mutationFn: () => api.post('/shifts/clock-out', {}).then((r) => r.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['current-shift'] });
            queryClient.invalidateQueries({ queryKey: ['sales', 'current-shift'] });
            closeClockOutDialog();
        },
    });
    const isPending = clockOutMutation.isPending;
    return (_jsxs(Modal, { open: isClockOutDialogOpen, onClose: isPending ? undefined : closeClockOutDialog, title: "Clock Out", footer: _jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: closeClockOutDialog, disabled: isPending, className: "px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-sm font-normal hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed", children: "Stay Clocked In" }), _jsx("button", { type: "button", disabled: isPending, onClick: () => clockOutMutation.mutate(), className: "px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed", children: isPending ? 'Clocking Out...' : 'Clock Out' })] }), children: [_jsx("p", { className: "text-sm font-normal text-gray-900 dark:text-gray-100", children: "Are you sure you want to clock out? Your shift will end and your Sales Sheet will reset until you clock in again." }), clockOutMutation.isError && (_jsx("p", { className: "text-sm font-normal text-red-600 dark:text-red-400 mt-2", children: "Failed to clock out. Please try again." }))] }));
}
