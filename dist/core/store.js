"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSeedStoreState = buildSeedStoreState;
exports.createEmptyManagerRuntimeConfig = createEmptyManagerRuntimeConfig;
exports.InMemoryStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const utils_js_1 = require("./utils.js");
const STATIC_IDS = {
    products: {
        botTicketHype: "11111111-1111-4111-8111-111111111111",
    },
    plans: {
        weekly: "41111111-1111-4111-8111-111111111111",
        monthly: "41111111-1111-4111-8111-111111111112",
        quarterly: "41111111-1111-4111-8111-111111111113",
        semiannual: "41111111-1111-4111-8111-111111111114",
        annual: "41111111-1111-4111-8111-111111111115",
    },
};
function createEmptyManagerRuntimeConfig() {
    return {
        appBaseUrl: null,
        updatedAt: null,
        access: {
            adminUserIds: [],
            staffUserIds: [],
            staffRoleIds: [],
        },
        sales: {
            cartCategoryId: null,
            customerRoleId: null,
            cartStaffRoleIds: [],
            logsChannelId: null,
            cartInactivityMinutes: 5,
            cartChannelNameTemplate: "carrinho-{user}",
            autoAssignCustomerRole: true,
        },
        sources: {
            "bot-ticket-hype": {
                githubRepo: process.env.SOURCE_GITHUB_REPO_BOT_TICKET_HYPE ?? "hypevalorant/bot-ticket-hype",
                githubRef: process.env.SOURCE_GITHUB_REF_BOT_TICKET_HYPE ?? "main",
                excludePaths: ["data", "transcripts"],
            },
        },
        billing: {
            efipay: {
                clientId: null,
                clientSecret: null,
                pixKey: null,
                certP12Base64: null,
                certP12Passphrase: null,
                certFileName: null,
                caBase64: null,
                caFileName: null,
                baseUrl: null,
                sandbox: null,
                pixExpirationSeconds: null,
                webhookPublicUrl: null,
                webhookPath: null,
                webhookSecret: null,
                webhookSkipMtls: null,
                autoSyncWebhook: null,
                lastValidationOk: false,
                lastValidatedAt: null,
                lastValidationError: null,
                lastWebhookSyncAt: null,
                lastWebhookSyncError: null,
            },
        },
    };
}
function buildSeedStoreState() {
    const createdAt = (0, utils_js_1.nowIso)();
    const tutorialUrl = process.env.BOT_SETUP_TUTORIAL_URL ?? "https://youtu.be/7eamnEDwOW8";
    const botTicketHypeProduct = {
        id: STATIC_IDS.products.botTicketHype,
        slug: "bot-ticket-hype",
        name: "Bot Ticket Hype",
        description: "Bot de tickets terceirizado como servico, com configuracao final feita pelo proprio cliente.",
        sourceSlug: "bot-ticket-hype",
        appPoolKey: "bot-ticket-hype",
        botProvisioningMode: "customer_token",
        requiredPrivilegedIntents: ["guild_presences", "guild_members", "message_content"],
        tutorialUrl,
        customerRoleId: null,
        panelConfig: {
            title: null,
            summary: null,
            details: null,
            imageUrl: null,
            embedColor: null,
            previewUrl: null,
            buttonLabel: null,
            pricePrefix: null,
            footerText: null,
            approvedTitle: null,
            approvedDescription: null,
            approvedImageUrl: null,
            approvedEmbedColor: null,
            publishedChannelId: null,
            publishedMessageId: null,
        },
    };
    return {
        createdAt,
        products: [botTicketHypeProduct],
        productAddons: [
            {
                id: "51111111-1111-4111-8111-111111111111",
                productId: botTicketHypeProduct.id,
                code: "custom-bio",
                name: "Bio Personalizada",
                description: "Adiciona bio personalizada ao bot do cliente.",
                priceCents: 1000,
                currency: "BRL",
                informationalOnly: false,
            },
            {
                id: "51111111-1111-4111-8111-111111111112",
                productId: botTicketHypeProduct.id,
                code: "auto-restart",
                name: "AutoRestart",
                description: "O bot ja reinicia automaticamente em caso de erro.",
                priceCents: 0,
                currency: "BRL",
                informationalOnly: true,
            },
            {
                id: "51111111-1111-4111-8111-111111111113",
                productId: botTicketHypeProduct.id,
                code: "custom-qr",
                name: "QrCode Personalizado",
                description: "O QR Code personalizado ja faz parte do pacote, sem custo extra.",
                priceCents: 0,
                currency: "BRL",
                informationalOnly: true,
            },
            {
                id: "51111111-1111-4111-8111-111111111114",
                productId: botTicketHypeProduct.id,
                code: "priority-support",
                name: "Suporte Prioritario",
                description: "Nossa equipe permanece disponivel para ajudar, sem custo extra no momento.",
                priceCents: 0,
                currency: "BRL",
                informationalOnly: true,
            },
        ],
        plans: [
            {
                id: STATIC_IDS.plans.weekly,
                productId: botTicketHypeProduct.id,
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
                id: STATIC_IDS.plans.monthly,
                productId: botTicketHypeProduct.id,
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
                id: STATIC_IDS.plans.quarterly,
                productId: botTicketHypeProduct.id,
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
                id: STATIC_IDS.plans.semiannual,
                productId: botTicketHypeProduct.id,
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
                id: STATIC_IDS.plans.annual,
                productId: botTicketHypeProduct.id,
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
        ],
        customers: [],
        subscriptions: [],
        instances: [],
        payments: [],
        checkoutSessions: [],
        purchaseSetupSessions: [],
        managerRuntimeConfig: createEmptyManagerRuntimeConfig(),
    };
}
class InMemoryStore {
    customers = [];
    products = [];
    productAddons = [];
    plans = [];
    discordApps = [];
    subscriptions = [];
    instances = [];
    payments = [];
    checkoutSessions = [];
    purchaseSetupSessions = [];
    managerRuntimeConfig = createEmptyManagerRuntimeConfig();
    constructor() {
        this.seed();
    }
    seed() {
        const seed = buildSeedStoreState();
        this.products.push(...seed.products);
        this.productAddons.push(...seed.productAddons);
        this.plans.push(...seed.plans);
        const configuredDiscordApps = this.loadDiscordAppsFromConfig();
        if (configuredDiscordApps.length > 0) {
            this.discordApps.push(...configuredDiscordApps);
        }
    }
    loadDiscordAppsFromConfig() {
        const configPath = (0, node_path_1.resolve)(process.cwd(), process.env.DISCORD_APP_POOL_FILE ?? "data/discord-app-pool.json");
        if (!(0, node_fs_1.existsSync)(configPath)) {
            return [];
        }
        const raw = (0, utils_js_1.parseJsonSafe)((0, node_fs_1.readFileSync)(configPath, "utf8"));
        if (!raw?.discordApps?.length) {
            return [];
        }
        const validStatuses = new Set(["available", "allocated", "disabled", "recycling"]);
        return raw.discordApps.flatMap((entry) => {
            const product = this.products.find((item) => item.slug === String(entry.productSlug ?? "").trim());
            const applicationId = String(entry.applicationId ?? "").trim();
            const clientId = String(entry.clientId ?? "").trim();
            const appName = String(entry.appName ?? "").trim();
            const botToken = String(entry.botToken ?? "").trim();
            if (!product || !applicationId || !clientId || !appName || !botToken) {
                return [];
            }
            return [
                {
                    id: (0, utils_js_1.makeId)(),
                    productId: product.id,
                    poolKey: String(entry.poolKey ?? "").trim() || product.appPoolKey,
                    applicationId,
                    clientId,
                    appName,
                    botToken,
                    defaultGuildId: String(entry.defaultGuildId ?? "").trim() || null,
                    runtimeEnv: this.normalizeRuntimeEnv(entry.runtimeEnv),
                    source: "app_pool",
                    customerId: null,
                    poolStatus: validStatuses.has(entry.poolStatus ?? "available")
                        ? entry.poolStatus ?? "available"
                        : "available",
                },
            ];
        });
    }
    normalizeRuntimeEnv(runtimeEnv) {
        if (!runtimeEnv) {
            return {};
        }
        return Object.fromEntries(Object.entries(runtimeEnv)
            .filter(([key, value]) => String(key).trim() && value !== undefined && value !== null)
            .map(([key, value]) => [String(key).trim(), String(value)]));
    }
}
exports.InMemoryStore = InMemoryStore;
