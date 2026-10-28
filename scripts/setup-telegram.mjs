const names = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "APP_URL"];
for (const name of names)
  if (!process.env[name])
    throw new Error(
      `Falta ${name}. Cargá el entorno antes de ejecutar este script.`,
    );
const url = new URL("/api/turi/telegram/webhook", process.env.APP_URL);
if (url.protocol !== "https:")
  throw new Error("Telegram requiere una URL pública HTTPS.");
const response = await fetch(
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url.toString(),
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message"],
    }),
  },
);
const data = await response.json();
if (!data.ok)
  throw new Error(
    `No se pudo configurar el webhook (${response.status}). Revisá el bot y el secreto.`,
  );
console.log(
  `Webhook configurado: ${url.toString()}. No se envió ningún mensaje a usuarios.`,
);
