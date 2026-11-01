/**
 * Zod validation schemas for EventPilot domain types.
 * These provide runtime validation for user input and AI responses.
 * Schema validation is the FIRST layer — business rule validation follows.
 */

import { z } from 'zod';

// ─── Enums ──────────────────────────────────────────────

export const EventCategorySchema = z.enum([
  'wedding', 'birthday', 'freshers_party', 'farewell',
  'college_festival', 'community_event', 'conference',
  'seminar', 'workshop', 'custom',
]);

export const EventStatusSchema = z.enum([
  'draft', 'planning', 'confirmed', 'in_progress', 'completed', 'cancelled',
]);

export const CurrencyCodeSchema = z.enum(['INR', 'USD', 'EUR', 'GBP']);

export const BudgetCategorySchema = z.enum([
  'venue', 'catering', 'decoration', 'entertainment', 'photography',
  'transportation', 'accommodation', 'marketing', 'equipment',
  'staffing', 'miscellaneous',
]);

export const TaskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const VendorStatusSchema = z.enum([
  'identified', 'contacted', 'quoted', 'negotiating', 'booked', 'completed', 'cancelled',
]);

export const TeamRoleSchema = z.enum([
  'organizer', 'coordinator', 'volunteer', 'vendor_liaison',
  'finance', 'logistics', 'creative', 'technical', 'custom',
]);

export const RiskSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const RiskLikelihoodSchema = z.enum(['unlikely', 'possible', 'likely', 'very_likely']);
export const RiskStatusSchema = z.enum(['identified', 'mitigated', 'accepted', 'occurred', 'resolved']);

// ─── Sub-entity Schemas ─────────────────────────────────

export const BudgetItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Budget item name is required'),
  category: BudgetCategorySchema,
  estimatedAmountMinor: z.number().int('Estimated amount must be an integer (minor units)'),
  actualAmountMinor: z.number().int('Actual amount must be an integer (minor units)'),
  isPaid: z.boolean(),
  notes: z.string(),
});

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Task title is required'),
  description: z.string(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  dueDate: z.string().refine(
    (val) => val === '' || !isNaN(Date.parse(val)),
    { message: 'Due date must be a valid ISO 8601 date or empty' }
  ),
  assigneeId: z.string(),
  dependsOn: z.array(z.string()),
  completedAt: z.string(),
});

export const VendorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Vendor name is required'),
  service: z.string().min(1, 'Service description is required'),
  contactEmail: z.string(),
  contactPhone: z.string(),
  status: VendorStatusSchema,
  quotedAmountMinor: z.number().int(),
  agreedAmountMinor: z.number().int(),
  notes: z.string(),
});

export const TeamMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Team member name is required'),
  role: TeamRoleSchema,
  email: z.string(),
  phone: z.string(),
  responsibilities: z.string(),
});

export const RiskSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1, 'Risk description is required'),
  severity: RiskSeveritySchema,
  likelihood: RiskLikelihoodSchema,
  status: RiskStatusSchema,
  impact: z.string(),
  mitigation: z.string(),
  contingency: z.string(),
  owner: z.string(),
});

// ─── Event Schema ───────────────────────────────────────

export const EventDataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Event name is required').max(200, 'Event name is too long'),
  description: z.string().max(2000, 'Description is too long'),
  category: EventCategorySchema,
  status: EventStatusSchema,
  startDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'Start date must be a valid ISO 8601 date' }
  ),
  endDate: z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: 'End date must be a valid ISO 8601 date' }
  ),
  location: z.string(),
  expectedGuests: z.number().int().min(0, 'Guest count cannot be negative'),
  currency: CurrencyCodeSchema,
  totalBudgetMinor: z.number().int('Budget must be an integer (minor units)').min(0, 'Budget cannot be negative'),
  budgetItems: z.array(BudgetItemSchema),
  tasks: z.array(TaskSchema),
  vendors: z.array(VendorSchema),
  teamMembers: z.array(TeamMemberSchema),
  risks: z.array(RiskSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ─── Event Creation Input (partial, for wizard) ─────────

export const CreateEventInputSchema = z
  .object({
    name: z.string().min(1, 'Event name is required').max(200),
    description: z.string().max(2000).default(''),
    category: EventCategorySchema,
    startDate: z.string().refine(
      (val) => !isNaN(Date.parse(val)),
      { message: 'Start date must be a valid date' }
    ),
    endDate: z.string().refine(
      (val) => !isNaN(Date.parse(val)),
      { message: 'End date must be a valid date' }
    ),
    location: z.string().default(''),
    expectedGuests: z.number().int().min(0).default(0),
    currency: CurrencyCodeSchema.default('INR'),
    totalBudgetMajor: z.number().min(0, 'Budget cannot be negative').default(0),
  })
  .refine(
    (data) => {
      const today = new Date();
      const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const startStr = data.startDate.slice(0, 10);
      return startStr >= localToday;
    },
    {
      message: 'Start date cannot be earlier than today',
      path: ['startDate'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end >= start;
    },
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    }
  );

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

// ─── Simulation Scenario Schema ─────────────────────────

export const SimulationScenarioSchema = z.object({
  id: z.string().min(1),
  sourceEventId: z.string().min(1),
  name: z.string().min(1, 'Scenario name is required'),
  description: z.string(),
  snapshotData: EventDataSchema,
  modifications: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
