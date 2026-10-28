"use client";

import { useState } from "react";
import type { ConversationWidget } from "@/lib/turi/conversation-widgets";
import type { TuriController } from "./useTuri";
import PlanningStep from "./PlanningStep";
import ConversationPanels from "./ConversationPanels";
import "./conversation-widgets.css";

function QuickReplies({ widget, disabled, onSend }: {
  widget: Extract<ConversationWidget, { type: "quick-replies" }>;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [selected, setSelected] = useState<string>();
  return <div className="turi-quick-replies" aria-label="Cómo seguimos">
    {widget.choices.map((choice) => <button key={choice.label} type="button" disabled={disabled || Boolean(selected)}
      className={selected === choice.label ? "selected" : ""}
      onClick={() => { setSelected(choice.label); onSend(choice.text); }}>{choice.label}</button>)}
  </div>;
}

export default function ConversationWidgets({ widgets, turi, disabled, onSend }: {
  widgets: ConversationWidget[];
  turi: TuriController;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  return <div className="turi-conversation-widgets">
    {widgets.map((widget) => widget.type === "planning"
      ? <PlanningStep key={widget.id} context={widget.context} disabled={disabled} onSend={onSend} />
      : widget.type === "panel"
        ? <ConversationPanels key={widget.id} kind={widget.kind} turi={turi} disabled={disabled} onSend={onSend} />
        : <QuickReplies key={widget.id} widget={widget} disabled={disabled} onSend={onSend} />)}
  </div>;
}
