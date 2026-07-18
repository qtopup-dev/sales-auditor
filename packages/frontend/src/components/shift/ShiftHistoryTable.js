import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// UI-SPEC.md §Component Contract: ShiftHistoryTable — react-table v8, read-only, no
// Actions/CSV column (precedent: every other tabular view in the app uses react-table v8).
import { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender, } from '@tanstack/react-table';
import { PaginationFooter } from '../PaginationFooter';
import { formatClockTime, formatShiftDate } from '../../lib/shiftTime';
// New utility — no existing precedent in the codebase (only formatDateTime for absolute
// timestamps exists). Guards the still-open case with "In progress" (Claude's discretion).
function formatDuration(clockInAt, clockOutAt) {
    if (!clockOutAt)
        return 'In progress';
    const ms = new Date(clockOutAt).getTime() - new Date(clockInAt).getTime();
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}
export function ShiftHistoryTable({ shifts, loading, isError }) {
    const [pageSizeOption, setPageSizeOption] = useState(25);
    const [pageIndex, setPageIndex] = useState(0);
    const effectivePageSize = pageSizeOption === 'all' ? Math.max(shifts.length, 1) : pageSizeOption;
    const effectivePageIndex = pageSizeOption === 'all' ? 0 : pageIndex;
    const handlePageSizeChange = (size) => {
        setPageSizeOption(size);
        setPageIndex(0);
    };
    const columns = useMemo(() => [
        {
            accessorKey: 'clockInAt',
            header: 'Date',
            size: 120,
            cell: ({ getValue }) => (_jsx("span", { className: "text-sm text-gray-900 dark:text-gray-100", children: formatShiftDate(getValue()) })),
        },
        {
            id: 'clockIn',
            header: 'Clock In',
            size: 110,
            cell: ({ row }) => (_jsx("span", { className: "text-sm text-gray-900 dark:text-gray-100", children: formatClockTime(row.original.clockInAt) })),
        },
        {
            accessorKey: 'clockOutAt',
            header: 'Clock Out',
            size: 110,
            cell: ({ getValue }) => {
                const clockOutAt = getValue();
                return (_jsx("span", { className: "text-sm text-gray-500 dark:text-gray-400", children: clockOutAt ? formatClockTime(clockOutAt) : 'Still open' }));
            },
        },
        {
            id: 'duration',
            header: 'Duration',
            size: 100,
            cell: ({ row }) => (_jsx("span", { className: "text-sm text-gray-500 dark:text-gray-400", children: formatDuration(row.original.clockInAt, row.original.clockOutAt) })),
        },
        {
            accessorKey: 'activeSalesCount',
            header: () => _jsx("span", { className: "block text-right", children: "Sales" }),
            size: 80,
            cell: ({ getValue }) => (_jsx("span", { className: "block text-right text-sm text-gray-900 dark:text-gray-100", children: getValue() })),
        },
        {
            accessorKey: 'activeSalesRevenue',
            header: () => _jsx("span", { className: "block text-right", children: "Revenue" }),
            size: 120,
            cell: ({ getValue }) => (
            // Display string as-is — NEVER parseFloat (CLAUDE.md Rule 6)
            _jsx("span", { className: "block text-right text-sm text-gray-900 dark:text-gray-100", children: '₱' + getValue() })),
        },
    ], []);
    const table = useReactTable({
        data: shifts,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        state: { pagination: { pageIndex: effectivePageIndex, pageSize: effectivePageSize } },
        onPaginationChange: (updater) => {
            const next = typeof updater === 'function'
                ? updater({ pageIndex: effectivePageIndex, pageSize: effectivePageSize })
                : updater;
            setPageIndex(next.pageIndex);
        },
    });
    if (loading) {
        return _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Loading shift history..." });
    }
    if (isError) {
        return _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Failed to load shift history. Please refresh the page." });
    }
    if (shifts.length === 0) {
        return (_jsxs("div", { className: "border border-gray-200 dark:border-gray-700 rounded-md p-8 text-center", children: [_jsx("p", { className: "text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1", children: "No shifts yet" }), _jsx("p", { className: "text-sm font-normal text-gray-500 dark:text-gray-400", children: "Clock in from the sidebar to start your first shift." })] }));
    }
    return (_jsxs("div", { className: "border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full min-w-[640px]", children: [_jsx("thead", { children: table.getHeaderGroups().map((headerGroup) => (_jsx("tr", { className: "bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700", children: headerGroup.headers.map((header) => (_jsx("th", { className: "px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left", style: { width: header.column.getSize() !== 150 ? header.column.getSize() : undefined }, children: flexRender(header.column.columnDef.header, header.getContext()) }, header.id))) }, headerGroup.id))) }), _jsx("tbody", { children: table.getRowModel().rows.map((row) => (
                            // No strikethrough/tint — an open shift is a normal active state, not voided (UI-SPEC.md)
                            _jsx("tr", { className: "bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800", children: row.getVisibleCells().map((cell) => (_jsx("td", { className: "px-4 py-3 text-sm text-gray-900 dark:text-gray-100", children: flexRender(cell.column.columnDef.cell, cell.getContext()) }, cell.id))) }, row.id))) })] }) }), _jsx(PaginationFooter, { pageSize: pageSizeOption, pageIndex: effectivePageIndex, totalRows: shifts.length, onPageSizeChange: handlePageSizeChange, canPrev: table.getCanPreviousPage(), canNext: table.getCanNextPage(), onPrev: () => table.previousPage(), onNext: () => table.nextPage() })] }));
}
