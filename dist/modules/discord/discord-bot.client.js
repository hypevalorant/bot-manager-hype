"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordBotClient = void 0;
const utils_js_1 = require("../../core/utils.js");
const APPLICATION_FLAG_GATEWAY_PRESENCE = 1 << 12;
const APPLICATION_FLAG_GATEWAY_PRESENCE_LIMITED = 1 << 13;
const APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS = 1 << 14;
const APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS_LIMITED = 1 << 15;
const APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT = 1 << 18;
const APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT_LIMITED = 1 << 19;
class DiscordBotClient {
    baseUrl;
    defaultPermissions;
    constructor(options) {
        this.baseUrl = options.baseUrl ?? "https://discord.com/api/v10";
        this.defaultPermissions = options.defaultPermissions;
    }
    async inspectBotToken(botToken) {
        const token = String(botToken ?? "").trim();
        if (!token) {
            throw new Error("Token do bot obrigatorio.");
        }
        const [application, currentUser] = await Promise.all([
            this.request("/oauth2/applications/@me", token),
            this.request("/users/@me", token),
        ]);
        const flags = Number(application.flags ?? 0);
        return {
            applicationId: String(application.id),
            clientId: String(application.id),
            applicationName: String(application.name || currentUser.username || "Discord App").trim(),
            applicationDescription: String(application.description ?? "").trim(),
            botUserId: String(application.bot?.id || currentUser.id),
            botUsername: String(currentUser.username || application.bot?.username || application.name).trim(),
            flags,
            enabledPrivilegedIntents: {
                guild_presences: this.hasAnyFlag(flags, [
                    APPLICATION_FLAG_GATEWAY_PRESENCE,
                    APPLICATION_FLAG_GATEWAY_PRESENCE_LIMITED,
                ]),
                guild_members: this.hasAnyFlag(flags, [
                    APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS,
                    APPLICATION_FLAG_GATEWAY_GUILD_MEMBERS_LIMITED,
                ]),
                message_content: this.hasAnyFlag(flags, [
                    APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT,
                    APPLICATION_FLAG_GATEWAY_MESSAGE_CONTENT_LIMITED,
                ]),
            },
            inviteUrl: (0, utils_js_1.buildInstallUrl)({
                clientId: String(application.id),
                permissions: this.defaultPermissions,
            }),
        };
    }
    async updateBotUsername(botToken, desiredName) {
        const username = (0, utils_js_1.normalizeHumanTitle)(desiredName);
        if (!username) {
            throw new Error("Nome da aplicacao obrigatorio.");
        }
        return this.request("/users/@me", botToken, {
            method: "PATCH",
            body: JSON.stringify({
                username,
            }),
        });
    }
    async updateApplicationDescription(botToken, description) {
        return this.request("/applications/@me", botToken, {
            method: "PATCH",
            body: JSON.stringify({
                description: String(description ?? "").trim(),
            }),
        });
    }
    hasAnyFlag(flags, candidates) {
        return candidates.some((candidate) => (flags & candidate) === candidate);
    }
    async request(path, botToken, init = {}) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: {
                Authorization: `Bot ${String(botToken).trim()}`,
                "Content-Type": "application/json",
                ...(init.headers ?? {}),
            },
        });
        if (!response.ok) {
            const bodyText = await response.text().catch(() => "");
            if (response.status === 401 || response.status === 403) {
                throw new Error("Token do bot invalido ou sem permissao para consulta.");
            }
            throw new Error(`Discord respondeu ${response.status} para ${path}${bodyText ? `: ${bodyText}` : "."}`);
        }
        return (await response.json());
    }
}
exports.DiscordBotClient = DiscordBotClient;
