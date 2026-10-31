/**
 * Core domain types for EventPilot.
 * These types define the shape of all business entities.
 */

import type { Money, CurrencyCode } from './money';

// ─── Event ──────────────────────────────────────────────

export type EventCategory =
  | 'wedding'
  | 'birthday'
  | 'freshers_party'
  | 'farewell'
  | 'college_festival'
  | 'community_event'
  | 'conference'
  | 'seminar'
  | 'workshop'
  | 'custom';

export type EventStatus =
  | 'draft'
  | 'planning'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface EventData {
  readonly id: string;
  name: string;
  description: string;
  category: EventCategory;
  status: EventStatus;
  startDate: string; // ISO 8601 date string
  endDate: string;   // ISO 8601 date string
  location: string;
  expectedGuests: number;
  currency: CurrencyCode;
  totalBudgetMinor: number; // Integer minor units
  budgetItems: BudgetItem[];
  tasks: Task[];
  vendors: Vendor[];
  teamMembers: TeamMember[];
  risks: Risk[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ─── Budget ─────────────────────────────────────────────

export type BudgetCategory =
  | 'venue'
  | 'catering'
  | 'decoration'
  | 'entertainment'
  | 'photography'
  | 'transportation'
  | 'accommodation'
  | 'marketing'
  | 'equipment'
  | 'staffing'
  | 'miscellaneous';

export interface BudgetItem {
  readonly id: string;
  name: string;
  category: BudgetCategory;
  estimatedAmountMinor: number; // Integer minor units
  actualAmountMinor: number;    // Integer minor units
  isPaid: boolean;
  notes: string;
}

// ─── Tasks ──────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  readonly id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;        // ISO 8601
  assigneeId: string;     // TeamMember id, or empty string if unassigned
  dependsOn: string[];    // Array of Task ids this task depends on
  completedAt: string;    // ISO 8601, empty string if not completed
}

// ─── Vendors ────────────────────────────────────────────

export type VendorStatus =
  | 'identified'
  | 'contacted'
  | 'quoted'
  | 'negotiating'
  | 'booked'
  | 'completed'
  | 'cancelled';

export interface Vendor {
  readonly id: string;
  name: string;
  service: string;
  contactEmail: string;
  contactPhone: string;
  status: VendorStatus;
  quotedAmountMinor: number; // Integer minor units
  agreedAmountMinor: number; // Integer minor units
  notes: string;
}

// ─── Team ───────────────────────────────────────────────

export type TeamRole =
  | 'organizer'
  | 'coordinator'
  | 'volunteer'
  | 'vendor_liaison'
  | 'finance'
  | 'logistics'
  | 'creative'
  | 'technical'
  | 'custom';

export interface TeamMember {
  readonly id: string;
  name: string;
  role: TeamRole;
  email: string;
  phone: string;
  responsibilities: string;
}

// ─── Risk ───────────────────────────────────────────────

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskLikelihood = 'unlikely' | 'possible' | 'likely' | 'very_likely';
export type RiskStatus = 'identified' | 'mitigated' | 'accepted' | 'occurred' | 'resolved';

export interface Risk {
  readonly id: string;
  description: string;
  severity: RiskSeverity;
  likelihood: RiskLikelihood;
  status: RiskStatus;
  impact: string;
  mitigation: string;
  contingency: string;
  owner: string; // TeamMember id or name
}

// ─── Simulation ─────────────────────────────────────────

export interface SimulationScenario {
  readonly id: string;
  readonly sourceEventId: string; // ID of the original event
  name: string;
  description: string;
  snapshotData: EventData;       // Deep copy of event data at snapshot time
  modifications: Record<string, unknown>; // Track what was changed
  createdAt: string;             // ISO 8601
}

// ─── Validation ─────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  readonly field: string;
  readonly message: string;
  readonly severity: ValidationSeverity;
  readonly code: string; // Machine-readable code like 'BUDGET_OVERFLOW'
}
