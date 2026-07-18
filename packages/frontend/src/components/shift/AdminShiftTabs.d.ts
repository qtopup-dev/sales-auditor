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
export declare function AdminShiftTabs({ tabs, activeShiftId, onSelect }: AdminShiftTabsProps): import("react").JSX.Element;
export {};
