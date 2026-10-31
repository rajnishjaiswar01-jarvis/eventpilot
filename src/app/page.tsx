'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar, CalendarClock, Wallet, ListChecks,
  Plus, Sparkles, ArrowRight, Users
} from 'lucide-react';
import { useEventStore } from '@/lib/stores/event-store';
import { moneyFormat, moneyFromMinor } from '@/lib/types/money';
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_ICONS, EVENT_STATUS_LABELS, EVENT_STATUS_COLORS } from '@/lib/constants/display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, isAfter } from 'date-fns';
import type { EventData, BudgetItem, Task, TeamMember, Vendor, Risk } from '@/lib/types/domain';
import { DataManager } from '@/components/events/data-manager';

function generateDemoBudgetItems(): BudgetItem[] {
  return [
    { id: 'bi-1', name: 'Auditorium Booking', category: 'venue', estimatedAmountMinor: 3000000, actualAmountMinor: 0, isPaid: false, notes: 'Main auditorium + 2 seminar halls' },
    { id: 'bi-2', name: 'Catering & Refreshments', category: 'catering', estimatedAmountMinor: 5000000, actualAmountMinor: 0, isPaid: false, notes: 'Day 1-3 lunch + snacks for 500' },
    { id: 'bi-3', name: 'Stage & Decorations', category: 'decoration', estimatedAmountMinor: 2500000, actualAmountMinor: 0, isPaid: false, notes: 'Main stage setup + banners' },
    { id: 'bi-4', name: 'Sound & Lighting', category: 'equipment', estimatedAmountMinor: 2000000, actualAmountMinor: 0, isPaid: false, notes: 'Professional AV setup' },
    { id: 'bi-5', name: 'Guest Speakers', category: 'entertainment', estimatedAmountMinor: 3000000, actualAmountMinor: 0, isPaid: false, notes: 'Travel + honorarium' },
    { id: 'bi-6', name: 'Marketing & Promotion', category: 'marketing', estimatedAmountMinor: 1500000, actualAmountMinor: 0, isPaid: false, notes: 'Posters + social media + website' },
    { id: 'bi-7', name: 'Prizes & Certificates', category: 'miscellaneous', estimatedAmountMinor: 1500000, actualAmountMinor: 0, isPaid: false, notes: 'Competition prizes + participation certificates' },
    { id: 'bi-8', name: 'Volunteer T-shirts', category: 'staffing', estimatedAmountMinor: 500000, actualAmountMinor: 0, isPaid: false, notes: '50 volunteer tees' },
    { id: 'bi-9', name: 'Photography & Videography', category: 'photography', estimatedAmountMinor: 1000000, actualAmountMinor: 0, isPaid: false, notes: 'Event coverage + after-movie' },
  ];
}

function generateDemoTasks(): Task[] {
  return [
    { id: 'task-1', title: 'Book venue', description: 'Confirm auditorium and halls', status: 'completed', priority: 'critical', dueDate: '2026-11-01', assigneeId: 'tm-1', dependsOn: [], completedAt: '2026-10-28' },
    { id: 'task-2', title: 'Finalize speakers', description: 'Contact and confirm guest speakers', status: 'in_progress', priority: 'high', dueDate: '2026-11-15', assigneeId: 'tm-2', dependsOn: [], completedAt: '' },
    { id: 'task-3', title: 'Design posters', description: 'Create promotional material', status: 'in_progress', priority: 'medium', dueDate: '2026-11-10', assigneeId: 'tm-4', dependsOn: [], completedAt: '' },
    { id: 'task-4', title: 'Setup registration portal', description: 'Online registration for attendees', status: 'pending', priority: 'high', dueDate: '2026-11-20', assigneeId: 'tm-5', dependsOn: ['task-3'], completedAt: '' },
    { id: 'task-5', title: 'Arrange catering', description: 'Finalize menu and vendor', status: 'pending', priority: 'high', dueDate: '2026-12-01', assigneeId: 'tm-3', dependsOn: ['task-1'], completedAt: '' },
    { id: 'task-6', title: 'Sound check & AV setup', description: 'Test all equipment', status: 'pending', priority: 'critical', dueDate: '2026-12-14', assigneeId: 'tm-5', dependsOn: ['task-1'], completedAt: '' },
    { id: 'task-7', title: 'Volunteer briefing', description: 'Brief all volunteers on roles', status: 'pending', priority: 'medium', dueDate: '2026-12-13', assigneeId: 'tm-1', dependsOn: [], completedAt: '' },
    { id: 'task-8', title: 'Print certificates', description: 'Participation & winner certificates', status: 'pending', priority: 'low', dueDate: '2026-12-10', assigneeId: 'tm-4', dependsOn: ['task-3'], completedAt: '' },
  ];
}

function generateDemoTeam(): TeamMember[] {
  return [
    { id: 'tm-1', name: 'Ananya Sharma', role: 'organizer', email: 'ananya@college.edu', phone: '', responsibilities: 'Overall event coordination' },
    { id: 'tm-2', name: 'Rahul Verma', role: 'coordinator', email: 'rahul@college.edu', phone: '', responsibilities: 'Speaker management & scheduling' },
    { id: 'tm-3', name: 'Priya Patel', role: 'logistics', email: 'priya@college.edu', phone: '', responsibilities: 'Venue, catering & transport' },
    { id: 'tm-4', name: 'Arjun Nair', role: 'creative', email: 'arjun@college.edu', phone: '', responsibilities: 'Design, branding & social media' },
    { id: 'tm-5', name: 'Sneha Gupta', role: 'technical', email: 'sneha@college.edu', phone: '', responsibilities: 'Website, registration & AV' },
  ];
}

