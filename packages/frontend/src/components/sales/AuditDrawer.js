import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { useSalesEditStore } from '../../stores/salesEditStore';
function actionLabel(action, fieldName) {
    if (action === 'create')
        return 'Created row';
    if (action === 'void')
        return 'Voided row';
    if (action === 'update')
        return `Updated ${fieldName ?? 'field'}`;
    return action;
}
export function AuditDrawer() {
    const { openAuditSaleId, closeAuditDrawer } = useSalesEditStore();
    const isOpen = openAuditSaleId !== null;
    useEffect(() => {
        if (!isOpen)
            return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape')
                closeAuditDrawer();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeAuditDrawer]);
    const { data: entries = [], isLoading } = useQuery({
        queryKey: ['sales', openAuditSaleId, 'audit'],
        queryFn: () => api.get(`/sales/${openAuditSaleId}/audit`).then((r) => r.data),
        enabled: openAuditSaleId !== null,
    });
    if (!isOpen)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-gray-900/30 z-40", onClick: closeAuditDrawer, "aria-hidden": "true" }), _jsxs("div", { className: "fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col", role: "dialog", "aria-modal": "true", "aria-labelledby": "audit-drawer-title", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-6 border-b border-gray-200 dark:border-gray-700", children: [_jsx("h2", { id: "audit-drawer-title", className: "text-xl font-semibold text-gray-900 dark:text-gray-100", children: "Audit Log" }), _jsx("button", { type: "button", onClick: closeAuditDrawer, className: "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded", "aria-label": "Close", children: "\u2715" })] }), _jsx("div", { className: "flex-1 overflow-y-auto px-6 py-4", children: isLoading ? (_jsx("p", { className: "text-sm font-normal text-gray-500 dark:text-gray-400", children: "Loading..." })) : entries.length === 0 ? (_jsx("p", { className: "text-sm font-normal text-gray-500 dark:text-gray-400", children: "No audit entries found." })) : (_jsx("div", { className: "divide-y divide-gray-100 dark:divide-gray-700", children: entries.map((entry) => (_jsxs("div", { className: "py-3", children: [_jsxs("p", { className: "text-xs font-normal text-gray-400 dark:text-gray-500", children: [entry.createdAt.replace('T', ' ').slice(0, 16), " UTC"] }), _jsxs("p", { className: "text-sm font-normal text-gray-900 dark:text-gray-100", children: [entry.userUsername, _jsxs("span", { className: "text-gray-500 dark:text-gray-400", children: [' · ', actionLabel(entry.action, entry.fieldName)] })] }), entry.action === 'update' && entry.fieldName && (_jsxs("p", { className: "text-sm font-normal mt-0.5", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "Field: " }), _jsx("span", { className: "text-gray-900 dark:text-gray-100", children: entry.fieldName }), '  ', _jsx("span", { className: "text-gray-900 dark:text-gray-100", children: entry.oldValue ?? '—' }), _jsx("span", { className: "text-gray-400 dark:text-gray-500", children: " \u2192 " }), _jsx("span", { className: "text-gray-900 dark:text-gray-100", children: entry.newValue ?? '—' })] }))] }, entry.id))) })) })] })] }));
}
