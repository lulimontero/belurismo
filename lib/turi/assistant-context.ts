import type { Message, Workspace } from "./domain";
import { optionToText } from "./travel-options";
import { priceReviewToText } from "./price-reviews";
import { priceCheckToText } from "./price-check";

/** Include the facts in cards even when the assistant message has no prose. */
export function messageForAssistant(message: Pick<Message, "text" | "options" | "widgets">): string {
  return [message.text, ...(message.options || []).map(optionToText),
    ...(message.widgets || []).flatMap(widget => widget.type === "price-review-result" ? [priceReviewToText(widget.comparison)]
      : widget.type === "price-check" ? [priceCheckToText(widget.check)] : []),
  ].filter(Boolean).join("\n\n");
}

/** Archived trips and the private library are retrieved explicitly in the UI,
 * rather than sent to the model on every turn or Realtime tool call. */
export function workspaceForAssistant(state: Workspace): Workspace {
  return { ...state, postTrip: { ...state.postTrip, archivedTrips: [], templates: [], priceContributions: [], flightWatches: [] } };
}
