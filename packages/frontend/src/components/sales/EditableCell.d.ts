import type { Sale } from '@alejinput/shared';
interface EditableCellProps {
    sale: Sale;
    field: 'productId' | 'mopId' | 'receiverId' | 'notes';
    displayValue: string;
}
export declare function EditableCell({ sale, field, displayValue }: EditableCellProps): import("react").JSX.Element;
export {};
