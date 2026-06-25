// UI-SPEC.md §SalesFilterBar — live-filtering controls for DashboardPage admin table
// D-05: applied live on change, no Apply button
// D-06: FilterState shape

import Select from 'react-select';
import type { Sale } from '@alejinput/shared';

export interface FilterState {
  startDate: string | null;
  endDate: string | null;
  productId: number | null;
  mopId: number | null;
  createdById: number | null;
}

// Apply all active filters in-memory (D-04 client-side filtering)
// sale.createdAt is ISO-8601 string — lexicographic comparison is safe (RESEARCH.md Pattern 4)
export function applyFilters(sales: Sale[], filters: FilterState): Sale[] {
  return sales.filter((sale) => {
    if (filters.startDate && sale.createdAt < filters.startDate) return false;
    if (filters.endDate) {
      const endDayInclusive = filters.endDate + 'T23:59:59.999Z';
      if (sale.createdAt > endDayInclusive) return false;
    }
    if (filters.productId !== null && sale.productId !== filters.productId) return false;
    if (filters.mopId !== null && sale.mopId !== filters.mopId) return false;
    if (filters.createdById !== null && sale.createdById !== filters.createdById) return false;
    return true;
  });
}

interface SalesFilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  products: Array<{ id: number; name: string }>;
  mops: Array<{ id: number; name: string }>;
  users: Array<{ id: number; username: string }>;
}

// react-select custom styles matching UI-SPEC.md §SalesFilterBar
// Controls are h-10 (40px) to align with button height across the app
const selectStyles = {
  control: (base: Record<string, unknown>) => ({
    ...base,
    height: '40px',
    minHeight: '40px',
    borderColor: '#d1d5db',   // gray-300
    borderRadius: '6px',
    fontSize: '14px',
    '&:hover': { borderColor: '#9ca3af' },  // gray-400
  }),
  placeholder: (base: Record<string, unknown>) => ({ ...base, color: '#6b7280' }), // gray-500
};

export function SalesFilterBar({
  filters,
  onFilterChange,
  products,
  mops,
  users,
}: SalesFilterBarProps) {
  const productOptions = products.map((p) => ({ value: p.id, label: p.name }));
  const mopOptions = mops.map((m) => ({ value: m.id, label: m.name }));
  const userOptions = users.map((u) => ({ value: u.id, label: u.username }));

  const clearAll = () =>
    onFilterChange({
      startDate: null,
      endDate: null,
      productId: null,
      mopId: null,
      createdById: null,
    });

  return (
    <div className="flex items-end gap-4 flex-wrap mb-4">
      {/* From date */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-normal text-gray-500">From</label>
        <input
          type="date"
          value={filters.startDate ?? ''}
          onChange={(e) =>
            onFilterChange({ ...filters, startDate: e.target.value || null })
          }
          className="h-10 border border-gray-300 rounded-md px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* To date */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-normal text-gray-500">To</label>
        <input
          type="date"
          value={filters.endDate ?? ''}
          onChange={(e) =>
            onFilterChange({ ...filters, endDate: e.target.value || null })
          }
          className="h-10 border border-gray-300 rounded-md px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Product filter */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-normal text-gray-500">Product</label>
        <div className="w-48">
          <Select
            options={productOptions}
            isClearable
            placeholder="All products"
            value={productOptions.find((o) => o.value === filters.productId) ?? null}
            onChange={(opt) => onFilterChange({ ...filters, productId: opt?.value ?? null })}
            styles={selectStyles}
            menuPortalTarget={document.body}
          />
        </div>
      </div>

      {/* MOP filter */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-normal text-gray-500">MOP</label>
        <div className="w-40">
          <Select
            options={mopOptions}
            isClearable
            placeholder="All MOPs"
            value={mopOptions.find((o) => o.value === filters.mopId) ?? null}
            onChange={(opt) => onFilterChange({ ...filters, mopId: opt?.value ?? null })}
            styles={selectStyles}
            menuPortalTarget={document.body}
          />
        </div>
      </div>

      {/* Moderator filter */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-normal text-gray-500">Moderator</label>
        <div className="w-48">
          <Select
            options={userOptions}
            isClearable
            placeholder="All moderators"
            value={userOptions.find((o) => o.value === filters.createdById) ?? null}
            onChange={(opt) =>
              onFilterChange({ ...filters, createdById: opt?.value ?? null })
            }
            styles={selectStyles}
            menuPortalTarget={document.body}
          />
        </div>
      </div>

      {/* Clear all filters */}
      <button
        type="button"
        onClick={clearAll}
        className="text-sm text-gray-500 hover:text-gray-900 self-end h-10 px-2"
      >
        Clear filters
      </button>
    </div>
  );
}
