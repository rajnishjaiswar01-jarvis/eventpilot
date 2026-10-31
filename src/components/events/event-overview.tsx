'use client';

import { useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Users,
  Wallet,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import type { EventData } from '@/lib/types/domain';
import { moneyFromMinor, moneyFormat } from '@/lib/types/money';
import { cn } from '@/lib/utils';

interface EventOverviewProps {
  event: EventData;
}

export function EventOverview({ event }: EventOverviewProps) {
  const budgetStats = useMemo(() => {
    const totalBudget = event.totalBudgetMinor;
    const totalEstimated = event.budgetItems.reduce(
      (sum, item) => sum + item.estimatedAmountMinor,
      0
    );
    const totalActual = event.budgetItems.reduce(
      (sum, item) => sum + item.actualAmountMinor,
      0
    );
    const totalPaid = event.budgetItems
      .filter((item) => item.isPaid)
      .reduce((sum, item) => sum + item.actualAmountMinor, 0);
    const remaining = totalBudget - totalEstimated;

    return { totalBudget, totalEstimated, totalActual, totalPaid, remaining };
  }, [event.totalBudgetMinor, event.budgetItems]);

  const taskStats = useMemo(() => {
    const total = event.tasks.length;
    const pending = event.tasks.filter((t) => t.status === 'pending').length;
    const inProgress = event.tasks.filter((t) => t.status === 'in_progress').length;
    const completed = event.tasks.filter((t) => t.status === 'completed').length;
    const cancelled = event.tasks.filter((t) => t.status === 'cancelled').length;
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, pending, inProgress, completed, cancelled, completionPercent };
  }, [event.tasks]);

  const daysUntilEvent = useMemo(() => {
    try {
      return differenceInDays(parseISO(event.startDate), new Date());
    } catch {
      return null;
    }
  }, [event.startDate]);

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const fmt = (amountMinor: number) =>
    moneyFormat(moneyFromMinor(amountMinor, event.currency));

  const budgetPercentUsed =
    budgetStats.totalBudget > 0
      ? Math.round((budgetStats.totalEstimated / budgetStats.totalBudget) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Date Range Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-500">Date Range</p>
              <p className="truncate text-sm font-semibold text-gray-900">
                {formatDate(event.startDate)}
              </p>
              <p className="truncate text-xs text-gray-500">
                to {formatDate(event.endDate)}
              </p>
            </div>
          </div>
          {daysUntilEvent !== null && (
            <p
              className={cn(
                'mt-3 text-xs font-medium',
                daysUntilEvent > 7
                  ? 'text-green-600'
                  : daysUntilEvent > 0
                    ? 'text-amber-600'
                    : 'text-red-600'
              )}
            >
              {daysUntilEvent > 0
                ? `${daysUntilEvent} days away`
                : daysUntilEvent === 0
                  ? 'Today!'
                  : `${Math.abs(daysUntilEvent)} days ago`}
            </p>
          )}
        </div>

        {/* Location Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <MapPin className="h-5 w-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-500">Location</p>
              <p className="truncate text-sm font-semibold text-gray-900">
                {event.location || 'Not set'}
              </p>
            </div>
          </div>
        </div>

        {/* Expected Guests Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-500">Expected Guests</p>
              <p className="text-sm font-semibold text-gray-900">
                {event.expectedGuests.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Total Budget Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <Wallet className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-500">Total Budget</p>
              <p className="truncate text-sm font-semibold text-gray-900">
                {fmt(event.totalBudgetMinor)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Summary & Task Progress */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Budget Summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
            <TrendingUp className="h-5 w-5 text-gray-500" />
            Budget Summary
          </h3>
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-gray-500">Allocated</span>
                <span
                  className={cn(
                    'font-medium',
                    budgetPercentUsed > 100 ? 'text-red-600' : 'text-gray-900'
                  )}
                >
                  {budgetPercentUsed}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    budgetPercentUsed > 100
                      ? 'bg-red-500'
                      : budgetPercentUsed > 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  )}
                  style={{ width: `${Math.min(budgetPercentUsed, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Total Budget</p>
                <p className="text-sm font-semibold text-gray-900">
                  {fmt(budgetStats.totalBudget)}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-xs text-blue-600">Estimated</p>
                <p className="text-sm font-semibold text-blue-900">
                  {fmt(budgetStats.totalEstimated)}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-600">Actual Spent</p>
                <p className="text-sm font-semibold text-emerald-900">
                  {fmt(budgetStats.totalActual)}
                </p>
              </div>
              <div
                className={cn(
                  'rounded-lg p-3',
                  budgetStats.remaining >= 0 ? 'bg-green-50' : 'bg-red-50'
                )}
              >
                <p
                  className={cn(
                    'text-xs',
                    budgetStats.remaining >= 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  Remaining
                </p>
                <p
                  className={cn(
                    'text-sm font-semibold',
                    budgetStats.remaining >= 0
                      ? 'text-green-900'
                      : 'text-red-900'
                  )}
                >
                  {fmt(budgetStats.remaining)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Task Progress */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
            <CheckCircle2 className="h-5 w-5 text-gray-500" />
            Task Progress
          </h3>

          {taskStats.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">No tasks created yet</p>
              <p className="text-xs text-gray-400">
                Switch to the Tasks tab to add tasks
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Completion Bar */}
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Completion</span>
                  <span className="font-medium text-gray-900">
                    {taskStats.completionPercent}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${taskStats.completionPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="text-xs text-yellow-600">Pending</p>
                    <p className="text-lg font-semibold text-yellow-900">
                      {taskStats.pending}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-blue-600">In Progress</p>
                    <p className="text-lg font-semibold text-blue-900">
                      {taskStats.inProgress}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-xs text-emerald-600">Completed</p>
                    <p className="text-lg font-semibold text-emerald-900">
                      {taskStats.completed}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-xs text-red-500">Cancelled</p>
                    <p className="text-lg font-semibold text-red-900">
                      {taskStats.cancelled}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {event.budgetItems.length}
          </p>
          <p className="text-xs text-gray-500">Budget Items</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {event.tasks.length}
          </p>
          <p className="text-xs text-gray-500">Tasks</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {event.vendors.length}
          </p>
          <p className="text-xs text-gray-500">Vendors</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">
            {event.teamMembers.length}
          </p>
          <p className="text-xs text-gray-500">Team Members</p>
        </div>
      </div>

      {/* Event Description */}
      {event.description && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900">
            <FileText className="h-5 w-5 text-gray-500" />
            Description
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
            {event.description}
          </p>
        </div>
      )}
    </div>
  );
}