function generateDemoVendors(): Vendor[] {
  return [
    { id: 'v-1', name: 'Campus Kitchen', service: 'Catering', contactEmail: '', contactPhone: '', status: 'quoted', quotedAmountMinor: 5200000, agreedAmountMinor: 0, notes: 'Veg + non-veg options' },
    { id: 'v-2', name: 'SoundWave Productions', service: 'Sound & Lighting', contactEmail: '', contactPhone: '', status: 'contacted', quotedAmountMinor: 0, agreedAmountMinor: 0, notes: 'Full AV setup for 3 days' },
    { id: 'v-3', name: 'PixelPerfect Studio', service: 'Photography & Video', contactEmail: '', contactPhone: '', status: 'identified', quotedAmountMinor: 0, agreedAmountMinor: 0, notes: 'Event coverage + after-movie' },
  ];
}

function generateDemoRisks(): Risk[] {
  return [
    { id: 'r-1', description: 'Rain on outdoor stage day', severity: 'high', likelihood: 'possible', status: 'identified', impact: 'Outdoor events cancelled', mitigation: 'Book indoor backup venue', contingency: 'Move to gymnasium', owner: 'tm-3' },
    { id: 'r-2', description: 'Speaker cancellation', severity: 'medium', likelihood: 'possible', status: 'identified', impact: 'Gap in schedule', mitigation: 'Confirm backup speakers', contingency: 'Panel discussion with faculty', owner: 'tm-2' },
    { id: 'r-3', description: 'Budget overrun', severity: 'high', likelihood: 'unlikely', status: 'identified', impact: 'Cannot cover all expenses', mitigation: 'Weekly budget reviews', contingency: 'Cut non-essential items', owner: 'tm-1' },
  ];
}

export default function DashboardPage() {
  const events = useEventStore((s) => s.events);
  const isHydrated = useEventStore((s) => s.isHydrated);
  const addEvent = useEventStore((s) => s.addEvent);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const router = useRouter();

  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = events.filter(
      (e) => isAfter(new Date(e.startDate), now) && e.status !== 'completed' && e.status !== 'cancelled'
    );
    const totalBudgetMinor = events.reduce((sum, e) => sum + e.totalBudgetMinor, 0);
    const pendingTasks = events.reduce(
      (sum, e) => sum + e.tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length, 0
    );
    return { total: events.length, upcoming: upcoming.length, totalBudgetMinor, pendingTasks };
  }, [events]);

  const handleLoadDemo = () => {
    const newEvent = addEvent({
      name: 'TechFest 2026',
      description: 'Annual college technology festival featuring hackathons, workshops, tech talks, and exhibitions',
      category: 'college_festival',
      startDate: '2026-12-15',
      endDate: '2026-12-17',
      location: 'Main Campus, University Auditorium',
      expectedGuests: 500,
      currency: 'INR',
      totalBudgetMajor: 200000,
    });
    updateEvent(newEvent.id, {
      status: 'planning',
      budgetItems: generateDemoBudgetItems(),
      tasks: generateDemoTasks(),
      teamMembers: generateDemoTeam(),
      vendors: generateDemoVendors(),
      risks: generateDemoRisks(),
    });
  };

  if (!isHydrated) return null;

  const statCards = [
    { label: 'Total Events', value: stats.total, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
    { label: 'Upcoming', value: stats.upcoming, icon: CalendarClock, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Total Budget', value: stats.totalBudgetMinor > 0 ? moneyFormat(moneyFromMinor(stats.totalBudgetMinor, 'INR')) : '—', icon: Wallet, color: 'text-violet-600 bg-violet-50' },
    { label: 'Pending Tasks', value: stats.pendingTasks, icon: ListChecks, color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome to EventPilot — your adaptive event intelligence platform</p>
        </div>
        <Link href="/events/new">
          <Button>
            <Plus className="w-4 h-4" />
            Create Event
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg', stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Events</h2>
          {events.length > 0 && (
            <Link href="/events" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Sparkles className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No events yet</h3>
              <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                Create your first event or load demo data to explore EventPilot&apos;s features
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/events/new">
                  <Button>
                    <Plus className="w-4 h-4" />
                    Create Your First Event
                  </Button>
                </Link>
                <Button variant="outline" onClick={handleLoadDemo}>
                  <Sparkles className="w-4 h-4" />
                  Load Demo Data
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.slice(0, 6).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Data Management */}
      <div className="border-t border-border pt-6">
        <DataManager />
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EventData }) {
  const categoryLabel = EVENT_CATEGORY_LABELS[event.category];
  const categoryIcon = EVENT_CATEGORY_ICONS[event.category];
  const statusLabel = EVENT_STATUS_LABELS[event.status];
  const statusColor = EVENT_STATUS_COLORS[event.status];

  let dateRange = '';
  try {
    const start = format(new Date(event.startDate), 'MMM d');
    const end = format(new Date(event.endDate), 'MMM d, yyyy');
    dateRange = `${start} - ${end}`;
  } catch {
    dateRange = `${event.startDate} - ${event.endDate}`;
  }

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">{categoryIcon}</span>
              <div>
                <CardTitle className="text-base">{event.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{categoryLabel}</p>
              </div>
            </div>
            <Badge className={cn('text-xs', statusColor)}>{statusLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>{dateRange}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              <span>{event.expectedGuests} guests</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" />
              <span>{moneyFormat(moneyFromMinor(event.totalBudgetMinor, event.currency))}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
