"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagerRuntimeConfigService = exports.maskSecretPreview = exports.isPublicUrl = exports.normalizeUrl = void 0;
const utils_js_1 = require("./utils.js");
const store_js_1 = require("./store.js");
function readEnvValue(envKey) {
    const value = String(process.env[envKey] ?? "").trim();
    return value || null;
}
function readEnvList(envKey) {
    return String(process.env[envKey] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
}
function normalizeUrl(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
        return null;
    }
    try {
        const parsed = new URL(trimmed);
        const normalized = parsed.toString();
        return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
    }
    catch {
        return null;
    }
}
exports.normalizeUrl = normalizeUrl;
function isPublicUrl(urlValue) {
    if (!urlValue) {
        return false;
    }
    try {
        const parsed = new URL(urlValue);
        return !["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
    }
    catch {
        return false;
    }
}
exports.isPublicUrl = isPublicUrl;
function readEnvBoolean(envKey, fallback) {
    const rawValue = String(process.env[envKey] ?? "").trim().toLowerCase();
    if (!rawValue) {
        return fallback;
    }
    if (["1", "true", "yes", "on"].includes(rawValue)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(rawValue)) {
        return false;
    }
    return fallback;
}
function readEnvNumber(envKey, fallback) {
    const rawValue = String(process.env[envKey] ?? "").trim();
    if (!rawValue) {
        return fallback;
    }
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function maskSecretPreview(value, options = {}) {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
        return null;
    }
    const visibleStart = Math.max(0, Number(options.visibleStart ?? 4));
    const visibleEnd = Math.max(0, Number(options.visibleEnd ?? 3));
    if (normalized.length <= visibleStart + visibleEnd + 1) {
        return `${normalized.slice(0, Math.max(1, normalized.length - 1))}*`;
    }
    return `${normalized.slice(0, visibleStart)}***${normalized.slice(-visibleEnd)}`;
}
exports.maskSecretPreview = maskSecretPreview;
function normalizeWebhookPath(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
        return "/webhooks/efipay";
    }
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
function normalizeOptionalString(value) {
    if (value === undefined) {
        return undefined;
    }
    const trimmed = String(value ?? "").trim();
    return trimmed || null;
}
function normalizeOptionalBoolean(value) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    if (typeof value === "boolean") {
        return value;
    }
    const normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }
    return undefined;
}
function normalizeOptionalNumber(value) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null || value === "") {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function normalizeBinaryBase64(value) {
    if (value === undefined) {
        return undefined;
    }
    const normalized = String(value ?? "")
        .trim()
        .replace(/^data:[^;]+;base64,/u, "")
        .replace(/\s+/gu, "");
    return normalized || null;
}
function normalizeIdList(values) {
    const list = Array.isArray(values) ? values : [values];
    return [...new Set(list
            .flatMap((value) => Array.isArray(value) ? value : [value])
            .map((value) => String(value ?? "").trim())
            .filter((value) => /^\d{5,32}$/u.test(value)))];
}
function normalizeSourceSlug(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
function normalizeRelativePathList(values) {
    const list = Array.isArray(values) ? values : [values];
    return [...new Set(list
            .map((value) => String(value ?? "").trim().replaceAll("\\", "/").replace(/^[./]+/u, "").replace(/^\/+|\/+$/g, ""))
            .filter(Boolean))];
}
class ManagerRuntimeConfigService {
    store;
    efipayClient = null;
    squareCloudProvisioningService = null;
    constructor(store) {
        this.store = store;
        this.ensureState();
    }
    attachRuntimeTargets(targets = {}) {
        this.efipayClient = targets.efipayClient ?? this.efipayClient;
        this.squareCloudProvisioningService =
            targets.squareCloudProvisioningService ?? this.squareCloudProvisioningService;
        this.syncRuntimeTargets();
    }
    ensureState() {
        if (!this.store.managerRuntimeConfig || typeof this.store.managerRuntimeConfig !== "object") {
            this.store.managerRuntimeConfig = (0, store_js_1.createEmptyManagerRuntimeConfig)();
        }
        const defaults = (0, store_js_1.createEmptyManagerRuntimeConfig)();
        const current = this.store.managerRuntimeConfig;
        const access = current.access && typeof current.access === "object" ? current.access : {};
        const sales = current.sales && typeof current.sales === "object" ? current.sales : {};
        const sources = current.sources && typeof current.sources === "object" ? current.sources : {};
        const billing = current.billing && typeof current.billing === "object" ? current.billing : {};
        const efipay = billing.efipay && typeof billing.efipay === "object" ? billing.efipay : {};
        this.store.managerRuntimeConfig = {
            ...defaults,
            ...current,
            appBaseUrl: normalizeUrl(current.appBaseUrl),
            access: {
                ...defaults.access,
                ...access,
                adminUserIds: normalizeIdList(access.adminUserIds),
                staffUserIds: normalizeIdList(access.staffUserIds),
                staffRoleIds: normalizeIdList(access.staffRoleIds),
            },
            sales: {
                ...defaults.sales,
                ...sales,
                cartCategoryId: normalizeIdList(sales.cartCategoryId)[0] ?? null,
                customerRoleId: normalizeIdList(sales.customerRoleId)[0] ?? null,
                cartStaffRoleIds: normalizeIdList(sales.cartStaffRoleIds),
                logsChannelId: normalizeIdList(sales.logsChannelId)[0] ?? null,
                cartInactivityMinutes: Math.min(5, Math.max(1, normalizeOptionalNumber(sales.cartInactivityMinutes) ?? defaults.sales.cartInactivityMinutes)),
                cartChannelNameTemplate: normalizeOptionalString(sales.cartChannelNameTemplate) ?? defaults.sales.cartChannelNameTemplate,
                autoAssignCustomerRole: normalizeOptionalBoolean(sales.autoAssignCustomerRole) ?? defaults.sales.autoAssignCustomerRole,
            },
            sources: {
                ...(defaults.sources && typeof defaults.sources === "object" ? defaults.sources : {}),
                ...sources,
            },
            billing: {
                ...defaults.billing,
                ...billing,
                efipay: {
                    ...defaults.billing.efipay,
                    ...efipay,
                },
            },
        };
        return this.store.managerRuntimeConfig;
    }
    inferRequestBaseUrl(request) {
        const forwardedProto = String(request?.headers?.["x-forwarded-proto"] ?? "").split(",")[0]?.trim();
        const forwardedHost = String(request?.headers?.["x-forwarded-host"] ?? "").split(",")[0]?.trim();
        const host = forwardedHost || String(request?.headers?.host ?? "").trim();
        if (!host) {
            return null;
        }
        const protocol = forwardedProto || (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
        return normalizeUrl(`${protocol}://${host}`);
    }
    getResolvedAppBaseUrl(request) {
        const runtimeState = this.ensureState();
        const runtimeValue = normalizeUrl(runtimeState.appBaseUrl);
        if (runtimeValue) {
            return runtimeValue;
        }
        const envValue = normalizeUrl(readEnvValue("APP_BASE_URL"));
        if (envValue) {
            return envValue;
        }
        return this.inferRequestBaseUrl(request);
    }
    getResolvedAppBaseUrlSource(request) {
        const runtimeValue = normalizeUrl(this.ensureState().appBaseUrl);
        if (runtimeValue) {
            return "runtime";
        }
        const envValue = normalizeUrl(readEnvValue("APP_BASE_URL"));
        if (envValue) {
            return "env";
        }
        return this.inferRequestBaseUrl(request) ? "request" : "missing";
    }
    getResolvedEfipayOptions(request) {
        const runtimeState = this.ensureState().billing.efipay;
        const sandbox = runtimeState.sandbox ?? readEnvBoolean("EFI_SANDBOX", false);
        return {
            clientId: runtimeState.clientId ?? readEnvValue("EFI_CLIENT_ID"),
            clientSecret: runtimeState.clientSecret ?? readEnvValue("EFI_CLIENT_SECRET"),
            pixKey: runtimeState.pixKey ?? readEnvValue("EFI_PIX_KEY"),
            certP12Base64: runtimeState.certP12Base64 ?? null,
            certP12Path: readEnvValue("EFI_CERT_P12_PATH"),
            certP12Passphrase: runtimeState.certP12Passphrase ?? readEnvValue("EFI_CERT_P12_PASSPHRASE"),
            caBase64: runtimeState.caBase64 ?? null,
            caPath: readEnvValue("EFI_CA_PATH"),
            baseUrl: runtimeState.baseUrl ?? readEnvValue("EFI_BASE_URL"),
            sandbox,
            pixExpirationSeconds: runtimeState.pixExpirationSeconds ?? readEnvNumber("EFI_PIX_EXPIRATION_SECONDS", 1800),
            appBaseUrl: this.getResolvedAppBaseUrl(request),
            webhookPublicUrl: runtimeState.webhookPublicUrl ?? readEnvValue("EFI_WEBHOOK_PUBLIC_URL"),
            webhookPath: normalizeWebhookPath(runtimeState.webhookPath ?? readEnvValue("EFI_WEBHOOK_PATH")),
            webhookSecret: runtimeState.webhookSecret ?? readEnvValue("EFI_WEBHOOK_SECRET"),
            webhookSkipMtls: runtimeState.webhookSkipMtls ?? readEnvBoolean("EFI_WEBHOOK_SKIP_MTLS", true),
            autoSyncWebhook: runtimeState.autoSyncWebhook ?? readEnvBoolean("EFI_AUTO_SYNC_WEBHOOK", true),
        };
    }
    syncRuntimeTargets(request) {
        const appBaseUrl = this.getResolvedAppBaseUrl(request);
        if (this.efipayClient && typeof this.efipayClient.applyConfig === "function") {
            this.efipayClient.applyConfig(this.getResolvedEfipayOptions(request));
        }
        if (this.squareCloudProvisioningService &&
            typeof this.squareCloudProvisioningService.setManagerApiUrl === "function") {
            this.squareCloudProvisioningService.setManagerApiUrl(appBaseUrl);
        }
    }
    getResolvedAccessControl() {
        const runtimeState = this.ensureState().access;
        const runtimeAdminUserIds = normalizeIdList(runtimeState.adminUserIds);
        return {
            adminUserIds: runtimeAdminUserIds,
            staffUserIds: [],
            staffRoleIds: [],
            sources: {
                runtimeAdminUserIds,
            },
        };
    }
    updateAccessControl(input = {}) {
        const runtimeState = this.ensureState();
        const access = runtimeState.access;
        access.adminUserIds = normalizeIdList([
            ...access.adminUserIds,
            ...(input.addAdminUserIds ?? []),
        ].filter((value) => !normalizeIdList(input.removeAdminUserIds).includes(String(value))));
        access.staffUserIds = [];
        access.staffRoleIds = [];
        runtimeState.updatedAt = (0, utils_js_1.nowIso)();
        return this.getResolvedAccessControl();
    }
    getResolvedSalesSettings() {
        const sales = this.ensureState().sales;
        return {
            cartCategoryId: normalizeIdList(sales.cartCategoryId)[0] ?? null,
            customerRoleId: normalizeIdList(sales.customerRoleId)[0] ?? null,
            cartStaffRoleIds: normalizeIdList(sales.cartStaffRoleIds),
            logsChannelId: normalizeIdList(sales.logsChannelId)[0] ?? null,
            cartInactivityMinutes: Math.min(5, Math.max(1, normalizeOptionalNumber(sales.cartInactivityMinutes) ?? 5)),
            cartChannelNameTemplate: normalizeOptionalString(sales.cartChannelNameTemplate) ?? "🛒・{guild}",
            autoAssignCustomerRole: normalizeOptionalBoolean(sales.autoAssignCustomerRole) ?? true,
        };
    }
    updateSalesSettings(input = {}) {
        const runtimeState = this.ensureState();
        const sales = runtimeState.sales;
        if (input.cartCategoryId !== undefined) {
            sales.cartCategoryId = normalizeIdList(input.cartCategoryId)[0] ?? null;
        }
        if (input.customerRoleId !== undefined) {
            sales.customerRoleId = normalizeIdList(input.customerRoleId)[0] ?? null;
        }
        if (input.cartStaffRoleIds !== undefined) {
            sales.cartStaffRoleIds = normalizeIdList(input.cartStaffRoleIds);
        }
        if (input.logsChannelId !== undefined) {
            sales.logsChannelId = normalizeIdList(input.logsChannelId)[0] ?? null;
        }
        if (input.cartInactivityMinutes !== undefined) {
            sales.cartInactivityMinutes = Math.min(5, Math.max(1, normalizeOptionalNumber(input.cartInactivityMinutes) ?? 5));
        }
        if (input.cartChannelNameTemplate !== undefined) {
            sales.cartChannelNameTemplate = normalizeOptionalString(input.cartChannelNameTemplate) ?? "🛒・{guild}";
        }
        if (input.autoAssignCustomerRole !== undefined) {
            sales.autoAssignCustomerRole = normalizeOptionalBoolean(input.autoAssignCustomerRole) ?? true;
        }
        runtimeState.updatedAt = (0, utils_js_1.nowIso)();
        return this.getResolvedSalesSettings();
    }
    getRuntimeSourceConfig(sourceSlug) {
        const normalizedSlug = normalizeSourceSlug(sourceSlug);
        if (!normalizedSlug) {
            return null;
        }
        const sourceConfig = this.ensureState().sources?.[normalizedSlug];
        return sourceConfig && typeof sourceConfig === "object" ? { ...sourceConfig } : null;
    }
    updateRuntimeSourceConfig(sourceSlug, input = {}) {
        const normalizedSlug = normalizeSourceSlug(sourceSlug);
        if (!normalizedSlug) {
            throw new Error("sourceSlug invalido.");
        }
        const runtimeState = this.ensureState();
        const current = this.getRuntimeSourceConfig(normalizedSlug) ?? {};
        const next = {
            ...current,
        };
        const stringFields = [
            "artifactPath",
            "projectDir",
            "githubRepo",
            "githubRef",
            "githubPath",
            "githubArchiveUrl",
            "githubToken",
            "entrypoint",
            "displayName",
            "memory",
            "appPublicUrl",
            "transcriptPublicUrl",
        ];
        for (const field of stringFields) {
            const normalizedValue = normalizeOptionalString(input[field]);
            if (normalizedValue !== undefined) {
                next[field] = field.endsWith("Url") ? normalizeUrl(normalizedValue) ?? normalizedValue : normalizedValue;
            }
        }
        if (input.excludePaths !== undefined) {
            next.excludePaths = normalizeRelativePathList(input.excludePaths);
        }
        runtimeState.sources[normalizedSlug] = next;
        runtimeState.updatedAt = (0, utils_js_1.nowIso)();
        return this.getRuntimeSourceConfig(normalizedSlug);
    }
    updateRuntimeConfig(input = {}, request) {
        const runtimeState = this.ensureState();
        const efipay = runtimeState.billing.efipay;
        if (input.clearAppBaseUrl === true) {
            runtimeState.appBaseUrl = null;
        }
        else if (input.appBaseUrl !== undefined) {
            runtimeState.appBaseUrl = normalizeUrl(input.appBaseUrl);
        }
        else if (input.useCurrentRequestOrigin === true && !runtimeState.appBaseUrl) {
            runtimeState.appBaseUrl = this.inferRequestBaseUrl(request);
        }
        const stringFields = [
            "clientId",
            "clientSecret",
            "pixKey",
            "certP12Passphrase",
            "baseUrl",
            "webhookPublicUrl",
            "webhookSecret",
        ];
        for (const field of stringFields) {
            const normalizedValue = normalizeOptionalString(input[field]);
            if (normalizedValue !== undefined) {
                efipay[field] = field === "baseUrl" || field === "webhookPublicUrl"
                    ? normalizeUrl(normalizedValue)
                    : normalizedValue;
            }
        }
        if (input.webhookPath !== undefined) {
            efipay.webhookPath = normalizeWebhookPath(input.webhookPath);
        }
        const booleanFields = ["sandbox", "webhookSkipMtls", "autoSyncWebhook"];
        for (const field of booleanFields) {
            const normalizedValue = normalizeOptionalBoolean(input[field]);
            if (normalizedValue !== undefined) {
                efipay[field] = normalizedValue;
            }
        }
        const expirationSeconds = normalizeOptionalNumber(input.pixExpirationSeconds);
        if (expirationSeconds !== undefined) {
            efipay.pixExpirationSeconds = expirationSeconds;
        }
        const certP12Base64 = normalizeBinaryBase64(input.certP12Base64);
        if (certP12Base64 !== undefined) {
            efipay.certP12Base64 = certP12Base64;
        }
        const caBase64 = normalizeBinaryBase64(input.caBase64);
        if (caBase64 !== undefined) {
            efipay.caBase64 = caBase64;
        }
        if (input.clearStoredCert === true) {
            efipay.certP12Base64 = null;
            efipay.certFileName = null;
        }
        else if (input.certFileName !== undefined) {
            efipay.certFileName = normalizeOptionalString(input.certFileName) ?? null;
        }
        if (input.clearStoredCa === true) {
            efipay.caBase64 = null;
            efipay.caFileName = null;
        }
        else if (input.caFileName !== undefined) {
            efipay.caFileName = normalizeOptionalString(input.caFileName) ?? null;
        }
        runtimeState.updatedAt = (0, utils_js_1.nowIso)();
        this.syncRuntimeTargets(request);
        return this.getAdminSnapshot(request);
    }
    async validateEfipayConfiguration(options = {}, request) {
        if (!this.efipayClient) {
            throw new Error("Cliente Efipay ainda nao conectado ao runtime config.");
        }
        this.syncRuntimeTargets(request);
        const runtimeState = this.ensureState().billing.efipay;
        const validatedAt = (0, utils_js_1.nowIso)();
        let remoteWebhook = null;
        try {
            await this.efipayClient.getAccessToken();
            runtimeState.lastValidationOk = true;
            runtimeState.lastValidatedAt = validatedAt;
            runtimeState.lastValidationError = null;
            if (options.syncWebhook === true) {
                remoteWebhook = await this.efipayClient.registerWebhook();
                runtimeState.lastWebhookSyncAt = validatedAt;
                runtimeState.lastWebhookSyncError = null;
            }
            return {
                ok: true,
                remoteWebhook,
                config: this.getAdminSnapshot(request),
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            runtimeState.lastValidationOk = false;
            runtimeState.lastValidatedAt = validatedAt;
            runtimeState.lastValidationError = message;
            if (options.syncWebhook === true) {
                runtimeState.lastWebhookSyncAt = validatedAt;
                runtimeState.lastWebhookSyncError = message;
            }
            throw new Error(message);
        }
    }
    async syncEfipayWebhook(request) {
        if (!this.efipayClient) {
            throw new Error("Cliente Efipay ainda nao conectado ao runtime config.");
        }
        this.syncRuntimeTargets(request);
        const runtimeState = this.ensureState().billing.efipay;
        const syncedAt = (0, utils_js_1.nowIso)();
        try {
            const remoteWebhook = await this.efipayClient.registerWebhook();
            runtimeState.lastWebhookSyncAt = syncedAt;
            runtimeState.lastWebhookSyncError = null;
            return {
                ok: true,
                remoteWebhook,
                config: this.getAdminSnapshot(request),
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            runtimeState.lastWebhookSyncAt = syncedAt;
            runtimeState.lastWebhookSyncError = message;
            throw new Error(message);
        }
    }
    getAdminSnapshot(request) {
        this.syncRuntimeTargets(request);
        const runtimeState = this.ensureState();
        const efipayState = runtimeState.billing.efipay;
        const resolvedEfipay = this.getResolvedEfipayOptions(request);
        const sanitizedSources = Object.fromEntries(Object.entries(runtimeState.sources ?? {}).map(([slug, config]) => {
            const normalizedConfig = config && typeof config === "object" ? { ...config } : {};
            const githubToken = normalizeOptionalString(normalizedConfig.githubToken);
            if ("githubToken" in normalizedConfig) {
                normalizedConfig.githubToken = githubToken ? maskSecretPreview(githubToken, { visibleStart: 8, visibleEnd: 4 }) : null;
            }
            normalizedConfig.githubTokenConfigured = Boolean(githubToken);
            return [slug, normalizedConfig];
        }));
        const efipayClientConfig = this.efipayClient?.getConfigSnapshot?.() ?? null;
        const webhookStatus = this.efipayClient?.getWebhookStatus?.() ?? {
            configured: false,
            canCreatePixCharges: false,
            canRegisterWebhook: false,
            webhookPublicUrl: resolvedEfipay.webhookPublicUrl ?? resolvedEfipay.appBaseUrl ?? null,
            webhookPublicUrlReady: isPublicUrl(resolvedEfipay.webhookPublicUrl ?? resolvedEfipay.appBaseUrl ?? null),
            webhookRegistrationUrl: null,
            webhookPath: resolvedEfipay.webhookPath,
            webhookSecretManagedInternally: false,
            webhookDerivedFromAppBaseUrl: Boolean(!resolvedEfipay.webhookPublicUrl && resolvedEfipay.appBaseUrl),
            autoSyncWebhook: resolvedEfipay.autoSyncWebhook,
            lastWebhookSyncError: efipayState.lastWebhookSyncError,
        };
        return {
            appBaseUrl: this.getResolvedAppBaseUrl(request),
            appBaseUrlSource: this.getResolvedAppBaseUrlSource(request),
            inferredRequestBaseUrl: this.inferRequestBaseUrl(request),
            updatedAt: runtimeState.updatedAt,
            access: this.getResolvedAccessControl(),
            sales: this.getResolvedSalesSettings(),
            sources: sanitizedSources,
            billing: {
                efipay: {
                    configuredFields: {
                        clientId: Boolean(resolvedEfipay.clientId),
                        clientSecret: Boolean(resolvedEfipay.clientSecret),
                        pixKey: Boolean(resolvedEfipay.pixKey),
                        certificate: efipayClientConfig?.certP12Configured ?? Boolean(resolvedEfipay.certP12Base64 || resolvedEfipay.certP12Path),
                        certificateSource: resolvedEfipay.certP12Base64
                            ? "runtime"
                            : resolvedEfipay.certP12Path
                                ? "env_path"
                                : "missing",
                        caCertificate: efipayClientConfig?.caConfigured ?? Boolean(resolvedEfipay.caBase64 || resolvedEfipay.caPath),
                    },
                    previews: {
                        clientId: maskSecretPreview(resolvedEfipay.clientId, { visibleStart: 8, visibleEnd: 4 }),
                        pixKey: maskSecretPreview(resolvedEfipay.pixKey, { visibleStart: 8, visibleEnd: 6 }),
                        certFileName: efipayState.certFileName,
                        caFileName: efipayState.caFileName,
                    },
                    values: {
                        sandbox: resolvedEfipay.sandbox,
                        baseUrl: resolvedEfipay.baseUrl,
                        pixExpirationSeconds: resolvedEfipay.pixExpirationSeconds,
                        webhookPublicUrl: resolvedEfipay.webhookPublicUrl,
                        webhookPath: resolvedEfipay.webhookPath,
                        autoSyncWebhook: resolvedEfipay.autoSyncWebhook,
                        webhookSkipMtls: resolvedEfipay.webhookSkipMtls,
                        appBaseUrl: resolvedEfipay.appBaseUrl,
                    },
                    status: {
                        ...webhookStatus,
                        hasStoredRuntimeCertificate: Boolean(efipayState.certP12Base64),
                        hasStoredRuntimeCa: Boolean(efipayState.caBase64),
                        certPathExists: efipayClientConfig?.certP12PathExists ?? false,
                        caPathExists: efipayClientConfig?.caPathExists ?? false,
                        lastValidationOk: efipayState.lastValidationOk,
                        lastValidatedAt: efipayState.lastValidatedAt,
                        lastValidationError: efipayState.lastValidationError,
                        lastWebhookSyncAt: efipayState.lastWebhookSyncAt,
                        lastWebhookSyncError: efipayState.lastWebhookSyncError,
                    },
                },
            },
        };
    }
}
exports.ManagerRuntimeConfigService = ManagerRuntimeConfigService;
