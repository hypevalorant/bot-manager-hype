"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadEnvFile } = require("../dist/core/env.js");
function collectJavaScriptFiles(rootDir) {
    const files = [];
    const stack = [rootDir];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
            continue;
        }
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const absolutePath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(absolutePath);
                continue;
            }
            if (entry.isFile() && absolutePath.endsWith(".js")) {
                files.push(absolutePath);
            }
        }
    }
    files.sort((left, right) => left.localeCompare(right));
    return files;
}
async function main() {
    const distDir = path.resolve(__dirname, "..", "dist");
    if (!fs.existsSync(distDir)) {
        throw new Error("Pasta dist nao encontrada.");
    }
    for (const filePath of collectJavaScriptFiles(distDir)) {
        const source = fs.readFileSync(filePath, "utf8");
        new vm.Script(source, { filename: filePath });
    }
    loadEnvFile();
    process.env.DATABASE_URL = "";
    process.env.DATABASE_SSL = "false";
    const { createServices } = require("../dist/app.js");
    const services = await createServices();
    const products = services.catalogService.listProducts();
    if (!Array.isArray(products) || products.length === 0) {
        throw new Error("Catalogo vazio ou invalido.");
    }
    if (typeof services.store?.close === "function") {
        await services.store.close();
    }
    process.stdout.write(`Runtime validado com ${products.length} produto(s).\n`);
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
