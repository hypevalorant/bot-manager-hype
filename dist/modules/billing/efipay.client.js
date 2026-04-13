"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EfipayClient = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_http_1 = require("node:http");
const node_https_1 = require("node:https");
const utils_js_1 = require("../../core/utils.js");
function normalizeUrl(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
        return null;
    }
    try {
        return new URL(trimmed).toString();
    }
    catch {
        return null;
    }
}
function normalizeBase64Binary(value) {
    const trimmed = String(value ?? "")
        .trim()
        .replace(/^data:[^;]+;base64,/u, "")
        .replace(/\s+/gu, "");
    return trimmed || null;
}
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
function collectWebhookCandidates(payload) {
    const parsed = payload && typeof payload === "object" ? payload : {};
    const directCandidates = [];
    for (const source of [parsed, parsed.data]) {
        if (!source || typeof source !== "object") {
            continue;
        }
        if (source.txid || source.endToEndId || source.e2eid || (Array.isArray(source.e2eids) && source.e2eids.length > 0)) {
            directCandidates.push(source);
        }
    }
    const pixItems = Array.isArray(parsed.pix) ? parsed.pix : [];
    const nestedPixItems = Array.isArray(parsed.data?.pix) ? parsed.data.pix : [];
    return [...pixItems, ...nestedPixItems, ...directCandidates].filter((item) => item && typeof item === "object");
}
class EfipayClient {
    clientId;
    clientSecret;
    pixKey;
    certP12Path;
    certP12Base64;
    certP12Passphrase;
    caPath;
    caBase64;
    baseUrl;
    pixExpirationSeconds;
    webhookPublicUrl;
    webhookPath;
    webhookSecret;
    webhookSkipMtls;
    appBaseUrl;
    autoSyncWebhook;
    accessTokenCache = {
        token: null,
        expiresAt: 0,
    };
    webhookSyncState = {
        attempted: false,
        inFlight: null,
        lastError: null,
    };
    constructor(options = {}) {
        this.applyConfig(options);
    }
    applyConfig(options = {}) {
        const previousFingerprint = this.getConfigFingerprint();
        this.clientId = options.clientId;
        this.clientSecret = options.clientSecret;
        this.pixKey = options.pixKey;
        this.certP12Path = options.certP12Path;
        this.certP12Base64 = normalizeBase64Binary(options.certP12Base64);
        this.certP12Passphrase = options.certP12Passphrase;
        this.caPath = options.caPath;
        this.caBase64 = normalizeBase64Binary(options.caBase64);
        this.baseUrl =
            options.baseUrl ??
                (options.sandbox ? "https://pix-h.api.efipay.com.br" : "https://pix.api.efipay.com.br");
        this.pixExpirationSeconds = options.pixExpirationSeconds ?? 1800;
        this.webhookPublicUrl = normalizeUrl(options.webhookPublicUrl);
        this.webhookPath = options.webhookPath ?? "/webhooks/efipay";
        this.webhookSecret = String(options.webhookSecret ?? "").trim() || null;
        this.webhookSkipMtls = options.webhookSkipMtls ?? true;
        this.appBaseUrl = normalizeUrl(options.appBaseUrl);
        this.autoSyncWebhook = options.autoSyncWebhook ?? true;
        const nextFingerprint = this.getConfigFingerprint();
        if (previousFingerprint !== nextFingerprint) {
            this.accessTokenCache = {
                token: null,
                expiresAt: 0,
            };
            this.webhookSyncState = {
                attempted: false,
                inFlight: null,
                lastError: null,
            };
        }
        return this.getConfigSnapshot();
    }
    getConfigFingerprint() {
        return JSON.stringify([
            this.clientId ?? null,
            this.clientSecret ?? null,
            this.pixKey ?? null,
            this.certP12Path ?? null,
            this.certP12Base64 ?? null,
            this.certP12Passphrase ?? null,
            this.caPath ?? null,
            this.caBase64 ?? null,
            this.baseUrl ?? null,
            this.pixExpirationSeconds ?? null,
            this.webhookPublicUrl ?? null,
            this.webhookPath ?? null,
            this.webhookSecret ?? null,
            this.webhookSkipMtls ?? null,
            this.appBaseUrl ?? null,
            this.autoSyncWebhook ?? null,
        ]);
    }
    getConfigSnapshot() {
        const certP12PathExists = Boolean(this.certP12Path && (0, node_fs_1.existsSync)(this.certP12Path));
        const caPathExists = Boolean(this.caPath && (0, node_fs_1.existsSync)(this.caPath));
        return {
            clientIdConfigured: Boolean(this.clientId),
            clientSecretConfigured: Boolean(this.clientSecret),
            pixKeyConfigured: Boolean(this.pixKey),
            certP12PathConfigured: Boolean(this.certP12Path),
            certP12PathExists,
            certP12Base64Configured: Boolean(this.certP12Base64),
            certP12Configured: Boolean(this.getPfxBuffer()),
            caPathConfigured: Boolean(this.caPath),
            caPathExists,
            caBase64Configured: Boolean(this.caBase64),
            caConfigured: Boolean(this.getCaBuffer()),
            baseUrl: this.baseUrl,
            pixExpirationSeconds: this.pixExpirationSeconds,
            webhookPublicUrl: this.webhookPublicUrl,
            webhookPath: this.webhookPath,
            webhookSecretConfigured: Boolean(this.webhookSecret),
            webhookSkipMtls: this.webhookSkipMtls,
            appBaseUrl: this.appBaseUrl,
            autoSyncWebhook: this.autoSyncWebhook,
        };
    }
    isConfigured() {
        const hasCredentials = Boolean(this.clientId && this.clientSecret);
        const usesPlainHttp = this.baseUrl.startsWith("http://");
        const hasCertificate = Boolean(this.getPfxBuffer());
        return hasCredentials && (usesPlainHttp || hasCertificate);
    }
    canCreatePixCharges() {
        return this.isConfigured() && Boolean(this.pixKey);
    }
    canRegisterWebhook() {
        return this.canCreatePixCharges() && Boolean(this.getResolvedWebhookBaseUrl());
    }
    getResolvedWebhookBaseUrl() {
        return this.webhookPublicUrl ?? this.appBaseUrl ?? null;
    }
    getResolvedWebhookSecret() {
        if (this.webhookSecret) {
            return this.webhookSecret;
        }
        const webhookBaseUrl = this.getResolvedWebhookBaseUrl();
        if (!webhookBaseUrl || !this.clientSecret || !this.pixKey) {
            return null;
        }
        return (0, node_crypto_1.createHash)("sha256")
            .update([
            this.clientId ?? "",
            this.clientSecret,
            this.pixKey,
            webhookBaseUrl,
            this.webhookPath,
        ].join("|"))
            .digest("hex")
            .slice(0, 32);
    }
    getWebhookRegistrationUrl() {
        const webhookBaseUrl = this.getResolvedWebhookBaseUrl();
        if (!webhookBaseUrl) {
            return null;
        }
        const url = new URL(this.webhookPath, webhookBaseUrl);
        const webhookSecret = this.getResolvedWebhookSecret();
        if (webhookSecret) {
            url.searchParams.set("hmac", webhookSecret);
        }
        url.searchParams.set("ignorar", "");
        return url.toString();
    }
    getWebhookStatus() {
        const webhookBaseUrl = this.getResolvedWebhookBaseUrl();
        const webhookSecret = this.getResolvedWebhookSecret();
        return {
            configured: this.isConfigured(),
            canCreatePixCharges: this.canCreatePixCharges(),
            canRegisterWebhook: this.canRegisterWebhook(),
            webhookPublicUrl: webhookBaseUrl,
            webhookPublicUrlReady: isPublicUrl(webhookBaseUrl),
            webhookRegistrationUrl: this.getWebhookRegistrationUrl(),
            webhookPath: this.webhookPath,
            webhookSecretManagedInternally: Boolean(webhookSecret && !this.webhookSecret),
            webhookDerivedFromAppBaseUrl: Boolean(!this.webhookPublicUrl && this.appBaseUrl),
            autoSyncWebhook: this.autoSyncWebhook,
            lastWebhookSyncError: this.webhookSyncState.lastError,
        };
    }
    validateWebhookHmac(rawValue) {
        const expected = this.getResolvedWebhookSecret();
        if (!expected) {
            return true;
        }
        const incoming = Array.isArray(rawValue) ? String(rawValue[0] ?? "") : String(rawValue ?? "");
        return incoming === expected;
    }
    async createPixCharge(input) {
        if (!this.canCreatePixCharges()) {
            throw new Error("Efipay nao configurada para cobranca Pix. Verifique credenciais, certificado e EFI_PIX_KEY.");
        }
        await this.autoRegisterWebhookIfNeeded();
        const accessToken = await this.getAccessToken();
        const payload = {
            calendario: {
                expiracao: this.pixExpirationSeconds,
            },
            valor: {
                original: (0, utils_js_1.formatAmountCentsToDecimalString)(input.amountCents),
            },
            chave: this.pixKey,
            solicitacaoPagador: String(input.description || "").trim().slice(0, 140),
        };
        return this.requestJson({
            method: "POST",
            pathname: "/v2/cob",
            body: payload,
            accessToken,
        });
    }
    async getPixCharge(txid) {
        const accessToken = await this.getAccessToken();
        return this.requestJson({
            method: "GET",
            pathname: `/v2/cob/${encodeURIComponent(txid)}`,
            accessToken,
        });
    }
    async getPixByEndToEndId(endToEndId) {
        const accessToken = await this.getAccessToken();
        return this.requestJson({
            method: "GET",
            pathname: `/v2/pix/${encodeURIComponent(endToEndId)}`,
            accessToken,
        });
    }
    async getPixQrCode(locationId) {
        const accessToken = await this.getAccessToken();
        return this.requestJson({
            method: "GET",
            pathname: `/v2/loc/${encodeURIComponent(String(locationId))}/qrcode`,
            accessToken,
        });
    }
    async getWebhook() {
        if (!this.pixKey) {
            throw new Error("EFI_PIX_KEY nao configurada para consultar webhook.");
        }
        const accessToken = await this.getAccessToken();
        return this.requestJson({
            method: "GET",
            pathname: `/v2/webhook/${encodeURIComponent(this.pixKey)}`,
            accessToken,
        });
    }
    async registerWebhook() {
        if (!this.pixKey) {
            throw new Error("EFI_PIX_KEY nao configurada para cadastrar webhook.");
        }
        const webhookUrl = this.getWebhookRegistrationUrl();
        if (!webhookUrl) {
            throw new Error("Nao foi possivel resolver a URL publica do webhook da Efipay. Defina APP_BASE_URL publico ou EFI_WEBHOOK_PUBLIC_URL.");
        }
        const accessToken = await this.getAccessToken();
        await this.requestJson({
            method: "PUT",
            pathname: `/v2/webhook/${encodeURIComponent(this.pixKey)}`,
            body: {
                webhookUrl,
            },
            accessToken,
            headers: {
                "x-skip-mtls-checking": this.webhookSkipMtls ? "true" : "false",
            },
        });
        this.webhookSyncState.attempted = true;
        this.webhookSyncState.lastError = null;
        return this.getWebhook();
    }
    async autoRegisterWebhookIfNeeded() {
        if (!this.autoSyncWebhook || !this.canRegisterWebhook()) {
            return null;
        }
        if (this.webhookSyncState.attempted) {
            return null;
        }
        if (this.webhookSyncState.inFlight) {
            return this.webhookSyncState.inFlight;
        }
        this.webhookSyncState.inFlight = this.registerWebhook()
            .catch((error) => {
            this.webhookSyncState.lastError = error.message;
            return null;
        })
            .finally(() => {
            this.webhookSyncState.attempted = true;
            this.webhookSyncState.inFlight = null;
        });
        return this.webhookSyncState.inFlight;
    }
    async resolveWebhookTxids(payload) {
        const parsed = (payload ?? {});
        const txids = new Set();
        const candidates = collectWebhookCandidates(parsed);
        for (const item of candidates) {
            const txid = String(item?.txid ?? parsed?.txid ?? parsed?.data?.txid ?? "").trim();
            if (txid) {
                txids.add(txid);
            }
        }
        if (txids.size > 0) {
            return [...txids];
        }
        const endToEndIds = new Set();
        for (const endToEndId of parsed.e2eids ?? []) {
            const normalized = String(endToEndId ?? "").trim();
            if (normalized) {
                endToEndIds.add(normalized);
            }
        }
        for (const endToEndId of parsed?.data?.e2eids ?? []) {
            const normalized = String(endToEndId ?? "").trim();
            if (normalized) {
                endToEndIds.add(normalized);
            }
        }
        for (const item of candidates) {
            const normalized = String(item?.endToEndId ?? item?.e2eid ?? "").trim();
            if (normalized) {
                endToEndIds.add(normalized);
            }
        }
        for (const endToEndId of endToEndIds) {
            const pix = await this.getPixByEndToEndId(String(endToEndId ?? "").trim());
            const txid = String(pix?.txid ?? "").trim();
            if (txid) {
                txids.add(txid);
            }
        }
        return [...txids];
    }
    async getAccessToken() {
        if (this.accessTokenCache.token && this.accessTokenCache.expiresAt > Date.now() + 30_000) {
            return this.accessTokenCache.token;
        }
        const response = await this.requestJson({
            method: "POST",
            pathname: "/oauth/token",
            body: {
                grant_type: "client_credentials",
            },
            useBasicAuth: true,
        });
        const accessToken = String(response.access_token ?? "").trim();
        if (!accessToken) {
            throw new Error("A Efipay nao retornou access_token.");
        }
        const expiresIn = Number(response.expires_in ?? 0);
        this.accessTokenCache = {
            token: accessToken,
            expiresAt: Date.now() + Math.max(0, expiresIn - 30) * 1000,
        };
        return accessToken;
    }
    requestJson(options) {
        if (!this.isConfigured()) {
            throw new Error("Efipay nao configurada. Defina credenciais e certificado.");
        }
        const url = new URL(options.pathname, `${this.baseUrl}/`);
        const body = options.body ? JSON.stringify(options.body) : "";
        const isHttps = url.protocol === "https:";
        const headers = {
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers ?? {}),
        };
        if (body) {
            headers["Content-Length"] = String(Buffer.byteLength(body));
        }
        if (options.accessToken) {
            headers.Authorization = `Bearer ${options.accessToken}`;
        }
        else if (options.useBasicAuth) {
            const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
            headers.Authorization = `Basic ${basicAuth}`;
        }
        const requestOptions = {
            method: options.method,
            hostname: url.hostname,
            port: url.port ? Number(url.port) : isHttps ? 443 : 80,
            path: `${url.pathname}${url.search}`,
            headers,
            ...(isHttps ? this.getTlsOptions() : {}),
        };
        return new Promise((resolve, reject) => {
            const requester = isHttps ? node_https_1.request : node_http_1.request;
            const req = requester(requestOptions, (response) => {
                const chunks = [];
                response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                response.on("end", () => {
                    const rawBody = Buffer.concat(chunks).toString("utf8");
                    const parsed = (0, utils_js_1.parseJsonSafe)(rawBody);
                    if ((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300) {
                        resolve((parsed ?? {}));
                        return;
                    }
                    const detailedError = parsed?.mensagem ??
                        parsed?.message ??
                        parsed?.erros?.map((item) => item?.mensagem).filter(Boolean).join(" | ") ??
                        rawBody ??
                        `HTTP ${response.statusCode}`;
                    reject(new Error(`Efipay respondeu ${response.statusCode}: ${detailedError}`));
                });
            });
            req.on("error", (error) => {
                reject(new Error(`Falha ao comunicar com a Efipay: ${error.message}`));
            });
            req.setTimeout(20_000, () => {
                req.destroy(new Error("timeout"));
            });
            if (body) {
                req.write(body);
            }
            req.end();
        });
    }
    getTlsOptions() {
        const pfx = this.getPfxBuffer();
        if (!pfx) {
            throw new Error("Certificado .p12 da Efipay nao encontrado. Defina EFI_CERT_P12_PATH.");
        }
        return {
            pfx,
            passphrase: this.certP12Passphrase || undefined,
            ...(this.getCaBuffer() ? { ca: this.getCaBuffer() } : {}),
            rejectUnauthorized: true,
        };
    }
    getPfxBuffer() {
        if (this.certP12Base64) {
            return Buffer.from(this.certP12Base64, "base64");
        }
        if (this.certP12Path && (0, node_fs_1.existsSync)(this.certP12Path)) {
            return (0, node_fs_1.readFileSync)(this.certP12Path);
        }
        return null;
    }
    getCaBuffer() {
        if (this.caBase64) {
            return Buffer.from(this.caBase64, "base64");
        }
        if (this.caPath && (0, node_fs_1.existsSync)(this.caPath)) {
            return (0, node_fs_1.readFileSync)(this.caPath);
        }
        return null;
    }
}
exports.EfipayClient = EfipayClient;
