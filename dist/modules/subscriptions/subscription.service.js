"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const utils_js_1 = require("../../core/utils.js");
class SubscriptionService {
    store;
    catalogService;
    instanceService;
    constructor(store, catalogService, instanceService) {
        this.store = store;
        this.catalogService = catalogService;
        this.instanceService = instanceService;
    }
    findOrCreateCustomer(discordUserId, discordUsername) {
        const existing = this.store.customers.find((customer) => customer.discordUserId === discordUserId);
        if (existing) {
            existing.discordUsername = discordUsername;
            return existing;
        }
        const customer = {
            id: (0, utils_js_1.makeId)(),
            discordUserId,
            discordUsername,
            createdAt: (0, utils_js_1.nowIso)(),
        };
        this.store.customers.push(customer);
        return customer;
    }
    createPendingSubscription(input) {
        const product = this.catalogService.getProductBySlug(input.productSlug);
        if (!product) {
            throw new Error("Produto nao encontrado.");
        }
        const plan = this.catalogService.getPlan(product.id, input.planCode);
        if (!plan) {
            throw new Error("Plano nao encontrado.");
        }
        const customer = this.findOrCreateCustomer(input.discordUserId, input.discordUsername);
        const activeSubscription = this.store.subscriptions.find((item) => item.customerId === customer.id &&
            item.productId === product.id &&
            ["active", "grace", "suspended"].includes(item.status));
        if (activeSubscription) {
            throw new Error("Este cliente ja possui uma assinatura deste produto. Use renovacao.");
        }
        const timestamp = (0, utils_js_1.nowIso)();
        const subscription = {
            id: (0, utils_js_1.makeId)(),
            customerId: customer.id,
            productId: product.id,
            planId: plan.id,
            commercialOwnerDiscordUserId: customer.discordUserId,
            status: "pending",
            currentPeriodStart: null,
            currentPeriodEnd: null,
            graceUntil: null,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        this.store.subscriptions.push(subscription);
        return {
            customer,
            product,
            plan,
            subscription,
        };
    }
    async activateSubscription(subscriptionId, options = {}) {
        const subscription = this.getRequired(subscriptionId);
        const plan = this.store.plans.find((item) => item.id === subscription.planId);
        const product = this.store.products.find((item) => item.id === subscription.productId);
        if (!plan || !product) {
            throw new Error("Plano ou produto da assinatura nao encontrado.");
        }
        const start = new Date();
        const end = (0, utils_js_1.addPeriod)(start, plan.interval, plan.intervalCount);
        subscription.status = "active";
        subscription.currentPeriodStart = start.toISOString();
        subscription.currentPeriodEnd = end.toISOString();
        subscription.graceUntil = (0, utils_js_1.addDays)(end, plan.graceDays).toISOString();
        subscription.updatedAt = (0, utils_js_1.nowIso)();
        const deferProvisioning = options.deferProvisioning === true || product.botProvisioningMode === "customer_token";
        const instance = deferProvisioning ? null : await this.instanceService.provision(subscription);
        return {
            subscription,
            instance,
            awaitingBotSetup: deferProvisioning,
        };
    }
    async renewSubscription(subscriptionId, quantity = 1) {
        const subscription = this.getRequired(subscriptionId);
        const plan = this.store.plans.find((item) => item.id === subscription.planId);
        if (!plan) {
            throw new Error("Plano da assinatura nao encontrado.");
        }
        const fromDate = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : new Date();
        const end = (0, utils_js_1.addPeriod)(fromDate, plan.interval, plan.intervalCount * quantity);
        subscription.status = "active";
        subscription.currentPeriodStart = subscription.currentPeriodStart ?? new Date().toISOString();
        subscription.currentPeriodEnd = end.toISOString();
        subscription.graceUntil = (0, utils_js_1.addDays)(end, plan.graceDays).toISOString();
        subscription.updatedAt = (0, utils_js_1.nowIso)();
        const instance = await this.instanceService.reactivate(subscription);
        return { subscription, instance };
    }
    async runExpirationCycle(referenceDate = new Date()) {
        const changes = [];
        for (const subscription of this.store.subscriptions) {
            if (!subscription.currentPeriodEnd || !subscription.graceUntil) {
                continue;
            }
            const periodEnd = new Date(subscription.currentPeriodEnd);
            const graceUntil = new Date(subscription.graceUntil);
            if (subscription.status === "active" && referenceDate >= periodEnd) {
                subscription.status = "grace";
                subscription.updatedAt = (0, utils_js_1.nowIso)();
                await this.instanceService.suspend(subscription.id);
                changes.push({ subscriptionId: subscription.id, action: "moved_to_grace_and_suspended" });
                continue;
            }
            if (["grace", "suspended", "expired"].includes(subscription.status) && referenceDate > graceUntil) {
                subscription.status = "deleted";
                subscription.updatedAt = (0, utils_js_1.nowIso)();
                await this.instanceService.deleteBySubscription(subscription.id);
                changes.push({ subscriptionId: subscription.id, action: "deleted_after_grace" });
            }
        }
        return changes;
    }
    getById(subscriptionId) {
        const subscription = this.store.subscriptions.find((item) => item.id === subscriptionId) ?? null;
        if (!subscription) {
            return null;
        }
        const customer = this.store.customers.find((item) => item.id === subscription.customerId) ?? null;
        const product = this.store.products.find((item) => item.id === subscription.productId) ?? null;
        const plan = this.store.plans.find((item) => item.id === subscription.planId) ?? null;
        const instance = this.instanceService.getBySubscriptionId(subscription.id);
        return {
            subscription,
            customer,
            product,
            plan,
            instance,
        };
    }
    listByDiscordUserId(discordUserId) {
        const customer = this.store.customers.find((item) => item.discordUserId === discordUserId);
        if (!customer) {
            return [];
        }
        return this.store.subscriptions
            .filter((item) => item.customerId === customer.id)
            .map((subscription) => this.getById(subscription.id));
    }
    getRequired(subscriptionId) {
        const subscription = this.store.subscriptions.find((item) => item.id === subscriptionId);
        if (!subscription) {
            throw new Error("Assinatura nao encontrada.");
        }
        return subscription;
    }
    getRequiredBundle(subscriptionId) {
        const bundle = this.getById(subscriptionId);
        if (!bundle) {
            throw new Error("Assinatura nao encontrada.");
        }
        return bundle;
    }
}
exports.SubscriptionService = SubscriptionService;
