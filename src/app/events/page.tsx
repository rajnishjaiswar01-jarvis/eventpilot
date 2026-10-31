'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Search, Calendar, Users, Wallet, ArrowUpDown } from 'lucide-react';
import { useEventStore } from '@/lib/stores/event-store';
import { moneyFormat, moneyFromMinor } from '@/lib/types/money';
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_ICONS, EVENT_STATUS_LABELS, EVENT_STATUS_COLORS } from '@/lib/constants/display';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { EventData } from '@/lib/types/domain';

type SortField = 'name' | 'date' | 'budget';

export default function EventsPage() {
  const events = useEventStore((s) => s.events);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('date');

  const filtered = useMemo(() => {
    let result = events;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) => e.name.toLowerCase().includes(q) || EVENT_CATEGORY_LABELS[e.category].toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'budget') return b.totalBudgetMinor - a.totalBudgetMinor;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
    return result;
  }, [events, search, sortBy]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">{events.length} event{events.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/events/new">
          <Button>
            <Plus className="w-4 h-4" />
            Create Event
          </Button>
        </Link>
      </div>

      {events.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {(['date', 'name', 'budget'] as SortField[]).map((s) => (
              <Button
                key={s}
                variant={sortBy === s ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSortBy(s)}
              >
                <ArrowUpDown className="w-3 h-3 mr-1" />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">
              {search ? 'No events match your search' : 'No events yet'}
            </p>
            {!search && (
              <Link href="/events/new">
                <Button>
                  <Plus className="w-4 h-4" />
                  Create Your First Event
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event) => (
            <EventListCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventListCard({ event }: { event: EventData }) {
  let dateRange = '';
  try {
    dateRange = `${format(new Date(event.startDate), 'MMM d')} - ${format(new Date(event.endDate), 'MMM d, yyyy')}`;
  } catch {
    dateRange = `${event.startDate} - ${event.endDate}`;
  }

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{EVENT_CATEGORY_ICONS[event.category]}</span>
              <div>
                <CardTitle className="text-base">{event.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{EVENT_CATEGORY_LABELS[event.category]}</p>
              </div>
            </div>
            <Badge className={cn('text-xs', EVENT_STATUS_COLORS[event.status])}>
              {EVENT_STATUS_LABELS[event.status]}
            </Badge>
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
          {event.tasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{event.tasks.filter((t) => t.status === 'completed').length}/{event.tasks.length} tasks done</span>
                <span>{event.budgetItems.length} budget items</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
