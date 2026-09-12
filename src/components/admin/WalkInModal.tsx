import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { useQueue } from '../../context/QueueContext';
import { QueuePriority } from '../../types';
import { UserPlus, Flame } from 'lucide-react';

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDoctorId?: string;
}

export const WalkInModal: React.FC<WalkInModalProps> = ({
  isOpen,
  onClose,
  defaultDoctorId,
}) => {
  const { doctors, addWalkIn } = useQueue();
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorId, setDoctorId] = useState(defaultDoctorId || (doctors[0]?.id || ''));
  const [priority, setPriority] = useState<QueuePriority>('normal');
  const [time, setTime] = useState('Immediate Walk-in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      setError('Please enter patient full name');
      return;
    }
    if (!patientPhone.trim() || patientPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!doctorId) {
      setError('Please select a consulting doctor');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await addWalkIn({
        patientName,
        patientPhone,
        doctorId,
        time,
        priority,
      });
      // reset form
      setPatientName('');
      setPatientPhone('');
      setPriority('normal');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error adding walk-in patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const doctorOptions = doctors.map((d) => ({
    value: d.id,
    label: `${d.name} (${d.specialization})`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register Walk-in Patient"
      description="Issue a digital queue token for in-person clinic arrivals. The patient will be merged directly into the doctor's live queue."
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={priority === 'emergency' ? 'danger' : 'primary'}
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            icon={<UserPlus className="w-3.5 h-3.5" />}
          >
            Generate Token & Insert to Queue
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        <Input
          label="Patient Full Name"
          placeholder="e.g. Ramesh Chandra Mondal"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          required
        />

        <Input
          label="Mobile Number (for SMS & Token updates)"
          placeholder="10-digit mobile number"
          type="tel"
          maxLength={10}
          value={patientPhone}
          onChange={(e) => setPatientPhone(e.target.value.replace(/[^0-9]/g, ''))}
          required
        />

        <Select
          label="Consulting Doctor / OPD Department"
          options={doctorOptions}
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Arrival / Slot Reference"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g. 11:15 AM Walk-in"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Triage Priority
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPriority('normal')}
                className={`flex-1 py-2 text-xs font-medium rounded border transition-colors ${
                  priority === 'normal'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setPriority('emergency')}
                className={`flex-1 py-2 text-xs font-medium rounded border transition-colors flex items-center justify-center gap-1 ${
                  priority === 'emergency'
                    ? 'bg-red-600 text-white border-red-600 font-bold'
                    : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                Emergency
              </button>
            </div>
          </div>
        </div>

        {priority === 'emergency' && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-start gap-2">
            <Flame className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Emergency Priority Triage:</strong> This token will be placed at the top of the waiting list for urgent attention by the consulting physician.
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
};
