"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceService = void 0;
const utils_js_1 = require("../../core/utils.js");
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
    async provision(subscription) {
        const existing = this.store.instances.find((instance) => instance.subscriptionId === subscription.id);
        if (existing) {
            return existing;
        }
        const product = this.store.products.find((item) => item.id === subscription.productId);
        if (!product) {
            throw new Error("Produto da assinatura nao encontrado.");
        }
        if (product.botProvisioningMode !== "app_pool") {
            throw new Error("Este produto exige que o cliente envie o token do bot antes do provisionamento.");
        }
        const app = this.appPoolService.allocate(product.id);
        return this.createAndProvisionInstance(subscription, product.slug, product.sourceSlug, app);
    }
    async provisionCustomerOwnedBot(subscription, input) {
        const existing = this.store.instances.find((instance) => instance.subscriptionId === subscription.id);
        if (existing) {
            return existing;
        }
        const product = this.store.products.find((item) => item.id === subscription.productId);
        if (!product) {
            throw new Error("Produto da assinatura nao encontrado.");
        }
        const app = this.registerCustomerProvidedDiscordApp(input);
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
    setAssignedGuild(instanceId, guildId) {
        const instance = this.getById(instanceId);
        if (!instance) {
            throw new Error("Instancia nao encontrada.");
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
            await this.provisioningService.restartInstance(instance);
        }
        instance.status = "running";
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
            await this.provisioningService.deleteInstance(instance);
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
            throw new Error("Instancia nao encontrada.");
        }
        if (!this.provisioningService?.isConfigured()) {
            throw new Error("SquareCloud nao configurada para atualizar a instancia.");
        }
        const discordApp = this.store.discordApps.find((entry) => entry.id === instance.discordAppId);
        if (!discordApp) {
            throw new Error("App do Discord vinculada a essa instancia nao encontrada.");
        }
        const subscription = this.store.subscriptions.find((entry) => entry.id === instance.subscriptionId);
        const product = subscription ? this.store.products.find((entry) => entry.id === subscription.productId) : null;
        if (product?.sourceSlug && product.sourceSlug !== instance.sourceSlug) {
            instance.sourceSlug = product.sourceSlug;
        }
        const update = await this.provisioningService.updateInstance(instance, discordApp);
        instance.configVersion = Number(instance.configVersion ?? 1) + 1;
        instance.updatedAt = (0, utils_js_1.nowIso)();
        return {
            instance,
            update,
        };
    }
    heartbeat(instanceId, instanceSecret, metrics) {
        const instance = this.getById(instanceId);
        if (!instance || instance.instanceSecret !== instanceSecret) {
            throw new Error("Credenciais da instancia invalidas.");
        }
        instance.lastHeartbeatAt = (0, utils_js_1.nowIso)();
        instance.updatedAt = instance.lastHeartbeatAt;
        return {
            ok: true,
            desiredState: instance.status === "running" ? "running" : "suspended",
            nextConfigVersion: instance.configVersion,
            metricsReceived: metrics,
            expiresAt: instance.expiresAt,
        };
    }
    bootstrap(instanceId, instanceSecret) {
        const instance = this.getById(instanceId);
        if (!instance || instance.instanceSecret !== instanceSecret) {
            throw new Error("Credenciais da instancia invalidas.");
        }
        const subscription = this.store.subscriptions.find((item) => item.id === instance.subscriptionId);
        if (!subscription) {
            throw new Error("Assinatura da instancia nao encontrada.");
        }
        return {
            ok: true,
            instance: {
                id: instance.id,
                status: instance.status,
                expiresAt: instance.expiresAt,
                hostingProvider: instance.hostingProvider,
                hostingAccountId: instance.hostingAccountId,
                hostingAppId: instance.hostingAppId,
            },
            tenant: {
                customerDiscordUserId: subscription.commercialOwnerDiscordUserId,
                assignedGuildId: instance.assignedGuildId,
            },
            config: instance.config,
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
    async createAndProvisionInstance(subscription, productSlug, sourceSlug, app, ownerDiscordUserId) {
        const timestamp = (0, utils_js_1.nowIso)();
        const installUrl = (0, utils_js_1.buildInstallUrl)({
            clientId: app.clientId,
            permissions: this.defaultPermissions,
        });
        const instance = {
            id: (0, utils_js_1.makeId)(),
            subscriptionId: subscription.id,
            discordAppId: app.id,
            sourceSlug,
            sourceVersion: "1.0.0",
            hostingProvider: "squarecloud",
            hostingAccountId: this.squareCloudAccountId ?? null,
            hostingAppId: `pending-${(0, utils_js_1.makeId)().replaceAll("-", "").slice(0, 12)}`,
            installUrl,
            instanceSecret: (0, utils_js_1.makeSecret)(),
            assignedGuildId: null,
            status: "provisioning",
            configVersion: 1,
            config: {
                locale: "pt-BR",
                ownerDiscordUserId: String(ownerDiscordUserId ?? "").trim() || subscription.commercialOwnerDiscordUserId,
                productSlug,
                discordClientId: app.clientId,
                discordApplicationId: app.applicationId,
                discordAppName: app.appName,
            },
            lastHeartbeatAt: null,
            expiresAt: subscription.currentPeriodEnd ?? timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        this.store.instances.push(instance);
        if (!this.provisioningService?.isConfigured()) {
            instance.hostingAppId = `sqc-${(0, utils_js_1.makeId)().replaceAll("-", "").slice(0, 24)}`;
            instance.status = "running";
            instance.updatedAt = (0, utils_js_1.nowIso)();
            return instance;
        }
        try {
            const provisioning = await this.provisioningService.provisionInstance(instance, app);
            instance.hostingAppId = provisioning.appId;
            instance.status = "running";
            instance.updatedAt = (0, utils_js_1.nowIso)();
            return instance;
        }
        catch (error) {
            instance.status = "failed";
            instance.updatedAt = (0, utils_js_1.nowIso)();
            this.appPoolService.release(instance.discordAppId);
            throw error;
        }
    }
}
exports.InstanceService = InstanceService;
