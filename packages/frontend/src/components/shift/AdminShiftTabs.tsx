// UI-SPEC.md §Component Contract: AdminShiftTabs — Excel-sheet-tab style, one tab per
// moderator with a shift that date. No direct codebase precedent (new UI pattern) — built
// directly from the UI-SPEC.md Color section's tab class strings.

interface ShiftTabInfo {
  shiftId: number;
  username: string;
  clockOutAt: string | null;
}

interface AdminShiftTabsProps {
  tabs: ShiftTabInfo[];
  activeShiftId: number | null;
  onSelect: (shiftId: number) => void;
}

const ACTIVE_TAB_CLASSES =
  'px-4 py-2 text-sm font-normal text-gray-900 bg-white rounded-t-md border border-b-0 border-gray-200 min-h-[44px]';
const INACTIVE_TAB_CLASSES =
  'px-4 py-2 text-sm font-normal text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-700 rounded-t-md border border-b-0 border-transparent min-h-[44px]';

export function AdminShiftTabs({ tabs, activeShiftId, onSelect }: AdminShiftTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto bg-gray-100 border-b border-gray-200 px-2 pt-2">
      {tabs.map((tab) => (
        <button
          key={tab.shiftId}
          type="button"
          onClick={() => onSelect(tab.shiftId)}
          className={tab.shiftId === activeShiftId ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES}
        >
          {tab.username}
        </button>
      ))}
    </div>
  );
}
