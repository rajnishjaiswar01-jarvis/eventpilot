'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, ChevronLeft } from 'lucide-react';
import { useEventStore } from '@/lib/stores/event-store';
import { CreateEventInputSchema } from '@/lib/schemas/event.schema';
import { EVENT_CATEGORY_LABELS, EVENT_CATEGORY_ICONS } from '@/lib/constants/display';
import type { EventCategory } from '@/lib/types/domain';
import type { CurrencyCode } from '@/lib/types/money';
import { moneyFormat, moneyFromMinor } from '@/lib/types/money';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import Link from 'next/link';

const CATEGORY_DESCRIPTIONS: Record<EventCategory, string> = {
  wedding: 'Celebrate the union of two souls',
  birthday: 'Mark another year of memories',
  freshers_party: 'Welcome the new batch',
  farewell: 'Bid farewell in style',
  college_festival: 'Multi-day campus celebration',
  community_event: 'Bring the community together',
  conference: 'Professional knowledge sharing',
  seminar: 'Focused educational session',
  workshop: 'Hands-on learning experience',
  custom: 'Design your own event',
};

const CATEGORIES: EventCategory[] = [
  'wedding', 'birthday', 'freshers_party', 'farewell',
  'college_festival', 'community_event', 'conference',
  'seminar', 'workshop', 'custom',
];

const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
  { value: 'EUR', label: '€ EUR' },
  { value: 'GBP', label: '£ GBP' },
];

const STEPS = ['Category', 'Details', 'Dates & Guests', 'Budget', 'Review'];

interface FormData {
  category: EventCategory | '';
  name: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  expectedGuests: string;
  currency: CurrencyCode;
  totalBudgetMajor: string;
}

function getLocalTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CreateEventPage() {
  const router = useRouter();
  const addEvent = useEventStore((s) => s.addEvent);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormData>({
    category: '',
    name: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    expectedGuests: '0',
    currency: 'INR',
    totalBudgetMajor: '0',
  });

  const update = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!form.category) newErrors.category = 'Please select an event type';
    } else if (step === 1) {
      if (!form.name.trim()) newErrors.name = 'Event name is required';
      if (form.name.length > 200) newErrors.name = 'Event name is too long (max 200 chars)';
    } else if (step === 2) {
      const todayStr = getLocalTodayString();
      if (!form.startDate) {
        newErrors.startDate = 'Start date is required';
      } else if (form.startDate < todayStr) {
        newErrors.startDate = 'Start date cannot be earlier than today';
      }

      if (!form.endDate) {
        newErrors.endDate = 'End date is required';
      } else if (form.startDate && form.endDate < form.startDate) {
        newErrors.endDate = 'End date must be on or after start date';
      }
      const guests = parseInt(form.expectedGuests, 10);
      if (isNaN(guests) || guests < 0) newErrors.expectedGuests = 'Guest count must be 0 or more';
    } else if (step === 3) {
      const budget = parseFloat(form.totalBudgetMajor);
      if (isNaN(budget) || budget < 0) newErrors.totalBudgetMajor = 'Budget cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = () => {
    const input = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category as EventCategory,
      startDate: form.startDate,
      endDate: form.endDate,
      location: form.location.trim(),
      expectedGuests: parseInt(form.expectedGuests, 10) || 0,
      currency: form.currency,
      totalBudgetMajor: parseFloat(form.totalBudgetMajor) || 0,
    };

    const result = CreateEventInputSchema.safeParse(input);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0]?.toString() || 'form';
        fieldErrors[field] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    const newEvent = addEvent(result.data);
    router.push(`/events/${newEvent.id}`);
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Event</h1>
          <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-semibold">What type of event are you planning?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => update('category', cat)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center hover:border-primary/50',
                      form.category === cat
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border'
                    )}
                  >
                    <span className="text-2xl">{EVENT_CATEGORY_ICONS[cat]}</span>
                    <span className="text-sm font-medium">{EVENT_CATEGORY_LABELS[cat]}</span>
                    <span className="text-xs text-muted-foreground leading-tight">{CATEGORY_DESCRIPTIONS[cat]}</span>
                  </button>
                ))}
              </div>
              {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold">Event Details</h2>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Event Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., TechFest 2026"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of your event..."
                    value={form.description}
                    onChange={(e) => update('description', e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., University Auditorium"
                    value={form.location}
                    onChange={(e) => update('location', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold">Dates & Guests</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    min={getLocalTodayString()}
                    value={form.startDate}
                    onChange={(e) => update('startDate', e.target.value)}
                    className={errors.startDate ? 'border-destructive' : ''}
                  />
                  {errors.startDate && <p className="text-sm text-destructive mt-1">{errors.startDate}</p>}
                </div>
                <div>
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    min={form.startDate || getLocalTodayString()}
                    value={form.endDate}
                    onChange={(e) => update('endDate', e.target.value)}
                    className={errors.endDate ? 'border-destructive' : ''}
                  />
                  {errors.endDate && <p className="text-sm text-destructive mt-1">{errors.endDate}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="guests">Expected Guests</Label>
                <Input
                  id="guests"
                  type="number"
                  min="0"
                  value={form.expectedGuests}
                  onChange={(e) => update('expectedGuests', e.target.value)}
                  className={errors.expectedGuests ? 'border-destructive' : ''}
                />
                {errors.expectedGuests && <p className="text-sm text-destructive mt-1">{errors.expectedGuests}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold">Budget</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    id="currency"
                    value={form.currency}
                    onChange={(e) => update('currency', e.target.value as CurrencyCode)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="budget">Total Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    min="0"
                    step="100"
                    value={form.totalBudgetMajor}
                    onChange={(e) => update('totalBudgetMajor', e.target.value)}
                    className={errors.totalBudgetMajor ? 'border-destructive' : ''}
                  />
                  {errors.totalBudgetMajor && <p className="text-sm text-destructive mt-1">{errors.totalBudgetMajor}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-semibold">Review & Create</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">
                    {EVENT_CATEGORY_ICONS[form.category as EventCategory]} {EVENT_CATEGORY_LABELS[form.category as EventCategory]}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{form.name}</span>
                </div>
                {form.description && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Description</span>
                    <span className="font-medium max-w-[60%] text-right">{form.description}</span>
                  </div>
                )}
                {form.location && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium">{form.location}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Dates</span>
                  <span className="font-medium">
                    {form.startDate && format(new Date(form.startDate), 'MMM d, yyyy')} — {form.endDate && format(new Date(form.endDate), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Guests</span>
                  <span className="font-medium">{form.expectedGuests}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-medium">
                    {moneyFormat(moneyFromMinor(Math.round((parseFloat(form.totalBudgetMajor) || 0) * 100), form.currency))}
                  </span>
                </div>
              </div>
              {Object.keys(errors).length > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {Object.values(errors).map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={step === 0 ? () => router.push('/') : handleBack}>
          <ArrowLeft className="w-4 h-4" />
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext}>
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit}>
            <Check className="w-4 h-4" />
            Create Event
          </Button>
        )}
      </div>
    </div>
  );
}
