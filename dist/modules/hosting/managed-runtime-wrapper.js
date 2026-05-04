"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildManagedRuntimeWrapperSource = buildManagedRuntimeWrapperSource;
function buildManagedRuntimeWrapperSource() {
    return String.raw `const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

loadPackagedRuntimeEnv();

const managerApiUrl = requireEnv("MANAGER_API_URL");
const instanceId = requireEnv("INSTANCE_ID");
const instanceSecret = requireEnv("INSTANCE_SECRET");
const heartbeatIntervalMs = Math.max(15000, Number(process.env.HEARTBEAT_INTERVAL_MS || 60000));

let childProcess = null;
let shutdownRequested = false;
const startedAt = Date.now();

function formatValue(value, fallback = "nao informado") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function formatDateTime(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    return normalized;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: process.env.TZ || "America/Sao_Paulo",
  }).format(date);
}

function formatStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const labels = {
    pending: "Pendente",
    active: "Ativa",
    provisioning: "Provisionando",
    starting: "Inicializando",
    running: "Em execucao",
    suspended: "Suspensa",
    stopped: "Desligada",
    failed: "Falhou",
    deleted: "Deletada",
    expired: "Expirada",
  };
  return labels[normalized] || formatValue(value);
}

function formatDiscordIdentity(username, userId) {
  const normalizedUsername = String(username || "").trim();
  const normalizedUserId = String(userId || "").trim();
  if (normalizedUsername && normalizedUserId) {
    return normalizedUsername + " (" + normalizedUserId + ")";
  }
  return normalizedUsername || normalizedUserId || "";
}

function formatUrlOrigin(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  try {
    return new URL(normalized).origin;
  } catch {
    return normalized;
  }
}

function formatError(error) {
  if (!error) {
    return "erro desconhecido";
  }
  return String(error?.stack || error?.message || error).trim() || "erro desconhecido";
}

function printSection(title, lines = []) {
  console.log("");
  console.log("[runtime-gerenciado] ============================================================");
  console.log("[runtime-gerenciado] " + String(title || "Evento do runtime").toUpperCase());
  console.log("[runtime-gerenciado] ============================================================");
  for (const line of lines) {
    if (line === "") {
      console.log("[runtime-gerenciado]");
      continue;
    }
    if (!line) {
      continue;
    }
    console.log("[runtime-gerenciado] " + line);
  }
  console.log("[runtime-gerenciado] ------------------------------------------------------------");
}

function groupLines(title, lines = []) {
  const visibleLines = lines.filter(Boolean);
  if (visibleLines.length === 0) {
    return [];
  }
  return ["", title].concat(visibleLines.map((line) => "  - " + line));
}

function loadPackagedRuntimeEnv() {
  const envPath = path.join(process.cwd(), "runtime-env.json");
  if (!fs.existsSync(envPath)) {
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(envPath, "utf8"));
    const env = parsed && typeof parsed.env === "object" ? parsed.env : parsed;
    if (!env || typeof env !== "object" || Array.isArray(env)) {
      return;
    }

    let applied = 0;
    for (const [key, value] of Object.entries(env)) {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey || value === undefined || value === null) {
        continue;
      }
      if (String(process.env[normalizedKey] || "").trim()) {
        continue;
      }
      process.env[normalizedKey] = String(value);
      applied += 1;
    }

    if (applied > 0) {
      console.log("[runtime-gerenciado] Ambiente inicial carregado do pacote vendido.");
    }
  } catch (error) {
    console.warn("[runtime-gerenciado] Nao consegui carregar runtime-env.json:", error);
  }
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(name + " e obrigatoria para o runtime gerenciado.");
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

function collectDeclaredDependencies() {
  try {
    const pkg = require(path.join(process.cwd(), "package.json"));
    return Object.keys(pkg?.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {});
  } catch {
    return [];
  }
}

function findMissingDependencies() {
  return collectDeclaredDependencies().filter((dependencyName) => {
    try {
      require.resolve(dependencyName, { paths: [process.cwd()] });
      return false;
    } catch {
      return true;
    }
  });
}

function ensureRuntimeDependencies() {
  const missingDependencies = findMissingDependencies();
  if (missingDependencies.length === 0) {
    return;
  }

  printSection("Instalando dependencias da aplicacao vendida", [
    "Dependencias ausentes: " + missingDependencies.join(", "),
    "Comando: npm install --omit=dev",
  ]);

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const install = spawnSync(npmCommand, ["install", "--omit=dev"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (install.error) {
    throw install.error;
  }

  if (install.status !== 0) {
    throw new Error("npm install --omit=dev falhou com codigo " + formatValue(install.status, "desconhecido") + ".");
  }

  const stillMissing = findMissingDependencies();
  if (stillMissing.length > 0) {
    throw new Error("Dependencias ainda ausentes apos npm install: " + stillMissing.join(", "));
  }
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

function buildLocalBootstrapFromEnv(reason) {
  return {
    ok: true,
    offlineBootstrap: true,
    offlineBootstrapReason: String(reason?.message || reason || "manager indisponivel"),
    instance: {
      id: process.env.INSTANCE_ID || "",
      status: process.env.INSTANCE_STATUS || "provisioning",
      expiresAt: process.env.INSTANCE_EXPIRES_AT || "",
      hostingProvider: "squarecloud",
      hostingAccountId: process.env.SQUARECLOUD_ACCOUNT_ID || "",
      hostingAppId: process.env.SQUARECLOUD_APP_ID || process.env.SQUARECLOUD_APPLICATION_ID || "",
      saleSequenceNumber: process.env.TENANT_SALE_SEQUENCE_NUMBER || "",
      saleSequenceLabel: process.env.TENANT_SALE_SEQUENCE_LABEL || "",
      soldAt: process.env.TENANT_SOLD_AT || "",
      managedDescription: process.env.SQUARECLOUD_DESCRIPTION || "",
    },
    tenant: {
      customerId: process.env.TENANT_CUSTOMER_ID || "",
      subscriptionId: process.env.TENANT_SUBSCRIPTION_ID || "",
      customerDiscordUserId: process.env.TENANT_CUSTOMER_DISCORD_USER_ID || process.env.TENANT_BOT_OWNER_DISCORD_USER_ID || "",
      customerDiscordUsername: process.env.TENANT_CUSTOMER_DISCORD_USERNAME || "",
      commercialOwnerDiscordUserId: process.env.TENANT_COMMERCIAL_OWNER_DISCORD_USER_ID || "",
      purchaserDiscordUserId: process.env.TENANT_PURCHASER_DISCORD_USER_ID || "",
      purchaserDiscordUsername: process.env.TENANT_PURCHASER_DISCORD_USERNAME || "",
      botOwnerDiscordUserId: process.env.TENANT_BOT_OWNER_DISCORD_USER_ID || process.env.TENANT_CUSTOMER_DISCORD_USER_ID || "",
      assignedGuildId: process.env.TENANT_ASSIGNED_GUILD_ID || "",
      assignedGuildUrl: process.env.TENANT_ASSIGNED_GUILD_URL || "",
      defaultGuildId: process.env.TENANT_DEFAULT_GUILD_ID || process.env.DEFAULT_GUILD_ID || process.env.GUILD_ID || "",
      defaultGuildUrl: process.env.TENANT_DEFAULT_GUILD_URL || "",
      installUrl: process.env.TENANT_INSTALL_URL || "",
      productSlug: process.env.TENANT_PRODUCT_SLUG || process.env.SOURCE_SLUG || process.env.INSTANCE_SOURCE_SLUG || "",
      productName: process.env.TENANT_PRODUCT_NAME || process.env.SOURCE_SLUG || "",
      planName: process.env.TENANT_PLAN_NAME || "",
    },
    config: {
      discordAppName: process.env.DISCORD_APP_NAME || "",
      discordClientId: process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || "",
      discordApplicationId: process.env.DISCORD_APPLICATION_ID || process.env.APPLICATION_ID || "",
    },
  };
}

function buildRuntimeSummary(payload) {
  return {
    applicationName: String(process.env.DISCORD_APP_NAME || payload?.config?.discordAppName || ""),
    instanceStatus: String(payload?.instance?.status || process.env.INSTANCE_STATUS || ""),
    expiresAt: String(payload?.instance?.expiresAt || process.env.INSTANCE_EXPIRES_AT || ""),
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
    sourceSlug: String(process.env.SOURCE_SLUG || process.env.INSTANCE_SOURCE_SLUG || payload?.tenant?.productSlug || ""),
    sourceVersion: String(process.env.SOURCE_VERSION || ""),
    entrypoint: resolveEntrypoint(),
    managerApiOrigin: formatUrlOrigin(managerApiUrl),
  };
}

function logRuntimeSummary(label, payload) {
  const summary = buildRuntimeSummary(payload);
  const productPlan = [
    formatValue(summary.productName || summary.productSlug),
    formatValue(summary.planName),
  ].filter((value) => value !== "nao informado").join(" / ");
  printSection(label, [
    ...groupLines("Identificacao", [
      "Aplicacao vendida: " + formatValue(summary.applicationName),
      "Produto e plano: " + formatValue(productPlan),
      "Descricao na SquareCloud: " + formatValue(summary.managedDescription),
      "Status no manager: " + formatStatus(summary.instanceStatus),
      "Expira em: " + formatValue(formatDateTime(summary.expiresAt) || summary.expiresAt),
    ]),
    ...groupLines("Venda", [
      "Sequencia da venda: " + formatValue(summary.saleSequenceLabel),
      "Venda registrada em: " + formatValue(formatDateTime(summary.soldAt) || summary.soldAt),
      "Assinatura: " + formatValue(summary.subscriptionId),
      "Cliente interno: " + formatValue(summary.customerId),
    ]),
    ...groupLines("Discord", [
      "Comprador: " + formatValue(formatDiscordIdentity(summary.purchaserDiscordUsername, summary.purchaserDiscordUserId)),
      "Cliente: " + formatValue(formatDiscordIdentity(summary.customerDiscordUsername, summary.customerDiscordUserId)),
      "Dono comercial: " + formatValue(summary.commercialOwnerDiscordUserId),
      "Dono operacional do bot: " + formatValue(summary.botOwnerDiscordUserId),
      "Application ID: " + formatValue(summary.discordApplicationId),
      "Client ID: " + formatValue(summary.discordClientId),
    ]),
    ...groupLines("Servidor", [
      "Servidor vinculado: " + formatValue(summary.assignedGuildId),
      "URL do servidor vinculado: " + formatValue(summary.assignedGuildUrl),
      "Servidor padrao: " + formatValue(summary.defaultGuildId),
      "URL do servidor padrao: " + formatValue(summary.defaultGuildUrl),
    ]),
    ...groupLines("Hospedagem e execucao", [
      "App ID na SquareCloud: " + formatValue(summary.squareCloudAppId),
      "ID interno da instancia: " + formatValue(summary.managerInstanceId),
      "Fonte da aplicacao: " + formatValue(summary.sourceSlug),
      "Versao da fonte: " + formatValue(summary.sourceVersion),
      "Arquivo inicial: " + formatValue(summary.entrypoint),
      "API do manager: " + formatValue(summary.managerApiOrigin),
      "PID do processo gerenciador: " + process.pid,
      childProcess?.pid ? "PID da aplicacao: " + childProcess.pid : null,
    ]),
    ...groupLines("Links uteis", [
      "Adicionar bot ao servidor: " + formatValue(summary.installUrl),
    ]),
  ]);
}

function spawnBotProcess() {
  const entrypoint = resolveEntrypoint();
  ensureRuntimeDependencies();
  printSection("Iniciando aplicacao vendida", [
    "Arquivo inicial da aplicacao: " + formatValue(entrypoint),
    "PID do processo gerenciador: " + process.pid,
  ]);

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

    printSection("Aplicacao vendida encerrada inesperadamente", [
      "Codigo de saida: " + formatValue(code, "sem codigo"),
      "Sinal recebido: " + formatValue(signal, "sem sinal"),
      "A SquareCloud pode exibir o app como exited quando a aplicacao fecha logo apos iniciar.",
    ]);
    process.exit(code ?? 1);
  });
}

function requestShutdown(reason) {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  printSection("Encerrando aplicacao vendida", [
    "Motivo: " + formatValue(reason),
    "Status atual no manager: " + formatValue(process.env.INSTANCE_STATUS),
    "Expira em: " + formatValue(process.env.INSTANCE_EXPIRES_AT),
    "App ID da SquareCloud: " + formatValue(process.env.SQUARECLOUD_APP_ID || process.env.SQUARECLOUD_APPLICATION_ID),
  ]);

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
    logRuntimeSummary("Servidor vinculado atualizado pelo manager", heartbeat);
  }

  if (String(heartbeat?.desiredState || "") !== "running") {
    requestShutdown("o manager solicitou bloqueio ou suspensao da aplicacao");
  }
}

async function main() {
  let bootstrap;
  try {
    bootstrap = await postJson("/internal/instances/bootstrap", {
      instanceId,
      instanceSecret,
    });
  } catch (error) {
    bootstrap = buildLocalBootstrapFromEnv(error);
    printSection("Manager indisponivel; usando bootstrap local", [
      formatError(error),
      "A aplicacao vendida vai iniciar com as variaveis gravadas no deploy.",
    ]);
  }

  syncBootstrapEnv(bootstrap);
  logRuntimeSummary("Contexto recebido da aplicacao vendida", bootstrap);
  spawnBotProcess();
  await sendHeartbeat().catch((error) => {
    printSection("Heartbeat inicial falhou; mantendo aplicacao ligada", [
      formatError(error),
    ]);
  });

  const interval = setInterval(() => {
    sendHeartbeat().catch((error) => {
      printSection("Falha ao sincronizar status com o manager", [
        formatError(error),
      ]);
    });
  }, heartbeatIntervalMs);
  interval.unref();
}

process.on("SIGTERM", () => requestShutdown("SIGTERM"));
process.on("SIGINT", () => requestShutdown("SIGINT"));

main().catch((error) => {
  printSection("Falha ao iniciar contexto da aplicacao vendida", [
    formatError(error),
  ]);
  process.exit(1);
});
`;
}
