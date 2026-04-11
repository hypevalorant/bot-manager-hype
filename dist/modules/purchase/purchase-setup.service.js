"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseSetupService = exports.PurchaseSetupError = void 0;
const utils_js_1 = require("../../core/utils.js");
const SETUP_ACTION_TIMEOUT_MINUTES = 1;
const SETUP_RETRY_COOLDOWN_MINUTES = 1;
const DISCORD_DEVELOPER_PORTAL_URL = "https://discord.com/developers/applications";
const PROCESSING_FACTS = [
    "🔄 | Configurando o seu bot...",
    "🔄 | Hospedando seu bot em nossa database...",
];
const SETUP_COMPLETED_LABEL = "✅ | Bot ligado! Seu sistema já está funcionando, use /botsetup no seu servidor para efetuar as primeiras configurações!";
const INTENT_LABELS = {
    guild_presences: "Intenção de presença",
    guild_members: "Intenção dos membros do servidor",
    message_content: "Intenção do conteúdo das mensagens",
};
class PurchaseSetupError extends Error {
    statusCode;
    details;
    constructor(message, statusCode = 400, details = {}) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = "PurchaseSetupError";
    }
}
exports.PurchaseSetupError = PurchaseSetupError;
class PurchaseSetupService {
    store;
    catalogService;
    subscriptionService;
    instanceService;
    discordBotClient;
    defaultPermissions;
    constructor(store, catalogService, subscriptionService, instanceService, discordBotClient, defaultPermissions) {
        this.store = store;
        this.catalogService = catalogService;
        this.subscriptionService = subscriptionService;
        this.instanceService = instanceService;
        this.discordBotClient = discordBotClient;
        this.defaultPermissions = defaultPermissions;
    }
    getSetupStatus(paymentId) {
        const context = this.getSetupContext(paymentId);
        const requiresSetup = context.bundle.product?.botProvisioningMode === "customer_token";
        if (!requiresSetup) {
            return {
                ok: true,
                setupRequired: false,
                paymentStatus: context.payment.status,
                message: "Este produto não exige envio manual do token do bot.",
            };
        }
        if (context.payment.status !== "approved") {
            return {
                ok: true,
                setupRequired: true,
                paymentStatus: context.payment.status,
                status: "awaiting_payment",
                developerPortalUrl: DISCORD_DEVELOPER_PORTAL_URL,
                tutorialUrl: context.bundle.product?.tutorialUrl ?? null,
                addonCodes: context.addons.map((addon) => addon.code),
                message: "Aguarde a aprovação do pagamento para liberar o envio do bot.",
            };
        }
        const session = this.getOrCreateApprovedSession(context);
        this.refreshSessionStatus(session);
        return this.buildPublicSetupStatus(session, context);
    }
    resetSetupSession(paymentId) {
        const context = this.requireApprovedCustomerTokenSetup(paymentId);
        const session = this.getOrCreateApprovedSession(context);
        session.status = "awaiting_submission";
        session.cooldownUntil = null;
        session.lastError = null;
        this.touchSession(session);
        return this.buildPublicSetupStatus(session, context);
    }
    nextProgressMessage(paymentId) {
        const context = this.requireApprovedCustomerTokenSetup(paymentId);
        const session = this.getOrCreateApprovedSession(context);
        this.refreshSessionStatus(session);
        if (session.status === "expired") {
            throw new PurchaseSetupError("Interação expirada.", 410, {
                code: "interaction_expired",
            });
        }
        session.lastProgressIndex = (session.lastProgressIndex + 1) % PROCESSING_FACTS.length;
        this.touchSession(session);
        return {
            ok: true,
            status: session.status,
            progressMessage: PROCESSING_FACTS[session.lastProgressIndex],
            actionExpiresAt: session.actionExpiresAt,
            secondsUntilExpiration: (0, utils_js_1.secondsUntil)(session.actionExpiresAt),
        };
    }
    async submitBotForProvisioning(paymentId, input, options = {}) {
        const context = this.requireApprovedCustomerTokenSetup(paymentId);
        const session = this.getOrCreateApprovedSession(context);
        this.ensureCanSubmit(session);
        const desiredApplicationName = (0, utils_js_1.normalizeHumanTitle)(input.applicationName ?? "");
        const botToken = String(input.botToken ?? "").trim();
        const ownerDiscordUserId = String(input.ownerDiscordUserId ?? "").trim();
        const customBioText = String(input.customBioText ?? "").trim();
        if (!desiredApplicationName) {
            throw new PurchaseSetupError("Nome da aplicação obrigatório.", 400, {
                code: "application_name_required",
            });
        }
        if (!botToken) {
            throw new PurchaseSetupError("Token do bot obrigatório.", 400, {
                code: "bot_token_required",
            });
        }
        if (ownerDiscordUserId && !/^\d{5,32}$/u.test(ownerDiscordUserId)) {
            throw new PurchaseSetupError("Owner Discord User ID inválido.", 400, {
                code: "owner_discord_user_id_invalid",
            });
        }
        const hasCustomBioAddon = context.addons.some((addon) => addon.code === "custom-bio");
        if (hasCustomBioAddon && !customBioText) {
            throw new PurchaseSetupError("Bio personalizada selecionada, mas nenhum texto foi enviado.", 400, {
                code: "custom_bio_required",
            });
        }
        session.status = "processing";
        this.touchSession(session);
        try {
            session.lastProgressIndex = 0;
            await options.onProgress?.({
                stage: "configuring",
                message: PROCESSING_FACTS[0],
            });
            const inspection = await this.discordBotClient.inspectBotToken(botToken);
            const missingIntents = this.getMissingIntents(context.bundle.product?.requiredPrivilegedIntents ?? [], inspection.enabledPrivilegedIntents);
            if (missingIntents.length > 0) {
                this.applyCooldown(session, "As intents não estão ativas.");
                throw new PurchaseSetupError("As intents não estão ativas.", 400, {
                    code: "missing_privileged_intents",
                    missingIntents,
                    missingIntentLabels: missingIntents.map((intent) => INTENT_LABELS[intent]),
                    developerPortalUrl: `${DISCORD_DEVELOPER_PORTAL_URL}/${inspection.applicationId}/bot`,
                    retryAfterSeconds: (0, utils_js_1.secondsUntil)(session.cooldownUntil),
                });
            }
            if (desiredApplicationName && desiredApplicationName !== inspection.botUsername) {
                await this.discordBotClient.updateBotUsername(botToken, desiredApplicationName);
            }
            if (hasCustomBioAddon && customBioText) {
                await this.discordBotClient.updateApplicationDescription(botToken, customBioText);
            }
            const refreshedInspection = await this.discordBotClient.inspectBotToken(botToken);
            const resolvedName = desiredApplicationName || refreshedInspection.botUsername || refreshedInspection.applicationName;
            session.lastProgressIndex = 1;
            await options.onProgress?.({
                stage: "hosting",
                message: PROCESSING_FACTS[1],
            });
            const instance = await this.instanceService.provisionCustomerOwnedBot(context.bundle.subscription, {
                customerId: context.bundle.customer?.id ?? context.bundle.subscription.customerId,
                productId: context.bundle.product?.id ?? context.bundle.subscription.productId,
                applicationId: refreshedInspection.applicationId,
                clientId: refreshedInspection.clientId,
                appName: resolvedName,
                botToken,
                ownerDiscordUserId: ownerDiscordUserId || context.bundle.subscription.commercialOwnerDiscordUserId,
                defaultGuildId: String(input.defaultGuildId ?? "").trim() || null,
                runtimeEnv: {
                    CUSTOMER_PROVISIONING_MODE: "customer_token",
                    CUSTOMER_SUBMITTED_APPLICATION_NAME: resolvedName,
                    CUSTOMER_OWNER_DISCORD_USER_ID: ownerDiscordUserId || context.bundle.subscription.commercialOwnerDiscordUserId,
                },
            });
            session.status = "completed";
            session.applicationName = resolvedName;
            session.customBioText = customBioText || null;
            session.discordApplicationId = refreshedInspection.applicationId;
            session.discordBotUserId = refreshedInspection.botUserId;
            session.instanceId = instance.id;
            session.installUrl = instance.installUrl;
            session.completedAt = (0, utils_js_1.nowIso)();
            session.lastError = null;
            this.touchSession(session);
            return {
                ok: true,
                status: this.buildPublicSetupStatus(session, context),
                successMessage: SETUP_COMPLETED_LABEL,
                validation: {
                    applicationId: refreshedInspection.applicationId,
                    botUserId: refreshedInspection.botUserId,
                    botUsername: refreshedInspection.botUsername,
                    enabledPrivilegedIntents: refreshedInspection.enabledPrivilegedIntents,
                },
                application: {
                    id: refreshedInspection.applicationId,
                    name: resolvedName,
                    inviteUrl: instance.installUrl ||
                        (0, utils_js_1.buildInstallUrl)({
                            clientId: refreshedInspection.clientId,
                            permissions: this.defaultPermissions,
                        }),
                    developerPortalBotUrl: `${DISCORD_DEVELOPER_PORTAL_URL}/${refreshedInspection.applicationId}/bot`,
                },
                instance,
            };
        }
        catch (error) {
            if (error instanceof PurchaseSetupError) {
                throw error;
            }
            this.applyCooldown(session, String(error.message || error || "Falha ao enviar bot."));
            throw new PurchaseSetupError(String(error.message || "Falha ao enviar bot."), 400, {
                code: "bot_submission_failed",
                retryAfterSeconds: (0, utils_js_1.secondsUntil)(session.cooldownUntil),
            });
        }
    }
    getSetupContext(paymentId) {
        const payment = this.store.payments.find((item) => item.id === paymentId);
        if (!payment) {
            throw new PurchaseSetupError("Pagamento não encontrado.", 404, {
                code: "payment_not_found",
            });
        }
        const bundle = this.subscriptionService.getById(payment.subscriptionId);
        if (!bundle?.product || !bundle.plan || !bundle.customer) {
            throw new PurchaseSetupError("Pagamento sem assinatura/produto/plano/cliente associado.", 400, {
                code: "payment_context_incomplete",
            });
        }
        const addonCodes = Array.isArray(payment.metadata.addonCodes)
            ? payment.metadata.addonCodes.map((code) => String(code))
            : [];
        return {
            payment,
            bundle,
            addons: this.catalogService.getAddonsByCodes(bundle.product.id, addonCodes),
        };
    }
    requireApprovedCustomerTokenSetup(paymentId) {
        const context = this.getSetupContext(paymentId);
        if (context.payment.purpose !== "activation") {
            throw new PurchaseSetupError("Somente pagamentos de ativação usam este fluxo.", 400, {
                code: "setup_not_supported_for_renewal",
            });
        }
        if (context.bundle.product?.botProvisioningMode !== "customer_token") {
            throw new PurchaseSetupError("Este produto não usa setup manual de token.", 400, {
                code: "setup_not_required",
            });
        }
        if (context.payment.status !== "approved") {
            throw new PurchaseSetupError("Pagamento ainda não aprovado.", 409, {
                code: "payment_not_approved",
            });
        }
        return context;
    }
    getOrCreateApprovedSession(context) {
        const existing = this.store.purchaseSetupSessions.find((item) => item.paymentId === context.payment.id);
        if (existing) {
            return existing;
        }
        const now = new Date();
        const session = {
            id: (0, utils_js_1.makeId)(),
            paymentId: context.payment.id,
            subscriptionId: context.payment.subscriptionId,
            customerId: context.bundle.customer?.id ?? context.bundle.subscription.customerId,
            productId: context.bundle.product?.id ?? context.bundle.subscription.productId,
            addonCodes: context.addons.map((addon) => addon.code),
            status: "awaiting_submission",
            actionExpiresAt: (0, utils_js_1.addMinutes)(now, SETUP_ACTION_TIMEOUT_MINUTES).toISOString(),
            cooldownUntil: null,
            lastError: null,
            lastProgressIndex: -1,
            applicationName: null,
            customBioText: null,
            discordApplicationId: null,
            discordBotUserId: null,
            instanceId: null,
            installUrl: null,
            createdAt: (0, utils_js_1.nowIso)(),
            updatedAt: (0, utils_js_1.nowIso)(),
            completedAt: null,
        };
        this.store.purchaseSetupSessions.push(session);
        return session;
    }
    ensureCanSubmit(session) {
        this.refreshSessionStatus(session);
        if (session.status === "expired") {
            throw new PurchaseSetupError("Interação expirada.", 410, {
                code: "interaction_expired",
            });
        }
        if (session.cooldownUntil && (0, utils_js_1.secondsUntil)(session.cooldownUntil) > 0) {
            throw new PurchaseSetupError(`Segure a ansiedade por mais ${(0, utils_js_1.secondsUntil)(session.cooldownUntil)} segundo(s) antes de tentar novamente.`, 429, {
                code: "setup_cooldown",
                retryAfterSeconds: (0, utils_js_1.secondsUntil)(session.cooldownUntil),
            });
        }
    }
    refreshSessionStatus(session) {
        if (session.status === "completed") {
            return;
        }
        if (session.cooldownUntil && (0, utils_js_1.secondsUntil)(session.cooldownUntil) > 0) {
            session.status = "cooldown";
            return;
        }
        if ((0, utils_js_1.secondsUntil)(session.actionExpiresAt) === 0) {
            session.status = "expired";
            return;
        }
        if (session.status === "cooldown" || session.status === "failed" || session.status === "expired") {
            session.status = "awaiting_submission";
        }
    }
    applyCooldown(session, message) {
        const now = new Date();
        session.status = "cooldown";
        session.cooldownUntil = (0, utils_js_1.addMinutes)(now, SETUP_RETRY_COOLDOWN_MINUTES).toISOString();
        session.actionExpiresAt = (0, utils_js_1.addMinutes)(now, SETUP_ACTION_TIMEOUT_MINUTES).toISOString();
        session.lastError = message;
        session.updatedAt = (0, utils_js_1.nowIso)();
    }
    touchSession(session) {
        session.actionExpiresAt = (0, utils_js_1.addMinutes)(new Date(), SETUP_ACTION_TIMEOUT_MINUTES).toISOString();
        session.updatedAt = (0, utils_js_1.nowIso)();
    }
    getMissingIntents(requiredIntents, enabledIntents) {
        return requiredIntents.filter((intent) => enabledIntents[intent] !== true);
    }
    buildPublicSetupStatus(session, context) {
        const retryAfterSeconds = (0, utils_js_1.secondsUntil)(session.cooldownUntil);
        const expiresInSeconds = (0, utils_js_1.secondsUntil)(session.actionExpiresAt);
        const customBioSelected = context.addons.some((addon) => addon.code === "custom-bio");
        return {
            ok: true,
            setupRequired: true,
            paymentStatus: context.payment.status,
            status: session.status,
            actionExpiresAt: session.actionExpiresAt,
            secondsUntilExpiration: expiresInSeconds,
            cooldownUntil: session.cooldownUntil,
            retryAfterSeconds,
            developerPortalUrl: DISCORD_DEVELOPER_PORTAL_URL,
            tutorialUrl: context.bundle.product?.tutorialUrl ?? null,
            botDeveloperPortalUrl: session.discordApplicationId
                ? `${DISCORD_DEVELOPER_PORTAL_URL}/${session.discordApplicationId}/bot`
                : null,
            applicationId: session.discordApplicationId,
            installUrl: session.installUrl,
            customBioSelected,
            lastError: session.lastError,
            addonCodes: session.addonCodes,
            addons: context.addons.map((addon) => ({
                code: addon.code,
                name: addon.name,
                priceCents: addon.priceCents,
                informationalOnly: addon.informationalOnly,
            })),
            plan: context.bundle.plan,
            product: {
                slug: context.bundle.product?.slug,
                name: context.bundle.product?.name,
            },
            nextProcessingFact: session.status === "processing"
                ? PROCESSING_FACTS[(session.lastProgressIndex + 1) % PROCESSING_FACTS.length]
                : null,
            completedMessage: session.status === "completed" ? SETUP_COMPLETED_LABEL : null,
            completed: session.status === "completed",
            canSubmit: session.status === "awaiting_submission" ||
                (session.status === "cooldown" && retryAfterSeconds === 0),
        };
    }
}
exports.PurchaseSetupService = PurchaseSetupService;
