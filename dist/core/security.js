"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePaymentOrAdminAccess = requirePaymentOrAdminAccess;
exports.requireAdminAccess = requireAdminAccess;
exports.SecurityError = void 0;
const node_crypto_1 = require("node:crypto");
class SecurityError extends Error {
    statusCode;
    constructor(message, statusCode = 401) {
        super(message);
        this.statusCode = statusCode;
        this.name = "SecurityError";
    }
}
exports.SecurityError = SecurityError;
function readEnvValue(envKey) {
    const value = String(process.env[envKey] ?? "").trim();
    return value || null;
}
function isProduction() {
    return String(process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";
}
function getAdminToken() {
    return readEnvValue("ADMIN_API_TOKEN");
}
function getPresentedTokens(request, extraTokens = []) {
    const authorization = String(request.headers.authorization ?? "").trim();
    const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;
    const adminToken = String(request.headers["x-admin-token"] ?? "").trim() || null;
    const paymentToken = String(request.headers["x-payment-token"] ?? "").trim() || null;
    const queryToken = String(request.query?.token ?? "").trim() || null;
    return [
        bearerToken,
        adminToken,
        paymentToken,
        queryToken,
        ...extraTokens,
    ].filter(Boolean);
}
function secureEqual(left, right) {
    const leftBuffer = Buffer.from(String(left ?? ""), "utf8");
    const rightBuffer = Buffer.from(String(right ?? ""), "utf8");
    if (leftBuffer.length !== rightBuffer.length || leftBuffer.length === 0) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(leftBuffer, rightBuffer);
}
function requireAdminAccess(request) {
    const adminToken = getAdminToken();
    if (!adminToken) {
        if (isProduction()) {
            throw new SecurityError("ADMIN_API_TOKEN nao configurado para proteger as rotas administrativas.", 503);
        }
        return {
            scope: "development_bypass",
        };
    }
    const tokens = getPresentedTokens(request);
    if (tokens.some((token) => secureEqual(token, adminToken))) {
        return {
            scope: "admin",
        };
    }
    throw new SecurityError("Token administrativo invalido ou ausente.", 401);
}
function requirePaymentOrAdminAccess(request, payment) {
    const paymentToken = String(payment?.accessToken ?? "").trim();
    if (paymentToken) {
        const tokens = getPresentedTokens(request);
        if (tokens.some((token) => secureEqual(token, paymentToken))) {
            return {
                scope: "payment",
            };
        }
    }
    return requireAdminAccess(request);
}
