import { z } from "zod";

export const panelKinds = ["summary", "daily", "group", "recap", "checklist", "template", "post-trip-notice", "leftover", "price-review", "feedback", "next-trip"] as const;
export const planningContextSchema = z.object({
  step: z.enum(["destination", "dates", "travelers", "ages", "budget", "ready"]),
  destination: z.string().max(120).optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  nights: z.number().int().min(1).max(365).optional(),
  adults: z.number().int().min(1).max(50).optional(),
  children: z.number().int().min(0).max(49).optional(),
  ages: z.array(z.string().max(20)).max(49).optional(),
  currency: z.string().max(3).optional(),
  budget: z.number().finite().min(0).max(1e9).optional(),
  budgetScope: z.enum(["night", "total"]).optional(),
  budgetAudience: z.enum(["group", "person"]).optional(),
});
export const conversationWidgetSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().max(80), type: z.literal("planning"), context: planningContextSchema }),
  z.object({ id: z.string().max(80), type: z.literal("panel"), kind: z.enum(panelKinds) }),
  z.object({ id: z.string().max(80), type: z.literal("quick-replies"), choices: z.array(z.object({ label: z.string().min(1).max(70), text: z.string().min(1).max(1500) })).max(6) }),
]);
export type ConversationWidget = z.infer<typeof conversationWidgetSchema>;

export function readConversationWidget(value: unknown): ConversationWidget | undefined {
  const result = conversationWidgetSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
