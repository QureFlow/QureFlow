import React, { useState } from 'react';
import { QueueToken } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Check, SkipForward, Ban, Phone } from 'lucide-react';

interface QueueTableProps {
  tokens: QueueToken[];
  onServe: (tokenId: string) => void;
  onSkip: (tokenId: string) => void;
  onCancel: (tokenId: string) => void;
  nextTokenId: string | null;
}

export const QueueTable: React.FC<QueueTableProps> = ({
  tokens,
  onServe,
  onSkip,
  onCancel,
  nextTokenId,
}) => {
  const waitingPositions = new Map(
    tokens
      .filter((token) => token.status === 'waiting')
      .map((token, index) => [token.id, index + 1]),
  );
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'skip' | 'cancel' | 'serve';
    token: QueueToken | null;
  }>({
    isOpen: false,
    action: 'serve',
    token: null,
  });

  const handleActionClick = (action: 'skip' | 'cancel' | 'serve', token: QueueToken) => {
    setConfirmModal({
      isOpen: true,
      action,
      token,
    });
  };

  const handleConfirmAction = () => {
    if (!confirmModal.token) return;
    const { action, token } = confirmModal;

    if (action === 'serve') onServe(token.id);
    else if (action === 'skip') onSkip(token.id);
    else if (action === 'cancel') onCancel(token.id);

    setConfirmModal({ isOpen: false, action: 'serve', token: null });
  };

  return (
    <>
      <div className="overflow-x-auto qf-panel">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4">Token</th>
              <th className="py-3 px-4">Patient Name & Contact</th>
              <th className="py-3 px-4">Time / Type</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Queue Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No patient tokens found in this doctor's queue today.
                </td>
              </tr>
            ) : (
              tokens.map((token) => {
                const isCurrent = token.status === 'current';
                const isWaiting = token.status === 'waiting';

                return (
                  <tr
                    key={token.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isCurrent ? 'bg-blue-50/40 font-medium' : ''
                    }`}
                  >
                    {/* Token */}
                    <td className="py-3 px-4">
                      <span
                        className={`font-mono font-bold text-sm px-2 py-1 rounded border ${
                          isCurrent
                            ? 'bg-brand-950 text-white border-brand-950'
                            : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        {token.tokenNumber}
                      </span>
                    </td>

                    {/* Patient */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{token.patientName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {token.patientPhone}
                      </div>
                    </td>

                    {/* Time / Type */}
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{token.scheduledTime}</div>
                      <div className="text-[11px] text-slate-500">
                        {token.isWalkIn ? 'Reception Walk-in' : 'Online Booking'}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-4">
                      {token.priority === 'emergency' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          Emergency
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Normal</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <StatusBadge status={token.status} size="sm" />
                      {isWaiting && (
                        <p className="text-[11px] text-slate-500 mt-1.5">
                          {nextTokenId === token.id
                            ? 'Next eligible patient'
                            : `Position ${waitingPositions.get(token.id)}`}
                        </p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isCurrent && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleActionClick('serve', token)}
                            icon={<Check className="w-3 h-3" />}
                          >
                            Mark Served
                          </Button>
                        )}

                        {(isWaiting || isCurrent) && (
                          <>
                            <button
                              onClick={() => handleActionClick('skip', token)}
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded border border-transparent hover:border-amber-200 transition-colors"
                              title="Skip Patient (No Show)"
                              aria-label="Skip Patient"
                            >
                              <SkipForward className="w-3.5 h-3.5" />
                            </button>
                            {isWaiting && (
                              <button
                                onClick={() => handleActionClick('cancel', token)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors"
                                title="Cancel Token"
                                aria-label="Cancel Token"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={
          confirmModal.action === 'serve'
            ? 'Complete Consultation?'
            : confirmModal.action === 'skip'
              ? 'Skip Patient (No-show)?'
              : 'Cancel Token?'
        }
        description={`Confirm status update for Token ${confirmModal.token?.tokenNumber} (${confirmModal.token?.patientName}).`}
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Back
            </Button>
            <Button
              variant={confirmModal.action === 'cancel' ? 'danger' : 'primary'}
              size="sm"
              onClick={handleConfirmAction}
            >
              Confirm Update
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600">
          {confirmModal.action === 'serve' &&
            'This will mark the patient as treated and advance queue records.'}
          {confirmModal.action === 'skip' &&
            'This visit will be closed as skipped / no-show. If the patient arrives later, reception must register a new visit.'}
          {confirmModal.action === 'cancel' &&
            'This token will be permanently marked cancelled and removed from active wait queues.'}
        </p>
      </Modal>
    </>
  );
};
