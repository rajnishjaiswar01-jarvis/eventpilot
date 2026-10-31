'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Trash2, Settings, LayoutDashboard,
  Wallet, ListChecks, Store, UsersRound, Sparkles,
  MapPin, Calendar, Users, MoreVertical, Clock, FlaskConical,
} from 'lucide-react';
import { useEventStore } from '@/lib/stores/event-store';
import {
  EVENT_CATEGORY_LABELS, EVENT_CATEGORY_ICONS,
  EVENT_STATUS_LABELS, EVENT_STATUS_COLORS,
} from '@/lib/constants/display';
import type { EventStatus } from '@/lib/types/domain';
import { moneyFormat, moneyFromMinor } from '@/lib/types/money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { EventOverview } from '@/components/events/event-overview';
import { BudgetManager } from '@/components/events/budget-manager';
import { TaskManager } from '@/components/events/task-manager';
import { VendorManager } from '@/components/events/vendor-manager';
import { TeamManager } from '@/components/events/team-manager';
import { AiPlanner } from '@/components/events/ai-planner';
import { TimelinePlanner } from '@/components/events/timeline-planner';
import { SimulationPanel } from '@/components/events/simulation-panel';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_OPTIONS: EventStatus[] = [
  'draft', 'planning', 'confirmed', 'in_progress', 'completed', 'cancelled',
];

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const events = useEventStore((s) => s.events);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const deleteEvent = useEventStore((s) => s.deleteEvent);
  const isHydrated = useEventStore((s) => s.isHydrated);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const event = events.find((e) => e.id === id);

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <h2 className="text-lg font-semibold mb-2">Event not found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              This event may have been deleted.
            </p>
            <Link href="/">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDelete = () => {
    deleteEvent(event.id);
    router.push('/');
  };

  const handleStatusChange = (newStatus: string) => {
    updateEvent(event.id, { status: newStatus as EventStatus });
  };

  let dateRange = '';
  try {
    dateRange = `${format(new Date(event.startDate), 'MMM d')} – ${format(new Date(event.endDate), 'MMM d, yyyy')}`;
  } catch {
    dateRange = `${event.startDate} – ${event.endDate}`;
  }

  const tabs = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'budget', label: 'Budget', icon: Wallet },
    { value: 'timeline', label: 'Timeline', icon: Clock },
    { value: 'tasks', label: 'Tasks', icon: ListChecks },
    { value: 'simulation', label: 'Simulate', icon: FlaskConical },
    { value: 'vendors', label: 'Vendors', icon: Store },
    { value: 'team', label: 'Team', icon: UsersRound },
    { value: 'ai', label: 'AI Planner', icon: Sparkles },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Link href="/events">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">{EVENT_CATEGORY_ICONS[event.category]}</span>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{event.name}</h1>
              <Badge className={cn('text-xs shrink-0', EVENT_STATUS_COLORS[event.status])}>
                {EVENT_STATUS_LABELS[event.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{dateRange}</span>
              {event.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{event.location}</span>}
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{event.expectedGuests} guests</span>
              <span className="flex items-center gap-1"><Wallet className="w-3.5 h-3.5" />{moneyFormat(moneyFromMinor(event.totalBudgetMinor, event.currency))}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="status-select" className="text-sm text-muted-foreground">Status:</label>
            <Select
              id="status-select"
              value={event.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-auto"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{EVENT_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </div>
          <div className="flex-1" />
          <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <EventOverview event={event} />
        </TabsContent>
        <TabsContent value="budget">
          <BudgetManager event={event} />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelinePlanner event={event} />
        </TabsContent>
        <TabsContent value="tasks">
          <TaskManager event={event} />
        </TabsContent>
        <TabsContent value="simulation">
          <SimulationPanel event={event} />
        </TabsContent>
        <TabsContent value="vendors">
          <VendorManager event={event} />
        </TabsContent>
        <TabsContent value="team">
          <TeamManager event={event} />
        </TabsContent>
        <TabsContent value="ai">
          <AiPlanner event={event} />
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent onClose={() => setDeleteDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &quot;{event.name}&quot;? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
