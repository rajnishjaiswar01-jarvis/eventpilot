'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Clock, AlertTriangle, CheckCircle2, XCircle, ArrowRight,
  Plus, Pencil, Trash2, Check, X, AlertCircle,
} from 'lucide-react';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import type { EventData, Task, TaskStatus, TaskPriority } from '@/lib/types/domain';
import {
  buildDependencyGraph, topologicalSort, detectCycles, validateDependencies,
} from '@/lib/engine/dependency-graph';
import { useEventStore } from '@/lib/stores/event-store';
import { cn } from '@/lib/utils';

interface TimelinePlannerProps {
  event: EventData;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-gray-100 text-gray-700 border-gray-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-amber-100 text-amber-700 border-amber-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-gray-400" />,
  in_progress: <AlertCircle className="w-4 h-4 text-blue-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  cancelled: <XCircle className="w-4 h-4 text-gray-400" />,
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function generateId() {
  return `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export function TimelinePlanner({ event }: TimelinePlannerProps) {
  const updateEvent = useEventStore((s) => s.updateEvent);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state for add/edit
  const [formTitle, setFormTitle] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formDeps, setFormDeps] = useState<string[]>([]);

  const taskMap = useMemo(() => new Map(event.tasks.map((t) => [t.id, t])), [event.tasks]);

  // Build dependency graph and sort topologically
  const analysis = useMemo(() => {
    const graph = buildDependencyGraph(event.tasks);
    const sorted = topologicalSort(graph);
    const cycles = detectCycles(graph);
    const validationResults = validateDependencies(event.tasks);
    const hasCycles = cycles.length > 0;

    // Sort tasks chronologically with topological order as tiebreaker
    const topoOrder = new Map<string, number>();
    if (sorted) {
      sorted.forEach((id, idx) => topoOrder.set(id, idx));
    }

    const sortedTasks = [...event.tasks].sort((a, b) => {
      // First by due date
      if (a.dueDate && b.dueDate) {
        const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (diff !== 0) return diff;
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      // Then by topological order
      return (topoOrder.get(a.id) ?? 0) - (topoOrder.get(b.id) ?? 0);
    });

    return { sortedTasks, hasCycles, cycles, validationResults, graph };
  }, [event.tasks]);

  const isOverdue = useCallback((task: Task) => {
    if (!task.dueDate || task.status === 'completed' || task.status === 'cancelled') return false;
    return isPast(parseISO(task.dueDate));
  }, []);

  const hasSchedulingConflict = useCallback((task: Task) => {
    if (!task.dueDate) return false;
    const taskDue = new Date(task.dueDate);
    for (const depId of task.dependsOn) {
      const dep = taskMap.get(depId);
      if (dep && dep.dueDate && new Date(dep.dueDate) > taskDue) return true;
    }
    return false;
  }, [taskMap]);

  const resetForm = () => {
    setFormTitle('');
    setFormDueDate('');
    setFormPriority('medium');
    setFormDeps([]);
  };

  const handleAdd = () => {
    if (!formTitle.trim()) return;
    const newTask: Task = {
      id: generateId(),
      title: formTitle.trim(),
      description: '',
      status: 'pending',
      priority: formPriority,
      dueDate: formDueDate,
      assigneeId: '',
      dependsOn: formDeps,
      completedAt: '',
    };
    updateEvent(event.id, { tasks: [...event.tasks, newTask] });
    resetForm();
    setShowAddForm(false);
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setFormTitle(task.title);
    setFormDueDate(task.dueDate);
    setFormPriority(task.priority);
    setFormDeps([...task.dependsOn]);
  };

  const handleSaveEdit = () => {
    if (!editingId || !formTitle.trim()) return;
    const updated = event.tasks.map((t) =>
      t.id === editingId
        ? { ...t, title: formTitle.trim(), dueDate: formDueDate, priority: formPriority, dependsOn: formDeps }
        : t
    );
    updateEvent(event.id, { tasks: updated });
    setEditingId(null);
    resetForm();
  };

  const handleDelete = (taskId: string) => {
    // Also remove from other tasks' dependsOn
    const updated = event.tasks
      .filter((t) => t.id !== taskId)
      .map((t) => ({
        ...t,
        dependsOn: t.dependsOn.filter((d) => d !== taskId),
      }));
    updateEvent(event.id, { tasks: updated });
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const updated = event.tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: newStatus, completedAt: newStatus === 'completed' ? new Date().toISOString() : '' }
        : t
    );
    updateEvent(event.id, { tasks: updated });
  };

  const eventStart = new Date(event.startDate);
  const eventEnd = new Date(event.endDate);

  return (
    <div className="space-y-6">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Timeline</h3>
          <p className="text-sm text-muted-foreground">
            {event.tasks.length} task{event.tasks.length !== 1 ? 's' : ''} Â· Event: {format(eventStart, 'MMM d')} â€“ {format(eventEnd, 'MMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); resetForm(); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Cycle warnings */}
      {analysis.hasCycles && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Circular dependencies detected</p>
            {analysis.cycles.map((cycle, i) => (
              <p key={i} className="text-xs text-red-700 mt-1">
                Cycle: {cycle.map((id) => taskMap.get(id)?.title ?? id).join(' â†’ ')}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Validation warnings */}
      {analysis.validationResults.filter((r) => r.code === 'DUE_BEFORE_DEPENDENCY').length > 0 && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
          <p className="text-sm font-medium text-amber-800 mb-1">Scheduling Conflicts</p>
          {analysis.validationResults
            .filter((r) => r.code === 'DUE_BEFORE_DEPENDENCY')
            .map((r, i) => (
              <p key={i} className="text-xs text-amber-700">{r.message}</p>
            ))}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title *</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Task title"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Due Date</label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Depends On</label>
              <select
                multiple
                value={formDeps}
                onChange={(e) => setFormDeps(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="w-full mt-1 px-3 py-1 rounded-lg border border-border bg-background text-sm h-20"
              >
                {event.tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <Check className="w-3.5 h-3.5 inline mr-1" />Add
            </button>
            <button
              onClick={() => { setShowAddForm(false); resetForm(); }}
              className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {event.tasks.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">No tasks yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add tasks to build your event timeline with dependencies and due dates.
          </p>
        </div>
      )}

      {/* Timeline */}
      {analysis.sortedTasks.length > 0 && (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" aria-hidden="true" />

          <div className="space-y-1">
            {analysis.sortedTasks.map((task) => {
              const overdue = isOverdue(task);
              const conflict = hasSchedulingConflict(task);
              const isEditing = editingId === task.id;
              const deps = task.dependsOn.map((d) => taskMap.get(d)).filter(Boolean) as Task[];
              const daysUntilDue = task.dueDate
                ? differenceInDays(parseISO(task.dueDate), new Date())
                : null;

              if (isEditing) {
                return (
                  <div key={task.id} className="relative pl-12 py-2">
                    <div className="absolute left-3.5 top-5 w-3 h-3 rounded-full border-2 border-primary bg-background z-10" />
                    <div className="p-4 rounded-xl border-2 border-primary bg-card space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Title</label>
                          <input
                            value={formTitle}
                            onChange={(e) => setFormTitle(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                          <input
                            type="date"
                            value={formDueDate}
                            onChange={(e) => setFormDueDate(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Priority</label>
                          <select
                            value={formPriority}
                            onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Depends On</label>
                          <select
                            multiple
                            value={formDeps}
                            onChange={(e) => setFormDeps(Array.from(e.target.selectedOptions, (o) => o.value))}
                            className="w-full mt-1 px-3 py-1 rounded-lg border border-border bg-background text-sm h-20"
                          >
                            {event.tasks.filter((t) => t.id !== task.id).map((t) => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                          <Check className="w-3.5 h-3.5 inline mr-1" />Save
                        </button>
                        <button onClick={() => { setEditingId(null); resetForm(); }} className="px-3 py-1.5 rounded-md border border-border text-sm hover:bg-muted">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={task.id} className="relative pl-12 py-2 group">
                  {/* Timeline dot */}
                  <div className={cn(
                    'absolute left-3.5 top-5 w-3 h-3 rounded-full border-2 z-10',
                    task.status === 'completed' ? 'border-green-500 bg-green-500' :
                    task.status === 'cancelled' ? 'border-gray-300 bg-gray-300' :
                    overdue ? 'border-red-500 bg-red-500' :
                    task.status === 'in_progress' ? 'border-blue-500 bg-blue-500' :
                    'border-gray-300 bg-background'
                  )} />

                  <div className={cn(
                    'p-3 rounded-xl border transition-colors',
                    overdue ? 'border-red-200 bg-red-50/50' :
                    conflict ? 'border-amber-200 bg-amber-50/50' :
                    task.status === 'completed' ? 'border-green-200 bg-green-50/30' :
                    'border-border bg-card hover:border-primary/30'
                  )}>
                    <div className="flex items-start gap-3">
                      {/* Status icon */}
                      <button
                        onClick={() => {
                          const next: TaskStatus = task.status === 'pending' ? 'in_progress'
                            : task.status === 'in_progress' ? 'completed' : task.status;
                          if (next !== task.status) handleStatusChange(task.id, next);
                        }}
                        className="mt-0.5 shrink-0"
                        title={`Status: ${STATUS_LABELS[task.status]}. Click to advance.`}
                      >
                        {STATUS_ICONS[task.status]}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'text-sm font-medium',
                            task.status === 'completed' ? 'line-through text-muted-foreground' :
                            task.status === 'cancelled' ? 'line-through text-muted-foreground' : ''
                          )}>
                            {task.title}
                          </span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', PRIORITY_COLORS[task.priority])}>
                            {task.priority}
                          </span>
                          {overdue && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                              Overdue
                            </span>
                          )}
                          {conflict && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                              Conflict
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {task.dueDate && (
                            <span>
                              Due: {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                              {daysUntilDue !== null && task.status !== 'completed' && task.status !== 'cancelled' && (
                                <span className={cn('ml-1', daysUntilDue < 0 ? 'text-red-600' : daysUntilDue <= 3 ? 'text-amber-600' : '')}>
                                  ({daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? 'today' : `${daysUntilDue}d left`})
                                </span>
                              )}
                            </span>
                          )}
                          {deps.length > 0 && (
                            <span className="flex items-center gap-1">
                              <ArrowRight className="w-3 h-3" />
                              Depends on: {deps.map((d) => d.title).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => startEdit(task)}
                          className="p-1.5 rounded-md hover:bg-muted"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-1.5 rounded-md hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
