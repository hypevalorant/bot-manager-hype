"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const node_crypto_1 = require("node:crypto");
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
function secureEqual(left, right) {
    const leftBuffer = Buffer.from(String(left ?? ""), "utf8");
    const rightBuffer = Buffer.from(String(right ?? ""), "utf8");
    if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(leftBuffer, rightBuffer);
}
function requireProvisioningWorkerAccess(request) {
    const workerToken = String(process.env.PROVISIONING_WORKER_TOKEN ?? process.env.EXTERNAL_PROVISIONING_TOKEN ?? "").trim();
    const adminToken = String(process.env.ADMIN_API_TOKEN ?? "").trim();
    const expectedToken = workerToken || adminToken;
    if (!expectedToken) {
        if (String(process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
            throw new security_js_1.SecurityError("PROVISIONING_WORKER_TOKEN ou ADMIN_API_TOKEN nao configurado.", 503);
        }
        return { scope: "development_bypass" };
    }
    const authorization = String(request.headers.authorization ?? "").trim();
    const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
    const headerToken = String(request.headers["x-provisioning-worker-token"] ?? request.headers["x-admin-token"] ?? "").trim();
    const queryToken = String(request.query?.token ?? "").trim();
    if ([bearerToken, headerToken, queryToken].some((token) => token && secureEqual(token, expectedToken))) {
        return { scope: workerToken ? "provisioning_worker" : "admin" };
    }
    throw new security_js_1.SecurityError("Token do worker de provisionamento invalido ou ausente.", 401);
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
    app.get("/webhooks/efipay", async (_request, reply) => reply.send({
        ok: true,
        service: "efi-webhook",
        accepts: ["/webhooks/efipay", "/webhooks/efipay/pix"],
    }));
    app.post("/webhooks/efipay", async (request, reply) => {
        const query = request.query;
        if (!services.billingService.validateEfipayWebhookHmac(query.hmac)) {
            return reply.status(401).send({ error: "Webhook Efipay rejeitada." });
        }
        try {
            const result = await services.billingService.handleEfipayWebhook(request.body);
            await syncApprovedPaymentsToManager(result, services);
            return reply.status(200).send(result);
        }
        catch (error) {
            return reply.status(400).send({ error: error.message });
        }
    });
    app.get("/webhooks/efipay/pix", async (_request, reply) => reply.send({
        ok: true,
        service: "efi-webhook",
        accepts: ["/webhooks/efipay", "/webhooks/efipay/pix"],
    }));
    app.post("/webhooks/efipay/pix", async (request, reply) => {
        const query = request.query;
        if (!services.billingService.validateEfipayWebhookHmac(query.hmac)) {
            return reply.status(401).send({ error: "Webhook Efipay rejeitada." });
        }
        try {
            const result = await services.billingService.handleEfipayWebhook(request.body);
            await syncApprovedPaymentsToManager(result, services);
            return reply.status(200).send(result);
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
    app.post("/internal/provisioning/jobs/claim", async (request, reply) => {
        try {
            requireProvisioningWorkerAccess(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const body = request.body ?? {};
        const workerId = String(body.workerId ?? request.headers["x-worker-id"] ?? "worker").trim().slice(0, 80) || "worker";
        const now = Date.now();
        const jobs = Array.isArray(services.store.provisioningJobs) ? services.store.provisioningJobs : [];
        services.store.provisioningJobs = jobs;
        const activeInstanceIds = new Set(jobs
            .filter((entry) => ["queued", "retry", "processing"].includes(String(entry?.status ?? "").toLowerCase()))
            .map((entry) => String(entry.instanceId ?? "").trim())
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
            const createdAt = new Date().toISOString();
            jobs.push({
                id: (0, utils_js_1.makeId)(),
                type: "squarecloud_provision",
                instanceId: instance.id,
                discordAppId: discordApp.id,
                sourceSlug: instance.sourceSlug,
                status: "queued",
                attempts: 0,
                maxAttempts: Number(process.env.PROVISIONING_WORKER_MAX_ATTEMPTS ?? 8) || 8,
                lockedBy: null,
                lockedAt: null,
                lockExpiresAt: null,
                lastError: null,
                result: null,
                reason: "recovered_pending_instance",
                nextRunAt: createdAt,
                createdAt,
                updatedAt: createdAt,
            });
            activeInstanceIds.add(instance.id);
            instance.status = "queued";
            instance.updatedAt = createdAt;
        }
        const job = jobs
            .filter((entry) => ["queued", "retry", "processing"].includes(String(entry?.status ?? "").toLowerCase()))
            .filter((entry) => {
            const nextRunAt = Date.parse(String(entry.nextRunAt ?? entry.createdAt ?? 0)) || 0;
            const lockExpiresAt = Date.parse(String(entry.lockExpiresAt ?? 0)) || 0;
            const status = String(entry.status ?? "").toLowerCase();
            return nextRunAt <= now && (status !== "processing" || lockExpiresAt <= now);
        })
            .sort((left, right) => Date.parse(String(left.nextRunAt ?? left.createdAt ?? 0)) - Date.parse(String(right.nextRunAt ?? right.createdAt ?? 0)))[0];
        if (!job) {
            return reply.send({ ok: true, job: null });
        }
        const instance = services.instanceService.getById(job.instanceId);
        const discordApp = services.store.discordApps.find((entry) => entry.id === job.discordAppId || entry.id === instance?.discordAppId);
        if (!instance || !discordApp) {
            job.status = "failed";
            job.lastError = "Instancia ou app Discord nao encontrado para provisionamento.";
            job.updatedAt = new Date().toISOString();
            await services.store.flush?.().catch(() => null);
            return reply.status(409).send({ ok: false, error: job.lastError });
        }
        const lockTtlSeconds = Math.max(60, Number(body.lockTtlSeconds ?? process.env.PROVISIONING_WORKER_LOCK_TTL_SECONDS ?? 900) || 900);
        const lockedAt = new Date();
        job.status = "processing";
        job.attempts = Math.max(0, Number(job.attempts ?? 0) || 0) + 1;
        job.lockedBy = workerId;
        job.lockedAt = lockedAt.toISOString();
        job.lockExpiresAt = new Date(lockedAt.getTime() + lockTtlSeconds * 1000).toISOString();
        job.updatedAt = job.lockedAt;
        instance.status = "queued";
        instance.updatedAt = job.updatedAt;
        await services.store.flush?.().catch(() => null);
        return reply.send({
            ok: true,
            job,
            instance,
            discordApp,
            runtimeSourceConfig: services.managerRuntimeConfigService.getRuntimeSourceConfig(instance.sourceSlug) ?? null,
            managerApiUrl: services.managerRuntimeConfigService.getResolvedAppBaseUrl(request) ?? null,
        });
    });
    app.get("/internal/provisioning/diagnostics", async (request, reply) => {
        try {
            requireProvisioningWorkerAccess(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const jobs = Array.isArray(services.store.provisioningJobs) ? services.store.provisioningJobs : [];
        const instances = Array.isArray(services.store.instances) ? services.store.instances : [];
        const discordApps = Array.isArray(services.store.discordApps) ? services.store.discordApps : [];
        const pendingInstances = instances
            .filter((instance) => String(instance?.hostingAppId ?? "").trim().startsWith("pending-"))
            .map((instance) => {
            const discordApp = discordApps.find((entry) => entry.id === instance.discordAppId);
            const matchingJobs = jobs.filter((job) => job.instanceId === instance.id).map((job) => ({
                id: job.id,
                status: job.status,
                attempts: job.attempts,
                reason: job.reason,
                lastError: job.lastError,
                lockedBy: job.lockedBy,
                lockExpiresAt: job.lockExpiresAt,
                nextRunAt: job.nextRunAt,
                updatedAt: job.updatedAt,
            }));
            return {
                id: instance.id,
                name: instance.name,
                status: instance.status,
                hostingAppId: instance.hostingAppId,
                sourceSlug: instance.sourceSlug,
                discordAppId: instance.discordAppId,
                hasDiscordApp: Boolean(discordApp),
                hasBotToken: Boolean(discordApp?.botToken),
                discordAppSource: discordApp?.source ?? null,
                jobCount: matchingJobs.length,
                jobs: matchingJobs,
                updatedAt: instance.updatedAt,
            };
        });
        return reply.send({
            ok: true,
            now: new Date().toISOString(),
            jobCounts: jobs.reduce((accumulator, job) => {
                const status = String(job?.status ?? "unknown").trim() || "unknown";
                accumulator[status] = (accumulator[status] ?? 0) + 1;
                return accumulator;
            }, {}),
            recentJobs: [...jobs]
                .sort((left, right) => Date.parse(String(right.updatedAt ?? right.createdAt ?? 0)) - Date.parse(String(left.updatedAt ?? left.createdAt ?? 0)))
                .slice(0, 10)
                .map((job) => ({
                id: job.id,
                instanceId: job.instanceId,
                discordAppId: job.discordAppId,
                sourceSlug: job.sourceSlug,
                status: job.status,
                attempts: job.attempts,
                reason: job.reason,
                lastError: job.lastError,
                result: job.result,
                lockedBy: job.lockedBy,
                lockExpiresAt: job.lockExpiresAt,
                nextRunAt: job.nextRunAt,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
            })),
            pendingInstances,
        });
    });
    app.post("/internal/provisioning/requeue", async (request, reply) => {
        try {
            requireProvisioningWorkerAccess(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const body = request.body ?? {};
        const instanceId = String(body.instanceId ?? "").trim();
        const hostingAppId = String(body.hostingAppId ?? body.appId ?? "").trim();
        const instances = Array.isArray(services.store.instances) ? services.store.instances : [];
        const instance = instances.find((entry) => (instanceId && entry.id === instanceId) ||
            (hostingAppId && String(entry.hostingAppId ?? "").trim() === hostingAppId));
        if (!instance) {
            return reply.status(404).send({ error: "Instancia nao encontrada para re-enfileirar." });
        }
        const discordApp = services.store.discordApps.find((entry) => entry.id === instance.discordAppId);
        if (!discordApp?.botToken) {
            return reply.status(409).send({ error: "Instancia nao possui app Discord com token salvo." });
        }
        const now = new Date().toISOString();
        const jobs = Array.isArray(services.store.provisioningJobs) ? services.store.provisioningJobs : [];
        services.store.provisioningJobs = jobs;
        for (const job of jobs.filter((entry) => entry.instanceId === instance.id && ["queued", "retry", "processing"].includes(String(entry.status ?? "").toLowerCase()))) {
            job.status = "cancelled";
            job.lastError = "Cancelado por re-enfileiramento manual.";
            job.lockExpiresAt = null;
            job.updatedAt = now;
        }
        const job = {
            id: (0, utils_js_1.makeId)(),
            type: "squarecloud_provision",
            instanceId: instance.id,
            discordAppId: discordApp.id,
            sourceSlug: instance.sourceSlug,
            status: "queued",
            attempts: 0,
            maxAttempts: Number(process.env.PROVISIONING_WORKER_MAX_ATTEMPTS ?? 8) || 8,
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
            lastError: null,
            result: null,
            reason: String(body.reason ?? "manual_requeue").trim().slice(0, 120) || "manual_requeue",
            nextRunAt: now,
            createdAt: now,
            updatedAt: now,
        };
        jobs.push(job);
        const preserveHostingAppId = body.preserveHostingAppId === true && hostingAppId && !hostingAppId.startsWith("pending-");
        instance.hostingAppId = preserveHostingAppId ? hostingAppId : `pending-${(0, utils_js_1.makeId)().replace(/-/gu, "").slice(0, 12)}`;
        instance.status = "queued";
        instance.updatedAt = now;
        instance.config = {
            ...(instance.config ?? {}),
            lastProvisioningError: null,
            lastProvisioningErrorAt: null,
            provisioningQueueJobId: job.id,
            previousInaccessibleHostingAppId: preserveHostingAppId ? String(instance.config?.previousInaccessibleHostingAppId ?? "").trim() || null : hostingAppId || String(instance.config?.previousInaccessibleHostingAppId ?? "").trim() || null,
        };
        await services.store.flush?.().catch(() => null);
        return reply.send({ ok: true, job, instance: (0, serializers_js_1.sanitizeInstance)(instance, { includeConfig: true }) });
    });
    app.post("/internal/provisioning/jobs/:jobId/complete", async (request, reply) => {
        try {
            requireProvisioningWorkerAccess(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const { jobId } = request.params;
        const body = request.body ?? {};
        const job = Array.isArray(services.store.provisioningJobs)
            ? services.store.provisioningJobs.find((entry) => entry.id === jobId)
            : null;
        if (!job) {
            return reply.status(404).send({ error: "Job de provisionamento nao encontrado." });
        }
        const instance = services.instanceService.getById(job.instanceId);
        if (!instance) {
            return reply.status(404).send({ error: "Instancia do job nao encontrada." });
        }
        const appId = String(body.appId ?? body.hostingAppId ?? "").trim();
        if (!appId) {
            return reply.status(400).send({ error: "appId e obrigatorio." });
        }
        const now = new Date().toISOString();
        instance.hostingAppId = appId;
        instance.status = body.instanceStatus ? String(body.instanceStatus).trim() : "provisioning";
        instance.updatedAt = now;
        instance.config = {
            ...(instance.config ?? {}),
            provisioningCompletedAt: now,
            provisioningQueueJobId: job.id,
            lastProvisioningError: null,
            lastProvisioningErrorAt: null,
        };
        const discordApp = services.store.discordApps.find((entry) => entry.id === instance.discordAppId);
        if (discordApp) {
            discordApp.poolStatus = "allocated";
            discordApp.updatedAt = now;
        }
        job.status = "completed";
        job.result = {
            appId,
            upload: body.upload ?? null,
            boot: body.boot ?? null,
        };
        job.completedAt = now;
        job.updatedAt = now;
        job.lockExpiresAt = null;
        await services.store.flush?.().catch(() => null);
        return reply.send({ ok: true, job, instance: (0, serializers_js_1.sanitizeInstance)(instance, { includeConfig: true }) });
    });
    app.post("/internal/provisioning/jobs/:jobId/fail", async (request, reply) => {
        try {
            requireProvisioningWorkerAccess(request);
        }
        catch (error) {
            return sendSecurityError(reply, error);
        }
        const { jobId } = request.params;
        const body = request.body ?? {};
        const job = Array.isArray(services.store.provisioningJobs)
            ? services.store.provisioningJobs.find((entry) => entry.id === jobId)
            : null;
        if (!job) {
            return reply.status(404).send({ error: "Job de provisionamento nao encontrado." });
        }
        const now = new Date();
        const attempts = Math.max(0, Number(job.attempts ?? 0) || 0);
        const maxAttempts = Math.max(1, Number(job.maxAttempts ?? process.env.PROVISIONING_WORKER_MAX_ATTEMPTS ?? 8) || 8);
        const retry = body.retry !== false && attempts < maxAttempts;
        const delaySeconds = Math.max(10, Number(body.retryDelaySeconds ?? Math.min(900, 30 * Math.max(1, attempts))) || 30);
        job.status = retry ? "retry" : "failed";
        job.lastError = String(body.error ?? "Falha no worker de provisionamento.").slice(0, 1500);
        job.lockExpiresAt = null;
        job.updatedAt = now.toISOString();
        job.nextRunAt = retry ? new Date(now.getTime() + delaySeconds * 1000).toISOString() : null;
        const instance = services.instanceService.getById(job.instanceId);
        if (instance) {
            instance.status = retry ? "queued" : "failed";
            instance.updatedAt = job.updatedAt;
            instance.config = {
                ...(instance.config ?? {}),
                lastProvisioningError: job.lastError,
                lastProvisioningErrorAt: job.updatedAt,
                provisioningQueueJobId: job.id,
            };
        }
        await services.store.flush?.().catch(() => null);
        return reply.send({ ok: true, retry, job });
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
