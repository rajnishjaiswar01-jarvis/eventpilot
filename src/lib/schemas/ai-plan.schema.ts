import { z } from 'zod';

export const AIPlanBudgetItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  estimatedAmountMajor: z.number().min(0),
  notes: z.string().optional().default(''),
});

export const AIPlanTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  dueOffsetDays: z.number().int(),
});

export const AIPlanRiskSchema = z.object({
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  likelihood: z.enum(['unlikely', 'possible', 'likely', 'very_likely']),
  mitigation: z.string(),
  contingency: z.string().optional().default(''),
});

export const AIPlanVendorCategorySchema = z.object({
  service: z.string(),
  description: z.string(),
  estimatedBudgetMajor: z.number().min(0),
});

export const AIEventPlanSchema = z.object({
  summary: z.string(),
  themeIdeas: z.array(z.string()),
  budgetItems: z.array(AIPlanBudgetItemSchema),
  tasks: z.array(AIPlanTaskSchema),
  risks: z.array(AIPlanRiskSchema),
  vendorCategories: z.array(AIPlanVendorCategorySchema),
  tips: z.array(z.string()),
});

export type AIEventPlan = z.infer<typeof AIEventPlanSchema>;
