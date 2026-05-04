"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_js_1 = require("./core/env.js");
const app_js_1 = require("./app.js");
const logger_js_1 = require("./core/logger.js");
const manager_bot_config_js_1 = require("./modules/manager/manager-bot.config.js");
const manager_bot_service_js_1 = require("./modules/manager/manager-bot.service.js");
(0, env_js_1.loadEnvFile)();
async function main() {
    const services = await (0, app_js_1.createServices)();
    const logger = (0, logger_js_1.createAppLogger)("Bot Manager Hype");
    const app = await (0, app_js_1.buildApp)(services, logger);
    const managerBotService = new manager_bot_service_js_1.ManagerBotService({
        billingService: services.billingService,
        catalogService: services.catalogService,
        discordBotClient: services.discordBotClient,
        instanceService: services.instanceService,
        managerRuntimeConfigService: services.managerRuntimeConfigService,
        purchaseSetupService: services.purchaseSetupService,
        sourceArtifactService: services.sourceArtifactService,
        squareCloudClient: services.squareCloudClient,
        squareCloudProvisioningService: services.squareCloudProvisioningService,
        store: services.store,
        subscriptionService: services.subscriptionService,
    }, (0, manager_bot_config_js_1.getManagerBotConfigFromEnv)());
    services.managerBotService = managerBotService;
    if (typeof services.billingService.onPaymentApproved === "function") {
        services.billingService.onPaymentApproved(async (payment) => {
            if (typeof services.store?.flush === "function") {
                await services.store.flush().catch(() => null);
            }
            await managerBotService.syncApprovedPaymentToCart(payment.id).catch(() => null);
        });
    }
    const port = Number(process.env.PORT ?? 80);
    const host = process.env.HOST ?? "0.0.0.0";
    const expirationCheckIntervalMs = Math.max(0, Number(process.env.EXPIRATION_CHECK_INTERVAL_SECONDS ?? 300) * 1000);
    const provisioningCheckIntervalMs = Math.max(0, Number(process.env.PROVISIONING_MANAGER_INTERVAL_SECONDS ?? 45) * 1000);
    const provisioningMaxJobsPerCycle = Math.max(1, Number(process.env.PROVISIONING_MANAGER_MAX_JOBS ?? 1) || 1);
    const externalDispatchGraceMs = Math.max(30, Number(process.env.PROVISIONING_EXTERNAL_DISPATCH_GRACE_SECONDS ?? 120) || 120) * 1000;
    let expirationTimer = null;
    let provisioningTimer = null;
    let provisioningCycleRunning = false;
    let shuttingDown = false;
    const isExternalProvisioningMode = () => {
        const mode = String(process.env.SQUARECLOUD_PROVISIONING_MODE ?? process.env.PROVISIONING_MODE ?? "").trim().toLowerCase();
        return ["external", "worker", "queue", "queued", "external_only", "worker_only", "queue_only", "queued_only"].includes(mode) ||
            String(process.env.EXTERNAL_PROVISIONING_ENABLED ?? "").trim().toLowerCase() === "true";
    };
    const runExpirationCycle = async () => {
        try {
            const changes = await services.subscriptionService.runExpirationCycle(new Date());
            if (changes.length > 0) {
                logger.info({ changes }, "Ciclo automatico de expiracao aplicou alteracoes.");
            }
            if (typeof services.store?.flush === "function") {
                await services.store.flush();
            }
        }
        catch (error) {
            logger.warn({ error: error?.message ?? String(error) }, "Falha no ciclo automatico de expiracao.");
        }
    };
    const runProvisioningCycle = async () => {
        if (provisioningCycleRunning || !services.squareCloudProvisioningService?.isConfigured?.()) {
            return;
        }
        provisioningCycleRunning = true;
        try {
            const jobs = Array.isArray(services.store.provisioningJobs) ? services.store.provisioningJobs : [];
            services.store.provisioningJobs = jobs;
            const now = new Date();
            const activeInstanceIds = new Set(jobs
                .filter((job) => ["queued", "retry", "processing"].includes(String(job?.status ?? "").toLowerCase()))
                .map((job) => String(job.instanceId ?? "").trim())
                .filter(Boolean));
            for (const instance of Array.isArray(services.store.instances) ? services.store.instances : []) {
                const hostingAppId = String(instance?.hostingAppId ?? "").trim();
                const status = String(instance?.status ?? "").trim().toLowerCase();
                if (!hostingAppId.startsWith("pending-") || activeInstanceIds.has(instance.id) || ["deleted", "suspended"].includes(status)) {
                    continue;
                }
                const discordApp = services.store.discordApps.find((entry) => entry.id === instance.discordAppId);
                if (!discordApp?.botToken) {
                    continue;
                }
                services.instanceService.enqueueProvisioningJob(instance, discordApp, "manager_auto_recovered_pending");
                activeInstanceIds.add(instance.id);
            }
            if (isExternalProvisioningMode()) {
                let waitingForExternalWorker = false;
                for (const job of jobs.filter((entry) => ["queued", "retry"].includes(String(entry?.status ?? "").toLowerCase()))) {
                    const lastDispatchAt = Date.parse(String(job.lastDispatchAt ?? 0)) || 0;
                    const dispatchStatus = String(job.lastDispatchStatus ?? "").toLowerCase();
                    const recentlyDispatched = dispatchStatus === "dispatched" &&
                        lastDispatchAt > 0 &&
                        now.getTime() - lastDispatchAt < externalDispatchGraceMs;
                    if (recentlyDispatched) {
                        waitingForExternalWorker = true;
                        continue;
                    }
                    const dispatched = await services.instanceService.triggerProvisioningWorker(job).catch(() => false);
                    if (dispatched) {
                        waitingForExternalWorker = true;
                    }
                }
                await services.store.flush?.().catch(() => null);
                if (waitingForExternalWorker) {
                    return;
                }
                logger.warn("Worker externo de provisionamento indisponivel; usando fallback direto no manager.");
            }
            const dueJobs = jobs
                .filter((job) => ["queued", "retry", "processing"].includes(String(job?.status ?? "").toLowerCase()))
                .filter((job) => {
                const nextRunAt = Date.parse(String(job.nextRunAt ?? job.createdAt ?? 0)) || 0;
                const lockExpiresAt = Date.parse(String(job.lockExpiresAt ?? 0)) || 0;
                const status = String(job.status ?? "").toLowerCase();
                return nextRunAt <= now.getTime() && (status !== "processing" || lockExpiresAt <= now.getTime());
            })
                .sort((left, right) => Date.parse(String(left.nextRunAt ?? left.createdAt ?? 0)) - Date.parse(String(right.nextRunAt ?? right.createdAt ?? 0)))
                .slice(0, provisioningMaxJobsPerCycle);
            for (const job of dueJobs) {
                const instance = services.instanceService.getById(job.instanceId);
                const discordApp = services.store.discordApps.find((entry) => entry.id === job.discordAppId || entry.id === instance?.discordAppId);
                if (!instance || !discordApp?.botToken || ["deleted", "suspended"].includes(String(instance?.status ?? "").toLowerCase())) {
                    job.status = "failed";
                    job.lastError = "Instancia ou app Discord indisponivel para provisionamento automatico.";
                    job.updatedAt = new Date().toISOString();
                    continue;
                }
                const startedAt = new Date().toISOString();
                job.status = "processing";
                job.lockedBy = "manager-auto";
                job.lockedAt = startedAt;
                job.lockExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
                job.attempts = Math.max(0, Number(job.attempts ?? 0) || 0) + 1;
                job.updatedAt = startedAt;
                instance.status = "provisioning";
                instance.updatedAt = startedAt;
                await services.store.flush?.().catch(() => null);
                try {
                    const hasRealHostingApp = Boolean(instance.hostingAppId) && !String(instance.hostingAppId).startsWith("pending-");
                    const result = hasRealHostingApp
                        ? await services.squareCloudProvisioningService.updateInstance(instance, discordApp)
                        : await services.squareCloudProvisioningService.provisionInstance(instance, discordApp);
                    const completedAt = new Date().toISOString();
                    instance.hostingAppId = result.appId;
                    instance.status = result.boot?.running ? "running" : "provisioning";
                    instance.updatedAt = completedAt;
                    instance.config = {
                        ...(instance.config ?? {}),
                        provisioningCompletedAt: completedAt,
                        provisioningQueueJobId: job.id,
                        lastProvisioningError: null,
                        lastProvisioningErrorAt: null,
                    };
                    job.status = "completed";
                    job.result = {
                        appId: result.appId,
                        upload: result.upload ?? result.commit ?? null,
                        boot: result.boot ?? null,
                    };
                    job.completedAt = completedAt;
                    job.updatedAt = completedAt;
                    job.lockExpiresAt = null;
                    logger.info({ instanceId: instance.id, appId: result.appId, running: Boolean(result.boot?.running) }, "Provisionamento automatico concluido.");
                }
                catch (error) {
                    const partialAppId = String(error?.squareCloudAppId ?? "").trim();
                    const failedAt = new Date().toISOString();
                    if (partialAppId) {
                        instance.hostingAppId = partialAppId;
                        instance.status = "provisioning";
                        instance.updatedAt = failedAt;
                        instance.config = {
                            ...(instance.config ?? {}),
                            lastProvisioningWarning: String(error?.message ?? error ?? "App criada, aguardando boot.").slice(0, 1000),
                            lastProvisioningWarningAt: failedAt,
                            partialProvisioningSavedAt: failedAt,
                        };
                        job.status = "completed";
                        job.result = { appId: partialAppId, boot: { ok: false, warning: instance.config.lastProvisioningWarning } };
                        job.completedAt = failedAt;
                        job.updatedAt = failedAt;
                        job.lockExpiresAt = null;
                        logger.warn({ instanceId: instance.id, appId: partialAppId, error: instance.config.lastProvisioningWarning }, "Provisionamento automatico salvou app parcial.");
                        continue;
                    }
                    const attempts = Math.max(0, Number(job.attempts ?? 0) || 0);
                    const maxAttempts = Math.max(1, Number(job.maxAttempts ?? process.env.PROVISIONING_WORKER_MAX_ATTEMPTS ?? 8) || 8);
                    const retry = attempts < maxAttempts;
                    const delaySeconds = Math.max(30, Math.min(900, 30 * Math.max(1, attempts)));
                    job.status = retry ? "retry" : "failed";
                    job.lastError = String(error?.message ?? error ?? "Falha no provisionamento automatico.").slice(0, 1500);
                    job.lockExpiresAt = null;
                    job.nextRunAt = retry ? new Date(Date.now() + delaySeconds * 1000).toISOString() : null;
                    job.updatedAt = failedAt;
                    instance.status = retry ? "queued" : "failed";
                    instance.updatedAt = failedAt;
                    instance.config = {
                        ...(instance.config ?? {}),
                        lastProvisioningError: job.lastError,
                        lastProvisioningErrorAt: failedAt,
                        provisioningQueueJobId: job.id,
                    };
                    logger.warn({ instanceId: instance.id, jobId: job.id, retry, error: job.lastError }, "Falha no provisionamento automatico.");
                }
            }
            await services.store.flush?.().catch(() => null);
        }
        finally {
            provisioningCycleRunning = false;
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
        if (provisioningTimer) {
            clearInterval(provisioningTimer);
            provisioningTimer = null;
        }
        logger.info({ signal }, "Encerrando API e manager bot.");
        await managerBotService.stop().catch((error) => {
            logger.warn({ error: error?.message ?? String(error) }, "Falha ao encerrar manager bot.");
        });
        await app.close().catch((error) => {
            logger.warn({ error: error?.message ?? String(error) }, "Falha ao encerrar API.");
        });
        if (typeof services.store?.close === "function") {
            await services.store.close().catch((error) => {
                logger.warn({ error: error?.message ?? String(error) }, "Falha ao encerrar persistencia do manager.");
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
        logger.info({ host, port }, "API do manager ouvindo.");
        await managerBotService.start(logger);
        if (typeof services.billingService.restorePendingEfipayPaymentWatchers === "function") {
            const restoredEfipayWatchers = services.billingService.restorePendingEfipayPaymentWatchers();
            if (restoredEfipayWatchers > 0) {
                logger.info({ restored: restoredEfipayWatchers }, "Watchers de pagamentos Efipay pendentes restaurados.");
            }
        }
        if (expirationCheckIntervalMs > 0) {
            expirationTimer = setInterval(() => {
                void runExpirationCycle();
            }, expirationCheckIntervalMs);
            expirationTimer.unref?.();
            logger.info({
                intervalSeconds: Math.floor(expirationCheckIntervalMs / 1000),
            }, "Scheduler automatico de expiracao iniciado.");
        }
        if (provisioningCheckIntervalMs > 0) {
            provisioningTimer = setInterval(() => {
                void runProvisioningCycle();
            }, provisioningCheckIntervalMs);
            provisioningTimer.unref?.();
            void runProvisioningCycle();
            logger.info({
                intervalSeconds: Math.floor(provisioningCheckIntervalMs / 1000),
            }, "Scheduler automatico de provisionamento iniciado.");
        }
    }
    catch (error) {
        logger.error({ error: error?.message ?? String(error), stack: error?.stack ?? null }, "Falha ao iniciar a aplicacao.");
        await shutdown("startup_error");
        process.exit(1);
    }
}
void main();
