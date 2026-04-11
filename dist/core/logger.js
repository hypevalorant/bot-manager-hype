"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppLogger = createAppLogger;
function formatTimestamp(date = new Date()) {
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Sao_Paulo",
    }).format(date);
}
function replacer(_key, value) {
    if (value instanceof Error) {
        return {
            message: value.message,
            stack: value.stack,
        };
    }
    if (typeof value === "bigint") {
        return value.toString();
    }
    return value;
}
function serializePayload(payload) {
    if (payload === undefined || payload === null) {
        return "";
    }
    if (typeof payload === "string") {
        return payload.trim();
    }
    try {
        const serialized = JSON.stringify(payload, replacer);
        return serialized.length > 1200 ? `${serialized.slice(0, 1197)}...` : serialized;
    }
    catch {
        return String(payload);
    }
}
function normalizeArgs(first, second) {
    if (second !== undefined) {
        return {
            payload: first,
            message: String(second ?? "").trim(),
        };
    }
    if (typeof first === "string") {
        return {
            payload: null,
            message: first.trim(),
        };
    }
    if (first instanceof Error) {
        return {
            payload: { error: first.message, stack: first.stack },
            message: first.message,
        };
    }
    return {
        payload: first,
        message: "",
    };
}
function writeLog(level, scope, first, second) {
    const { payload, message } = normalizeArgs(first, second);
    const payloadText = serializePayload(payload);
    const line = [
        `[${formatTimestamp()}]`,
        `[${level}]`,
        scope ? `[${scope}]` : "",
        message || "log",
        payloadText ? `| ${payloadText}` : "",
    ].filter(Boolean).join(" ");
    if (level === "ERROR") {
        console.error(line);
        return;
    }
    if (level === "WARN") {
        console.warn(line);
        return;
    }
    console.log(line);
}
function createAppLogger(scope = "app") {
    return {
        info(first, second) {
            writeLog("INFO", scope, first, second);
        },
        warn(first, second) {
            writeLog("WARN", scope, first, second);
        },
        error(first, second) {
            writeLog("ERROR", scope, first, second);
        },
        child(bindings = {}) {
            const suffix = serializePayload(bindings);
            return createAppLogger(suffix ? `${scope} ${suffix}` : scope);
        },
    };
}
