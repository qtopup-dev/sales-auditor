import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '@alejinput/shared';
import { api } from '../../lib/axios';
import { useSalesEditStore } from '../../stores/salesEditStore';

function actionLabel(action: string, fieldName: string | null): string {
  if (action === 'create') return 'Created row';
  if (action === 'void') return 'Voided row';
  if (action === 'update') return `Updated ${fieldName ?? 'field'}`;
  return action;
}

export function AuditDrawer() {
  const { openAuditSaleId, closeAuditDrawer } = useSalesEditStore();
  const isOpen = openAuditSaleId !== null;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAuditDrawer();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeAuditDrawer]);

  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['sales', openAuditSaleId, 'audit'],
    queryFn: () =>
      api.get<AuditEntry[]>(`/sales/${openAuditSaleId}/audit`).then((r) => r.data),
    enabled: openAuditSaleId !== null,
  });

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-gray-900/30 z-40"
        onClick={closeAuditDrawer}
        aria-hidden="true"
      />
      <div
        className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-drawer-title"
      >
        <div className="flex items-center justify-between px-6 py-6 border-b border-gray-200 dark:border-gray-700">
          <h2
            id="audit-drawer-title"
            className="text-xl font-semibold text-gray-900 dark:text-gray-100"
          >
            Audit Log
          </h2>
          <button
            type="button"
            onClick={closeAuditDrawer}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">No audit entries found.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {entries.map((entry) => (
                <div key={entry.id} className="py-3">
                  <p className="text-xs font-normal text-gray-400 dark:text-gray-500">
                    {entry.createdAt.replace('T', ' ').slice(0, 16)} UTC
                  </p>
                  <p className="text-sm font-normal text-gray-900 dark:text-gray-100">
                    {entry.userUsername}
                    <span className="text-gray-500 dark:text-gray-400">
                      {' · '}
                      {actionLabel(entry.action, entry.fieldName)}
                    </span>
                  </p>
                  {entry.action === 'update' && entry.fieldName && (
                    <p className="text-sm font-normal mt-0.5">
                      <span className="text-gray-500 dark:text-gray-400">Field: </span>
                      <span className="text-gray-900 dark:text-gray-100">{entry.fieldName}</span>
                      {'  '}
                      <span className="text-gray-900 dark:text-gray-100">{entry.oldValue ?? '—'}</span>
                      <span className="text-gray-400 dark:text-gray-500"> → </span>
                      <span className="text-gray-900 dark:text-gray-100">{entry.newValue ?? '—'}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
