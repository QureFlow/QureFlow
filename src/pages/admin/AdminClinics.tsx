import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { clinicService } from '../../services/clinicService';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Clinic } from '../../types';
import {
  Menu,
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Edit2,
  Stethoscope,
} from 'lucide-react';

export const AdminClinics: React.FC = () => {
  const { clinics, doctors, refreshState, showToast } = useQueue();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Edit modal state
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);
  const [formData, setFormData] = useState<Partial<Clinic>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenEdit = (clinic: Clinic) => {
    setEditingClinic(clinic);
    setFormData({ ...clinic });
  };

  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClinic) return;
    setIsSaving(true);
    try {
      await clinicService.updateClinic(editingClinic.id, formData);
      refreshState();
      showToast('Clinic details updated successfully', 'success');
      setEditingClinic(null);
    } catch {
      showToast('Failed to update clinic information', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <div className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-bold text-slate-900">Healthcare Facilities Network</h2>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <PageHeader
            title="Clinic Facility Management"
            subtitle="Manage affiliated rural health centres, sub-divisional hospitals, and operational contact helplines."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {clinics.map((clinic) => {
              const activeDocsInClinic = doctors.filter(
                (d) => d.clinicId === clinic.id && d.status === 'active'
              ).length;

              return (
                <div
                  key={clinic.id}
                  className="bg-white rounded-lg border border-slate-200 p-6 shadow-subtle flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="p-2.5 rounded-lg bg-brand-50 border border-brand-100 text-brand-800">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Operating Center
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-1">{clinic.name}</h3>
                    <p className="text-xs text-slate-500 flex items-start gap-1.5 mb-4">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>
                        {clinic.address}, {clinic.district}, {clinic.state}
                      </span>
                    </p>

                    {/* Operational Details */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{clinic.openingHours}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{clinic.phone}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{clinic.email}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-1 font-semibold text-brand-950">
                        <Stethoscope className="w-3.5 h-3.5 text-brand-700 flex-shrink-0" />
                        <span>{activeDocsInClinic} Active Consulting Doctors</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Emergency: {clinic.emergencyContact}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(clinic)}
                      icon={<Edit2 className="w-3 h-3" />}
                    >
                      Edit Info
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Edit Clinic Modal */}
      <Modal
        isOpen={Boolean(editingClinic)}
        onClose={() => setEditingClinic(null)}
        title={`Edit ${editingClinic?.name}`}
        description="Update operational address, opening shifts, and helpline contacts."
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditingClinic(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveClinic}
              isLoading={isSaving}
            >
              Save Clinic Info
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveClinic} className="space-y-4 text-xs">
          <Input
            label="Clinic / Hospital Name"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="Street Address / Ward"
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="District"
              value={formData.district || ''}
              onChange={(e) => setFormData({ ...formData, district: e.target.value })}
            />
            <Input
              label="State"
              value={formData.state || ''}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Official Contact Phone"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Helpdesk Email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <Input
            label="OPD Opening Hours"
            value={formData.openingHours || ''}
            onChange={(e) => setFormData({ ...formData, openingHours: e.target.value })}
          />

          <Input
            label="Emergency Contact / Ambulance"
            value={formData.emergencyContact || ''}
            onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  );
};
