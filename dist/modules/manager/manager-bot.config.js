"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManagerBotConfigFromEnv = getManagerBotConfigFromEnv;
exports.getManagerBotConfigStatus = getManagerBotConfigStatus;
function readEnvValue(envKey) {
    const value = String(process.env[envKey] ?? "").trim();
    return value || null;
}
function getManagerBotConfigFromEnv() {
    return {
        token: readEnvValue("MANAGER_BOT_TOKEN"),
        guildId: readEnvValue("MANAGER_BOT_GUILD_ID"),
        registerCommands: String(process.env.MANAGER_BOT_REGISTER_COMMANDS ?? "true").toLowerCase() !== "false",
    };
}
function getManagerBotConfigStatus() {
    const config = getManagerBotConfigFromEnv();
    const notes = [];
    if (!config.token) {
        notes.push("Defina MANAGER_BOT_TOKEN para ligar o bot manager do Discord.");
    }
    else if (!config.registerCommands) {
        notes.push("O bot manager vai conectar, mas o registro automatico de slash commands esta desligado.");
    }
    else if (config.guildId) {
        notes.push("Os slash commands serao registrados no servidor informado em MANAGER_BOT_GUILD_ID.");
    }
    else {
        notes.push("Os slash commands serao globais e podem levar alguns minutos para aparecer no Discord.");
    }
    notes.push("O primeiro acesso administrativo fica com o dono da aplicacao do bot.");
    notes.push("Depois disso, use /perm adicionar dentro do Discord para liberar outros usuarios.");
    return {
        enabled: Boolean(config.token),
        tokenConfigured: Boolean(config.token),
        guildIdConfigured: Boolean(config.guildId),
        commandRegistrationMode: !config.token || !config.registerCommands
            ? "disabled"
            : config.guildId
                ? "guild"
                : "global",
        notes,
    };
}
