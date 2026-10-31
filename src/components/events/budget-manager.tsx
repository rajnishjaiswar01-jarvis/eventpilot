'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Receipt,
  DollarSign,
} from 'lucide-react';
import type { EventData, BudgetItem, BudgetCategory } from '@/lib/types/domain';
import { BUDGET_CATEGORY_LABELS } from '@/lib/constants/display';
import { moneyFromMinor, moneyFormat, moneyToMajor } from '@/lib/types/money';
import { useEventStore } from '@/lib/stores/event-store';
import { cn } from '@/lib/utils';

interface BudgetManagerProps {
  event: EventData;
}

const EMPTY_ITEM: Omit<BudgetItem, 'id'> = {
  name: '',
  category: 'miscellaneous',
  estimatedAmountMinor: 0,
  actualAmountMinor: 0,
  isPaid: false,
  notes: '',
};

const CATEGORY_OPTIONS = Object.entries(BUDGET_CATEGORY_LABELS) as [
  BudgetCategory,
  string,
][];

export function BudgetManager({ event }: BudgetManagerProps) {
  const updateEvent = useEventStore((s) => s.updateEvent);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_ITEM);
  const [estimatedMajor, setEstimatedMajor] = useState('');
  const [actualMajor, setActualMajor] = useState('');

  const stats = useMemo(() => {
    const totalBudget = event.totalBudgetMinor;
    const allocated = event.budgetItems.reduce(
      (s, i) => s + i.estimatedAmountMinor,
      0
    );
    const spent = event.budgetItems.reduce(
      (s, i) => s + i.actualAmountMinor,
      0
    );
    const remaining = totalBudget - allocated;
    return { totalBudget, allocated, spent, remaining };
  }, [event.totalBudgetMinor, event.budgetItems]);

  const fmt = useCallback(
    (amountMinor: number) =>
      moneyFormat(moneyFromMinor(amountMinor, event.currency)),
    [event.currency]
  );

  const resetForm = () => {
    setFormData(EMPTY_ITEM);
    setEstimatedMajor('');
    setActualMajor('');
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      category: item.category,
      estimatedAmountMinor: item.estimatedAmountMinor,
      actualAmountMinor: item.actualAmountMinor,
      isPaid: item.isPaid,
      notes: item.notes,
    });
    setEstimatedMajor(
      String(moneyToMajor(moneyFromMinor(item.estimatedAmountMinor, event.currency)))
    );
    setActualMajor(
      String(moneyToMajor(moneyFromMinor(item.actualAmountMinor, event.currency)))
    );
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const estimatedMinor = Math.round(parseFloat(estimatedMajor || '0') * 100);
    const actualMinor = Math.round(parseFloat(actualMajor || '0') * 100);

    if (estimatedMinor < 0 || actualMinor < 0) return;

    if (editingId) {
      const updatedItems = event.budgetItems.map((item) =>
        item.id === editingId
          ? {
              ...item,
              name: formData.name,
              category: formData.category,
              estimatedAmountMinor: estimatedMinor,
              actualAmountMinor: actualMinor,
              isPaid: formData.isPaid,
              notes: formData.notes,
            }
          : item
      );
      updateEvent(event.id, { budgetItems: updatedItems });
    } else {
      const newItem: BudgetItem = {
        id: crypto.randomUUID(),
        name: formData.name,
        category: formData.category,
        estimatedAmountMinor: estimatedMinor,
        actualAmountMinor: actualMinor,
        isPaid: formData.isPaid,
        notes: formData.notes,
      };
      updateEvent(event.id, {
        budgetItems: [...event.budgetItems, newItem],
      });
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    updateEvent(event.id, {
      budgetItems: event.budgetItems.filter((item) => item.id !== id),
    });
    setDeleteConfirmId(null);
  };

  const togglePaid = (id: string) => {
    const updatedItems = event.budgetItems.map((item) =>
      item.id === id ? { ...item, isPaid: !item.isPaid } : item
    );
    updateEvent(event.id, { budgetItems: updatedItems });
  };

  const overBudgetWarning = stats.remaining < 0;

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500">Total Budget</p>
          <p className="text-lg font-bold text-gray-900">
            {fmt(stats.totalBudget)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-blue-600">Allocated</p>
          <p className="text-lg font-bold text-blue-900">
            {fmt(stats.allocated)}
          </p>
        </div>
        <div
          className={cn(
            'rounded-xl border p-4 shadow-sm',
            overBudgetWarning
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 bg-white'
          )}
        >
          <p
            className={cn(
              'text-xs font-medium',
              overBudgetWarning ? 'text-red-600' : 'text-green-600'
            )}
          >
            Remaining
          </p>
          <p
            className={cn(
              'text-lg font-bold',
              overBudgetWarning ? 'text-red-900' : 'text-green-900'
            )}
          >
            {fmt(stats.remaining)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-600">Spent</p>
          <p className="text-lg font-bold text-emerald-900">
            {fmt(stats.spent)}
          </p>
        </div>
      </div>

      {overBudgetWarning && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            Budget overallocated by{' '}
            <strong>{fmt(Math.abs(stats.remaining))}</strong>. Consider
            adjusting your budget items.
          </span>
        </div>
      )}

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
          Add Budget Item
        </button>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h4 className="mb-4 text-sm font-semibold text-gray-900">
            {editingId ? 'Edit Budget Item' : 'New Budget Item'}
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
                placeholder="e.g. Venue Booking"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    category: e.target.value as BudgetCategory,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Estimated Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={estimatedMajor}
                onChange={(e) => setEstimatedMajor(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Actual Amount
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={actualMajor}
                onChange={(e) => setActualMajor(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Notes
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, notes: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Optional notes"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPaid"
                checked={formData.isPaid}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, isPaid: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="isPaid" className="text-sm text-gray-700">
                Mark as paid
              </label>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Check className="h-4 w-4" />
              {editingId ? 'Save Changes' : 'Add Item'}
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

      {/* Budget Items List */}
      {event.budgetItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
          <Receipt className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">
            No budget items yet
          </p>
          <p className="text-xs text-gray-400">
            Add your first budget item to start tracking expenses
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Category
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Estimated
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Actual
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {event.budgetItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.notes && (
                          <p className="mt-0.5 text-xs text-gray-400">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {BUDGET_CATEGORY_LABELS[item.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmt(item.estimatedAmountMinor)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmt(item.actualAmountMinor)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => togglePaid(item.id)}
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors',
                          item.isPaid
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        )}
                        title={item.isPaid ? 'Mark unpaid' : 'Mark paid'}
                      >
                        {item.isPaid ? (
                          <DollarSign className="h-3.5 w-3.5" />
                        ) : (
                          <DollarSign className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(item)}
                          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(item.id)}
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
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
