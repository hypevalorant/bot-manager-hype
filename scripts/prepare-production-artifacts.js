"use strict";
const { loadEnvFile } = require("../dist/core/env.js");
const { buildSeedStoreState } = require("../dist/core/store.js");
const { SourceArtifactService } = require("../dist/modules/hosting/source-artifact.service.js");
loadEnvFile();
async function main() {
    const artifactService = new SourceArtifactService();
    const seed = buildSeedStoreState();
    const sourceSlugs = [...new Set(seed.products.map((product) => product.sourceSlug))];
    for (const sourceSlug of sourceSlugs) {
        const resolution = artifactService.resolveArtifact(sourceSlug);
        if (resolution.mode === "missing") {
            process.stdout.write(`[artifact:warn] ${sourceSlug}: ${resolution.error ?? "sem artefato configurado"}\n`);
            continue;
        }
        const artifact = await artifactService.getArtifact(sourceSlug);
        process.stdout.write(`[artifact] ${sourceSlug}: ${artifact.path}\n`);
    }
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
