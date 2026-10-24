import { useState } from 'react';
import { AlertTriangle, RotateCcw, Loader2, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import { dashboardService } from '../../services';
import { useNotification } from '../../context/NotificationContext';
import { getErrorMessage } from '../../utils';

export function ResetDashboardModal({ isOpen, onClose, onSuccess }) {
  const { success, error } = useNotification();
  const [confirmed, setConfirmed] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!confirmed) return;

    setResetting(true);
    try {
      const res = await dashboardService.reset();
      success(res.data?.message || 'Dashboard and sales data have been reset to zero.');
      setConfirmed(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      error(getErrorMessage(err));
    } finally {
      setResetting(false);
    }
  };

  const handleClose = () => {
    if (resetting) return;
    setConfirmed(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Reset Dashboard & Event Data"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={handleClose}
            disabled={resetting}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!confirmed || resetting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {resetting ? 'Resetting Event Data...' : 'Confirm & Reset'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Warning Callout */}
        <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-800">Caution: This action cannot be undone!</p>
            <p className="text-xs text-red-700 leading-relaxed">
              Use this before the official church fundraising event starts to wipe all test sales, transactions, and expenses.
            </p>
          </div>
        </div>

        {/* Breakdown List */}
        <div className="space-y-2 text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
          <p className="font-medium text-gray-800 mb-1">What will be reset:</p>
          <div className="flex items-center gap-2 text-red-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>All completed and pending sales transactions</span>
          </div>
          <div className="flex items-center gap-2 text-red-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>All refunds and refund audit records</span>
          </div>
          <div className="flex items-center gap-2 text-red-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span>All recorded operating expenses</span>
          </div>
          <div className="flex items-center gap-2 text-forest-700">
            <span className="w-1.5 h-1.5 rounded-full bg-forest-600" />
            <span>Inventory will be reset to fresh opening stock (50 units per item)</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 pt-1 border-t border-gray-200 mt-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Product catalogue, custom selling prices, and team accounts will be preserved</span>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={resetting}
            className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-gray-300"
          />
          <span className="text-xs font-medium text-gray-800">
            I understand that all sales and financial analytics will be reset to ₹0.
          </span>
        </label>
      </div>
    </Modal>
  );
}
