"use strict";

const fs = require("node:fs");
const os = require("node:os");
const { SquareCloudClient } = require("../dist/modules/hosting/squarecloud.client.js");
const { SquareCloudProvisioningService } = require("../dist/modules/hosting/squarecloud.provisioning.service.js");
const { SourceArtifactService } = require("../dist/modules/hosting/source-artifact.service.js");

function readDotEnv(filePath = ".env") {
  if (!fs.existsSync(filePath)) {
    return;
  }
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match || process.env[match[1]]) {
      continue;
    }
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/gu, "");
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(milliseconds) || 0)));
}

function requiredEnv(name, fallback = "") {
  const rawValue = String(process.env[name] ?? "").trim();
  const value = rawValue || String(fallback ?? "").trim();
  if (!value) {
    throw new Error(`${name} nao configurado.`);
  }
  return value;
}

function limitPayload(value, maxLength = 8000) {
  const normalized = JSON.stringify(value ?? null);
  if (normalized.length <= maxLength) {
    return value ?? null;
  }
  return {
    truncated: true,
    preview: normalized.slice(0, maxLength),
  };
}

function isInaccessibleSquareCloudAppError(error) {
  const normalized = [
    error?.code,
    error?.status,
    error?.message,
    error?.body?.code,
    error?.body?.message,
    error?.body?.error,
  ]
    .map((value) => String(value ?? "").trim().toUpperCase())
    .filter(Boolean)
    .join(" ");
  return normalized.includes("ACCESS_DENIED") ||
    normalized.includes("APP_NOT_FOUND") ||
    normalized.includes("INVALID USER DATA") ||
    normalized.includes("RESPONDEU 401") ||
    normalized.includes("RESPONDEU 404");
}

class ProvisioningWorker {
  constructor() {
    readDotEnv();
    this.managerApiUrl = requiredEnv("MANAGER_API_URL", process.env.APP_BASE_URL).replace(/\/+$/u, "");
    this.workerToken = requiredEnv("PROVISIONING_WORKER_TOKEN", process.env.EXTERNAL_PROVISIONING_TOKEN || process.env.ADMIN_API_TOKEN);
    this.workerId = String(process.env.PROVISIONING_WORKER_ID ?? `${os.hostname()}-${process.pid}`).trim();
    this.pollMs = Math.max(3000, Number(process.env.PROVISIONING_WORKER_POLL_MS ?? 10_000) || 10_000);
    this.once = String(process.env.PROVISIONING_WORKER_ONCE ?? "").trim().toLowerCase() === "true" || process.argv.includes("--once");
    this.maxTicks = this.once ? 1 : Math.max(0, Number(process.env.PROVISIONING_WORKER_MAX_TICKS ?? 0) || 0);
    this.squareCloudClient = new SquareCloudClient({
      apiKey: requiredEnv("SQUARECLOUD_UPLOAD_API_KEY", process.env.SQUARECLOUD_API_KEY),
      accountId: process.env.SQUARECLOUD_ACCOUNT_ID,
      baseUrl: process.env.SQUARECLOUD_API_BASE_URL,
    });
  }

  async managerRequest(pathname, options = {}) {
    const response = await fetch(`${this.managerApiUrl}${pathname}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.workerToken}`,
        "Content-Type": "application/json",
        "X-Worker-Id": this.workerId,
        ...(options.headers ?? {}),
      },
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 1000) };
    }
    if (!response.ok) {
      throw new Error(`Manager respondeu ${response.status} em ${pathname}: ${JSON.stringify(body).slice(0, 1200)}`);
    }
    return body;
  }

  async claimJob() {
    return this.managerRequest("/internal/provisioning/jobs/claim", {
      method: "POST",
      body: JSON.stringify({
        workerId: this.workerId,
        lockTtlSeconds: Number(process.env.PROVISIONING_WORKER_LOCK_TTL_SECONDS ?? 900) || 900,
      }),
    });
  }

  buildSourceArtifactService(runtimeSourceConfig) {
    return new SourceArtifactService(process.env.SOURCE_ARTIFACTS_DIR ?? "runtime-artifacts", {
      getRuntimeSourceConfig: () => runtimeSourceConfig ?? null,
    });
  }

  async processJob(payload) {
    const { job, instance, discordApp, runtimeSourceConfig, managerApiUrl } = payload;
    console.log(`[worker] provisionando job=${job.id} instance=${instance.id} source=${instance.sourceSlug}`);
    const sourceArtifactService = this.buildSourceArtifactService(runtimeSourceConfig);
    const provisioningService = new SquareCloudProvisioningService(this.squareCloudClient, sourceArtifactService, {
      managerApiUrl: managerApiUrl || this.managerApiUrl,
      getManagerApiUrl: () => managerApiUrl || this.managerApiUrl,
    });
    const result = instance.hostingAppId && !String(instance.hostingAppId).startsWith("pending-")
      ? await provisioningService.updateInstance(instance, discordApp)
      : await provisioningService.provisionInstance(instance, discordApp);
    await this.managerRequest(`/internal/provisioning/jobs/${encodeURIComponent(job.id)}/complete`, {
      method: "POST",
      body: JSON.stringify({
        appId: result.appId,
        upload: limitPayload(result.upload, 3000),
        boot: limitPayload(result.boot, 5000),
        instanceStatus: "provisioning",
      }),
    });
    console.log(`[worker] concluido job=${job.id} app=${result.appId}`);
  }

  async failJob(job, error) {
    const message = String(error?.message ?? error ?? "Falha desconhecida.").slice(0, 1500);
    console.error(`[worker] falha job=${job?.id ?? "unknown"} ${message}`);
    if (!job?.id) {
      return;
    }
    const partialAppId = String(error?.squareCloudAppId ?? "").trim();
    if (partialAppId && !isInaccessibleSquareCloudAppError(error)) {
      console.error(`[worker] app criada parcialmente job=${job.id} app=${partialAppId}`);
      await this.managerRequest(`/internal/provisioning/jobs/${encodeURIComponent(job.id)}/complete`, {
        method: "POST",
        body: JSON.stringify({
          appId: partialAppId,
          boot: { ok: false, error: message },
          instanceStatus: "provisioning",
        }),
      }).catch((completeError) => {
        console.error(`[worker] nao consegui salvar app parcial no manager: ${completeError?.message ?? completeError}`);
      });
      return;
    }
    await this.managerRequest(`/internal/provisioning/jobs/${encodeURIComponent(job.id)}/fail`, {
      method: "POST",
      body: JSON.stringify({
        error: message,
        retry: true,
      }),
    }).catch((failError) => {
      console.error(`[worker] nao consegui marcar falha no manager: ${failError?.message ?? failError}`);
    });
  }

  async tick() {
    const payload = await this.claimJob();
    if (!payload?.job) {
      return false;
    }
    try {
      await this.processJob(payload);
    } catch (error) {
      await this.failJob(payload.job, error);
    }
    return true;
  }

  async run() {
    console.log(`[worker] iniciado manager=${this.managerApiUrl} workerId=${this.workerId}`);
    let ticks = 0;
    do {
      ticks += 1;
      const hadJob = await this.tick().catch((error) => {
        console.error(`[worker] erro no ciclo: ${error?.message ?? error}`);
        return false;
      });
      if (this.once || (this.maxTicks > 0 && ticks >= this.maxTicks)) {
        break;
      }
      await sleep(hadJob ? 1000 : this.pollMs);
    } while (true);
  }
}

new ProvisioningWorker().run().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exitCode = 1;
});
