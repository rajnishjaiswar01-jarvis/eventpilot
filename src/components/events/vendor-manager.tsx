'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Store,
  Mail,
  Phone,
  ChevronRight,
} from 'lucide-react';
import type { EventData, Vendor, VendorStatus } from '@/lib/types/domain';
import { moneyFromMinor, moneyFormat, moneyToMajor } from '@/lib/types/money';
import { useEventStore } from '@/lib/stores/event-store';
import { cn } from '@/lib/utils';

interface VendorManagerProps {
  event: EventData;
}

const VENDOR_STATUS_CONFIG: Record<
  VendorStatus,
  { label: string; className: string; order: number }
> = {
  identified: {
    label: 'Identified',
    className: 'bg-gray-100 text-gray-700',
    order: 0,
  },
  contacted: {
    label: 'Contacted',
    className: 'bg-blue-100 text-blue-700',
    order: 1,
  },
  quoted: {
    label: 'Quoted',
    className: 'bg-purple-100 text-purple-700',
    order: 2,
  },
  negotiating: {
    label: 'Negotiating',
    className: 'bg-amber-100 text-amber-700',
    order: 3,
  },
  booked: {
    label: 'Booked',
    className: 'bg-emerald-100 text-emerald-700',
    order: 4,
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800',
    order: 5,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-700',
    order: 6,
  },
};

const STATUS_WORKFLOW: VendorStatus[] = [
  'identified',
  'contacted',
  'quoted',
  'negotiating',
  'booked',
  'completed',
];

const EMPTY_VENDOR: Omit<Vendor, 'id'> = {
  name: '',
  service: '',
  contactEmail: '',
  contactPhone: '',
  status: 'identified',
  quotedAmountMinor: 0,
  agreedAmountMinor: 0,
  notes: '',
};

