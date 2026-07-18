interface ShiftHistoryEntry {
    id: number;
    clockInAt: string;
    clockOutAt: string | null;
    activeSalesCount: number;
    activeSalesRevenue: string;
}
interface ShiftHistoryTableProps {
    shifts: ShiftHistoryEntry[];
    loading: boolean;
    isError: boolean;
}
export declare function ShiftHistoryTable({ shifts, loading, isError }: ShiftHistoryTableProps): import("react").JSX.Element;
export {};
