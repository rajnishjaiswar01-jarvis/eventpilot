'use client';

import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  UsersRound,
  Mail,
  Phone,
} from 'lucide-react';
import type { EventData, TeamMember, TeamRole } from '@/lib/types/domain';
import { useEventStore } from '@/lib/stores/event-store';
import { cn } from '@/lib/utils';

interface TeamManagerProps {
  event: EventData;
}

const TEAM_ROLE_CONFIG: Record<TeamRole, { label: string; className: string }> = {
  organizer: { label: 'Organizer', className: 'bg-purple-100 text-purple-700' },
  coordinator: { label: 'Coordinator', className: 'bg-blue-100 text-blue-700' },
  volunteer: { label: 'Volunteer', className: 'bg-green-100 text-green-700' },
  vendor_liaison: {
    label: 'Vendor Liaison',
    className: 'bg-amber-100 text-amber-700',
  },
  finance: { label: 'Finance', className: 'bg-emerald-100 text-emerald-700' },
  logistics: { label: 'Logistics', className: 'bg-cyan-100 text-cyan-700' },
  creative: { label: 'Creative', className: 'bg-pink-100 text-pink-700' },
  technical: { label: 'Technical', className: 'bg-indigo-100 text-indigo-700' },
  custom: { label: 'Custom', className: 'bg-gray-100 text-gray-700' },
};

const EMPTY_MEMBER: Omit<TeamMember, 'id'> = {
  name: '',
  role: 'volunteer',
  email: '',
  phone: '',
  responsibilities: '',
};

export function TeamManager({ event }: TeamManagerProps) {
  const updateEvent = useEventStore((s) => s.updateEvent);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_MEMBER);

  const resetForm = () => {
    setFormData(EMPTY_MEMBER);
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setFormData({
      name: member.name,
      role: member.role,
      email: member.email,
      phone: member.phone,
      responsibilities: member.responsibilities,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingId) {
      const updatedMembers = event.teamMembers.map((m) =>
        m.id === editingId
          ? {
              ...m,
              name: formData.name,
              role: formData.role,
              email: formData.email,
              phone: formData.phone,
              responsibilities: formData.responsibilities,
            }
          : m
      );
      updateEvent(event.id, { teamMembers: updatedMembers });
    } else {
      const newMember: TeamMember = {
        id: crypto.randomUUID(),
        name: formData.name,
        role: formData.role,
        email: formData.email,
        phone: formData.phone,
        responsibilities: formData.responsibilities,
      };
      updateEvent(event.id, {
        teamMembers: [...event.teamMembers, newMember],
      });
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    updateEvent(event.id, {
      teamMembers: event.teamMembers.filter((m) => m.id !== id),
    });
    setDeleteConfirmId(null);
  };

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
          Add Team Member
        </button>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h4 className="mb-4 text-sm font-semibold text-gray-900">
            {editingId ? 'Edit Team Member' : 'New Team Member'}
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
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    role: e.target.value as TeamRole,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {Object.entries(TEAM_ROLE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, email: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, phone: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Responsibilities
              </label>
              <textarea
                value={formData.responsibilities}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    responsibilities: e.target.value,
                  }))
                }
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Describe their responsibilities..."
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Check className="h-4 w-4" />
              {editingId ? 'Save Changes' : 'Add Member'}
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

      {/* Team Member Cards */}
      {event.teamMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
          <UsersRound className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">
            No team members yet
          </p>
          <p className="text-xs text-gray-400">
            Add team members to coordinate your event
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {event.teamMembers.map((member) => {
            const roleCfg = TEAM_ROLE_CONFIG[member.role];

            return (
              <div
                key={member.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {member.name}
                    </h4>
                    <span
                      className={cn(
                        'mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                        roleCfg.className
                      )}
                    >
                      {roleCfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(member)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deleteConfirmId === member.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(member.id)}
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
                        onClick={() => setDeleteConfirmId(member.id)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="mt-3 space-y-1.5">
                  {member.email && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </p>
                  )}
                  {member.phone && (
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="h-3 w-3 flex-shrink-0" />
                      {member.phone}
                    </p>
                  )}
                </div>

                {member.responsibilities && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-400">Responsibilities</p>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {member.responsibilities}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
