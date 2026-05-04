"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquareCloudClient = void 0;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function getRequestTimeoutMs(path, method) {
    const isUploadOrCommit = path === "/apps" || /\/apps\/[^/]+\/commit$/u.test(String(path ?? ""));
    const envName = isUploadOrCommit ? "SQUARECLOUD_UPLOAD_TIMEOUT_MS" : "SQUARECLOUD_REQUEST_TIMEOUT_MS";
    const fallback = isUploadOrCommit ? 90_000 : 30_000;
    return Math.max(5_000, Number(process.env[envName] ?? fallback) || fallback);
}
function isRetryableSquareCloudStatus(status) {
    return [408, 409, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(Number(status));
}
function sanitizeHtmlDetail(rawBody) {
    const raw = String(rawBody ?? "").trim();
    if (!raw) {
        return "";
    }
    if (!/^<!doctype html|^<html[\s>]/iu.test(raw)) {
        return raw;
    }
    const titleMatch = raw.match(/<title>(.*?)<\/title>/isu);
    const title = titleMatch?.[1]
        ? titleMatch[1].replace(/\s+/gu, " ").trim()
        : "pagina HTML";
    return `A SquareCloud/Cloudflare retornou ${title}. Tente novamente em alguns segundos.`;
}
class SquareCloudClient {
    apiKey;
    accountId;
    baseUrl;
    constructor(options = {}) {
        this.apiKey = options.apiKey;
        this.accountId = options.accountId;
        this.baseUrl = options.baseUrl ?? "https://api.squarecloud.app/v2";
    }
    isConfigured() {
        return Boolean(this.apiKey);
    }
    getAccountId() {
        return this.accountId ?? null;
    }
    async getAppInfo(appId) {
        return this.request(`/apps/${appId}`);
    }
    async getAppStatus(appId) {
        return this.request(`/apps/${appId}/status`);
    }
    async getAppLogs(appId) {
        return this.request(`/apps/${appId}/logs`);
    }
    async uploadApplication(fileBuffer, fileName = "app.zip") {
        return this.request("/apps", () => {
            const form = new FormData();
            const blob = new Blob([fileBuffer], { type: "application/zip" });
            form.append("file", blob, fileName);
            return {
                method: "POST",
                body: form,
            };
        });
    }
    async commitApplication(appId, fileBuffer, fileName = "app.zip") {
        return this.request(`/apps/${appId}/commit`, () => {
            const form = new FormData();
            const blob = new Blob([fileBuffer], { type: "application/zip" });
            form.append("file", blob, fileName);
            return {
                method: "POST",
                body: form,
            };
        });
    }
    async startApp(appId) {
        return this.request(`/apps/${appId}/start`, {
            method: "POST",
        });
    }
    async stopApp(appId) {
        return this.request(`/apps/${appId}/stop`, {
            method: "POST",
        });
    }
    async restartApp(appId) {
        return this.request(`/apps/${appId}/restart`, {
            method: "POST",
        });
    }
    normalizeEnvEntries(envs) {
        return Object.fromEntries(Object.entries(envs ?? {})
            .filter(([key, value]) => String(key ?? "").trim() && value !== undefined && value !== null)
            .map(([key, value]) => [String(key).trim(), this.normalizeEnvValue(value)]));
    }
    normalizeEnvValue(value) {
        const normalized = String(value);
        return /[\s"'`\\#]/u.test(normalized) ? JSON.stringify(normalized) : normalized;
    }
    async deleteApp(appId) {
        return this.request(`/apps/${appId}`, {
            method: "DELETE",
        });
    }
    async setAppEnvVars(appId, envs) {
        const payload = JSON.stringify({
            envs: this.normalizeEnvEntries(envs),
        });
        try {
            return await this.request(`/apps/${appId}/envs`, {
                method: "PUT",
                body: payload,
            });
        }
        catch (error) {
            const code = String(error?.code ?? "").trim().toUpperCase();
            const status = Number(error?.status ?? 0) || 0;
            if (status !== 404 && code !== "METHOD_NOT_ALLOWED") {
                throw error;
            }
        }
        return this.request(`/apps/${appId}/envs`, {
            method: "POST",
            body: payload,
        });
    }
    async request(path, init) {
        if (!this.apiKey) {
            throw new Error("SQUARECLOUD_API_KEY não configurada.");
        }
        const method = String(typeof init === "function" ? "POST" : init?.method ?? "GET").toUpperCase();
        const isMutation = typeof init === "function" || ["POST", "PUT", "PATCH", "DELETE"].includes(method);
        const isUploadOrCommit = path === "/apps" || /\/apps\/[^/]+\/commit$/u.test(String(path ?? ""));
        const maxAttempts = isUploadOrCommit
            ? Math.max(6, Number(process.env.SQUARECLOUD_UPLOAD_RETRY_ATTEMPTS ?? 8) || 8)
            : isMutation
                ? Math.max(3, Number(process.env.SQUARECLOUD_MUTATION_RETRY_ATTEMPTS ?? 3) || 3)
                : 2;
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                return await this.requestOnce(path, typeof init === "function" ? init() : init);
            }
            catch (error) {
                lastError = error;
                const status = Number(error?.status ?? 0) || 0;
                if (attempt >= maxAttempts || !isRetryableSquareCloudStatus(status)) {
                    throw error;
                }
                const baseDelayMs = isUploadOrCommit ? 5000 : 1200;
                await wait(Math.min(isUploadOrCommit ? 60_000 : 10_000, baseDelayMs * attempt * attempt));
            }
        }
        throw lastError;
    }
    async requestOnce(path, init) {
        const method = String(init?.method ?? "GET").toUpperCase();
        const timeoutMs = getRequestTimeoutMs(path, method);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        timeout.unref?.();
        let response;
        try {
            response = await fetch(`${this.baseUrl}${path}`, {
                ...init,
                signal: controller.signal,
                headers: {
                    Authorization: this.apiKey,
                    ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
                    ...(init?.headers ?? {}),
                },
            });
        }
        catch (error) {
            if (error?.name === "AbortError") {
                const timeoutError = new Error(`Square Cloud excedeu ${timeoutMs}ms para ${path}.`);
                timeoutError.status = 408;
                timeoutError.path = path;
                timeoutError.code = "REQUEST_TIMEOUT";
                throw timeoutError;
            }
            throw error;
        }
        finally {
            clearTimeout(timeout);
        }
        if (!response.ok) {
            const rawBody = await response.text().catch(() => "");
            let parsedBody = null;
            try {
                parsedBody = rawBody ? JSON.parse(rawBody) : null;
            }
            catch {
                parsedBody = null;
            }
            const code = String(parsedBody?.code ?? "").trim();
            const rawDetail = String(parsedBody?.message ?? parsedBody?.error ?? sanitizeHtmlDetail(rawBody) ?? "").trim();
            const detail = rawDetail.length > 700 ? `${rawDetail.slice(0, 700)}...` : rawDetail;
            const suffix = [
                code ? `code=${code}` : "",
                detail ? `detail=${detail}` : "",
            ].filter(Boolean).join(" | ");
            const error = new Error([
                `Square Cloud respondeu ${response.status} para ${path}.`,
                suffix,
            ].filter(Boolean).join(" "));
            error.status = response.status;
            error.path = path;
            error.code = code || null;
            error.body = parsedBody ?? rawBody;
            throw error;
        }
        return (await response.json());
    }
}
exports.SquareCloudClient = SquareCloudClient;
