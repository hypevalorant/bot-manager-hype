"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquareCloudClient = void 0;
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
        const form = new FormData();
        const blob = new Blob([fileBuffer], { type: "application/zip" });
        form.append("file", blob, fileName);
        return this.request("/apps", {
            method: "POST",
            body: form,
        });
    }
    async commitApplication(appId, fileBuffer, fileName = "app.zip") {
        const form = new FormData();
        const blob = new Blob([fileBuffer], { type: "application/zip" });
        form.append("file", blob, fileName);
        return this.request(`/apps/${appId}/commit`, {
            method: "POST",
            body: form,
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
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: {
                Authorization: this.apiKey,
                ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
                ...(init?.headers ?? {}),
            },
        });
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
            const detail = String(parsedBody?.message ?? parsedBody?.error ?? rawBody ?? "").trim();
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