export function VendorManager({ event }: VendorManagerProps) {
  const updateEvent = useEventStore((s) => s.updateEvent);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_VENDOR);
  const [quotedMajor, setQuotedMajor] = useState('');
  const [agreedMajor, setAgreedMajor] = useState('');

  const fmt = useCallback(
    (amountMinor: number) =>
      moneyFormat(moneyFromMinor(amountMinor, event.currency)),
    [event.currency]
  );

  const resetForm = () => {
    setFormData(EMPTY_VENDOR);
    setQuotedMajor('');
    setAgreedMajor('');
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    setFormData({
      name: vendor.name,
      service: vendor.service,
      contactEmail: vendor.contactEmail,
      contactPhone: vendor.contactPhone,
      status: vendor.status,
      quotedAmountMinor: vendor.quotedAmountMinor,
      agreedAmountMinor: vendor.agreedAmountMinor,
      notes: vendor.notes,
    });
    setQuotedMajor(
      String(moneyToMajor(moneyFromMinor(vendor.quotedAmountMinor, event.currency)))
    );
    setAgreedMajor(
      String(moneyToMajor(moneyFromMinor(vendor.agreedAmountMinor, event.currency)))
    );
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const quotedMinor = Math.round(parseFloat(quotedMajor || '0') * 100);
    const agreedMinor = Math.round(parseFloat(agreedMajor || '0') * 100);
    if (quotedMinor < 0 || agreedMinor < 0) return;

    if (editingId) {
      const updatedVendors = event.vendors.map((v) =>
        v.id === editingId
          ? {
              ...v,
              name: formData.name,
              service: formData.service,
              contactEmail: formData.contactEmail,
              contactPhone: formData.contactPhone,
              status: formData.status,
              quotedAmountMinor: quotedMinor,
              agreedAmountMinor: agreedMinor,
              notes: formData.notes,
            }
          : v
      );
      updateEvent(event.id, { vendors: updatedVendors });
    } else {
      const newVendor: Vendor = {
        id: crypto.randomUUID(),
        name: formData.name,
        service: formData.service,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        status: formData.status,
        quotedAmountMinor: quotedMinor,
        agreedAmountMinor: agreedMinor,
        notes: formData.notes,
      };
      updateEvent(event.id, { vendors: [...event.vendors, newVendor] });
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    updateEvent(event.id, {
      vendors: event.vendors.filter((v) => v.id !== id),
    });
    setDeleteConfirmId(null);
  };

  const advanceStatus = useCallback(
    (vendorId: string) => {
      const vendor = event.vendors.find((v) => v.id === vendorId);
      if (!vendor || vendor.status === 'cancelled') return;
      const currentIdx = STATUS_WORKFLOW.indexOf(vendor.status);
      if (currentIdx < 0 || currentIdx >= STATUS_WORKFLOW.length - 1) return;

      const nextStatus = STATUS_WORKFLOW[currentIdx + 1];
      const updatedVendors = event.vendors.map((v) =>
        v.id === vendorId ? { ...v, status: nextStatus } : v
      );
      updateEvent(event.id, { vendors: updatedVendors });
    },
    [event.id, event.vendors, updateEvent]
  );

  const cancelVendor = useCallback(
    (vendorId: string) => {
      const updatedVendors = event.vendors.map((v) =>
        v.id === vendorId ? { ...v, status: 'cancelled' as VendorStatus } : v
      );
      updateEvent(event.id, { vendors: updatedVendors });
    },
    [event.id, event.vendors, updateEvent]
  );

  return (
    <div className="space-y-6">
      {/* Add Button */}
      {!showForm && (
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Vendor
        </button>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h4 className="mb-4 text-sm font-semibold text-gray-900">
            {editingId ? 'Edit Vendor' : 'New Vendor'}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, name: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Vendor name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Service
              </label>
              <input
                type="text"
                value={formData.service}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, service: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Catering, Photography"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    contactEmail: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="vendor@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    contactPhone: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    status: e.target.value as VendorStatus,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {Object.entries(VENDOR_STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Quoted Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={quotedMajor}
                onChange={(e) => setQuotedMajor(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Agreed Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={agreedMajor}
                onChange={(e) => setAgreedMajor(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, notes: e.target.value }))
                }
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Check className="h-4 w-4" />
              {editingId ? 'Save Changes' : 'Add Vendor'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Vendor Cards */}
      {event.vendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
          <Store className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No vendors yet</p>
          <p className="text-xs text-gray-400">
            Add vendors to track your service providers
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {event.vendors.map((vendor) => {
            const statusCfg = VENDOR_STATUS_CONFIG[vendor.status];
            const canAdvance =
              vendor.status !== 'cancelled' &&
              vendor.status !== 'completed' &&
              STATUS_WORKFLOW.indexOf(vendor.status) <
                STATUS_WORKFLOW.length - 1;
            const nextStatus = canAdvance
              ? VENDOR_STATUS_CONFIG[
                  STATUS_WORKFLOW[STATUS_WORKFLOW.indexOf(vendor.status) + 1]
                ]
              : null;

            return (
              <div
                key={vendor.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {vendor.name}
                    </h4>
                    {vendor.service && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {vendor.service}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                      statusCfg.className
                    )}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="mt-3 space-y-1">
                  {vendor.contactEmail && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail className="h-3 w-3" />
                      {vendor.contactEmail}
                    </p>
                  )}
                  {vendor.contactPhone && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="h-3 w-3" />
                      {vendor.contactPhone}
                    </p>
                  )}
                </div>

                {/* Amounts */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">Quoted</p>
                    <p className="text-sm font-medium text-gray-900">
                      {fmt(vendor.quotedAmountMinor)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">Agreed</p>
                    <p className="text-sm font-medium text-gray-900">
                      {fmt(vendor.agreedAmountMinor)}
                    </p>
                  </div>
                </div>

                {vendor.notes && (
                  <p className="mt-3 text-xs italic text-gray-400">
                    {vendor.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-1">
                    {canAdvance && nextStatus && (
                      <button
                        onClick={() => advanceStatus(vendor.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                      >
                        <ChevronRight className="h-3 w-3" />
                        {nextStatus.label}
                      </button>
                    )}
                    {vendor.status !== 'cancelled' &&
                      vendor.status !== 'completed' && (
                        <button
                          onClick={() => cancelVendor(vendor.id)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Cancel
                        </button>
                      )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(vendor)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deleteConfirmId === vendor.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(vendor.id)}
                          className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-50"
                          title="Confirm delete"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(vendor.id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
