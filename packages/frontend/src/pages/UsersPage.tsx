// UsersPage — full user management (Phase 4)
// USERS-01: view all users
// USERS-02: invite moderator via POST /api/auth/invite
// USERS-03: edit username via UserModal + PATCH /api/users/:id/username
// USERS-04: toggle canEdit via PATCH /api/users/:id
// USERS-05/USERS-06: reset password via POST /api/users/:id/reset-password (session invalidation server-side)
// D-14: follows ProductsPage pattern exactly
// CLAUDE.md Rule 10: pessimistic UI — pendingCanEditId + pendingResetId

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { api } from '../lib/axios';
import { StatusBadge } from '../components/StatusBadge';
import { UserModal } from '../components/users/UserModal';
import { InviteModal } from '../components/users/InviteModal';
import { ResetPasswordModal } from '../components/users/ResetPasswordModal';
import { UserDeleteConfirmDialog } from '../components/users/UserDeleteConfirmDialog';
import { useAuthStore } from '../stores/authStore';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'moderator';
  canEdit: boolean;
  isActive: boolean;
  organizationId: number;
  createdAt: string;
  updatedAt: string;
}

// USERS-01: admin views all users
export function UsersPage() {
  const queryClient = useQueryClient();

  // Modal state — null = closed, User object = edit mode
  const [modalTarget, setModalTarget] = useState<User | null>(null);

  // Invite modal state
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Reset password modal state
  const [tempPassword, setTempPassword] = useState('');
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Pessimistic per-row pending state (CLAUDE.md Rule 10)
  const [pendingCanEditId, setPendingCanEditId] = useState<number | null>(null);
  const [pendingResetId, setPendingResetId] = useState<number | null>(null);

  // Delete confirm dialog target — separate from modalTarget so Edit and Delete never collide
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // Fetch all users (active + inactive)
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users').then((r) => r.data),
  });

  // canEdit toggle mutation (USERS-04, ROLES-02)
  const canEditMutation = useMutation({
    mutationFn: ({ userId, canEdit }: { userId: number; canEdit: boolean }) => {
      setPendingCanEditId(userId);
      return api.patch<User>(`/users/${userId}`, { canEdit }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setPendingCanEditId(null);
    },
    onError: () => setPendingCanEditId(null),
  });

  // Invite Moderator handler (USERS-02)
  // Endpoint: POST /api/auth/invite — returns { inviteUrl: string }
  const handleInvite = async () => {
    setInviteGenerating(true);
    try {
      const result = await api.post<{ inviteUrl: string }>('/auth/invite').then((r) => r.data);
      setInviteUrl(result.inviteUrl);
      setInviteModalOpen(true);
    } catch {
      alert('Failed to generate invite link. Please try again.');
    } finally {
      setInviteGenerating(false);
    }
  };

  // Reset password handler (USERS-05/USERS-06)
  const handleResetPassword = async (userId: number) => {
    setPendingResetId(userId);
    try {
      const result = await api
        .post<{ tempPassword: string }>(`/users/${userId}/reset-password`)
        .then((r) => r.data);
      setTempPassword(result.tempPassword);
      setResetModalOpen(true);
    } catch {
      alert('Failed to reset password. Please try again.');
    } finally {
      setPendingResetId(null);
    }
  };

  // react-table v8 column definitions (D-15, UI-SPEC.md §UsersTable)
  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'username',
      header: 'Username',
      size: 200,
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      size: 100,
      cell: ({ getValue }) => {
        const role = getValue<'admin' | 'moderator'>();
        return (
          <span className="text-sm text-gray-900 dark:text-gray-100">
            {role === 'admin' ? 'Admin' : 'Moderator'}
          </span>
        );
      },
    },
    {
      id: 'editRights',
      header: 'Edit Rights',
      size: 110,
      cell: ({ row }) => {
        const user = row.original;
        if (user.role === 'admin') {
          return <span className="text-sm text-gray-500 dark:text-gray-400 block text-center">—</span>;
        }
        return (
          <span
            className={`text-sm block text-center ${
              user.canEdit ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {user.canEdit ? 'Yes' : 'No'}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      size: 90,
      cell: ({ row }) => <StatusBadge active={row.original.isActive} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 240,
      cell: ({ row }) => {
        const user = row.original;
        const isRowPending = pendingCanEditId === user.id || pendingResetId === user.id;
        const canEditPending = pendingCanEditId === user.id;
        const resetPending = pendingResetId === user.id;
        const isModerator = user.role === 'moderator';
        const isOwnRow = user.id === useAuthStore.getState().user?.id;

        return (
          <div className="flex items-center gap-1">
            {/* Edit username — USERS-03 */}
            <button
              type="button"
              onClick={() => setModalTarget(user)}
              disabled={isRowPending}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Edit
            </button>

            {/* canEdit toggle — USERS-04, shown for moderators only (D-19) */}
            {isModerator && (
              <>
                <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
                <button
                  type="button"
                  disabled={isRowPending}
                  onClick={() =>
                    canEditMutation.mutate({ userId: user.id, canEdit: !user.canEdit })
                  }
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {canEditPending
                    ? user.canEdit
                      ? 'Disabling...'
                      : 'Enabling...'
                    : user.canEdit
                    ? 'Disable Editing'
                    : 'Enable Editing'}
                </button>
                <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
              </>
            )}

            {/* No canEdit toggle for admin rows — separator before Reset Password */}
            {!isModerator && <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>}

            {/* Reset password — USERS-05/USERS-06 */}
            <button
              type="button"
              disabled={isRowPending}
              onClick={() => handleResetPassword(user.id)}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {resetPending ? 'Resetting...' : 'Reset Password'}
            </button>

            <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
            <button
              type="button"
              disabled={isRowPending || isOwnRow}
              onClick={() => setDeleteTarget(user)}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Users</h1>
        <button
          type="button"
          onClick={handleInvite}
          disabled={inviteGenerating}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {inviteGenerating ? 'Generating...' : 'Invite Moderator'}
        </button>
      </div>

      {/* Users table */}
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : users.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md p-8 text-center">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No users yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Invite a moderator to get started.</p>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[740px]">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-sm font-normal text-gray-500 dark:text-gray-400 text-left"
                      style={
                        header.column.getSize() !== 150
                          ? { width: header.column.getSize() }
                          : undefined
                      }
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* UserModal — username edit (USERS-03) */}
      <UserModal
        user={modalTarget ? { id: modalTarget.id, username: modalTarget.username } : null}
        onClose={() => setModalTarget(null)}
      />

      {/* InviteModal — displays generated invite link (USERS-02) */}
      <InviteModal
        open={inviteModalOpen}
        inviteUrl={inviteUrl}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* ResetPasswordModal — displays temp password once (USERS-05) */}
      <ResetPasswordModal
        open={resetModalOpen}
        tempPassword={tempPassword}
        onClose={() => setResetModalOpen(false)}
      />

      {/* UserDeleteConfirmDialog — Delete user (D-08/D-09/D-10 safeguards enforced server-side) */}
      <UserDeleteConfirmDialog
        user={deleteTarget ? { id: deleteTarget.id, username: deleteTarget.username } : null}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
