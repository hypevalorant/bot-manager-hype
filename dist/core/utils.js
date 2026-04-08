"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nowIso = nowIso;
exports.makeId = makeId;
exports.makeSecret = makeSecret;
exports.addPeriod = addPeriod;
exports.addDays = addDays;
exports.addMinutes = addMinutes;
exports.buildInstallUrl = buildInstallUrl;
exports.formatAmountCentsToDecimalString = formatAmountCentsToDecimalString;
exports.parseJsonSafe = parseJsonSafe;
exports.normalizeEnvKeyPart = normalizeEnvKeyPart;
exports.isPlaceholderBotToken = isPlaceholderBotToken;
exports.secondsUntil = secondsUntil;
exports.normalizeHumanTitle = normalizeHumanTitle;
const node_crypto_1 = require("node:crypto");
function nowIso() {
    return new Date().toISOString();
}
function makeId() {
    return (0, node_crypto_1.randomUUID)();
}
function makeSecret() {
    return (0, node_crypto_1.randomBytes)(24).toString("hex");
}
function addPeriod(baseDate, interval, count = 1) {
    const next = new Date(baseDate);
    if (interval === "weekly") {
        next.setUTCDate(next.getUTCDate() + 7 * count);
        return next;
    }
    next.setUTCMonth(next.getUTCMonth() + count);
    return next;
}
function addDays(baseDate, days) {
    const next = new Date(baseDate);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}
function addMinutes(baseDate, minutes) {
    const next = new Date(baseDate);
    next.setUTCMinutes(next.getUTCMinutes() + minutes);
    return next;
}
function buildInstallUrl(input) {
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", input.clientId);
    url.searchParams.set("permissions", input.permissions);
    url.searchParams.set("integration_type", "0");
    url.searchParams.set("scope", (input.scope ?? ["bot", "applications.commands"]).join(" "));
    return url.toString();
}
function formatAmountCentsToDecimalString(amountCents) {
    return (amountCents / 100).toFixed(2);
}
function parseJsonSafe(raw) {
    try {
        return JSON.parse(raw.replace(/^\uFEFF/u, ""));
    }
    catch {
        return null;
    }
}
function normalizeEnvKeyPart(value) {
    return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}
function isPlaceholderBotToken(value) {
    const normalized = String(value ?? "").trim().toUpperCase();
    return (!normalized ||
        normalized.startsWith("SEU_") ||
        normalized.includes("TOKEN_AQUI") ||
        normalized.includes("YOUR_"));
}
function secondsUntil(isoDate, referenceDate = new Date()) {
    if (!isoDate) {
        return 0;
    }
    const target = Date.parse(isoDate);
    if (!Number.isFinite(target)) {
        return 0;
    }
    return Math.max(0, Math.ceil((target - referenceDate.getTime()) / 1000));
}
function normalizeHumanTitle(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80);
}
