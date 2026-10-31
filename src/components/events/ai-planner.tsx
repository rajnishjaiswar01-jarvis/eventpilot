'use client';

import { useState } from 'react';
import {
  Sparkles, Loader2, AlertTriangle, CheckCircle2,
  Lightbulb, ListChecks, ShieldAlert, Store, Wallet,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import type { EventData, BudgetItem, Task, Vendor, Risk, BudgetCategory } from '@/lib/types/domain';
import type { AIEventPlan } from '@/lib/schemas/ai-plan.schema';
import { useEventStore } from '@/lib/stores/event-store';
import { moneyFormat, moneyFromMinor } from '@/lib/types/money';
import { BUDGET_CATEGORY_LABELS } from '@/lib/constants/display';
import { cn } from '@/lib/utils';
import { addDays, format } from 'date-fns';

interface AiPlannerProps {
  event: EventData;
}

const VALID_BUDGET_CATEGORIES = new Set<string>([
  'venue','catering','decoration','entertainment','photography',
  'transportation','accommodation','marketing','equipment','staffing','miscellaneous',
]);

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function AiPlanner({ event }: AiPlannerProps) {
  const updateEvent = useEventStore((s) => s.updateEvent);
  const [plan, setPlan] = useState<AIEventPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedSections, setAppliedSections] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary', 'budget', 'tasks', 'risks', 'vendors', 'themes', 'tips']));

  const toggleSection = (s: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setPlan(null);
    setAppliedSections(new Set());

    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: event.name,
          eventCategory: event.category,
          eventDescription: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          expectedGuests: event.expectedGuests,
          totalBudgetMajor: event.totalBudgetMinor / 100,
          currency: event.currency,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate plan');
        return;
      }
      setPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const applyBudget = () => {
    if (!plan) return;
    const items: BudgetItem[] = plan.budgetItems.map((item) => ({
      id: generateId(),
      name: item.name,
      category: VALID_BUDGET_CATEGORIES.has(item.category) ? item.category as BudgetCategory : 'miscellaneous',
      estimatedAmountMinor: Math.round(item.estimatedAmountMajor * 100),
      actualAmountMinor: 0,
      isPaid: false,
      notes: item.notes ?? '',
    }));
    updateEvent(event.id, { budgetItems: [...event.budgetItems, ...items] });
    setAppliedSections((p) => new Set(p).add('budget'));
  };

  const applyTasks = () => {
    if (!plan) return;
    const startDate = new Date(event.startDate);
    const tasks: Task[] = plan.tasks.map((t) => ({
      id: generateId(),
      title: t.title,
      description: t.description ?? '',
      status: 'pending' as const,
      priority: t.priority,
      dueDate: format(addDays(startDate, t.dueOffsetDays), 'yyyy-MM-dd'),
      assigneeId: '',
      dependsOn: [],
      completedAt: '',
    }));
    updateEvent(event.id, { tasks: [...event.tasks, ...tasks] });
    setAppliedSections((p) => new Set(p).add('tasks'));
  };

  const applyRisks = () => {
    if (!plan) return;
    const risks: Risk[] = plan.risks.map((r) => ({
      id: generateId(),
      description: r.description,
      severity: r.severity,
      likelihood: r.likelihood,
      status: 'identified' as const,
      impact: '',
      mitigation: r.mitigation,
      contingency: r.contingency ?? '',
      owner: '',
    }));
    updateEvent(event.id, { risks: [...event.risks, ...risks] });
    setAppliedSections((p) => new Set(p).add('risks'));
  };

  const applyVendors = () => {
    if (!plan) return;
    const vendors: Vendor[] = plan.vendorCategories.map((v) => ({
      id: generateId(),
      name: v.service,
      service: v.description,
      contactEmail: '',
      contactPhone: '',
      status: 'identified' as const,
      quotedAmountMinor: Math.round(v.estimatedBudgetMajor * 100),
      agreedAmountMinor: 0,
      notes: '',
    }));
    updateEvent(event.id, { vendors: [...event.vendors, ...vendors] });
    setAppliedSections((p) => new Set(p).add('vendors'));
  };

  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    critical: 'bg-red-100 text-red-700',
  };

  const severityColors: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">AI suggestions are advisory</p>
          <p className="text-xs text-amber-700 mt-0.5">Review all suggestions before applying. AI-generated plans may contain inaccuracies.</p>
        </div>
      </div>

      {/* Generate Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
            'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-sm',
            'disabled:opacity-60 disabled:cursor-not-allowed'
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Generating...' : plan ? 'Regenerate Plan' : 'Generate AI Plan'}
        </button>
        {plan && <span className="text-xs text-muted-foreground">Plan generated successfully</span>}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
          {error.includes('API key') && (
            <p className="text-xs text-red-600 mt-1">Add GEMINI_API_KEY to your .env.local file to enable AI features.</p>
          )}
        </div>
      )}

      {/* Plan Display */}
      {plan && (
        <div className="space-y-4">
          {/* Summary */}
          <SectionCard
            title="Summary"
            icon={<Lightbulb className="w-4 h-4" />}
            expanded={expandedSections.has('summary')}
            onToggle={() => toggleSection('summary')}
          >
            <p className="text-sm text-muted-foreground">{plan.summary}</p>
          </SectionCard>

          {/* Theme Ideas */}
          <SectionCard
            title="Theme Ideas"
            icon={<Sparkles className="w-4 h-4" />}
            expanded={expandedSections.has('themes')}
            onToggle={() => toggleSection('themes')}
          >
            <ul className="space-y-1.5">
              {plan.themeIdeas.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-0.5">â€¢</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Budget */}
          <SectionCard
            title="Suggested Budget"
            icon={<Wallet className="w-4 h-4" />}
            expanded={expandedSections.has('budget')}
            onToggle={() => toggleSection('budget')}
            action={
              <button
                onClick={applyBudget}
                disabled={appliedSections.has('budget')}
                className={cn(
                  'text-xs px-3 py-1 rounded-md font-medium transition-colors',
                  appliedSections.has('budget')
                    ? 'bg-green-100 text-green-700'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {appliedSections.has('budget') ? 'âœ“ Applied' : 'Apply to Event'}
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.budgetItems.map((item, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-muted-foreground">{BUDGET_CATEGORY_LABELS[item.category as BudgetCategory] ?? item.category}</td>
                      <td className="py-2 text-right font-medium">
                        {moneyFormat(moneyFromMinor(Math.round(item.estimatedAmountMajor * 100), event.currency))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="pt-2" colSpan={2}>Total</td>
                    <td className="pt-2 text-right">
                      {moneyFormat(moneyFromMinor(
                        Math.round(plan.budgetItems.reduce((s, i) => s + i.estimatedAmountMajor, 0) * 100),
                        event.currency
                      ))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>

          {/* Tasks */}
          <SectionCard
            title="Task Checklist"
            icon={<ListChecks className="w-4 h-4" />}
            expanded={expandedSections.has('tasks')}
            onToggle={() => toggleSection('tasks')}
            action={
              <button
                onClick={applyTasks}
                disabled={appliedSections.has('tasks')}
                className={cn(
                  'text-xs px-3 py-1 rounded-md font-medium transition-colors',
                  appliedSections.has('tasks')
                    ? 'bg-green-100 text-green-700'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {appliedSections.has('tasks') ? 'âœ“ Applied' : 'Apply to Event'}
              </button>
            }
          >
            <div className="space-y-2">
              {plan.tasks.map((task, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium mt-0.5', priorityColors[task.priority])}>
                    {task.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{task.title}</p>
                    {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {task.dueOffsetDays < 0 ? `${Math.abs(task.dueOffsetDays)}d before` : task.dueOffsetDays === 0 ? 'Event day' : `${task.dueOffsetDays}d after`}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Risks */}
          <SectionCard
            title="Risk Assessment"
            icon={<ShieldAlert className="w-4 h-4" />}
            expanded={expandedSections.has('risks')}
            onToggle={() => toggleSection('risks')}
            action={
              <button
                onClick={applyRisks}
                disabled={appliedSections.has('risks')}
                className={cn(
                  'text-xs px-3 py-1 rounded-md font-medium transition-colors',
                  appliedSections.has('risks')
                    ? 'bg-green-100 text-green-700'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {appliedSections.has('risks') ? 'âœ“ Applied' : 'Apply to Event'}
              </button>
            }
          >
            <div className="space-y-3">
              {plan.risks.map((risk, i) => (
                <div key={i} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium', severityColors[risk.severity])}>
                      {risk.severity}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">{risk.likelihood.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm font-medium">{risk.description}</p>
                  <p className="text-xs text-muted-foreground mt-1"><strong>Mitigation:</strong> {risk.mitigation}</p>
                  {risk.contingency && (
                    <p className="text-xs text-muted-foreground"><strong>Contingency:</strong> {risk.contingency}</p>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Vendors */}
          <SectionCard
            title="Vendor Categories"
            icon={<Store className="w-4 h-4" />}
            expanded={expandedSections.has('vendors')}
            onToggle={() => toggleSection('vendors')}
            action={
              <button
                onClick={applyVendors}
                disabled={appliedSections.has('vendors')}
                className={cn(
                  'text-xs px-3 py-1 rounded-md font-medium transition-colors',
                  appliedSections.has('vendors')
                    ? 'bg-green-100 text-green-700'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {appliedSections.has('vendors') ? 'âœ“ Applied' : 'Apply to Event'}
              </button>
            }
          >
            <div className="space-y-2">
              {plan.vendorCategories.map((v, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{v.service}</p>
                    <p className="text-xs text-muted-foreground">{v.description}</p>
                  </div>
                  <span className="text-sm font-medium">
                    {moneyFormat(moneyFromMinor(Math.round(v.estimatedBudgetMajor * 100), event.currency))}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Tips */}
          <SectionCard
            title="Planning Tips"
            icon={<Lightbulb className="w-4 h-4" />}
            expanded={expandedSections.has('tips')}
            onToggle={() => toggleSection('tips')}
          >
            <ul className="space-y-1.5">
              {plan.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  expanded,
  onToggle,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 font-medium text-sm">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {action}
          <button onClick={onToggle} className="p-1 rounded hover:bg-muted">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
