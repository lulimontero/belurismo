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
// Only display data: no card number, CVV or token ever reaches the widget.
export const beloCardWidgetSchema = z.object({
  holder: z.string().max(60),
  lastFour: z.string().max(4).nullable(),
  status: z.string().max(30),
  limitUsd: z.string().max(20).nullable(),
  error: z.string().max(200).optional(),
});
const beloTravelUrl = z.url().max(2048).refine((value) => new URL(value).hostname === "travel.belo.app");
export const beloHotelWidgetSchema = z.object({
  id: z.string().max(20),
  name: z.string().max(140),
  address: z.string().max(180),
  stars: z.number().int().min(1).max(5).nullable(),
  ratingLabel: z.string().max(30),
  rating: z.number().min(0).max(5),
  listPrice: z.number().min(0),
  price: z.number().min(0),
  discount: z.number().min(0).max(100),
  image: z.url().max(2048).refine((value) => new URL(value).hostname === "cdn.entravel.com").nullable(),
  url: beloTravelUrl,
});
export const conversationWidgetSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().max(80), type: z.literal("planning"), context: planningContextSchema }),
  z.object({ id: z.string().max(80), type: z.literal("panel"), kind: z.enum(panelKinds) }),
  z.object({ id: z.string().max(80), type: z.literal("quick-replies"), choices: z.array(z.object({ label: z.string().min(1).max(70), text: z.string().min(1).max(1500) })).max(6) }),
  z.object({ id: z.string().max(80), type: z.literal("cards"), cards: z.array(beloCardWidgetSchema).min(1).max(20) }),
  z.object({
    id: z.string().max(80),
    type: z.literal("belo-hotels"),
    destination: z.string().max(120),
    searchUrl: beloTravelUrl,
    checkedAt: z.iso.date(),
    checkedDates: z.tuple([z.iso.date(), z.iso.date()]),
    adults: z.number().int().min(1).max(20),
    hotels: z.array(beloHotelWidgetSchema).min(1).max(12),
  }),
]);
export type ConversationWidget = z.infer<typeof conversationWidgetSchema>;

export function readConversationWidget(value: unknown): ConversationWidget | undefined {
  const result = conversationWidgetSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
