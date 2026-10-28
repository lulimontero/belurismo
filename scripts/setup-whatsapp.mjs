import { writeFileSync } from "node:fs";
const names = ["EVOLUTION_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE", "WHATSAPP_WEBHOOK_SECRET", "APP_URL"];
for (const name of names)
  if (!process.env[name])
    throw new Error(`Falta ${name}. Cargá el entorno antes de ejecutar este script.`);
const base = process.env.EVOLUTION_URL.replace(/\/$/, ""),
  instance = process.env.EVOLUTION_INSTANCE,
  headers = { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY };
const call = async (method, path, body) => {
  const response = await fetch(`${base}/${path}`, { method, headers, body: body && JSON.stringify(body) });
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
};
const created = await call("POST", "instance/create", { instanceName: instance, integration: "WHATSAPP-BAILEYS", qrcode: true });
if (!created.ok && created.status !== 403)
  throw new Error(`No se pudo crear la instancia (${created.status}): ${JSON.stringify(created.data)}`);
const url = new URL("/api/turi/whatsapp/webhook", process.env.APP_URL);
if (url.protocol !== "https:") throw new Error("El webhook necesita una URL pública HTTPS.");
const webhook = await call("POST", `webhook/set/${instance}`, {
  webhook: {
    enabled: true,
    url: url.toString(),
    headers: { "x-turi-secret": process.env.WHATSAPP_WEBHOOK_SECRET },
    byEvents: false,
    base64: true,
    events: ["MESSAGES_UPSERT"],
  },
});
if (!webhook.ok) throw new Error(`No se pudo configurar el webhook (${webhook.status}): ${JSON.stringify(webhook.data)}`);
console.log(`Webhook configurado: ${url}`);
const state = await call("GET", `instance/connectionState/${instance}`);
if (state.data?.instance?.state === "open") {
  console.log("WhatsApp ya está conectado. No hace falta escanear.");
} else {
  const connect = await call("GET", `instance/connect/${instance}`),
    qr = connect.data?.base64?.split(",")[1];
  if (!qr) throw new Error(`No llegó el QR: ${JSON.stringify(connect.data)}`);
  const out = process.argv[2] || "whatsapp-qr.png";
  writeFileSync(out, Buffer.from(qr, "base64"));
  console.log(`QR guardado en ${out}. Escanealo desde WhatsApp > Dispositivos vinculados.`);
}
