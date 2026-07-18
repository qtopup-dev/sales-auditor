// UI-SPEC.md §SalesFilterBar — live-filtering controls for DashboardPage admin table
// D-05: applied live on change, no Apply button
// D-06: FilterState shape

import Select from 'react-select';
import type { Sale } from '@alejinput/shared';
import { makeSelectStyles } from '../../lib/selectStyles';

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

// Controls are h-10 (40px) to align with button height across the app;
// theme-aware styling comes from the shared select styles module.
const selectStyles = makeSelectStyles<{ value: number; label: string }>({ height: 40 });

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
        <label className="text-sm font-normal text-gray-500 dark:text-gray-400">From</label>
        <input
          type="date"
          value={filters.startDate ?? ''}
          onChange={(e) =>
            onFilterChange({ ...filters, startDate: e.target.value || null })
          }
          className="h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md px-3 text-sm text-gray-900 dark:text-gray-100 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* To date */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-normal text-gray-500 dark:text-gray-400">To</label>
        <input
          type="date"
          value={filters.endDate ?? ''}
          onChange={(e) =>
            onFilterChange({ ...filters, endDate: e.target.value || null })
          }
          className="h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-md px-3 text-sm text-gray-900 dark:text-gray-100 dark:[color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Product filter */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-normal text-gray-500 dark:text-gray-400">Product</label>
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
        <label className="text-sm font-normal text-gray-500 dark:text-gray-400">MOP</label>
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
        <label className="text-sm font-normal text-gray-500 dark:text-gray-400">Moderator</label>
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
        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 self-end h-10 px-2"
      >
        Clear filters
      </button>
    </div>
  );
}
