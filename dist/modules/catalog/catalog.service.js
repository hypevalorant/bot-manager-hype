"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogService = void 0;
const utils_js_1 = require("../../core/utils.js");
function normalizeEmbedColorInput(value) {
    const normalized = String(value ?? "")
        .trim()
        .replace(/^#/u, "")
        .replace(/^0x/iu, "");
    if (!normalized) {
        return null;
    }
    if (!/^(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/u.test(normalized)) {
        return null;
    }
    const expanded = normalized.length === 3
        ? normalized
            .split("")
            .map((character) => `${character}${character}`)
            .join("")
        : normalized;
    return `#${expanded.toUpperCase()}`;
}
const STANDARD_PLAN_BLUEPRINTS = [
    {
        code: "weekly",
        name: "Semanal",
        description: "Plano de 7 dias",
        interval: "weekly",
        intervalCount: 1,
        durationDays: 7,
        discountPercentage: 0,
        priceCents: 510,
        currency: "BRL",
        graceDays: 3,
    },
    {
        code: "monthly",
        name: "Mensal",
        description: "Plano de 30 dias",
        interval: "monthly",
        intervalCount: 1,
        durationDays: 30,
        discountPercentage: 0,
        priceCents: 1015,
        currency: "BRL",
        graceDays: 3,
    },
    {
        code: "quarterly",
        name: "Trimestral",
        description: "Plano de 90 dias com desconto",
        interval: "monthly",
        intervalCount: 3,
        durationDays: 90,
        discountPercentage: 2,
        priceCents: 2984,
        currency: "BRL",
        graceDays: 3,
    },
    {
        code: "semiannual",
        name: "Semestral",
        description: "Plano de 180 dias com desconto",
        interval: "monthly",
        intervalCount: 6,
        durationDays: 180,
        discountPercentage: 3,
        priceCents: 5907,
        currency: "BRL",
        graceDays: 3,
    },
    {
        code: "annual",
        name: "Anual",
        description: "Plano de 360 dias com desconto",
        interval: "monthly",
        intervalCount: 12,
        durationDays: 360,
        discountPercentage: 5,
        priceCents: 11571,
        currency: "BRL",
        graceDays: 3,
    },
];
class CatalogService {
    store;
    constructor(store) {
        this.store = store;
        this.ensureDefaultAddonsForAllProducts();
    }
    normalizePanelConfig(input = {}, fallback = {}) {
        const source = input && typeof input === "object" ? input : {};
        const base = fallback && typeof fallback === "object" ? fallback : {};
        return {
            title: String(source.title ?? base.title ?? "").trim() || null,
            summary: String(source.summary ?? base.summary ?? "").trim() || null,
            details: String(source.details ?? base.details ?? "").trim() || null,
            imageUrl: String(source.imageUrl ?? base.imageUrl ?? "").trim() || null,
            embedColor: normalizeEmbedColorInput(source.embedColor ?? base.embedColor),
            previewUrl: String(source.previewUrl ?? base.previewUrl ?? "").trim() || null,
            buttonLabel: String(source.buttonLabel ?? base.buttonLabel ?? "").trim() || null,
            pricePrefix: String(source.pricePrefix ?? base.pricePrefix ?? "").trim() || null,
            footerText: String(source.footerText ?? base.footerText ?? "").trim() || null,
            approvedTitle: String(source.approvedTitle ?? base.approvedTitle ?? "").trim() || null,
            approvedDescription: String(source.approvedDescription ?? base.approvedDescription ?? "").trim() || null,
            approvedImageUrl: String(source.approvedImageUrl ?? base.approvedImageUrl ?? "").trim() || null,
            approvedEmbedColor: normalizeEmbedColorInput(source.approvedEmbedColor ?? base.approvedEmbedColor),
            publishedChannelId: String(source.publishedChannelId ?? base.publishedChannelId ?? "").trim() || null,
            publishedMessageId: String(source.publishedMessageId ?? base.publishedMessageId ?? "").trim() || null,
        };
    }
    listProducts() {
        return this.store.products.map((product) => ({
            ...product,
            plans: this.store.plans.filter((plan) => plan.productId === product.id),
            addons: this.store.productAddons.filter((addon) => addon.productId === product.id),
            poolAvailable: this.store.discordApps.filter((app) => app.productId === product.id &&
                app.source === "app_pool" &&
                app.poolStatus === "available" &&
                !(0, utils_js_1.isPlaceholderBotToken)(app.botToken)).length,
        }));
    }
    getProductBySlug(slug) {
        return this.store.products.find((product) => product.slug === slug) ?? null;
    }
    getPlan(productId, code) {
        return this.store.plans.find((plan) => plan.productId === productId && plan.code === code) ?? null;
    }
    listAddons(productId) {
        return this.store.productAddons.filter((addon) => addon.productId === productId);
    }
    getAddonsByCodes(productId, addonCodes = []) {
        const requested = new Set(addonCodes.map((code) => String(code).trim()).filter(Boolean));
        return this.listAddons(productId).filter((addon) => requested.has(addon.code));
    }
    createProduct(input) {
        const slug = this.normalizeSlug(input.slug);
        if (!slug) {
            throw new Error("Slug do produto invalido.");
        }
        if (this.getProductBySlug(slug)) {
            throw new Error("Ja existe um produto com esse slug.");
        }
        const product = {
            id: (0, utils_js_1.makeId)(),
            slug,
            name: String(input.name ?? "").trim() || slug,
            description: String(input.description ?? "").trim() || `Produto ${slug}`,
            sourceSlug: this.normalizeSlug(input.sourceSlug ?? slug),
            appPoolKey: this.normalizeSlug(input.appPoolKey ?? slug),
            botProvisioningMode: input.botProvisioningMode ?? "customer_token",
            requiredPrivilegedIntents: Array.isArray(input.requiredPrivilegedIntents) && input.requiredPrivilegedIntents.length > 0
                ? input.requiredPrivilegedIntents
                : ["guild_presences", "guild_members", "message_content"],
            tutorialUrl: String(input.tutorialUrl ?? "").trim() || null,
            customerRoleId: String(input.customerRoleId ?? "").trim() || null,
            panelConfig: this.normalizePanelConfig(input.panelConfig),
        };
        this.store.products.push(product);
        this.upsertStandardPlans(product.id, input.planPrices ?? {});
        this.ensureDefaultProductAddons(product.id);
        return this.getProductBySlug(slug);
    }
    updateProduct(slug, input = {}) {
        const product = this.getProductBySlug(slug);
        if (!product) {
            throw new Error("Produto nao encontrado.");
        }
        if (input.name !== undefined) {
            product.name = String(input.name ?? "").trim() || product.name;
        }
        if (input.description !== undefined) {
            product.description = String(input.description ?? "").trim() || product.description;
        }
        if (input.sourceSlug !== undefined) {
            product.sourceSlug = this.normalizeSlug(input.sourceSlug) || product.sourceSlug;
        }
        if (input.appPoolKey !== undefined) {
            product.appPoolKey = this.normalizeSlug(input.appPoolKey) || product.appPoolKey;
        }
        if (input.botProvisioningMode !== undefined) {
            product.botProvisioningMode = input.botProvisioningMode;
        }
        if (input.tutorialUrl !== undefined) {
            product.tutorialUrl = String(input.tutorialUrl ?? "").trim() || null;
        }
        if (input.customerRoleId !== undefined) {
            product.customerRoleId = String(input.customerRoleId ?? "").trim() || null;
        }
        if (input.panelConfig !== undefined) {
            product.panelConfig = this.normalizePanelConfig(input.panelConfig, product.panelConfig);
        }
        if (Array.isArray(input.requiredPrivilegedIntents) && input.requiredPrivilegedIntents.length > 0) {
            product.requiredPrivilegedIntents = input.requiredPrivilegedIntents;
        }
        if (input.planPrices && typeof input.planPrices === "object") {
            this.upsertStandardPlans(product.id, input.planPrices);
        }
        return this.getProductBySlug(product.slug);
    }
    upsertStandardPlans(productId, planPrices = {}) {
        for (const blueprint of STANDARD_PLAN_BLUEPRINTS) {
            const existing = this.store.plans.find((plan) => plan.productId === productId && plan.code === blueprint.code);
            const priceOverride = Number(planPrices?.[blueprint.code]);
            const nextPriceCents = Number.isFinite(priceOverride) && priceOverride > 0 ? priceOverride : blueprint.priceCents;
            if (existing) {
                Object.assign(existing, {
                    ...blueprint,
                    priceCents: nextPriceCents,
                });
                continue;
            }
            this.store.plans.push({
                id: (0, utils_js_1.makeId)(),
                productId,
                ...blueprint,
                priceCents: nextPriceCents,
            });
        }
    }
    ensureDefaultAddonsForAllProducts() {
        for (const product of this.store.products) {
            if (!product?.id) {
                continue;
            }
            this.ensureDefaultProductAddons(product.id);
        }
    }
    ensureDefaultProductAddons(productId) {
        const defaults = [
            {
                code: "custom-bio",
                name: "Bio Personalizada",
                description: "Adiciona bio personalizada ao bot do cliente.",
                priceCents: 1000,
                currency: "BRL",
                informationalOnly: false,
            },
            {
                code: "auto-restart",
                name: "AutoRestart",
                description: "O bot ja reinicia automaticamente em caso de erro.",
                priceCents: 0,
                currency: "BRL",
                informationalOnly: true,
            },
            {
                code: "custom-qr",
                name: "QrCode Personalizado",
                description: "O QR Code personalizado ja faz parte do pacote, sem custo extra.",
                priceCents: 0,
                currency: "BRL",
                informationalOnly: true,
            },
            {
                code: "priority-support",
                name: "Suporte Prioritario",
                description: "Nossa equipe permanece disponivel para ajudar, sem custo extra no momento.",
                priceCents: 0,
                currency: "BRL",
                informationalOnly: true,
            },
        ];
        for (const addon of defaults) {
            const exists = this.store.productAddons.find((item) => item.productId === productId && item.code === addon.code);
            if (exists) {
                Object.assign(exists, addon);
                continue;
            }
            this.store.productAddons.push({
                id: (0, utils_js_1.makeId)(),
                productId,
                ...addon,
            });
        }
    }
    normalizeSlug(value) {
        return String(value ?? "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }
}
exports.CatalogService = CatalogService;
