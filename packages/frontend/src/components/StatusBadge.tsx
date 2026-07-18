// UI-SPEC.md §Status badge — green Active / gray Inactive
// Used in Products table, MOPs table, and future User management table
export function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-normal bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      Inactive
    </span>
  );
}
