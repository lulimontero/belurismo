"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyWorkspace,
  messageSchema,
  workspaceSchema,
  type Workspace,
  type Message,
  type Attachment,
  type Status,
  type LocalAction,
} from "@/lib/turi/domain";
import { mergeTravelOptions, readTravelOptions } from "@/lib/turi/travel-options";
import { readConversationWidget } from "@/lib/turi/conversation-widgets";
import { messageForAssistant, workspaceForAssistant } from "@/lib/turi/assistant-context";

export async function api<T = Record<string, unknown>>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(`/api/turi/${path}`, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "No pude completar la conexión.");
  return data as T;
}
const storageKey = "turi.workspace.v1";
function readLocal(): {
  state: Workspace;
  messages: Message[];
  updatedAt: number;
  proposals: LocalAction[];
  beloProposals: BeloProposal[];
} {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (data)
      return {
        state: workspaceSchema.parse(data.state),
        messages: Array.isArray(data.messages)
          ? data.messages
              .flatMap((message: unknown) => {
                const result = messageSchema.safeParse(message);
                return result.success ? [result.data] : [];
              })
              .slice(-30)
          : [],
        updatedAt: Number(data.updatedAt || 0),
        proposals: Array.isArray(data.proposals)
          ? data.proposals.slice(-20)
          : [],
        beloProposals: Array.isArray(data.beloProposals)
          ? data.beloProposals.slice(-10)
          : [],
      };
  } catch {
    /* private browsing or older state */
  }
  return {
    state: emptyWorkspace(),
    messages: [],
    updatedAt: 0,
    proposals: [],
    beloProposals: [],
  };
}
export type BeloProposal = {
  label: string;
  name: string;
  args: Record<string, unknown>;
  token: string;
};
export function useTuri() {
  const [initial] = useState(readLocal);
  const [state, setState] = useState(initial.state),
    [messages, setMessages] = useState<Message[]>(initial.messages);
  const [status, setStatus] = useState<Status | null>(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [activity, setActivity] = useState(""),
    [proposals, setProposals] = useState<LocalAction[]>(initial.proposals),
    [beloProposals, setBeloProposals] = useState<BeloProposal[]>(
      initial.beloProposals,
    );
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  }>();
  const request = useRef<AbortController | null>(null),
    current = useRef({ state, messages, proposals, beloProposals });
  const cloudRevision = useRef(0),
    syncReady = useRef(false),
    dirty = useRef(false),
    syncing = useRef(false);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    current.current = { state, messages, proposals, beloProposals };
  }, [state, messages, proposals, beloProposals]);
  const refreshStatus = useCallback(async () => {
    try {
      const data = await api<Status>("status", undefined, "GET");
      setStatus(data);
      return data;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await api<Status>("status", undefined, "GET");
        if (!mounted) return;
        setStatus(data);
        if (data.cloud) {
          const cloud = await api<{
            state: Workspace | null;
            messages: Message[];
            updatedAt: number;
            proposals: LocalAction[];
            beloProposals: BeloProposal[];
          }>("state", undefined, "GET");
          cloudRevision.current = cloud.updatedAt;
          if (mounted && cloud.updatedAt > initial.updatedAt) {
            if (cloud.state) setState(workspaceSchema.parse(cloud.state));
            setMessages(cloud.messages);
            setProposals(cloud.proposals);
            setBeloProposals(cloud.beloProposals);
          }
        }
      } catch (e) {
        if (mounted) setError((e as Error).message);
      } finally {
        if (mounted) {
          syncReady.current = true;
          setReady(true);
        }
      }
    })();
    return () => {
      mounted = false;
      request.current?.abort();
    };
  }, [initial]);
  useEffect(() => {
    if (!ready) return;
    dirty.current = true;
    const timer = setTimeout(() => {
      const slim = messages
        .slice(-30)
        .map(({ id, role, text, sources, attachments, options, widgets }) => ({
          id,
          role,
          text,
          sources,
          attachments,
          options,
          widgets,
        }));
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            state,
            messages: slim,
            proposals,
            beloProposals,
            updatedAt: Date.now(),
          }),
        );
      } catch {
        setError(
          "El almacenamiento de este dispositivo está lleno. Exportá el viaje para conservarlo.",
        );
      }
      if (status?.cloud && !busy) {
        syncQueue.current = syncQueue.current.then(async () => {
          syncing.current = true;
          try {
            const data = await api<{ updatedAt: number }>("state", {
              state,
              messages: slim,
              baseRevision: cloudRevision.current,
              proposals,
              beloProposals,
            });
            cloudRevision.current = data.updatedAt;
            if (
              current.current.state === state &&
              current.current.messages === messages &&
              current.current.proposals === proposals &&
              current.current.beloProposals === beloProposals
            )
              dirty.current = false;
          } catch (e) {
            setError(
              `Guardado en este dispositivo. La sincronización falló: ${(e as Error).message}`,
            );
          } finally {
            syncing.current = false;
          }
        });
      } else if (!status?.cloud) dirty.current = false;
    }, 900);
    return () => clearTimeout(timer);
  }, [state, messages, proposals, beloProposals, ready, status?.cloud, busy]);
  useEffect(() => {
    if (!status?.cloud) return;
    const interval = setInterval(() => {
      if (
        !syncReady.current ||
        dirty.current ||
        syncing.current ||
        request.current
      )
        return;
      void api<{
        state: Workspace | null;
        messages: Message[];
        updatedAt: number;
        proposals: LocalAction[];
        beloProposals: BeloProposal[];
      }>("state", undefined, "GET")
        .then((cloud) => {
          if (
            cloud.updatedAt > cloudRevision.current &&
            !dirty.current &&
            !syncing.current
          ) {
            cloudRevision.current = cloud.updatedAt;
            if (cloud.state) setState(workspaceSchema.parse(cloud.state));
            setMessages(cloud.messages);
            setProposals(cloud.proposals);
            setBeloProposals(cloud.beloProposals);
          }
        })
        .catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [status?.cloud]);
  const handleEvent = useCallback(
    (event: Record<string, unknown>, assistantId?: string) => {
      if (event.type === "delta" && assistantId)
        setMessages((list) =>
          list.map((m) =>
            m.id === assistantId
              ? { ...m, text: m.text + String(event.text) }
              : m,
          ),
        );
      if (event.type === "activity") setActivity(String(event.text));
      if (
        event.type === "source" &&
        assistantId &&
        /^https?:\/\//.test(String(event.url))
      )
        setMessages((list) =>
          list.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  sources: [
                    ...(m.sources || []).filter((s) => s.url !== event.url).slice(-19),
                    { title: String(event.title), url: String(event.url) },
                  ],
                }
              : m,
          ),
        );
      if (event.type === "travel_options" && assistantId) {
        const options = readTravelOptions(event.options);
        if (options.length)
          setMessages((list) => list.map((message) =>
            message.id === assistantId ? { ...message, options: mergeTravelOptions(message.options || [], options) } : message,
          ));
      }
      if (event.type === "widget" && assistantId) {
        const widget = readConversationWidget(event.widget);
        if (widget) setMessages((list) => list.map((message) => message.id === assistantId ? {
          ...message, widgets: [...(message.widgets || []).filter((existing) => existing.id !== widget.id), widget].slice(-8),
        } : message));
      }
      if (event.type === "proposal")
        setProposals((list) => [...list, event.action as LocalAction]);
      if (event.type === "belo_review")
        setBeloProposals((list) => [...list, event.proposal as BeloProposal]);
      if (event.type === "error") setError(String(event.error));
    },
    [],
  );
  const send = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      if (busy || (!text.trim() && !attachments.length)) return false;
      if (!status?.ai) {
        setError(
          "Falta agregar OPENAI_API_KEY en Vercel para activar las respuestas y la voz de Turi. Tu viaje ya se puede organizar desde las otras pestañas.",
        );
        return false;
      }
      setError("");
      setBusy(true);
      setActivity("Turi está pensando…");
      const user: Message = {
          id: crypto.randomUUID(),
          role: "user",
          text:
            text.trim() ||
            "Revisá este comprobante y prepará los datos para mi viaje.",
          attachments: attachments.map((a) => ({ name: a.name })),
        },
        assistantId = crypto.randomUUID();
      const next = [...current.current.messages, user];
      setMessages([...next, { id: assistantId, role: "assistant", text: "" }]);
      const controller = new AbortController();
      request.current = controller;
      try {
        const response = await fetch("/api/turi/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: workspaceForAssistant(current.current.state),
            messages: next
              .slice(-24)
              .map((m) => ({
                role: m.role,
                text: messageForAssistant(m),
              })),
            attachments,
            location,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "No pude iniciar el chat.");
        }
        const reader = response.body!.getReader(),
          decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines)
            if (line.trim()) handleEvent(JSON.parse(line), assistantId);
        }
        if (buffer.trim()) handleEvent(JSON.parse(buffer), assistantId);
        return true;
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
        return false;
      } finally {
        setBusy(false);
        setActivity("");
        request.current = null;
        setMessages((list) => list.filter((m) => m.text || m.options?.length || m.widgets?.length || m.sources?.length || m.role === "user"));
      }
    },
    [busy, status?.ai, location, handleEvent],
  );
  const shareLocation = () => {
    if (location) {
      setLocation(undefined);
      return;
    }
    if (!navigator.geolocation) {
      setError("Este navegador no permite compartir la ubicación.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () =>
        setError(
          "No se compartió tu ubicación. Podés escribir la zona o el barrio.",
        ),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
    );
  };
  // Clears the chat but keeps the trip, expenses and group already saved.
  const restart = () => {
    request.current?.abort();
    setMessages([]);
    setProposals([]);
    setBeloProposals([]);
    setError("");
  };
  const erase = async () => {
    request.current?.abort();
    setReady(false);
    syncReady.current = false;
    try {
      await syncQueue.current;
      await api("state", undefined, "DELETE");
      cloudRevision.current = 0;
      localStorage.removeItem(storageKey);
      setState(emptyWorkspace());
      setMessages([]);
      setProposals([]);
      setBeloProposals([]);
      setLocation(undefined);
      await refreshStatus();
    } finally {
      syncReady.current = true;
      setReady(true);
    }
  };
  return {
    state,
    setState,
    messages,
    setMessages,
    status,
    busy,
    error,
    setError,
    activity,
    proposals,
    setProposals,
    beloProposals,
    setBeloProposals,
    location,
    shareLocation,
    send,
    handleEvent,
    refreshStatus,
    erase,
    restart,
    stop: () => request.current?.abort(),
  };
}
export type TuriController = ReturnType<typeof useTuri>;
