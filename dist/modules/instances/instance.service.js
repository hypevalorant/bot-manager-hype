"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceService = void 0;
const utils_js_1 = require("../../core/utils.js");
function isInaccessibleSquareCloudAppError(error) {
    const status = Number(error?.status ?? 0) || 0;
    const code = String(error?.code ?? "").trim().toUpperCase();
    const message = String(error?.message ?? error ?? "").toUpperCase();
    return status === 404 ||
        status === 401 ||
        status === 403 ||
        code === "NOT_FOUND" ||
        code === "APP_NOT_FOUND" ||
        code === "ACCESS_DENIED" ||
        message.includes("APP_NOT_FOUND") ||
        message.includes("ACCESS_DENIED") ||
        message.includes("INVALID USER DATA") ||
        message.includes("NAO ENCONTRADA") ||
        message.includes("NÃO ENCONTRADA") ||
        message.includes("NOT FOUND");
}
function shouldReviveDeletedInstanceFromHeartbeat(instance, subscription) {
    const status = String(instance?.status ?? "").trim().toLowerCase();
    if (status !== "deleted") {
        return false;
    }
    const subscriptionStatus = String(subscription?.status ?? "").trim().toLowerCase();
    if (["cancelled", "deleted", "expired", "suspended"].includes(subscriptionStatus)) {
        return false;
    }
    const expiresAt = Date.parse(String(instance?.expiresAt ?? subscription?.currentPeriodEnd ?? ""));
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        return false;
    }
    const reason = String(instance?.config?.squareCloudDeletedReason ?? "").toLowerCase();
    return !reason ||
        reason.includes("square cloud respondeu 401") ||
        reason.includes("square cloud respondeu 403") ||
        reason.includes("access_denied") ||
        reason.includes("invalid user data") ||
        reason.includes("inacessivel") ||
        reason.includes("inacessível");
}
class InstanceService {
    store;
    appPoolService;
    defaultPermissions;
    squareCloudAccountId;
    provisioningService;
    constructor(store, appPoolService, defaultPermissions, squareCloudAccountId, provisioningService) {
        this.store = store;
        this.appPoolService = appPoolService;
        this.defaultPermissions = defaultPermissions;
        this.squareCloudAccountId = squareCloudAccountId;
        this.provisioningService = provisioningService;
    }
    getNextSaleSequenceNumber() {
        const explicitMax = this.store.instances.reduce((maxValue, instance) => {
            const numericValue = Number(instance?.saleSequenceNumber ?? instance?.config?.saleSequenceNumber ?? 0);
            return Number.isFinite(numericValue) && numericValue > maxValue ? numericValue : maxValue;
        }, 0);
        return Math.max(explicitMax, this.store.instances.length) + 1;
    }
    formatSaleSequenceLabel(value) {
        const numericValue = Math.max(1, Number(value) || 1);
        return String(numericValue).padStart(2, "0");
    }
    formatSaleDateLabel(isoDate) {
        const date = new Date(isoDate);
        if (!Number.isFinite(date.getTime())) {
            return "data-não-informada";
        }
        const day = String(date.getUTCDate()).padStart(2, "0");
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const year = String(date.getUTCFullYear());
        return `${day}-${month}-${year}`;
    }
    buildManagedSaleDescription(sequenceLabel, purchaserDiscordUserId, soldAt) {
        return `Aplicação ID ${sequenceLabel} - ${String(purchaserDiscordUserId ?? "").trim() || "sem-comprador"} - ${this.formatSaleDateLabel(soldAt)}`.slice(0, 120);
    }
    buildRuntimePayload(instance, subscription) {
        const customer = this.store.customers.find((item) => item.id === subscription.customerId) ?? null;
        const product = this.store.products.find((item) => item.id === subscription.productId) ?? null;
        const plan = this.store.plans.find((item) => item.id === subscription.planId) ?? null;
        const discordApp = this.store.discordApps.find((item) => item.id === instance.discordAppId) ?? null;
        const purchaserDiscordUserId = String(instance?.config?.purchaserDiscordUserId ?? subscription.commercialOwnerDiscordUserId ?? customer?.discordUserId ?? "").trim() || null;
        const defaultGuildId = String(discordApp?.defaultGuildId ?? "").trim() || null;
        const assignedGuildId = String(instance.assignedGuildId ?? "").trim() || null;
        const saleSequenceNumber = Math.max(1, Number(instance?.saleSequenceNumber ?? instance?.config?.saleSequenceNumber ?? 1) || 1);
        const saleSequenceLabel = String(instance?.config?.saleSequenceLabel ?? this.formatSaleSequenceLabel(saleSequenceNumber)).trim();
        const soldAt = String(instance?.soldAt ?? instance?.config?.soldAt ?? subscription.createdAt ?? instance.createdAt ?? "").trim() || null;
        const assignedGuildUrl = assignedGuildId ? `https://discord.com/channels/${assignedGuildId}` : null;
        const defaultGuildUrl = defaultGuildId ? `https://discord.com/channels/${defaultGuildId}` : null;
        return {
            instance: {
                id: instance.id,
                status: instance.status,
                expiresAt: instance.expiresAt,
                hostingProvider: instance.hostingProvider,
                hostingAccountId: instance.hostingAccountId,
                hostingAppId: instance.hostingAppId,
                saleSequenceNumber,
                saleSequenceLabel,
                soldAt,
                managedDescription: String(instance?.managedSquareCloudDescription ?? this.buildManagedSaleDescription(saleSequenceLabel, purchaserDiscordUserId, soldAt ?? instance.createdAt)).trim(),
            },
            tenant: {
                customerId: customer?.id ?? subscription.customerId ?? null,
                subscriptionId: subscription.id,
                customerDiscordUserId: String(customer?.discordUserId ?? subscription.commercialOwnerDiscordUserId ?? "").trim() || null,
                customerDiscordUsername: String(customer?.discordUsername ?? "").trim() || null,
                commercialOwnerDiscordUserId: String(subscription.commercialOwnerDiscordUserId ?? "").trim() || null,
                purchaserDiscordUserId,
                purchaserDiscordUsername: String(instance?.config?.purchaserDiscordUsername ?? customer?.discordUsername ?? "").trim() || null,
                botOwnerDiscordUserId: String(instance?.config?.ownerDiscordUserId ?? "").trim() || null,
                assignedGuildId,
                assignedGuildUrl,
                defaultGuildId,
                defaultGuildUrl,
                installUrl: instance.installUrl ?? null,
                productSlug: String(product?.slug ?? instance?.config?.productSlug ?? "").trim() || null,
                productName: String(product?.name ?? "").trim() || null,
                planName: String(plan?.name ?? "").trim() || null,
            },
            config: instance.config,
        };
    }
    async provision(subscription) {
        const existing = this.store.instances.find((instance) => instance.subscriptionId === subscription.id);
        if (existing && String(existing.status ?? "").toLowerCase() !== "failed") {
            return existing;
        }
        const product = this.store.products.find((item) => item.id === subscription.productId);
        if (!product) {
            throw new Error("Produto da assinatura não encontrado.");
        }
        if (product.botProvisioningMode !== "app_pool") {
            throw new Error("Este produto exige que o cliente envie o token do bot antes do provisionamento.");
        }
        const app = this.appPoolService.allocate(product.id);
        if (existing) {
            return this.reprovisionExistingInstance(existing, subscription, product.slug, product.sourceSlug, app);
        }
        return this.createAndProvisionInstance(subscription, product.slug, product.sourceSlug, app);
    }
    async provisionCustomerOwnedBot(subscription, input) {
        const existing = this.store.instances.find((instance) => instance.subscriptionId === subscription.id);
        if (existing && String(existing.status ?? "").toLowerCase() !== "failed") {
            return existing;
        }
        const product = this.store.products.find((item) => item.id === subscription.productId);
        if (!product) {
            throw new Error("Produto da assinatura não encontrado.");
        }
        const app = this.registerCustomerProvidedDiscordApp(input);
        if (existing) {
            return this.reprovisionExistingInstance(existing, subscription, product.slug, product.sourceSlug, app, input.ownerDiscordUserId ?? null);
        }
        return this.createAndProvisionInstance(subscription, product.slug, product.sourceSlug, app, input.ownerDiscordUserId ?? null);
    }
    getById(instanceId) {
        return this.store.instances.find((instance) => instance.id === instanceId) ?? null;
    }
    getBySubscriptionId(subscriptionId) {
        return this.store.instances.find((instance) => instance.subscriptionId === subscriptionId) ?? null;
    }
    getByHostingAppId(hostingAppId) {
        return this.store.instances.find((instance) => instance.hostingAppId === hostingAppId) ?? null;
    }
    isInaccessibleSquareCloudAppError(error) {
        return isInaccessibleSquareCloudAppError(error);
    }
    isSquareCloudAppNotFoundError(error) {
        return isInaccessibleSquareCloudAppError(error);
    }
    async markSquareCloudAppDeleted(instanceOrHostingAppId, reason = null) {
        const instance = typeof instanceOrHostingAppId === "string"
            ? this.getByHostingAppId(instanceOrHostingAppId)
            : instanceOrHostingAppId;
        if (!instance) {
            return null;
        }
        const timestamp = (0, utils_js_1.nowIso)();
        instance.status = "deleted";
        instance.updatedAt = timestamp;
        instance.config = {
            ...(instance.config ?? {}),
            squareCloudDeletedAt: timestamp,
            squareCloudDeletedReason: String(reason ?? "SquareCloud app removida ou inacessivel.").slice(0, 1000),
        };
        this.appPoolService.release(instance.discordAppId);
        const discordApp = this.store.discordApps.find((entry) => entry.id === instance.discordAppId);
        if (discordApp && discordApp.source === "customer_token") {
            discordApp.poolStatus = "disabled";
        }
        if (typeof this.store?.flush === "function") {
            await this.store.flush().catch(() => null);
        }
        return instance;
    }
    setAssignedGuild(instanceId, guildId) {
        const instance = this.getById(instanceId);
        if (!instance) {
            throw new Error("Instância não encontrada.");
        }
        instance.assignedGuildId = guildId;
        instance.updatedAt = (0, utils_js_1.nowIso)();
        return instance;
    }
    async reactivate(subscription) {
        const instance = this.getBySubscriptionId(subscription.id);
        if (!instance) {
            return this.provision(subscription);
        }
        if (this.provisioningService?.isConfigured() && !instance.hostingAppId.startsWith("pending-")) {
            instance.status = "provisioning";
            instance.updatedAt = (0, utils_js_1.nowIso)();
            const boot = await this.provisioningService.restartInstance(instance);
            if (!boot?.running) {
                instance.status = "failed";
                instance.updatedAt = (0, utils_js_1.nowIso)();
                throw new Error("A SquareCloud iniciou a instância, mas ela não ficou em execução.");
            }
        }
        else {
            instance.status = "running";
        }
        instance.expiresAt = subscription.currentPeriodEnd ?? instance.expiresAt;
        instance.updatedAt = (0, utils_js_1.nowIso)();
        return instance;
    }
    async suspend(subscriptionId) {
        const instance = this.getBySubscriptionId(subscriptionId);
        if (!instance) {
            return null;
        }
        if (this.provisioningService?.isConfigured() && !instance.hostingAppId.startsWith("pending-")) {
            await this.provisioningService.suspendInstance(instance);
        }
        instance.status = "suspended";
        instance.updatedAt = (0, utils_js_1.nowIso)();
        return instance;
    }
    async deleteBySubscription(subscriptionId) {
        const instance = this.getBySubscriptionId(subscriptionId);
        if (!instance) {
            return null;
        }
        if (this.provisioningService?.isConfigured() && !instance.hostingAppId.startsWith("pending-")) {
            try {
                await this.provisioningService.deleteInstance(instance);
            }
            catch (error) {
                if (!isInaccessibleSquareCloudAppError(error)) {
                    throw error;
                }
                instance.config = {
                    ...(instance.config ?? {}),
                    squareCloudDeletedAt: (0, utils_js_1.nowIso)(),
                    squareCloudDeletedReason: "Delete solicitado pelo usuario; app SquareCloud ja estava inacessivel ou removida.",
                };
            }
        }
        instance.status = "deleted";
        instance.updatedAt = (0, utils_js_1.nowIso)();
        this.appPoolService.release(instance.discordAppId);
        const discordApp = this.store.discordApps.find((entry) => entry.id === instance.discordAppId);
        if (discordApp && discordApp.source === "customer_token") {
            discordApp.poolStatus = "disabled";
        }
        return instance;
    }
    async updateRuntime(instanceIdOrHostingAppId) {
        const instance = this.getById(instanceIdOrHostingAppId) ?? this.getByHostingAppId(instanceIdOrHostingAppId);
        if (!instance) {
            throw new Error("Instância não encontrada.");
        }
        if (!this.provisioningService?.isConfigured()) {
            throw new Error("SquareCloud não configurada para atualizar a instância.");
        }
        const discordApp = this.store.discordApps.find((entry) => entry.id === instance.discordAppId);
        if (!discordApp) {
            throw new Error("App do Discord vinculada a essa instância não encontrada.");
        }
        const subscription = this.store.subscriptions.find((entry) => entry.id === instance.subscriptionId);
        const product = subscription ? this.store.products.find((entry) => entry.id === subscription.productId) : null;
        if (product?.sourceSlug && product.sourceSlug !== instance.sourceSlug) {
            instance.sourceSlug = product.sourceSlug;
        }
        instance.status = "provisioning";
        instance.updatedAt = (0, utils_js_1.nowIso)();
        const update = await this.provisioningService.updateInstance(instance, discordApp);
        instance.configVersion = Number(instance.configVersion ?? 1) + 1;
        instance.updatedAt = (0, utils_js_1.nowIso)();
        return {
            instance,
            update,
        };
    }
    isExternalProvisioningEnabled() {
        const mode = String(process.env.SQUARECLOUD_PROVISIONING_MODE ?? process.env.PROVISIONING_MODE ?? "").trim().toLowerCase();
        if (["external", "worker", "queue", "queued"].includes(mode)) {
            return true;
        }
        return String(process.env.EXTERNAL_PROVISIONING_ENABLED ?? "").trim().toLowerCase() === "true";
    }
    isExternalProvisioningOnly() {
        const mode = String(process.env.SQUARECLOUD_PROVISIONING_MODE ?? process.env.PROVISIONING_MODE ?? "").trim().toLowerCase();
        return ["external_only", "worker_only", "queue_only", "queued_only"].includes(mode);
    }
    isExternalProvisioningFallbackError(error) {
        const status = Number(error?.status ?? 0) || 0;
        const path = String(error?.path ?? "").trim();
        const message = String(error?.message ?? error ?? "").toLowerCase();
        return (path === "/apps" || message.includes("para /apps")) &&
            (status === 520 ||
                status === 502 ||
                status === 503 ||
                message.includes("cloudflare") ||
                message.includes("unable to proceed") ||
                message.includes("respondeu 520"));
    }
    enqueueProvisioningJob(instance, app, reason = "queued") {
        if (!Array.isArray(this.store.provisioningJobs)) {
            this.store.provisioningJobs = [];
        }
        const now = (0, utils_js_1.nowIso)();
        const existing = this.store.provisioningJobs.find((job) => job.instanceId === instance.id &&
            ["queued", "processing", "retry"].includes(String(job.status ?? "").toLowerCase()));
        const job = existing ?? {
            id: (0, utils_js_1.makeId)(),
            type: "squarecloud_provision",
            instanceId: instance.id,
            discordAppId: app.id,
            sourceSlug: instance.sourceSlug,
            status: "queued",
            attempts: 0,
            maxAttempts: Number(process.env.PROVISIONING_WORKER_MAX_ATTEMPTS ?? 8) || 8,
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
            lastError: null,
            result: null,
            nextRunAt: now,
            createdAt: now,
            updatedAt: now,
        };
        job.discordAppId = app.id;
        job.sourceSlug = instance.sourceSlug;
        job.status = "queued";
        job.reason = reason;
        job.nextRunAt = now;
        job.updatedAt = now;
        if (!existing) {
            this.store.provisioningJobs.push(job);
        }
        instance.status = "queued";
        instance.updatedAt = now;
        instance.config = {
            ...(instance.config ?? {}),
            provisioningQueuedAt: now,
            provisioningQueueJobId: job.id,
            provisioningQueueReason: reason,
        };
        return job;
    }
    async triggerProvisioningWorker(job) {
        const repo = String(process.env.PROVISIONING_GITHUB_REPO ?? "").trim();
        const token = String(process.env.PROVISIONING_GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "").trim();
        const workflow = String(process.env.PROVISIONING_GITHUB_WORKFLOW ?? "provisioning-worker.yml").trim();
        const ref = String(process.env.PROVISIONING_GITHUB_REF ?? "main").trim();
        if (!repo || !token || !workflow || !ref) {
            return false;
        }
        const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
            method: "POST",
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                "User-Agent": "bot-manager-hype",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({
                ref,
                inputs: {
                    job_id: String(job?.id ?? ""),
                    instance_id: String(job?.instanceId ?? ""),
                    reason: String(job?.reason ?? "queued"),
                },
            }),
        });
        const now = (0, utils_js_1.nowIso)();
        if (job && typeof job === "object") {
            job.lastDispatchAt = now;
            job.lastDispatchStatus = response.ok ? "dispatched" : "failed";
            job.updatedAt = now;
        }
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            if (job && typeof job === "object") {
                job.lastDispatchError = `GitHub ${response.status}: ${body.slice(0, 700)}`;
            }
            return false;
        }
        if (job && typeof job === "object") {
            job.lastDispatchError = null;
        }
        return true;
    }
    heartbeat(instanceId, instanceSecret, metrics) {
        const instance = this.getById(instanceId);
        if (!instance || instance.instanceSecret !== instanceSecret) {
            throw new Error("Credenciais da instância inválidas.");
        }
        const subscription = this.store.subscriptions.find((item) => item.id === instance.subscriptionId);
        if (!subscription) {
            throw new Error("Assinatura da instância não encontrada.");
        }
        instance.lastHeartbeatAt = (0, utils_js_1.nowIso)();
        if (shouldReviveDeletedInstanceFromHeartbeat(instance, subscription)) {
            instance.status = "running";
            instance.config = {
                ...(instance.config ?? {}),
                squareCloudDeletedAt: null,
                squareCloudDeletedReason: null,
                falseDeletionRecoveredAt: instance.lastHeartbeatAt,
            };
        }
        if (["provisioning", "starting", "active", "failed", "queued", "retry", "processing"].includes(String(instance.status ?? "").toLowerCase())) {
            instance.status = "running";
        }
        instance.updatedAt = instance.lastHeartbeatAt;
        const normalizedStatus = String(instance.status ?? "").toLowerCase();
        return {
            ok: true,
            desiredState: ["running", "provisioning", "starting", "active"].includes(normalizedStatus) ? "running" : "suspended",
            nextConfigVersion: instance.configVersion,
            metricsReceived: metrics,
            expiresAt: instance.expiresAt,
            ...this.buildRuntimePayload(instance, subscription),
        };
    }
    bootstrap(instanceId, instanceSecret) {
        const instance = this.getById(instanceId);
        if (!instance || instance.instanceSecret !== instanceSecret) {
            throw new Error("Credenciais da instância inválidas.");
        }
        const subscription = this.store.subscriptions.find((item) => item.id === instance.subscriptionId);
        if (!subscription) {
            throw new Error("Assinatura da instância não encontrada.");
        }
        return {
            ok: true,
            ...this.buildRuntimePayload(instance, subscription),
        };
    }
    registerCustomerProvidedDiscordApp(input) {
        const existing = this.store.discordApps.find((entry) => entry.source === "customer_token" &&
            entry.customerId === input.customerId &&
            entry.applicationId === input.applicationId);
        if (existing) {
            existing.clientId = input.clientId;
            existing.appName = input.appName;
            existing.botToken = input.botToken;
            existing.defaultGuildId = input.defaultGuildId ?? null;
            existing.runtimeEnv = input.runtimeEnv ?? {};
            existing.poolStatus = "allocated";
            return existing;
        }
        const app = {
            id: (0, utils_js_1.makeId)(),
            productId: input.productId,
            poolKey: "customer-token",
            applicationId: input.applicationId,
            clientId: input.clientId,
            appName: input.appName,
            botToken: input.botToken,
            defaultGuildId: input.defaultGuildId ?? null,
            runtimeEnv: input.runtimeEnv ?? {},
            source: "customer_token",
            customerId: input.customerId,
            poolStatus: "allocated",
        };
        this.store.discordApps.push(app);
        return app;
    }
    applyInstanceProvisioningMetadata(instance, subscription, productSlug, sourceSlug, app, ownerDiscordUserId) {
        const timestamp = (0, utils_js_1.nowIso)();
        const customer = this.store.customers.find((item) => item.id === subscription.customerId) ?? null;
        const soldAt = String(instance?.soldAt ?? instance?.config?.soldAt ?? subscription.createdAt ?? timestamp).trim() || timestamp;
        const saleSequenceNumber = Math.max(1, Number(instance?.saleSequenceNumber ?? instance?.config?.saleSequenceNumber ?? this.getNextSaleSequenceNumber()) || 1);
        const saleSequenceLabel = String(instance?.config?.saleSequenceLabel ?? this.formatSaleSequenceLabel(saleSequenceNumber)).trim() || this.formatSaleSequenceLabel(saleSequenceNumber);
        const purchaserDiscordUserId = String(subscription.commercialOwnerDiscordUserId ?? customer?.discordUserId ?? "").trim() || null;
        const purchaserDiscordUsername = String(customer?.discordUsername ?? "").trim() || null;
        const managedSquareCloudDescription = this.buildManagedSaleDescription(saleSequenceLabel, purchaserDiscordUserId, soldAt);
        const installUrl = (0, utils_js_1.buildInstallUrl)({
            clientId: app.clientId,
            permissions: this.defaultPermissions,
        });
        instance.subscriptionId = subscription.id;
        instance.discordAppId = app.id;
        instance.sourceSlug = sourceSlug;
        instance.hostingProvider = "squarecloud";
        instance.hostingAccountId = this.squareCloudAccountId ?? null;
        instance.installUrl = installUrl;
        instance.saleSequenceNumber = saleSequenceNumber;
        instance.soldAt = soldAt;
        instance.managedSquareCloudDescription = managedSquareCloudDescription;
        instance.status = "provisioning";
        instance.expiresAt = subscription.currentPeriodEnd ?? instance.expiresAt ?? timestamp;
        instance.updatedAt = timestamp;
        instance.config = {
            ...(instance.config ?? {}),
            locale: "pt-BR",
            ownerDiscordUserId: String(ownerDiscordUserId ?? "").trim() || subscription.commercialOwnerDiscordUserId,
            commercialOwnerDiscordUserId: String(subscription.commercialOwnerDiscordUserId ?? "").trim() || purchaserDiscordUserId,
            purchaserDiscordUserId,
            purchaserDiscordUsername,
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            saleSequenceNumber,
            saleSequenceLabel,
            soldAt,
            managedSquareCloudDescription,
            productSlug,
            discordClientId: app.clientId,
            discordApplicationId: app.applicationId,
            discordAppName: app.appName,
        };
        if (!instance.hostingAppId) {
            instance.hostingAppId = `pending-${(0, utils_js_1.makeId)().replaceAll("-", "").slice(0, 12)}`;
        }
        return instance;
    }
    async finishProvisioning(instance, app) {
        if (!this.provisioningService?.isConfigured()) {
            instance.hostingAppId = String(instance.hostingAppId ?? "").startsWith("pending-")
                ? `sqc-${(0, utils_js_1.makeId)().replaceAll("-", "").slice(0, 24)}`
                : instance.hostingAppId;
            instance.status = "running";
            instance.updatedAt = (0, utils_js_1.nowIso)();
            return instance;
        }
        if (this.isExternalProvisioningOnly()) {
            const job = this.enqueueProvisioningJob(instance, app, "external_worker_mode");
            await this.triggerProvisioningWorker(job).catch(() => false);
            return instance;
        }
        try {
            const hasRealHostingApp = Boolean(instance.hostingAppId) && !String(instance.hostingAppId).startsWith("pending-");
            const provisioning = hasRealHostingApp
                ? await this.provisioningService.updateInstance(instance, app)
                : await this.provisioningService.provisionInstance(instance, app);
            instance.hostingAppId = provisioning.appId;
            instance.status = instance.lastHeartbeatAt ? "running" : "provisioning";
            instance.updatedAt = (0, utils_js_1.nowIso)();
            return instance;
        }
        catch (error) {
            if (this.isExternalProvisioningFallbackError(error)) {
                const job = this.enqueueProvisioningJob(instance, app, "squarecloud_upload_blocked");
                await this.triggerProvisioningWorker(job).catch(() => false);
                if (typeof this.store?.flush === "function") {
                    await this.store.flush().catch(() => null);
                }
                return instance;
            }
            const partialAppId = String(error?.squareCloudAppId ?? "").trim();
            if (partialAppId) {
                instance.hostingAppId = partialAppId;
                instance.status = "provisioning";
                instance.updatedAt = (0, utils_js_1.nowIso)();
                instance.config = {
                    ...(instance.config ?? {}),
                    lastProvisioningWarning: String(error?.message ?? error ?? "A SquareCloud criou a app, mas o boot automatico ainda nao confirmou execucao.").slice(0, 1000),
                    lastProvisioningWarningAt: instance.updatedAt,
                    partialProvisioningSavedAt: instance.updatedAt,
                };
                if (typeof this.store?.flush === "function") {
                    await this.store.flush().catch(() => null);
                }
                return instance;
            }
            instance.status = "failed";
            instance.updatedAt = (0, utils_js_1.nowIso)();
            instance.config = {
                ...(instance.config ?? {}),
                lastProvisioningError: String(error?.message ?? error ?? "Falha no provisionamento.").slice(0, 1000),
                lastProvisioningErrorAt: instance.updatedAt,
            };
            if (typeof this.store?.flush === "function") {
                await this.store.flush().catch(() => null);
            }
            this.appPoolService.release(instance.discordAppId);
            throw error;
        }
    }
    async reprovisionExistingInstance(instance, subscription, productSlug, sourceSlug, app, ownerDiscordUserId) {
        this.applyInstanceProvisioningMetadata(instance, subscription, productSlug, sourceSlug, app, ownerDiscordUserId);
        return this.finishProvisioning(instance, app);
    }
    async createAndProvisionInstance(subscription, productSlug, sourceSlug, app, ownerDiscordUserId) {
        const timestamp = (0, utils_js_1.nowIso)();
        const saleSequenceNumber = this.getNextSaleSequenceNumber();
        const instance = {
            id: (0, utils_js_1.makeId)(),
            subscriptionId: subscription.id,
            discordAppId: app.id,
            sourceSlug,
            sourceVersion: "1.0.0",
            hostingProvider: "squarecloud",
            hostingAccountId: this.squareCloudAccountId ?? null,
            hostingAppId: `pending-${(0, utils_js_1.makeId)().replaceAll("-", "").slice(0, 12)}`,
            installUrl: null,
            instanceSecret: (0, utils_js_1.makeSecret)(),
            assignedGuildId: null,
            saleSequenceNumber,
            soldAt: String(subscription.createdAt ?? timestamp).trim() || timestamp,
            managedSquareCloudDescription: "",
            status: "provisioning",
            configVersion: 1,
            config: {},
            lastHeartbeatAt: null,
            expiresAt: subscription.currentPeriodEnd ?? timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        this.applyInstanceProvisioningMetadata(instance, subscription, productSlug, sourceSlug, app, ownerDiscordUserId);
        this.store.instances.push(instance);
        return this.finishProvisioning(instance, app);
    }
}
exports.InstanceService = InstanceService;
