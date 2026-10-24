import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false, loading = false }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn-sm" disabled={loading}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={`btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}>
            {loading ? 'Please wait...' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${danger ? 'text-red-500' : 'text-yellow-500'}`} />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </Modal>
  );
}
