import { jsx as _jsx } from "react/jsx-runtime";
const ACTIVE_TAB_CLASSES = 'px-4 py-2 text-sm font-normal text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 rounded-t-md border border-b-0 border-gray-200 dark:border-gray-700 min-h-[44px]';
const INACTIVE_TAB_CLASSES = 'px-4 py-2 text-sm font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 rounded-t-md border border-b-0 border-transparent min-h-[44px]';
export function AdminShiftTabs({ tabs, activeShiftId, onSelect }) {
    return (_jsx("div", { className: "flex gap-1 overflow-x-auto bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 pt-2", children: tabs.map((tab) => (_jsx("button", { type: "button", onClick: () => onSelect(tab.shiftId), className: tab.shiftId === activeShiftId ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES, children: tab.username }, tab.shiftId))) }));
}
