'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ListTodo,
  ChevronDown,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { EventData, Task, TaskStatus, TaskPriority } from '@/lib/types/domain';
import { useEventStore } from '@/lib/stores/event-store';
import { cn } from '@/lib/utils';

interface TaskManagerProps {
  event: EventData;
}

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Medium', className: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', className: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700' },
};

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-yellow-100 text-yellow-700',
  },
  in_progress: {
    label: 'In Progress',
    icon: AlertCircle,
    className: 'bg-blue-100 text-blue-700',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'bg-emerald-100 text-emerald-700',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-red-100 text-red-700',
  },
};

const EMPTY_TASK: Omit<Task, 'id'> = {
  title: '',
  description: '',
  status: 'pending',
  priority: 'medium',
  dueDate: '',
  assigneeId: '',
  dependsOn: [],
  completedAt: '',
};

export function TaskManager({ event }: TaskManagerProps) {
  const updateEvent = useEventStore((s) => s.updateEvent);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_TASK);

  const resetForm = () => {
    setFormData(EMPTY_TASK);
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setFormData({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      assigneeId: task.assigneeId,
      dependsOn: task.dependsOn,
      completedAt: task.completedAt,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    if (editingId) {
      const updatedTasks = event.tasks.map((task) =>
        task.id === editingId
          ? {
              ...task,
              title: formData.title,
              description: formData.description,
              status: formData.status,
              priority: formData.priority,
              dueDate: formData.dueDate,
              assigneeId: formData.assigneeId,
              dependsOn: formData.dependsOn,
              completedAt:
                formData.status === 'completed' && !task.completedAt
                  ? new Date().toISOString()
                  : formData.status !== 'completed'
                    ? ''
                    : task.completedAt,
            }
          : task
      );
      updateEvent(event.id, { tasks: updatedTasks });
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: formData.title,
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        dueDate: formData.dueDate,
        assigneeId: formData.assigneeId,
        dependsOn: [],
        completedAt:
          formData.status === 'completed' ? new Date().toISOString() : '',
      };
      updateEvent(event.id, { tasks: [...event.tasks, newTask] });
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    updateEvent(event.id, {
      tasks: event.tasks.filter((task) => task.id !== id),
    });
    setDeleteConfirmId(null);
  };

  const changeStatus = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      const updatedTasks = event.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: newStatus,
              completedAt:
                newStatus === 'completed'
                  ? new Date().toISOString()
                  : '',
            }
          : task
      );
      updateEvent(event.id, { tasks: updatedTasks });
    },
    [event.id, event.tasks, updateEvent]
  );

  const getAssigneeName = (assigneeId: string) => {
    if (!assigneeId) return null;
    const member = event.teamMembers.find((m) => m.id === assigneeId);
    return member?.name ?? null;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
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
          Add Task
        </button>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h4 className="mb-4 text-sm font-semibold text-gray-900">
            {editingId ? 'Edit Task' : 'New Task'}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, title: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Book venue"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, description: e.target.value }))
                }
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Task details..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    priority: e.target.value as TaskPriority,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
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
                    status: e.target.value as TaskStatus,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate ? formData.dueDate.split('T')[0] : ''}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    dueDate: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : '',
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Assignee
              </label>
              <select
                value={formData.assigneeId}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, assigneeId: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {event.teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Check className="h-4 w-4" />
              {editingId ? 'Save Changes' : 'Add Task'}
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

      {/* Tasks List */}
      {event.tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-12">
          <ListTodo className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No tasks yet</p>
          <p className="text-xs text-gray-400">
            Add your first task to start planning
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {event.tasks.map((task) => {
            const statusCfg = STATUS_CONFIG[task.status];
            const priorityCfg = PRIORITY_CONFIG[task.priority];
            const StatusIcon = statusCfg.icon;
            const assigneeName = getAssigneeName(task.assigneeId);
            const dueDateStr = formatDate(task.dueDate);
            const isOverdue =
              task.dueDate &&
              task.status !== 'completed' &&
              task.status !== 'cancelled' &&
              new Date(task.dueDate) < new Date();

            return (
              <div
                key={task.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={cn(
                          'text-sm font-semibold text-gray-900',
                          task.status === 'completed' && 'line-through opacity-60'
                        )}
                      >
                        {task.title}
                      </h4>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          priorityCfg.className
                        )}
                      >
                        {priorityCfg.label}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          statusCfg.className
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </div>
                    {task.description && (
                      <p className="mt-1 text-xs text-gray-500">
                        {task.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      {dueDateStr && (
                        <span
                          className={cn(
                            'flex items-center gap-1',
                            isOverdue && 'font-medium text-red-500'
                          )}
                        >
                          <Clock className="h-3 w-3" />
                          {dueDateStr}
                          {isOverdue && ' (Overdue)'}
                        </span>
                      )}
                      {assigneeName && (
                        <span className="flex items-center gap-1">
                          → {assigneeName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Status change dropdown */}
                    <div className="relative">
                      <select
                        value={task.status}
                        onChange={(e) =>
                          changeStatus(task.id, e.target.value as TaskStatus)
                        }
                        className="appearance-none rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-2 pr-7 text-xs font-medium text-gray-600 outline-none hover:bg-gray-100 focus:border-blue-400"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                    </div>
                    <button
                      onClick={() => startEdit(task)}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {deleteConfirmId === task.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(task.id)}
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
                        onClick={() => setDeleteConfirmId(task.id)}
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
