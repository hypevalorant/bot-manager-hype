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
    async deleteApp(appId) {
        return this.request(`/apps/${appId}`, {
            method: "DELETE",
        });
    }
    async setAppEnvVars(appId, envs) {
        return this.request(`/apps/${appId}/envs`, {
            method: "POST",
            body: JSON.stringify({
                envs,
            }),
        });
    }
    async request(path, init) {
        if (!this.apiKey) {
            throw new Error("SQUARECLOUD_API_KEY nao configurada.");
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
            throw new Error(`Square Cloud respondeu ${response.status} para ${path}.`);
        }
        return (await response.json());
    }
}
exports.SquareCloudClient = SquareCloudClient;
