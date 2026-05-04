"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquareCloudProvisioningService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function readFirstEnvValue(envKeys) {
    for (const envKey of envKeys) {
        const value = String(process.env[envKey] ?? "").trim();
        if (value) {
            return value;
        }
    }
    return "";
}
function normalizeNamespacePart(value, fallbackValue) {
    const normalized = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return normalized || fallbackValue;
}
function normalizeIdentifier(value, fallbackValue) {
    const normalized = String(value ?? "")
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, "");
    return normalized || fallbackValue;
}
function readEnvFileAsBase64(pathEnvKeys, base64EnvKeys) {
    const inlineBase64 = readFirstEnvValue(base64EnvKeys);
    if (inlineBase64) {
        return inlineBase64;
    }
    const configuredPath = readFirstEnvValue(pathEnvKeys);
    if (!configuredPath) {
        return "";
    }
    if (process.platform !== "win32" && /^[a-z]:[\\/]/iu.test(configuredPath)) {
        return "";
    }
    const absolutePath = (0, node_path_1.resolve)(configuredPath);
    if (!(0, node_fs_1.existsSync)(absolutePath)) {
        return "";
    }
    return (0, node_fs_1.readFileSync)(absolutePath).toString("base64");
}
function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(milliseconds) || 0)));
}
function pickRuntimeStatusValue(payload) {
    const data = payload?.response ?? payload ?? {};
    const candidates = [
        data.running,
        data.status,
        data.state,
        data.currentStatus,
        data?.usage?.running,
        data?.usage?.status,
        data?.stats?.running,
        data?.stats?.status,
    ];
    for (const candidate of candidates) {
        if (candidate !== undefined && candidate !== null && String(candidate).trim() !== "") {
            return candidate;
        }
    }
    return null;
}
function isRuntimeStatusRunning(payload) {
    const rawStatus = pickRuntimeStatusValue(payload);
    if (typeof rawStatus === "boolean") {
        return rawStatus;
    }
    if (typeof rawStatus === "number") {
        return rawStatus > 0;
    }
    const normalized = String(rawStatus ?? "").trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    return ["running", "online", "started", "ready", "active", "em execucao", "em execução", "rodando"].some((token) => normalized.includes(token));
}
function isAlreadyStartedError(error) {
    const payload = error?.response ?? error?.body ?? error;
    const raw = [
        error?.code,
        error?.rawError?.code,
        payload?.code,
        payload?.error,
        payload?.message,
        error?.message,
    ]
        .map((value) => String(value ?? "").trim().toUpperCase())
        .filter(Boolean)
        .join(" ");
    return raw.includes("CONTAINER_ALREADY_STARTED") ||
        raw.includes("ALREADY STARTED") ||
        raw.includes("JA ESTA LIG") ||
        raw.includes("JÁ ESTÁ LIG");
}
function pickUploadedAppId(upload) {
    return String(upload?.response?.id ??
        upload?.response?.appId ??
        upload?.response?.app_id ??
        upload?.response?.application?.id ??
        upload?.id ??
        upload?.appId ??
        upload?.app_id ??
        "").trim();
}
class SquareCloudProvisioningService {
    squareCloudClient;
    sourceArtifactService;
    options;
    constructor(squareCloudClient, sourceArtifactService, options) {
        this.squareCloudClient = squareCloudClient;
        this.sourceArtifactService = sourceArtifactService;
        this.options = options;
    }
    setManagerApiUrl(managerApiUrl) {
        this.options.managerApiUrl = managerApiUrl ?? this.options.managerApiUrl ?? null;
    }
    getManagerApiUrl() {
        if (typeof this.options.getManagerApiUrl === "function") {
            const resolvedValue = this.options.getManagerApiUrl();
            if (resolvedValue) {
                return resolvedValue;
            }
        }
        return this.options.managerApiUrl ?? "http://localhost:3000";
    }
    isConfigured() {
        return this.squareCloudClient.isConfigured();
    }
    buildGuildUrl(guildId) {
        const normalizedGuildId = String(guildId ?? "").trim();
        return normalizedGuildId ? `https://discord.com/channels/${normalizedGuildId}` : "";
    }
    buildManagedDescription(instance) {
        const sequenceLabel = String(instance?.config?.saleSequenceLabel ?? "").trim() ||
            String(Math.max(1, Number(instance?.saleSequenceNumber ?? 1) || 1)).padStart(2, "0");
        const purchaserDiscordUserId = String(instance?.config?.purchaserDiscordUserId ?? instance?.config?.commercialOwnerDiscordUserId ?? instance?.config?.ownerDiscordUserId ?? "").trim() || "sem-comprador";
        const soldAt = new Date(String(instance?.soldAt ?? instance?.config?.soldAt ?? instance?.createdAt ?? "").trim() || Date.now());
        const day = String(Number.isFinite(soldAt.getTime()) ? soldAt.getUTCDate() : 0).padStart(2, "0");
        const month = String(Number.isFinite(soldAt.getTime()) ? soldAt.getUTCMonth() + 1 : 0).padStart(2, "0");
        const year = String(Number.isFinite(soldAt.getTime()) ? soldAt.getUTCFullYear() : 0);
        return `Aplicação ID ${sequenceLabel} - ${purchaserDiscordUserId} - ${day}-${month}-${year}`.slice(0, 120);
    }
    buildManagedDisplayName(instance, discordApp) {
        const rawBaseName = String(instance?.sourceSlug ?? "").trim() === "bot-ticket-hype"
            ? "Bot Ticket Hype"
            : String(discordApp?.appName ?? instance?.config?.discordAppName ?? "Bot Ticket Hype").trim() || "Bot Ticket Hype";
        const baseName = rawBaseName.replace(/\s+Runtime$/iu, "").trim() || rawBaseName;
        const rawUsername = String(instance?.config?.purchaserDiscordUsername ??
            instance?.config?.customerDiscordUsername ??
            instance?.config?.purchaserDiscordUserId ??
            instance?.config?.commercialOwnerDiscordUserId ??
            "").trim();
        const username = (rawUsername || "cliente").replace(/^@+/u, "").replace(/[^a-zA-Z0-9]+/gu, "").slice(0, 12) || "cliente";
        const expiresAt = new Date(String(instance?.expiresAt ?? "").trim() || Date.now());
        const day = String(Number.isFinite(expiresAt.getTime()) ? expiresAt.getUTCDate() : 0).padStart(2, "0");
        const month = String(Number.isFinite(expiresAt.getTime()) ? expiresAt.getUTCMonth() + 1 : 0).padStart(2, "0");
        const year = String(Number.isFinite(expiresAt.getTime()) ? expiresAt.getUTCFullYear() : 0);
        return `${baseName} ${username} ${day}${month}${year.slice(-2)}`.slice(0, 32);
    }
    async provisionInstance(instance, discordApp) {
        if (!this.squareCloudClient.isConfigured()) {
            throw new Error("SquareCloud não configurada para provisionamento real.");
        }
        const overrides = {
            displayName: this.buildManagedDisplayName(instance, discordApp),
            description: this.buildManagedDescription(instance),
            artifactTag: instance.id,
        };
        const artifact = await this.sourceArtifactService.getArtifact(instance.sourceSlug, overrides);
        const runtimeOptions = this.sourceArtifactService.getRuntimeOptions(instance.sourceSlug, overrides);
        const upload = await this.squareCloudClient.uploadApplication(artifact.fileBuffer, artifact.fileName);
        const appId = pickUploadedAppId(upload);
        if (!appId) {
            throw new Error("A SquareCloud respondeu o upload sem retornar o App ID da aplicação.");
        }
        try {
            await this.applyRuntimeEnv(appId, this.buildRuntimeEnv({
                appId,
                discordApp,
                instance,
                runtimeOptions,
            }));
            const boot = await this.bootProvisionedApp(appId);
            if (!boot?.ok) {
                throw new Error("A SquareCloud recebeu o deploy, mas não aceitou iniciar a aplicação vendida automaticamente.");
            }
            return {
                appId,
                upload,
                boot,
            };
        }
        catch (error) {
            if (error && typeof error === "object") {
                error.squareCloudAppId = appId;
            }
            throw error;
        }
    }
    async updateInstance(instance, discordApp) {
        if (!this.squareCloudClient.isConfigured()) {
            throw new Error("SquareCloud não configurada para atualização real.");
        }
        if (!instance.hostingAppId || instance.hostingAppId.startsWith("pending-")) {
            throw new Error("A instância ainda não possui uma app real para atualizar.");
        }
        const overrides = {
            displayName: this.buildManagedDisplayName(instance, discordApp),
            description: this.buildManagedDescription(instance),
            artifactTag: instance.id,
        };
        const artifact = await this.sourceArtifactService.getArtifact(instance.sourceSlug, overrides);
        const runtimeOptions = this.sourceArtifactService.getRuntimeOptions(instance.sourceSlug, overrides);
        const commit = await this.squareCloudClient.commitApplication(instance.hostingAppId, artifact.fileBuffer, artifact.fileName);
        try {
            await this.applyRuntimeEnv(instance.hostingAppId, this.buildRuntimeEnv({
                appId: instance.hostingAppId,
                discordApp,
                instance,
                runtimeOptions,
            }));
            const boot = await this.bootProvisionedApp(instance.hostingAppId);
            if (!boot?.ok) {
                throw new Error("A SquareCloud atualizou a aplicação, mas não aceitou iniciar o runtime automaticamente.");
            }
            return {
                appId: instance.hostingAppId,
                commit,
                boot,
            };
        }
        catch (error) {
            if (error && typeof error === "object") {
                error.squareCloudAppId = instance.hostingAppId;
            }
            throw error;
        }
    }
    async restartInstance(instance) {
        return this.bootProvisionedApp(instance.hostingAppId);
    }
    async suspendInstance(instance) {
        await this.squareCloudClient.stopApp(instance.hostingAppId);
    }
    async deleteInstance(instance) {
        await this.squareCloudClient.deleteApp(instance.hostingAppId);
    }
    async applyRuntimeEnv(appId, envs) {
        return this.squareCloudClient.setAppEnvVars(appId, envs);
    }
    async bootProvisionedApp(appId) {
        const normalizedAppId = String(appId ?? "").trim();
        if (!normalizedAppId) {
            throw new Error("App ID da SquareCloud obrigatório para iniciar a aplicação.");
        }
        const attempts = [];
        const pushAttempt = (action, ok, result = null, error = null) => {
            attempts.push({
                action,
                ok,
                result,
                error: error ? String(error?.message ?? error) : null,
            });
        };
        try {
            const result = await this.squareCloudClient.startApp(normalizedAppId);
            pushAttempt("start", true, result);
        }
        catch (error) {
            const alreadyStarted = isAlreadyStartedError(error);
            pushAttempt("start", alreadyStarted, alreadyStarted ? { alreadyStarted: true } : null, error);
        }
        await wait(2500);
        if (typeof this.squareCloudClient.restartApp === "function") {
            try {
                const restart = await this.squareCloudClient.restartApp(normalizedAppId);
                pushAttempt("restart", true, restart);
            }
            catch (error) {
                pushAttempt("restart", false, null, error);
            }
        }
        await wait(2500);
        try {
            const result = await this.squareCloudClient.startApp(normalizedAppId);
            pushAttempt("start_after_restart", true, result);
        }
        catch (error) {
            const alreadyStarted = isAlreadyStartedError(error);
            pushAttempt("start_after_restart", alreadyStarted, alreadyStarted ? { alreadyStarted: true } : null, error);
        }
        for (let attempt = 1; attempt <= 4; attempt += 1) {
            await wait(2500);
            try {
                const status = await this.squareCloudClient.getAppStatus(normalizedAppId);
                pushAttempt(`status_check_${attempt}`, true, status);
                if (isRuntimeStatusRunning(status)) {
                    return {
                        ok: true,
                        running: true,
                        attempts,
                        status,
                    };
                }
            }
            catch (error) {
                pushAttempt(`status_check_${attempt}`, false, null, error);
            }
            try {
                const result = await this.squareCloudClient.startApp(normalizedAppId);
                pushAttempt(`start_retry_${attempt}`, true, result);
            }
            catch (error) {
                const alreadyStarted = isAlreadyStartedError(error);
                pushAttempt(`start_retry_${attempt}`, alreadyStarted, alreadyStarted ? { alreadyStarted: true } : null, error);
            }
        }
        return {
            ok: false,
            running: false,
            attempts,
        };
    }
    buildRuntimeEnv(input) {
        const runtimeStateEnv = this.buildRuntimeStateEnv(input);
        const managedDescription = String(input.runtimeOptions?.description ?? this.buildManagedDescription(input.instance)).trim();
        const saleSequenceLabel = String(input.instance?.config?.saleSequenceLabel ?? "").trim() ||
            String(Math.max(1, Number(input.instance?.saleSequenceNumber ?? 1) || 1)).padStart(2, "0");
        const soldAt = String(input.instance?.soldAt ?? input.instance?.config?.soldAt ?? input.instance?.createdAt ?? "").trim();
        const purchaserDiscordUserId = String(input.instance?.config?.purchaserDiscordUserId ?? "").trim();
        const purchaserDiscordUsername = String(input.instance?.config?.purchaserDiscordUsername ?? "").trim();
        const customerId = String(input.instance?.config?.customerId ?? "").trim();
        const subscriptionId = String(input.instance?.config?.subscriptionId ?? input.instance?.subscriptionId ?? "").trim();
        const commercialOwnerDiscordUserId = String(input.instance?.config?.commercialOwnerDiscordUserId ?? "").trim();
        const defaultGuildId = String(input.discordApp.defaultGuildId ?? "").trim();
        const assignedGuildId = String(input.instance.assignedGuildId ?? "").trim();
        const runtimeEnv = {
            MANAGER_API_URL: this.getManagerApiUrl(),
            INSTANCE_ID: input.instance.id,
            INSTANCE_SECRET: input.instance.instanceSecret,
            INSTANCE_SOURCE_SLUG: input.instance.sourceSlug,
            SOURCE_SLUG: input.instance.sourceSlug,
            SOURCE_VERSION: input.instance.sourceVersion,
            NODE_ENV: "production",
            TOKEN: input.discordApp.botToken,
            DISCORD_TOKEN: input.discordApp.botToken,
            CLIENT_ID: input.discordApp.clientId,
            DISCORD_CLIENT_ID: input.discordApp.clientId,
            APPLICATION_ID: input.discordApp.applicationId,
            DISCORD_APPLICATION_ID: input.discordApp.applicationId,
            DISCORD_APP_NAME: input.discordApp.appName,
            SQUARECLOUD_APP_ID: input.appId,
            SQUARECLOUD_APPLICATION_ID: input.appId,
            SQUARECLOUD_DESCRIPTION: managedDescription,
            TENANT_SALE_SEQUENCE_LABEL: saleSequenceLabel,
            TENANT_SALE_SEQUENCE_NUMBER: String(Math.max(1, Number(input.instance?.saleSequenceNumber ?? input.instance?.config?.saleSequenceNumber ?? 1) || 1)),
            TENANT_SOLD_AT: soldAt,
            TENANT_CUSTOMER_ID: customerId,
            TENANT_SUBSCRIPTION_ID: subscriptionId,
            TENANT_PURCHASER_DISCORD_USER_ID: purchaserDiscordUserId,
            TENANT_PURCHASER_DISCORD_USERNAME: purchaserDiscordUsername,
            TENANT_COMMERCIAL_OWNER_DISCORD_USER_ID: commercialOwnerDiscordUserId,
            TENANT_INSTALL_URL: String(input.instance.installUrl ?? "").trim(),
        };
        if (input.runtimeOptions.entrypoint) {
            runtimeEnv.BOT_RUNTIME_ENTRYPOINT = input.runtimeOptions.entrypoint;
        }
        if (input.runtimeOptions.appPublicUrl) {
            runtimeEnv.APP_PUBLIC_URL = input.runtimeOptions.appPublicUrl;
        }
        if (input.runtimeOptions.transcriptPublicUrl) {
            runtimeEnv.TRANSCRIPT_PUBLIC_URL = input.runtimeOptions.transcriptPublicUrl;
        }
        if (defaultGuildId) {
            runtimeEnv.GUILD_ID = defaultGuildId;
            runtimeEnv.DEFAULT_GUILD_ID = defaultGuildId;
            runtimeEnv.TENANT_DEFAULT_GUILD_ID = defaultGuildId;
            runtimeEnv.TENANT_DEFAULT_GUILD_URL = this.buildGuildUrl(defaultGuildId);
        }
        const ownerDiscordUserId = String(input.instance.config.ownerDiscordUserId ?? "").trim();
        if (ownerDiscordUserId) {
            runtimeEnv.TENANT_CUSTOMER_DISCORD_USER_ID = ownerDiscordUserId;
            runtimeEnv.TENANT_BOT_OWNER_DISCORD_USER_ID = ownerDiscordUserId;
        }
        if (assignedGuildId) {
            runtimeEnv.TENANT_ASSIGNED_GUILD_ID = assignedGuildId;
            runtimeEnv.TENANT_ASSIGNED_GUILD_URL = this.buildGuildUrl(assignedGuildId);
        }
        return {
            ...input.discordApp.runtimeEnv,
            ...runtimeStateEnv,
            ...runtimeEnv,
        };
    }
    buildRuntimeStateEnv(input) {
        const databaseUrl = readFirstEnvValue([
            "SOURCE_STATE_DATABASE_URL",
            "BOT_RUNTIME_DATABASE_URL",
            "DATABASE_URL",
        ]);
        if (!databaseUrl) {
            return {};
        }
        const schema = normalizeIdentifier(readFirstEnvValue([
            "SOURCE_STATE_DATABASE_SCHEMA",
            "BOT_RUNTIME_DATABASE_SCHEMA",
            "BOT_STATE_DATABASE_SCHEMA",
        ]), "bot_runtime");
        const docsTable = normalizeIdentifier(readFirstEnvValue([
            "SOURCE_STATE_DATABASE_DOCS_TABLE",
            "BOT_RUNTIME_DATABASE_DOCS_TABLE",
            "BOT_STATE_DATABASE_DOCS_TABLE",
        ]), "legacy_bot_state_documents");
        const filesTable = normalizeIdentifier(readFirstEnvValue([
            "SOURCE_STATE_DATABASE_FILES_TABLE",
            "BOT_RUNTIME_DATABASE_FILES_TABLE",
            "BOT_STATE_DATABASE_FILES_TABLE",
        ]), "legacy_bot_state_files");
        const namespace = [
            normalizeNamespacePart(input.instance.sourceSlug, "source"),
            normalizeNamespacePart(input.instance.id, "instance"),
            "prod",
        ].join("__");
        const stateEnv = {
            BOT_STATE_DATABASE_URL: databaseUrl,
            BOT_STATE_NAMESPACE: namespace,
            BOT_STATE_DATABASE_SCHEMA: schema,
            BOT_STATE_DATABASE_DOCS_TABLE: docsTable,
            BOT_STATE_DATABASE_FILES_TABLE: filesTable,
            BOT_STATE_DATABASE_SSL: readFirstEnvValue([
                "SOURCE_STATE_DATABASE_SSL",
                "BOT_RUNTIME_DATABASE_SSL",
                "DATABASE_SSL",
            ]) || "true",
            BOT_STATE_DATABASE_SSL_REJECT_UNAUTHORIZED: readFirstEnvValue([
                "SOURCE_STATE_DATABASE_SSL_REJECT_UNAUTHORIZED",
                "BOT_RUNTIME_DATABASE_SSL_REJECT_UNAUTHORIZED",
                "DATABASE_SSL_REJECT_UNAUTHORIZED",
            ]) || "false",
        };
        const caBase64 = readEnvFileAsBase64([
            "SOURCE_STATE_DATABASE_SSL_CA_PATH",
            "BOT_RUNTIME_DATABASE_SSL_CA_PATH",
            "DATABASE_SSL_CA_PATH",
        ], [
            "SOURCE_STATE_DATABASE_SSL_CA_BASE64",
            "BOT_RUNTIME_DATABASE_SSL_CA_BASE64",
            "DATABASE_SSL_CA_BASE64",
        ]);
        const certBase64 = readEnvFileAsBase64([
            "SOURCE_STATE_DATABASE_SSL_CERT_PATH",
            "BOT_RUNTIME_DATABASE_SSL_CERT_PATH",
            "DATABASE_SSL_CERT_PATH",
        ], [
            "SOURCE_STATE_DATABASE_SSL_CERT_BASE64",
            "BOT_RUNTIME_DATABASE_SSL_CERT_BASE64",
            "DATABASE_SSL_CERT_BASE64",
        ]);
        const keyBase64 = readEnvFileAsBase64([
            "SOURCE_STATE_DATABASE_SSL_KEY_PATH",
            "BOT_RUNTIME_DATABASE_SSL_KEY_PATH",
            "DATABASE_SSL_KEY_PATH",
        ], [
            "SOURCE_STATE_DATABASE_SSL_KEY_BASE64",
            "BOT_RUNTIME_DATABASE_SSL_KEY_BASE64",
            "DATABASE_SSL_KEY_BASE64",
        ]);
        if (caBase64) {
            stateEnv.BOT_STATE_DATABASE_SSL_CA_BASE64 = caBase64;
        }
        if (certBase64) {
            stateEnv.BOT_STATE_DATABASE_SSL_CERT_BASE64 = certBase64;
        }
        if (keyBase64) {
            stateEnv.BOT_STATE_DATABASE_SSL_KEY_BASE64 = keyBase64;
        }
        return stateEnv;
    }
}
exports.SquareCloudProvisioningService = SquareCloudProvisioningService;
