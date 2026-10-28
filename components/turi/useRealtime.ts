"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type TuriController } from "./useTuri";

export function useRealtime(turi: TuriController) {
  const [phase, setPhase] = useState<
      "off" | "connecting" | "listening" | "speaking"
    >("off"),
    [muted, setMuted] = useState(false);
  const resources = useRef<{
    peer?: RTCPeerConnection;
    stream?: MediaStream;
    audio?: HTMLAudioElement;
    channel?: RTCDataChannel;
    timer?: ReturnType<typeof setTimeout>;
    abort?: AbortController;
  }>({});
  const current = useRef(turi),
    liveIds = useRef(new Map<string, string>()),
    generation = useRef(0),
    pendingTools = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    current.current = turi;
  }, [turi]);
  const cleanup = useCallback(() => {
    generation.current++;
    const r = resources.current;
    clearTimeout(r.timer);
    r.abort?.abort();
    r.channel?.close();
    r.peer?.close();
    r.stream?.getTracks().forEach((track) => track.stop());
    if (r.audio) {
      r.audio.pause();
      r.audio.srcObject = null;
    }
    resources.current = {};
    liveIds.current.clear();
  }, []);
  const stop = useCallback(() => {
    cleanup();
    setPhase("off");
    setMuted(false);
  }, [cleanup]);
  useEffect(() => () => cleanup(), [cleanup]);
  const sendEvent = (event: unknown) => {
    if (resources.current.channel?.readyState === "open")
      resources.current.channel.send(JSON.stringify(event));
  };
  const transcript = (
    key: string,
    role: "user" | "assistant",
    text: string,
    replace = false,
  ) => {
    let id = liveIds.current.get(key);
    if (!id) {
      id = crypto.randomUUID();
      liveIds.current.set(key, id);
      const newId = id;
      current.current.setMessages((list) => [
        ...list,
        { id: newId, role, text },
      ]);
    } else
      current.current.setMessages((list) =>
        list.map((message) =>
          message.id === id
            ? { ...message, text: replace ? text : message.text + text }
            : message,
        ),
      );
  };
  const start = async () => {
    if (phase !== "off") return;
    if (!current.current.status?.realtime) {
      current.current.setError(
        "La voz está preparada. Falta agregar OPENAI_API_KEY para conectar con OpenAI Realtime.",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      current.current.setError(
        "Necesitás un navegador con micrófono y una conexión HTTPS para hablar con Turi.",
      );
      return;
    }
    current.current.setError("");
    setPhase("connecting");
    const attempt = ++generation.current;
    const abort = new AbortController();
    resources.current.abort = abort;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (attempt !== generation.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      resources.current.stream = stream;
      const peer = new RTCPeerConnection();
      resources.current.peer = peer;
      const audio = new Audio();
      audio.autoplay = true;
      resources.current.audio = audio;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio
          .play()
          .catch(() =>
            current.current.setError(
              "El navegador bloqueó el audio. Tocá el control de voz para reconectar.",
            ),
          );
      };
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      peer.onconnectionstatechange = () => {
        if (attempt !== generation.current) return;
        if (["failed", "disconnected"].includes(peer.connectionState)) {
          current.current.setError(
            "Se cortó la conexión de voz. Podés volver a llamar.",
          );
          stop();
        }
      };
      const channel = peer.createDataChannel("oai-events");
      resources.current.channel = channel;
      channel.onmessage = (event) => {
        if (attempt !== generation.current) return;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        const type = String(data.type),
          itemId = String(data.item_id || data.response_id || "voice");
        if (type === "input_audio_buffer.speech_started") setPhase("listening");
        if (
          type === "response.output_audio_transcript.delta" ||
          type === "response.output_text.delta"
        ) {
          setPhase("speaking");
          transcript(
            `assistant:${itemId}`,
            "assistant",
            String(data.delta || ""),
          );
        }
        if (type === "conversation.item.input_audio_transcription.completed")
          transcript(
            `user:${itemId}`,
            "user",
            String(data.transcript || ""),
            true,
          );
        if (type === "conversation.item.input_audio_transcription.failed")
          current.current.setError(
            "No pude transcribir ese turno. Probá hablar un poco más cerca del micrófono.",
          );
        if (type === "response.done") {
          const response = data.response as {
            status?: string;
            output?: {
              type: string;
              call_id: string;
              name: string;
              arguments: string;
            }[];
          };
          if (response?.status === "failed")
            current.current.setError(
              "OpenAI no pudo completar ese turno de voz. Revisá el saldo y los permisos del modelo.",
            );
          setPhase("listening");
          const calls =
            response?.output?.filter((item) => item.type === "function_call") ||
            [];
          if (!calls.length) return;
          pendingTools.current = pendingTools.current.then(async () => {
            for (const call of calls) {
              if (attempt !== generation.current) return;
              try {
                const result = await api<{
                  result: unknown;
                  events: Record<string, unknown>[];
                }>("tool", {
                  name: call.name,
                  args: JSON.parse(call.arguments),
                  state: current.current.state,
                });
                result.events.forEach((e) => {
                  if (e.type === "source")
                    current.current.setMessages((list) => [
                      ...list,
                      {
                        id: crypto.randomUUID(),
                        role: "assistant",
                        text: "Fuente consultada",
                        sources: [
                          { title: String(e.title), url: String(e.url) },
                        ],
                      },
                    ]);
                  else current.current.handleEvent(e);
                });
                sendEvent({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: call.call_id,
                    output: JSON.stringify(result.result),
                  },
                });
              } catch (e) {
                sendEvent({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: call.call_id,
                    output: JSON.stringify({ error: (e as Error).message }),
                  },
                });
              }
            }
            if (attempt === generation.current)
              sendEvent({ type: "response.create" });
          });
        }
        if (type === "error") {
          const detail = data.error as { code?: string };
          if (detail?.code !== "response_cancel_not_active")
            current.current.setError(
              "Hubo un error en la sesión de voz. Intentá reconectar.",
            );
        }
      };
      channel.onopen = () => {
        if (attempt !== generation.current) return;
        // Carry the actual chat into the voice session, without re-playing audio.
        current.current.messages
          .slice(-12)
          .filter((m) => m.text)
          .forEach((message) =>
            sendEvent({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: message.role,
                content: [
                  {
                    type: message.role === "user" ? "input_text" : "output_text",
                    text: message.text,
                  },
                ],
              },
            }),
          );
        if (current.current.location)
          sendEvent({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Comparto voluntariamente mi ubicación para esta llamada: ${current.current.location.latitude}, ${current.current.location.longitude}.`,
                },
              ],
            },
          });
        setPhase("listening");
      };
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/turi/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp, state: current.current.state }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "No pude iniciar la voz.");
      }
      if (attempt !== generation.current) return;
      await peer.setRemoteDescription({
        type: "answer",
        sdp: await response.text(),
      });
      resources.current.timer = setTimeout(() => {
        current.current.setError(
          "La llamada terminó a los 10 minutos. Podés iniciar otra cuando quieras.",
        );
        stop();
      }, 600000);
    } catch (error) {
      if (attempt === generation.current) {
        current.current.setError(
          (error as Error).name === "NotAllowedError"
            ? "El micrófono está bloqueado. Habilitá el permiso del navegador para hablar con Turi."
            : (error as Error).message,
        );
        stop();
      }
    }
  };
  useEffect(() => {
    if (phase === "off" || phase === "connecting") return;
    const controller = new AbortController();
    void fetch("/api/turi/realtime/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: turi.state }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (
          data?.instructions &&
          resources.current.channel?.readyState === "open"
        )
          resources.current.channel.send(
            JSON.stringify({
              type: "session.update",
              session: { type: "realtime", instructions: data.instructions },
            }),
          );
      })
      .catch(() => {});
    return () => controller.abort();
    // Only actual trip edits need a context update; speech phases should not cause API calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turi.state]);
  const toggleMute = () => {
    const value = !muted;
    resources.current.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !value;
    });
    setMuted(value);
  };
  const sendText = (text: string) => {
    if (resources.current.channel?.readyState !== "open") return false;
    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    transcript(`typed:${crypto.randomUUID()}`, "user", text);
    sendEvent({ type: "response.create" });
    return true;
  };
  return { phase, muted, start, stop, toggleMute, sendText };
}
export type VoiceController = ReturnType<typeof useRealtime>;
