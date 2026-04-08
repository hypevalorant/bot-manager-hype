"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_js_1 = require("./core/env.js");
const app_js_1 = require("./app.js");
const manager_bot_config_js_1 = require("./modules/manager/manager-bot.config.js");
const manager_bot_service_js_1 = require("./modules/manager/manager-bot.service.js");
(0, env_js_1.loadEnvFile)();
async function main() {
    const services = await (0, app_js_1.createServices)();
    const app = await (0, app_js_1.buildApp)(services);
    const managerBotService = new manager_bot_service_js_1.ManagerBotService({
        billingService: services.billingService,
        catalogService: services.catalogService,
        instanceService: services.instanceService,
        managerRuntimeConfigService: services.managerRuntimeConfigService,
        purchaseSetupService: services.purchaseSetupService,
        sourceArtifactService: services.sourceArtifactService,
        squareCloudClient: services.squareCloudClient,
        store: services.store,
        subscriptionService: services.subscriptionService,
    }, (0, manager_bot_config_js_1.getManagerBotConfigFromEnv)());
    const port = Number(process.env.PORT ?? 80);
    const host = process.env.HOST ?? "0.0.0.0";
    const expirationCheckIntervalMs = Math.max(0, Number(process.env.EXPIRATION_CHECK_INTERVAL_SECONDS ?? 300) * 1000);
    let expirationTimer = null;
    let shuttingDown = false;
    const runExpirationCycle = async () => {
        try {
            const changes = await services.subscriptionService.runExpirationCycle(new Date());
            if (changes.length > 0) {
                app.log.info({ changes }, "Ciclo automatico de expiracao aplicou alteracoes.");
            }
            if (typeof services.store?.flush === "function") {
                await services.store.flush();
            }
        }
        catch (error) {
            app.log.warn({ error }, "Falha no ciclo automatico de expiracao.");
        }
    };
    const shutdown = async (signal) => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        if (expirationTimer) {
            clearInterval(expirationTimer);
            expirationTimer = null;
        }
        app.log.info({ signal }, "Encerrando API e manager bot.");
        await managerBotService.stop().catch((error) => {
            app.log.warn({ error }, "Falha ao encerrar manager bot.");
        });
        await app.close().catch((error) => {
            app.log.warn({ error }, "Falha ao encerrar API.");
        });
        if (typeof services.store?.close === "function") {
            await services.store.close().catch((error) => {
                app.log.warn({ error }, "Falha ao encerrar persistencia do manager.");
            });
        }
    };
    process.once("SIGINT", () => {
        void shutdown("SIGINT");
    });
    process.once("SIGTERM", () => {
        void shutdown("SIGTERM");
    });
    try {
        await app.listen({ port, host });
        await managerBotService.start(app.log);
        if (expirationCheckIntervalMs > 0) {
            expirationTimer = setInterval(() => {
                void runExpirationCycle();
            }, expirationCheckIntervalMs);
            expirationTimer.unref?.();
            app.log.info({
                intervalSeconds: Math.floor(expirationCheckIntervalMs / 1000),
            }, "Scheduler automatico de expiracao iniciado.");
        }
    }
    catch (error) {
        app.log.error(error);
        await shutdown("startup_error");
        process.exit(1);
    }
}
void main();
