"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const runtime_config_page_js_1 = require("../modules/admin/runtime-config.page.js");
const security_js_1 = require("../core/security.js");
const serializers_js_1 = require("../core/serializers.js");
const manager_bot_config_js_1 = require("../modules/manager/manager-bot.config.js");
const purchase_setup_service_js_1 = require("../modules/purchase/purchase-setup.service.js");
const utils_js_1 = require("../core/utils.js");
function getZipBuffer(zipBase64) {
    if (!zipBase64) {
        throw new Error("zipBase64 e obrigatorio.");
    }
    const normalized = zipBase64
        .trim()
        .replace(/^data:application\/(?:zip|octet-stream);base64,/u, "");
    const buffer = Buffer.from(normalized, "base64");
    if (!buffer.length) {
        throw new Error("zipBase64 invalido.");
    }
    return buffer;
}
function isPublicUrl(urlValue) {
    if (!urlValue) {
        return false;
    }
    try {
        const parsed = new URL(urlValue);
        return !["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
    }
    catch {
        return false;
    }
}
function sendSecurityError(reply, error) {
    if (error instanceof security_js_1.SecurityError) {
        return reply.status(error.statusCode).send({ error: error.message });
    }
    return reply.status(500).send({ error: "Falha ao validar acesso." });
}
function enforceAdmin(request) {
    return (0, security_js_1.requireAdminAccess)(request);
}
function enforcePaymentOrAdmin(request, payment) {
    return (0, security_js_1.requirePaymentOrAdminAccess)(request, payment);
}
async function syncApprovedPaymentsToManager(result, services) {
    const managerBotService = services?.managerBotService;
    if (!managerBotService || typeof managerBotService.syncApprovedPaymentToCart !== "function") {
        return;
    }
    const processed = Array.isArray(result?.processed) ? result.processed : [];
    for (const item of processed) {
        if (String(item?.status ?? "").toLowerCase() !== "approved") {
            continue;
        }
        await managerBotService.syncApprovedPaymentToCart(item.paymentId).catch(() => null);
    }
}
async function syncApprovedPaymentResultToManager(paymentId, result, services) {
    const managerBotService = services?.managerBotService;
    if (!managerBotService || typeof managerBotService.syncApprovedPaymentToCart !== "function") {
        return;
    }
    if (String(result?.payment?.status ?? "").toLowerCase() !== "approved") {
        return;
    }
    await managerBotService.syncApprovedPaymentToCart(paymentId).catch(() => null);
}
function getProductSaleStatus(product, services) {
    const artifactResolution = services.sourceArtifactService.resolveArtifact(product.sourceSlug);
    const poolApps = services.appPoolService
        .listPool()
        .filter((appItem) => appItem.productId === product.id && appItem.source === "app_pool");
    const realTokenPoolApps = poolApps.filter((appItem) => !(0, utils_js_1.isPlaceholderBotToken)(appItem.botToken));
    const poolReady = product.botProvisioningMode !== "app_pool" || realTokenPoolApps.length > 0;
    const artifactReady = artifactResolution.mode !== "missing";
    const saleReady = artifactReady && poolReady;
    let blockedReason = null;
    if (!artifactReady) {
        blockedReason = artifactResolution.error ?? "Artefato da source nao encontrado.";
    }
    else if (!poolReady) {
        blockedReason = "Nao ha bots reais livres no pool para este produto.";
    }
    return {
        artifactReady,
        artifactMode: artifactResolution.mode,
        artifactSourcePath: artifactResolution.sourcePath ?? artifactResolution.artifactPath ?? null,
        saleReady,
        blockedReason,
    };
}
function assertProductReadyForCheckout(productSlug, services) {
    const product = services.catalogService.getProductBySlug(productSlug);
    if (!product) {
        throw new Error("Produto nao encontrado.");
    }
    const saleStatus = getProductSaleStatus(product, services);
    if (!saleStatus.saleReady) {
        throw new Error(saleStatus.blockedReason ?? "Produto temporariamente indisponivel para novas vendas.");
    }
}
async function registerRoutes(app, services) {
    app.get("/admin/runtime-config", async (_request, reply) => reply
        .type("text/html; charset=utf-8")
        .send((0, runtime_config_page_js_1.buildRuntimeConfigAdminPage)()));
    app.get("/admin/runtime-config/state", async (request, reply) => {
        try {
            enforceAdmin(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        return reply.send(services.managerRuntimeConfigService.getAdminSnapshot(request));
    });
    app.post("/admin/runtime-config", async (request, reply) => {
        try {
            enforceAdmin(request);
            return reply.send(services.managerRuntimeConfigService.updateRuntimeConfig(request.body ?? {}, request));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/admin/runtime-config/efipay/validate", async (request, reply) => {
        try {
            enforceAdmin(request);
            return reply.send(await services.managerRuntimeConfigService.validateEfipayConfiguration({
                syncWebhook: request.body?.syncWebhook === true,
            }, request));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/admin/runtime-config/efipay/webhook/sync", async (request, reply) => {
        try {
            enforceAdmin(request);
            return reply.send(await services.managerRuntimeConfigService.syncEfipayWebhook(request));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.get("/health", async () => ({
        ok: true,
        service: "bot-manager-saas",
        now: new Date().toISOString(),
    }));
    app.get("/setup/status", async (request, reply) => {
        try {
            enforceAdmin(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const products = services.catalogService.listProducts();
        const pool = services.appPoolService.listPool();
        const managerBot = (0, manager_bot_config_js_1.getManagerBotConfigStatus)();
        const efipayStatus = services.billingService.getEfipayWebhookStatus();
        const productsStatus = await Promise.all(products.map(async (product) => {
            const artifactResolution = services.sourceArtifactService.resolveArtifact(product.sourceSlug);
            const availableApps = pool.filter((appItem) => appItem.productId === product.id);
            const realTokenApps = availableApps.filter((appItem) => !(0, utils_js_1.isPlaceholderBotToken)(appItem.botToken));
            const requiresPool = product.botProvisioningMode === "app_pool";
            const notes = artifactResolution.mode === "missing"
                ? [artifactResolution.error ?? "Artefato da source nao encontrado."]
                : !requiresPool
                    ? [
                        "Produto configurado para receber nome/token do bot do cliente apos o pagamento.",
                    ]
                    : realTokenApps.length > 0
                        ? []
                        : ["Cadastre bots reais em data/discord-app-pool.json para este produto."];
            if (artifactResolution.warning) {
                notes.unshift(artifactResolution.warning);
            }
            return {
                productSlug: product.slug,
                sourceSlug: product.sourceSlug,
                botProvisioningMode: product.botProvisioningMode,
                artifactMode: artifactResolution.mode,
                artifactSourcePath: artifactResolution.sourcePath ?? artifactResolution.artifactPath ?? null,
                artifactReady: artifactResolution.mode !== "missing",
                availableDiscordApps: availableApps.length,
                discordAppsWithRealToken: realTokenApps.length,
                ready: artifactResolution.mode !== "missing" && (!requiresPool || realTokenApps.length > 0),
                notes,
            };
        }));
        const appBaseUrl = services.managerRuntimeConfigService.getResolvedAppBaseUrl(request);
        return {
            ready: services.squareCloudClient.isConfigured() &&
                productsStatus.some((item) => item.ready) &&
                isPublicUrl(appBaseUrl) &&
                efipayStatus.webhookPublicUrlReady,
            squareCloudConfigured: services.squareCloudClient.isConfigured(),
            appBaseUrl,
            appBaseUrlPublic: isPublicUrl(appBaseUrl),
            runtimeConfigAdminUrl: appBaseUrl ? `${appBaseUrl}/admin/runtime-config` : null,
            managerBot,
            efipay: efipayStatus,
            products: productsStatus,
        };
    });
    app.get("/products", async () => services.catalogService.listProducts().map((product) => ({
        ...product,
        readiness: getProductSaleStatus(product, services),
    })));
    app.get("/customers/:discordUserId/apps", async (request, reply) => {
        try {
            enforceAdmin(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const { discordUserId } = request.params;
        return reply.send(services.subscriptionService.listByDiscordUserId(discordUserId).map((bundle) => (0, serializers_js_1.sanitizeSubscriptionBundle)(bundle, {
            includeInstanceConfig: false,
        })));
    });
    app.post("/checkout/mock", async (request, reply) => {
        const body = request.body;
        if (!body.productSlug || !body.planCode || !body.discordUserId || !body.discordUsername) {
            return reply.status(400).send({ error: "Campos obrigatorios ausentes." });
        }
        try {
            assertProductReadyForCheckout(body.productSlug, services);
            return reply.status(201).send((0, serializers_js_1.sanitizeCheckoutResponse)(services.billingService.createMockCheckout({
                productSlug: body.productSlug,
                planCode: body.planCode,
                discordUserId: body.discordUserId,
                discordUsername: body.discordUsername,
                addonCodes: Array.isArray(body.addonCodes) ? body.addonCodes : [],
            })));
        }
        catch (error) {
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/checkout/efipay/pix", async (request, reply) => {
        const body = request.body;
        if (!body.productSlug || !body.planCode || !body.discordUserId || !body.discordUsername) {
            return reply.status(400).send({ error: "Campos obrigatorios ausentes." });
        }
        try {
            assertProductReadyForCheckout(body.productSlug, services);
            return reply.status(201).send((0, serializers_js_1.sanitizeCheckoutResponse)(await services.billingService.createEfipayPixCheckout({
                productSlug: body.productSlug,
                planCode: body.planCode,
                discordUserId: body.discordUserId,
                discordUsername: body.discordUsername,
                addonCodes: Array.isArray(body.addonCodes) ? body.addonCodes : [],
            })));
        }
        catch (error) {
            return reply.status(400).send({ error: error.message });
        }
    });
    app.get("/payments/:paymentId/setup", async (request, reply) => {
        const { paymentId } = request.params;
        try {
            const payment = services.billingService.getPaymentById(paymentId)?.payment;
            if (payment) {
                enforcePaymentOrAdmin(request, payment);
            }
            return reply.send(services.purchaseSetupService.getSetupStatus(paymentId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            if (error instanceof purchase_setup_service_js_1.PurchaseSetupError) {
                return reply.status(error.statusCode).send({
                    error: error.message,
                    ...error.details,
                });
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/payments/:paymentId/setup/reset", async (request, reply) => {
        const { paymentId } = request.params;
        try {
            const payment = services.billingService.getPaymentById(paymentId)?.payment;
            if (payment) {
                enforcePaymentOrAdmin(request, payment);
            }
            return reply.send(services.purchaseSetupService.resetSetupSession(paymentId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            if (error instanceof purchase_setup_service_js_1.PurchaseSetupError) {
                return reply.status(error.statusCode).send({
                    error: error.message,
                    ...error.details,
                });
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/payments/:paymentId/setup/progress", async (request, reply) => {
        const { paymentId } = request.params;
        try {
            const payment = services.billingService.getPaymentById(paymentId)?.payment;
            if (payment) {
                enforcePaymentOrAdmin(request, payment);
            }
            return reply.send(services.purchaseSetupService.nextProgressMessage(paymentId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            if (error instanceof purchase_setup_service_js_1.PurchaseSetupError) {
                return reply.status(error.statusCode).send({
                    error: error.message,
                    ...error.details,
                });
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/payments/:paymentId/setup/submit-bot", async (request, reply) => {
        const { paymentId } = request.params;
        const body = request.body;
        try {
            const payment = services.billingService.getPaymentById(paymentId)?.payment;
            if (payment) {
                enforcePaymentOrAdmin(request, payment);
            }
            return reply.send((0, serializers_js_1.sanitizeSetupSubmissionResult)(await services.purchaseSetupService.submitBotForProvisioning(paymentId, {
                applicationName: body.applicationName,
                botToken: body.botToken,
                ownerDiscordUserId: body.ownerDiscordUserId,
                customBioText: body.customBioText,
                defaultGuildId: body.defaultGuildId,
            })));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            if (error instanceof purchase_setup_service_js_1.PurchaseSetupError) {
                return reply.status(error.statusCode).send({
                    error: error.message,
                    ...error.details,
                });
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/webhooks/payments/mock", async (request, reply) => {
        const body = request.body;
        if (!body.subscriptionId) {
            return reply.status(400).send({ error: "subscriptionId e obrigatorio." });
        }
        try {
            enforceAdmin(request);
            const result = await services.billingService.approveMockPayment(body.subscriptionId);
            await syncApprovedPaymentResultToManager(result.payment.id, result, services);
            return reply.send({
                payment: (0, serializers_js_1.sanitizePaymentRecord)(result.payment),
                activation: (0, serializers_js_1.sanitizeActivationResult)(result.activation),
            });
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/webhooks/efipay", async (request, reply) => {
        const query = request.query;
        if (!services.billingService.validateEfipayWebhookHmac(query.hmac)) {
            return reply.status(401).send({ error: "Webhook Efipay rejeitada." });
        }
        try {
            const result = await services.billingService.handleEfipayWebhook(request.body);
            await syncApprovedPaymentsToManager(result, services);
            return reply.status(202).send(result);
        }
        catch (error) {
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/webhooks/efipay/pix", async (request, reply) => {
        const query = request.query;
        if (!services.billingService.validateEfipayWebhookHmac(query.hmac)) {
            return reply.status(401).send({ error: "Webhook Efipay rejeitada." });
        }
        try {
            const result = await services.billingService.handleEfipayWebhook(request.body);
            await syncApprovedPaymentsToManager(result, services);
            return reply.status(202).send(result);
        }
        catch (error) {
            return reply.status(400).send({ error: error.message });
        }
    });
    app.get("/subscriptions/:subscriptionId", async (request, reply) => {
        try {
            enforceAdmin(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const { subscriptionId } = request.params;
        const item = services.subscriptionService.getById(subscriptionId);
        if (!item) {
            return reply.status(404).send({ error: "Assinatura nao encontrada." });
        }
        return reply.send((0, serializers_js_1.sanitizeSubscriptionBundle)(item, {
            includeInstanceConfig: true,
        }));
    });
    app.post("/subscriptions/:subscriptionId/renew", async (request, reply) => {
        const { subscriptionId } = request.params;
        const body = request.body;
        try {
            enforceAdmin(request);
            return reply.send((0, serializers_js_1.sanitizeSubscriptionBundle)(await services.subscriptionService.renewSubscription(subscriptionId, body.quantity && body.quantity > 0 ? body.quantity : 1), {
                includeInstanceConfig: false,
            }));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/subscriptions/:subscriptionId/renew/efipay/pix", async (request, reply) => {
        const { subscriptionId } = request.params;
        const body = request.body;
        try {
            enforceAdmin(request);
            return reply.status(201).send((0, serializers_js_1.sanitizeCheckoutResponse)(await services.billingService.createEfipayPixRenewal(subscriptionId, body.quantity && body.quantity > 0 ? body.quantity : 1), {
                includeAccessToken: false,
            }));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/maintenance/expire", async (_request, reply) => {
        try {
            enforceAdmin(_request);
            return reply.send({
                changes: await services.subscriptionService.runExpirationCycle(new Date()),
            });
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.get("/payments/:paymentId", async (request, reply) => {
        try {
            enforceAdmin(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const { paymentId } = request.params;
        const item = services.billingService.getPaymentById(paymentId);
        if (!item) {
            return reply.status(404).send({ error: "Pagamento nao encontrado." });
        }
        return reply.send((0, serializers_js_1.sanitizePaymentDetails)(item));
    });
    app.post("/payments/:paymentId/reconcile", async (request, reply) => {
        const { paymentId } = request.params;
        try {
            enforceAdmin(request);
            const result = await services.billingService.reconcileEfipayPayment(paymentId);
            await syncApprovedPaymentResultToManager(paymentId, result, services);
            return reply.send({
                ...result,
                payment: (0, serializers_js_1.sanitizePaymentRecord)(result.payment),
                activation: (0, serializers_js_1.sanitizeActivationResult)(result.activation),
            });
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.get("/billing/efipay/webhook", async (_request, reply) => {
        try {
            enforceAdmin(_request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        return reply.send(services.billingService.getEfipayWebhookStatus());
    });
    app.post("/billing/efipay/webhook/sync", async (_request, reply) => {
        try {
            enforceAdmin(_request);
            return reply.send(await services.billingService.syncEfipayWebhook());
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.get("/instances/:instanceId", async (request, reply) => {
        try {
            enforceAdmin(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const { instanceId } = request.params;
        const instance = services.instanceService.getById(instanceId);
        if (!instance) {
            return reply.status(404).send({ error: "Instancia nao encontrada." });
        }
        return reply.send((0, serializers_js_1.sanitizeInstance)(instance, {
            includeConfig: true,
        }));
    });
    app.get("/instances/:instanceId/install", async (request, reply) => {
        try {
            enforceAdmin(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const { instanceId } = request.params;
        const instance = services.instanceService.getById(instanceId);
        if (!instance) {
            return reply.status(404).send({ error: "Instancia nao encontrada." });
        }
        return reply.send({
            instanceId: instance.id,
            installUrl: instance.installUrl,
            status: instance.status,
            hostingProvider: instance.hostingProvider,
            hostingAccountId: instance.hostingAccountId,
            hostingAppId: instance.hostingAppId,
            assignedGuildId: instance.assignedGuildId,
        });
    });
    app.get("/instances/:instanceId/overview", async (request, reply) => {
        try {
            enforceAdmin(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const { instanceId } = request.params;
        const subscriptionBundle = services.subscriptionService.getById(services.instanceService.getById(instanceId)?.subscriptionId ?? "");
        const instance = services.instanceService.getById(instanceId);
        if (!instance || !subscriptionBundle) {
            return reply.status(404).send({ error: "Instancia nao encontrada." });
        }
        let squareCloud = null;
        if (services.squareCloudClient.isConfigured() && !instance.hostingAppId.startsWith("pending-")) {
            try {
                const [info, status] = await Promise.all([
                    services.squareCloudClient.getAppInfo(instance.hostingAppId),
                    services.squareCloudClient.getAppStatus(instance.hostingAppId),
                ]);
                squareCloud = {
                    info: info.response,
                    status: status.response,
                };
            }
            catch (error) {
                squareCloud = {
                    error: error.message,
                };
            }
        }
        return reply.send({
            applicationCard: {
                title: subscriptionBundle.product?.name ?? instance.sourceSlug,
                squareCloudStatus: squareCloud,
                expiresAt: instance.expiresAt,
                commercialOwnerDiscordUserId: subscriptionBundle.subscription.commercialOwnerDiscordUserId,
                installUrl: instance.installUrl,
                hostingProvider: instance.hostingProvider,
                hostingAccountId: instance.hostingAccountId,
                hostingAppId: instance.hostingAppId,
            },
        });
    });
    app.post("/instances/:instanceId/assign-guild", async (request, reply) => {
        const { instanceId } = request.params;
        const body = request.body;
        if (!body.guildId) {
            return reply.status(400).send({ error: "guildId e obrigatorio." });
        }
        try {
            enforceAdmin(request);
            return reply.send((0, serializers_js_1.sanitizeInstance)(services.instanceService.setAssignedGuild(instanceId, body.guildId), {
                includeConfig: false,
            }));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/internal/instances/bootstrap", async (request, reply) => {
        const body = request.body;
        if (!body.instanceId || !body.instanceSecret) {
            return reply.status(400).send({ error: "instanceId e instanceSecret sao obrigatorios." });
        }
        try {
            return reply.send(services.instanceService.bootstrap(body.instanceId, body.instanceSecret));
        }
        catch (error) {
            return reply.status(401).send({ error: error.message });
        }
    });
    app.post("/internal/instances/heartbeat", async (request, reply) => {
        const body = request.body;
        if (!body.instanceId || !body.instanceSecret) {
            return reply.status(400).send({ error: "instanceId e instanceSecret sao obrigatorios." });
        }
        try {
            return reply.send(services.instanceService.heartbeat(body.instanceId, body.instanceSecret, body.metrics ?? {}));
        }
        catch (error) {
            return reply.status(401).send({ error: error.message });
        }
    });
    app.get("/hosting/squarecloud/apps/:appId/status", async (request, reply) => {
        const { appId } = request.params;
        try {
            enforceAdmin(request);
            return reply.send(await services.squareCloudClient.getAppStatus(appId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.get("/hosting/squarecloud/apps/:appId/info", async (request, reply) => {
        const { appId } = request.params;
        try {
            enforceAdmin(request);
            return reply.send(await services.squareCloudClient.getAppInfo(appId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.get("/hosting/squarecloud/apps/:appId/logs", async (request, reply) => {
        const { appId } = request.params;
        try {
            enforceAdmin(request);
            return reply.send(await services.squareCloudClient.getAppLogs(appId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/hosting/squarecloud/apps", async (request, reply) => {
        const body = request.body;
        try {
            enforceAdmin(request);
            return reply.status(201).send(await services.squareCloudClient.uploadApplication(getZipBuffer(body.zipBase64), body.fileName ?? "app.zip"));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/hosting/squarecloud/apps/:appId/start", async (request, reply) => {
        const { appId } = request.params;
        try {
            enforceAdmin(request);
            return reply.send(await services.squareCloudClient.startApp(appId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/hosting/squarecloud/apps/:appId/commit", async (request, reply) => {
        const { appId } = request.params;
        const body = request.body;
        try {
            enforceAdmin(request);
            return reply.send(await services.squareCloudClient.commitApplication(appId, getZipBuffer(body.zipBase64), body.fileName ?? "app.zip"));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/hosting/squarecloud/apps/:appId/stop", async (request, reply) => {
        const { appId } = request.params;
        try {
            enforceAdmin(request);
            return reply.send(await services.squareCloudClient.stopApp(appId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.post("/hosting/squarecloud/apps/:appId/restart", async (request, reply) => {
        const { appId } = request.params;
        try {
            enforceAdmin(request);
            return reply.send(await services.squareCloudClient.restartApp(appId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
    app.delete("/hosting/squarecloud/apps/:appId", async (request, reply) => {
        const { appId } = request.params;
        try {
            enforceAdmin(request);
            return reply.send(await services.squareCloudClient.deleteApp(appId));
        }
        catch (error) {
            if (error instanceof security_js_1.SecurityError) {
                return sendSecurityError(reply, error);
            }
            return reply.status(400).send({ error: error.message });
        }
    });
}
