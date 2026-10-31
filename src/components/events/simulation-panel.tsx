'use client';

import { useState, useMemo } from 'react';
import {
  FlaskConical, Plus, Trash2, ArrowUpDown, Check, X,
  AlertTriangle, TrendingUp, TrendingDown, Users, Wallet,
  ArrowRight, RotateCcw,
} from 'lucide-react';
import type { EventData, SimulationScenario, BudgetItem } from '@/lib/types/domain';
import {
  createScenario, applyGuestCountModification,
  applyBudgetModification, compareScenarioToOriginal,
  promoteScenario, deepCloneEventData,
} from '@/lib/engine/simulation';
import { moneyFromMinor, moneyFormat, moneyToMajor } from '@/lib/types/money';
import { BUDGET_CATEGORY_LABELS } from '@/lib/constants/display';
import { useEventStore } from '@/lib/stores/event-store';
import { cn } from '@/lib/utils';

interface SimulationPanelProps {
  event: EventData;
}

export function SimulationPanel({ event }: SimulationPanelProps) {
  const updateEvent = useEventStore((s) => s.updateEvent);
  const [scenario, setScenario] = useState<SimulationScenario | null>(null);
  const [scenarioName, setScenarioName] = useState('What-if Scenario');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promoted, setPromoted] = useState(false);

  // Modification form state
  const [modGuestCount, setModGuestCount] = useState('');
  const [modTotalBudget, setModTotalBudget] = useState('');
  const [modBudgetItemId, setModBudgetItemId] = useState('');
  const [modBudgetItemAmount, setModBudgetItemAmount] = useState('');

  const comparison = useMemo(() => {
    if (!scenario) return null;
    return compareScenarioToOriginal(event, scenario);
  }, [event, scenario]);

  const handleCreate = () => {
    const newScenario = createScenario(event, scenarioName || 'What-if Scenario');
    setScenario(newScenario);
    setModGuestCount(String(event.expectedGuests));
    setModTotalBudget(String(moneyToMajor(moneyFromMinor(event.totalBudgetMinor, event.currency))));
    setShowCreateForm(false);
    setPromoted(false);
  };

  const handleDiscard = () => {
    setScenario(null);
    setPromoted(false);
  };

  const handleModifyGuests = () => {
    if (!scenario) return;
    const newCount = parseInt(modGuestCount, 10);
    if (isNaN(newCount) || newCount < 0) return;
    setScenario(applyGuestCountModification(scenario, newCount));
  };

  const handleModifyTotalBudget = () => {
    if (!scenario) return;
    const newBudgetMajor = parseFloat(modTotalBudget);
    if (isNaN(newBudgetMajor) || newBudgetMajor < 0) return;
    const newBudgetMinor = Math.round(newBudgetMajor * 100);
    const updated = deepCloneEventData(scenario.snapshotData);
    const old = updated.totalBudgetMinor;
    updated.totalBudgetMinor = newBudgetMinor;
    setScenario({
      ...scenario,
      snapshotData: updated,
      modifications: {
        ...scenario.modifications,
        'event.totalBudgetMinor': { from: old, to: newBudgetMinor },
      },
    });
  };

  const handleModifyBudgetItem = () => {
    if (!scenario || !modBudgetItemId) return;
    const newAmount = parseFloat(modBudgetItemAmount);
    if (isNaN(newAmount) || newAmount < 0) return;
    const newMinor = Math.round(newAmount * 100);
    try {
      setScenario(applyBudgetModification(scenario, modBudgetItemId, newMinor));
      setModBudgetItemId('');
      setModBudgetItemAmount('');
    } catch {
      // Item not found
    }
  };

  const handlePromote = () => {
    if (!scenario) return;
    const promotedData = promoteScenario(scenario);
    // Apply all changes from the scenario to the original event
    updateEvent(event.id, {
      expectedGuests: promotedData.expectedGuests,
      totalBudgetMinor: promotedData.totalBudgetMinor,
      budgetItems: promotedData.budgetItems,
      tasks: promotedData.tasks,
    });
    setPromoted(true);
    setPromoteDialogOpen(false);
  };

  const formatDiff = (diff: number, prefix: string = '') => {
    if (diff === 0) return <span className="text-muted-foreground">No change</span>;
    const isPositive = diff > 0;
    return (
      <span className={cn('font-medium', isPositive ? 'text-emerald-600' : 'text-red-600')}>
        {isPositive ? '+' : ''}{prefix}{diff.toLocaleString()}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50">
        <FlaskConical className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">What-if Simulation</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Explore changes safely. The original event is never modified until you explicitly apply changes.
          </p>
        </div>
      </div>

      {/* No scenario - Create button */}
      {!scenario && !showCreateForm && (
        <div className="flex flex-col items-center justify-center py-12">
          <FlaskConical className="w-12 h-12 text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">No active scenario</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
            Create a what-if scenario to explore changes to guest count, budget, and allocations without affecting your event.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Scenario
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && !scenario && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h3 className="font-semibold">New Scenario</h3>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Scenario Name</label>
            <input
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="e.g., Increased budget scenario"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Create Snapshot
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active scenario */}
      {scenario && (
        <>
          {/* Scenario header */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
            <div>
              <h3 className="font-semibold">{scenario.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {Object.keys(scenario.modifications).length} modification{Object.keys(scenario.modifications).length !== 1 ? 's' : ''} applied
              </p>
            </div>
            <div className="flex gap-2">
              {!promoted && (
                <button
                  onClick={() => setPromoteDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                >
                  <Check className="w-4 h-4" />
                  Apply Changes
                </button>
              )}
              <button
                onClick={handleDiscard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted"
              >
                <Trash2 className="w-4 h-4" />
                Discard
              </button>
            </div>
          </div>

          {promoted && (
            <div className="p-3 rounded-lg border border-green-200 bg-green-50 flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700 font-medium">Changes applied to event successfully.</p>
            </div>
          )}

          {/* Modification controls */}
          {!promoted && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Guest count */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Guest Count
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={modGuestCount}
                    onChange={(e) => setModGuestCount(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={handleModifyGuests}
                    className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Original: {event.expectedGuests}</p>
              </div>

              {/* Total budget */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  Total Budget ({event.currency})
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={modTotalBudget}
                    onChange={(e) => setModTotalBudget(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={handleModifyTotalBudget}
                    className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Original: {moneyFormat(moneyFromMinor(event.totalBudgetMinor, event.currency))}
                </p>
              </div>

              {/* Budget item modification */}
              {scenario.snapshotData.budgetItems.length > 0 && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                    Modify Budget Allocation
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={modBudgetItemId}
                      onChange={(e) => {
                        setModBudgetItemId(e.target.value);
                        const item = scenario.snapshotData.budgetItems.find((b) => b.id === e.target.value);
                        if (item) setModBudgetItemAmount(String(moneyToMajor(moneyFromMinor(item.estimatedAmountMinor, event.currency))));
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    >
                      <option value="">Select budget item...</option>
                      {scenario.snapshotData.budgetItems.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({moneyFormat(moneyFromMinor(b.estimatedAmountMinor, event.currency))})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={modBudgetItemAmount}
                      onChange={(e) => setModBudgetItemAmount(e.target.value)}
                      placeholder="New amount"
                      className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      onClick={handleModifyBudgetItem}
                      disabled={!modBudgetItemId}
                      className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comparison */}
          {comparison && Object.keys(scenario.modifications).length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4" />
                Comparison: Original vs Scenario
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Guest Count</p>
                  <p className="text-lg font-bold">
                    {event.expectedGuests} <ArrowRight className="w-4 h-4 inline text-muted-foreground mx-1" /> {scenario.snapshotData.expectedGuests}
                  </p>
                  <div className="mt-1">
                    {comparison.guestDifference > 0 ? (
                      <span className="text-xs text-emerald-600 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" />+{comparison.guestDifference}</span>
                    ) : comparison.guestDifference < 0 ? (
                      <span className="text-xs text-red-600 flex items-center justify-center gap-1"><TrendingDown className="w-3 h-3" />{comparison.guestDifference}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No change</span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
                  <p className="text-sm font-bold">
                    {moneyFormat(moneyFromMinor(event.totalBudgetMinor, event.currency))}
                  </p>
                  <ArrowRight className="w-4 h-4 mx-auto text-muted-foreground my-0.5" />
                  <p className="text-sm font-bold">
                    {moneyFormat(moneyFromMinor(scenario.snapshotData.totalBudgetMinor, event.currency))}
                  </p>
                  <div className="mt-1">
                    {(() => {
                      const diff = scenario.snapshotData.totalBudgetMinor - event.totalBudgetMinor;
                      if (diff === 0) return <span className="text-xs text-muted-foreground">No change</span>;
                      return (
                        <span className={cn('text-xs flex items-center justify-center gap-1', diff > 0 ? 'text-emerald-600' : 'text-red-600')}>
                          {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {moneyFormat(moneyFromMinor(Math.abs(diff), event.currency))}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card text-center">
                  <p className="text-xs text-muted-foreground mb-1">Budget Allocation</p>
                  <p className="text-sm font-bold">
                    {moneyFormat(moneyFromMinor(
                      event.budgetItems.reduce((s, i) => s + i.estimatedAmountMinor, 0),
                      event.currency
                    ))}
                  </p>
                  <ArrowRight className="w-4 h-4 mx-auto text-muted-foreground my-0.5" />
                  <p className="text-sm font-bold">
                    {moneyFormat(moneyFromMinor(
                      scenario.snapshotData.budgetItems.reduce((s, i) => s + i.estimatedAmountMinor, 0),
                      event.currency
                    ))}
                  </p>
                  <div className="mt-1">
                    {comparison.budgetDifferenceMinor !== 0 ? (
                      <span className={cn('text-xs flex items-center justify-center gap-1', comparison.budgetDifferenceMinor > 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {comparison.budgetDifferenceMinor > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {moneyFormat(moneyFromMinor(Math.abs(comparison.budgetDifferenceMinor), event.currency))}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">No change</span>}
                  </div>
                </div>
              </div>

              {/* Modification log */}
              <div className="p-4 rounded-xl border border-border bg-card">
                <h4 className="text-sm font-medium mb-2">Changes Made</h4>
                <div className="space-y-1.5">
                  {Object.entries(scenario.modifications).map(([key, val]) => {
                    const mod = val as { from: unknown; to: unknown };
                    const isBudgetItem = key.startsWith('budget.');
                    let label = key;
                    if (key === 'event.expectedGuests') label = 'Guest Count';
                    else if (key === 'event.totalBudgetMinor') label = 'Total Budget';
                    else if (isBudgetItem) {
                      const itemId = key.split('.')[1];
                      const item = scenario.snapshotData.budgetItems.find((b) => b.id === itemId);
                      label = `Budget: ${item?.name ?? itemId}`;
                    }

                    const formatVal = (v: unknown) => {
                      if (typeof v === 'number' && (key.includes('Minor') || isBudgetItem)) {
                        return moneyFormat(moneyFromMinor(v, event.currency));
                      }
                      return String(v);
                    };

                    return (
                      <div key={key} className="flex items-center justify-between text-sm py-1 border-b border-border last:border-0">
                        <span className="text-muted-foreground">{label}</span>
                        <span>
                          <span className="text-muted-foreground line-through mr-2">{formatVal(mod.from)}</span>
                          <ArrowRight className="w-3 h-3 inline text-muted-foreground mx-1" />
                          <span className="font-medium ml-1">{formatVal(mod.to)}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Promote confirmation dialog */}
          {promoteDialogOpen && (
            <div className="fixed inset-0 z-50">
              <div className="fixed inset-0 bg-black/50" onClick={() => setPromoteDialogOpen(false)} />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg z-50">
                <h3 className="text-lg font-semibold mb-2">Apply Scenario Changes?</h3>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    This will overwrite the current event data with the scenario values. This action modifies:
                    {comparison && comparison.guestDifference !== 0 && ' guest count,'}
                    {comparison && (scenario.snapshotData.totalBudgetMinor !== event.totalBudgetMinor) && ' total budget,'}
                    {comparison && comparison.budgetDifferenceMinor !== 0 && ' budget allocations'}
                    .
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setPromoteDialogOpen(false)}
                    className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePromote}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                  >
                    <Check className="w-4 h-4 inline mr-1" />
                    Confirm & Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
