import { useState } from 'react';
import { Modal } from '../Modal';

// UI-SPEC.md §ResetPasswordModal — temp password display modal
// USERS-05/USERS-06: admin resets password; session invalidation already done server-side
// D-18: POST /api/users/:id/reset-password returns { tempPassword } — modal receives it as prop
// Modal is always closeable — password already generated before this modal opens

interface ResetPasswordModalProps {
  open: boolean;
  tempPassword: string;
  onClose: () => void;
}

export function ResetPasswordModal({ open, tempPassword, onClose }: ResetPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Password Reset"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 h-10 bg-blue-600 text-white rounded-md text-sm font-normal hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Done
        </button>
      }
    >
      <p className="text-sm font-normal text-gray-500 mb-3">
        Copy and share this temporary password with the user. It will not be shown again.
      </p>
      <input
        type="text"
        readOnly
        value={tempPassword}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 bg-gray-50 font-mono select-all tracking-wider mb-3"
        onClick={(e) => (e.target as HTMLInputElement).select()}
      />
      <button
        type="button"
        onClick={handleCopy}
        className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 px-4 py-2 h-10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {copied ? 'Copied!' : 'Copy Password'}
      </button>
    </Modal>
  );
}
