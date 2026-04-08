"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvFile = loadEnvFile;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function normalizeEnvValue(value) {
    const trimmed = value.trim();
    const hasMatchingQuotes = (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"));
    if (!hasMatchingQuotes) {
        return trimmed;
    }
    return trimmed.slice(1, -1);
}
function loadEnvFile(filePath = ".env") {
    const resolvedPath = (0, node_path_1.resolve)(process.cwd(), filePath);
    if (!(0, node_fs_1.existsSync)(resolvedPath)) {
        return;
    }
    const content = (0, node_fs_1.readFileSync)(resolvedPath, "utf8");
    for (const rawLine of content.split(/\r?\n/u)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }
        const separatorIndex = line.indexOf("=");
        if (separatorIndex <= 0) {
            continue;
        }
        const key = line.slice(0, separatorIndex).trim();
        if (!key || process.env[key] !== undefined) {
            continue;
        }
        const value = line.slice(separatorIndex + 1);
        process.env[key] = normalizeEnvValue(value);
    }
}
