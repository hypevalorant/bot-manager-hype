"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildManagedRuntimeWrapperSource = buildManagedRuntimeWrapperSource;
function buildManagedRuntimeWrapperSource() {
    return String.raw `const { spawn } = require("node:child_process");
const path = require("node:path");

const managerApiUrl = requireEnv("MANAGER_API_URL");
const instanceId = requireEnv("INSTANCE_ID");
const instanceSecret = requireEnv("INSTANCE_SECRET");
const heartbeatIntervalMs = Math.max(15000, Number(process.env.HEARTBEAT_INTERVAL_MS || 60000));

let childProcess = null;
let shutdownRequested = false;
const startedAt = Date.now();

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(name + " é obrigatória para o runtime gerenciado.");
  }
  return value;
}

async function postJson(pathname, payload) {
  const response = await fetch(managerApiUrl + pathname, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Manager respondeu " + response.status + " para " + pathname + ".");
  }

  return response.json();
}

function resolveEntrypoint() {
  const explicit = String(process.env.BOT_RUNTIME_ENTRYPOINT || "").trim();
  if (explicit) {
    return path.resolve(process.cwd(), explicit);
  }

  try {
    const pkg = require(path.join(process.cwd(), "package.json"));
    if (typeof pkg.main === "string" && pkg.main.trim()) {
      return path.resolve(process.cwd(), pkg.main.trim());
    }
  } catch {}

  return path.resolve(process.cwd(), "index.js");
}

function syncBootstrapEnv(bootstrap) {
  process.env.INSTANCE_STATUS = String(bootstrap?.instance?.status || "");
  process.env.INSTANCE_EXPIRES_AT = String(bootstrap?.instance?.expiresAt || "");
  process.env.TENANT_CUSTOMER_ID = String(bootstrap?.tenant?.customerId || process.env.TENANT_CUSTOMER_ID || "");
  process.env.TENANT_SUBSCRIPTION_ID = String(bootstrap?.tenant?.subscriptionId || process.env.TENANT_SUBSCRIPTION_ID || "");
  process.env.TENANT_CUSTOMER_DISCORD_USER_ID = String(bootstrap?.tenant?.customerDiscordUserId || process.env.TENANT_CUSTOMER_DISCORD_USER_ID || "");
  process.env.TENANT_CUSTOMER_DISCORD_USERNAME = String(bootstrap?.tenant?.customerDiscordUsername || process.env.TENANT_CUSTOMER_DISCORD_USERNAME || "");
  process.env.TENANT_COMMERCIAL_OWNER_DISCORD_USER_ID = String(bootstrap?.tenant?.commercialOwnerDiscordUserId || process.env.TENANT_COMMERCIAL_OWNER_DISCORD_USER_ID || "");
  process.env.TENANT_PURCHASER_DISCORD_USER_ID = String(bootstrap?.tenant?.purchaserDiscordUserId || process.env.TENANT_PURCHASER_DISCORD_USER_ID || "");
  process.env.TENANT_PURCHASER_DISCORD_USERNAME = String(bootstrap?.tenant?.purchaserDiscordUsername || process.env.TENANT_PURCHASER_DISCORD_USERNAME || "");
  process.env.TENANT_BOT_OWNER_DISCORD_USER_ID = String(bootstrap?.tenant?.botOwnerDiscordUserId || process.env.TENANT_BOT_OWNER_DISCORD_USER_ID || "");
  process.env.TENANT_ASSIGNED_GUILD_ID = String(bootstrap?.tenant?.assignedGuildId || process.env.TENANT_ASSIGNED_GUILD_ID || "");
  process.env.TENANT_ASSIGNED_GUILD_URL = String(bootstrap?.tenant?.assignedGuildUrl || process.env.TENANT_ASSIGNED_GUILD_URL || "");
  process.env.TENANT_DEFAULT_GUILD_ID = String(bootstrap?.tenant?.defaultGuildId || process.env.TENANT_DEFAULT_GUILD_ID || "");
  process.env.TENANT_DEFAULT_GUILD_URL = String(bootstrap?.tenant?.defaultGuildUrl || process.env.TENANT_DEFAULT_GUILD_URL || "");
  process.env.TENANT_INSTALL_URL = String(bootstrap?.tenant?.installUrl || process.env.TENANT_INSTALL_URL || "");
  process.env.TENANT_PRODUCT_SLUG = String(bootstrap?.tenant?.productSlug || process.env.TENANT_PRODUCT_SLUG || "");
  process.env.TENANT_PRODUCT_NAME = String(bootstrap?.tenant?.productName || process.env.TENANT_PRODUCT_NAME || "");
  process.env.TENANT_PLAN_NAME = String(bootstrap?.tenant?.planName || process.env.TENANT_PLAN_NAME || "");
  process.env.TENANT_SALE_SEQUENCE_LABEL = String(bootstrap?.instance?.saleSequenceLabel || process.env.TENANT_SALE_SEQUENCE_LABEL || "");
  process.env.TENANT_SALE_SEQUENCE_NUMBER = String(bootstrap?.instance?.saleSequenceNumber || process.env.TENANT_SALE_SEQUENCE_NUMBER || "");
  process.env.TENANT_SOLD_AT = String(bootstrap?.instance?.soldAt || process.env.TENANT_SOLD_AT || "");
  process.env.SQUARECLOUD_DESCRIPTION = String(bootstrap?.instance?.managedDescription || process.env.SQUARECLOUD_DESCRIPTION || "");
}

function buildRuntimeSummary(payload) {
  return {
    saleSequenceLabel: String(payload?.instance?.saleSequenceLabel || process.env.TENANT_SALE_SEQUENCE_LABEL || ""),
    soldAt: String(payload?.instance?.soldAt || process.env.TENANT_SOLD_AT || ""),
    managedDescription: String(payload?.instance?.managedDescription || process.env.SQUARECLOUD_DESCRIPTION || ""),
    purchaserDiscordUserId: String(payload?.tenant?.purchaserDiscordUserId || process.env.TENANT_PURCHASER_DISCORD_USER_ID || ""),
    purchaserDiscordUsername: String(payload?.tenant?.purchaserDiscordUsername || process.env.TENANT_PURCHASER_DISCORD_USERNAME || ""),
    customerId: String(payload?.tenant?.customerId || process.env.TENANT_CUSTOMER_ID || ""),
    subscriptionId: String(payload?.tenant?.subscriptionId || process.env.TENANT_SUBSCRIPTION_ID || ""),
    customerDiscordUserId: String(payload?.tenant?.customerDiscordUserId || process.env.TENANT_CUSTOMER_DISCORD_USER_ID || ""),
    customerDiscordUsername: String(payload?.tenant?.customerDiscordUsername || process.env.TENANT_CUSTOMER_DISCORD_USERNAME || ""),
    commercialOwnerDiscordUserId: String(payload?.tenant?.commercialOwnerDiscordUserId || process.env.TENANT_COMMERCIAL_OWNER_DISCORD_USER_ID || ""),
    botOwnerDiscordUserId: String(payload?.tenant?.botOwnerDiscordUserId || process.env.TENANT_BOT_OWNER_DISCORD_USER_ID || ""),
    productSlug: String(payload?.tenant?.productSlug || process.env.TENANT_PRODUCT_SLUG || ""),
    productName: String(payload?.tenant?.productName || process.env.TENANT_PRODUCT_NAME || ""),
    planName: String(payload?.tenant?.planName || process.env.TENANT_PLAN_NAME || ""),
    assignedGuildId: String(payload?.tenant?.assignedGuildId || process.env.TENANT_ASSIGNED_GUILD_ID || ""),
    assignedGuildUrl: String(payload?.tenant?.assignedGuildUrl || process.env.TENANT_ASSIGNED_GUILD_URL || ""),
    defaultGuildId: String(payload?.tenant?.defaultGuildId || process.env.TENANT_DEFAULT_GUILD_ID || ""),
    defaultGuildUrl: String(payload?.tenant?.defaultGuildUrl || process.env.TENANT_DEFAULT_GUILD_URL || ""),
    installUrl: String(payload?.tenant?.installUrl || process.env.TENANT_INSTALL_URL || ""),
    discordApplicationId: String(process.env.DISCORD_APPLICATION_ID || process.env.APPLICATION_ID || ""),
    discordClientId: String(process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || ""),
    squareCloudAppId: String(process.env.SQUARECLOUD_APP_ID || process.env.SQUARECLOUD_APPLICATION_ID || ""),
    managerInstanceId: String(payload?.instance?.id || process.env.INSTANCE_ID || ""),
  };
}

function logRuntimeSummary(label, payload) {
  console.log("[runtime-gerenciado] " + label + ":", JSON.stringify(buildRuntimeSummary(payload), null, 2));
}

function spawnBotProcess() {
  const entrypoint = resolveEntrypoint();
  console.log("[runtime-gerenciado] iniciando a source em", entrypoint);

  childProcess = spawn(process.execPath, [entrypoint], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  childProcess.on("exit", (code, signal) => {
    if (shutdownRequested) {
      process.exit(code ?? 0);
      return;
    }

    console.error(
      "[runtime-gerenciado] processo da source encerrou inesperadamente",
      JSON.stringify({ code, signal }),
    );
    process.exit(code ?? 1);
  });
}

function requestShutdown(reason) {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  console.warn("[runtime-gerenciado] encerrando source:", reason);

  if (childProcess && !childProcess.killed) {
    childProcess.kill("SIGTERM");
  }

  setTimeout(() => {
    process.exit(0);
  }, 10000).unref();
}

async function sendHeartbeat() {
  const previousAssignedGuildId = String(process.env.TENANT_ASSIGNED_GUILD_ID || "");
  const heartbeat = await postJson("/internal/instances/heartbeat", {
    instanceId,
    instanceSecret,
    metrics: {
      wrapperPid: process.pid,
      childPid: childProcess?.pid ?? null,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      sourceSlug: process.env.SOURCE_SLUG || process.env.INSTANCE_SOURCE_SLUG || "",
      sourceVersion: process.env.SOURCE_VERSION || "",
    },
  });
  syncBootstrapEnv(heartbeat);
  const currentAssignedGuildId = String(process.env.TENANT_ASSIGNED_GUILD_ID || "");
  if (currentAssignedGuildId && currentAssignedGuildId !== previousAssignedGuildId) {
    logRuntimeSummary("servidor vinculado atualizado", heartbeat);
  }

  if (String(heartbeat?.desiredState || "") !== "running") {
    requestShutdown("manager solicitou bloqueio/suspensao");
  }
}

async function main() {
  const bootstrap = await postJson("/internal/instances/bootstrap", {
    instanceId,
    instanceSecret,
  });

  syncBootstrapEnv(bootstrap);
  logRuntimeSummary("contexto da aplicação vendida", bootstrap);
  spawnBotProcess();
  await sendHeartbeat();

  const interval = setInterval(() => {
    sendHeartbeat().catch((error) => {
      console.error("[runtime-gerenciado] heartbeat falhou:", error);
    });
  }, heartbeatIntervalMs);
  interval.unref();
}

process.on("SIGTERM", () => requestShutdown("SIGTERM"));
process.on("SIGINT", () => requestShutdown("SIGINT"));

main().catch((error) => {
  console.error("[runtime-gerenciado] bootstrap falhou:", error);
  process.exit(1);
});
`;
}
