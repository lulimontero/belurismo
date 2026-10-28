import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { z } from "zod";
import { AppError, seal, unseal } from "./security";
import { loadAccount, redis } from "./storage";

const allowed = (key: string) =>
  (process.env[key] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
export function beloPermission(name: string): "read" | "prepare" | null {
  if (allowed("BELO_READ_TOOLS").includes(name)) return "read";
  if (allowed("BELO_PREPARE_TOOLS").includes(name)) return "prepare";
  return null;
}
async function withBelo<T>(id: string, run: (client: Client) => Promise<T>) {
  const endpoint = process.env.BELO_MCP_URL,
    account = await loadAccount(id);
  if (!endpoint)
    throw new AppError("El MCP de Belo está pendiente de configuración.", 503);
  if (!account.beloToken)
    throw new AppError(
      "Conectá tu propia cuenta de Belo. Nunca se usa la cuenta de otro viajero.",
      401,
    );
  const url = new URL(endpoint);
  if (url.protocol !== "https:")
    throw new AppError("El MCP de Belo debe usar HTTPS.", 503);
  const client = new Client({ name: "turi-belo", version: "1.0.0" });
  const options = {
    requestInit: { headers: { Authorization: `Bearer ${account.beloToken}` } },
  };
  const transport =
    process.env.BELO_MCP_TRANSPORT === "sse"
      ? new SSEClientTransport(url, options)
      : new StreamableHTTPClientTransport(url, options);
  try {
    await client.connect(transport);
    return await run(client);
  } finally {
    await client.close().catch(() => {});
  }
}
export async function beloTools(id: string) {
  return withBelo(id, async (client) => {
    const { tools } = await client.listTools();
    return tools
      .filter((t) => beloPermission(t.name))
      .map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        permission: beloPermission(t.name),
      }));
  });
}
export async function callBelo(
  id: string,
  name: string,
  args: Record<string, unknown>,
  approvedToken?: string,
) {
  const permission = beloPermission(name);
  if (!permission)
    throw new AppError(
      "Esta herramienta de Belo todavía no fue validada ni habilitada.",
      403,
    );
  if (permission === "prepare" && !approvedToken)
    return {
      requiresReview: true,
      label: `Revisar propuesta de Belo: ${name}`,
      name,
      args,
      token: seal({
        id,
        name,
        args,
        expires: Date.now() + 600000,
        nonce: crypto.randomUUID(),
      }),
    };
  if (permission === "prepare") {
    const proposal = unseal<{
      id: string;
      name: string;
      args: Record<string, unknown>;
      expires: number;
      nonce: string;
    }>(approvedToken!);
    if (
      proposal.id !== id ||
      proposal.name !== name ||
      JSON.stringify(proposal.args) !== JSON.stringify(args) ||
      proposal.expires < Date.now()
    )
      throw new AppError(
        "La propuesta venció o cambió. Pedile una nueva a Turi.",
        403,
      );
    if (
      !(await redis(
        "SET",
        `turi:approval:${proposal.nonce}`,
        "used",
        "NX",
        "EX",
        900,
      ))
    )
      throw new AppError(
        "Esta propuesta ya se procesó. Revisá la app de Belo antes de reintentar.",
        409,
      );
  }
  return withBelo(id, async (client) => {
    const discovered = await client.listTools();
    if (!discovered.tools.some((tool) => tool.name === name))
      throw new AppError(
        "Belo no ofrece esta herramienta en la cuenta conectada.",
        404,
      );
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: 25000,
    });
    return {
      provider: "Belo MCP",
      mode: permission,
      result,
      notice:
        permission === "prepare"
          ? "Sólo se solicitó una propuesta. Cada movimiento se aprueba en Belo; no afirmar pago confirmado sin evidencia."
          : undefined,
    };
  });
}
export const beloCallSchema = z.object({
  name: z.string().min(1).max(160),
  args: z.record(z.string(), z.unknown()),
  token: z.string().optional(),
});
