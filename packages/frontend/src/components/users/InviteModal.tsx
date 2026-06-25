import { useState } from 'react';
import { Modal } from '../Modal';

// UI-SPEC.md §InviteModal — invite link display modal
// USERS-02: admin invites moderator by sharing generated invite link
// D-17: POST /api/auth/invite returns { inviteUrl } — this modal receives the URL as a prop
// Trigger: UsersPage calls POST /api/auth/invite, stores inviteUrl, opens this modal
// Modal is always closeable — link already generated before modal opens

interface InviteModalProps {
  open: boolean;
  inviteUrl: string;
  onClose: () => void;
}

export function InviteModal({ open, inviteUrl, onClose }: InviteModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite Moderator"
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
        Share this link with the new moderator. It expires in 48 hours and can only be used once.
      </p>
      <input
        type="text"
        readOnly
        value={inviteUrl}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 bg-gray-50 font-mono break-all select-all mb-3"
        onClick={(e) => (e.target as HTMLInputElement).select()}
      />
      <button
        type="button"
        onClick={handleCopy}
        className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 px-4 py-2 h-10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </Modal>
  );
}
