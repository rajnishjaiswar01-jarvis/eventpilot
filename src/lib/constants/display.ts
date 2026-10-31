/**
 * Display labels and helpers for domain enums.
 */
import type { EventCategory, EventStatus, BudgetCategory } from '@/lib/types/domain';

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  freshers_party: 'Freshers Party',
  farewell: 'Farewell',
  college_festival: 'College Festival',
  community_event: 'Community Event',
  conference: 'Conference',
  seminar: 'Seminar',
  workshop: 'Workshop',
  custom: 'Custom Event',
};

export const EVENT_CATEGORY_ICONS: Record<EventCategory, string> = {
  wedding: 'ðŸ’',
  birthday: 'ðŸŽ‚',
  freshers_party: 'ðŸŽ‰',
  farewell: 'ðŸ‘‹',
  college_festival: 'ðŸŽª',
  community_event: 'ðŸ˜ï¸',
  conference: 'ðŸŽ¤',
  seminar: 'ðŸ“š',
  workshop: 'ðŸ”§',
  custom: 'âš¡',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  planning: 'Planning',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const EVENT_STATUS_COLORS: Record<EventStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  planning: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  venue: 'Venue',
  catering: 'Catering',
  decoration: 'Decoration',
  entertainment: 'Entertainment',
  photography: 'Photography',
  transportation: 'Transportation',
  accommodation: 'Accommodation',
  marketing: 'Marketing',
  equipment: 'Equipment',
  staffing: 'Staffing',
  miscellaneous: 'Miscellaneous',
};
