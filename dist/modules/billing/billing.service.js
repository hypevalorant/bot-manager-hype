"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const utils_js_1 = require("../../core/utils.js");
class BillingService {
    store;
    catalogService;
    subscriptionService;
    efipayClient;
    constructor(store, catalogService, subscriptionService, efipayClient) {
        this.store = store;
        this.catalogService = catalogService;
        this.subscriptionService = subscriptionService;
        this.efipayClient = efipayClient;
    }
    createMockCheckout(input) {
        const { plan, product, subscription } = this.subscriptionService.createPendingSubscription(input);
        const addons = this.getSelectedAddons(product.id, input.addonCodes);
        const totalAmountCents = this.calculateTotalAmountCents(plan.priceCents, addons);
        const checkout = this.createCheckoutSession({
            subscriptionId: subscription.id,
            productSlug: input.productSlug,
            planCode: input.planCode,
            addonCodes: addons.map((addon) => addon.code),
            provider: "mock",
            paymentUrl: `https://pay.example/checkout/${subscription.id}`,
            pixCode: `PIX-${subscription.id.slice(0, 8).toUpperCase()}`,
            qrCodeImage: null,
            totalAmountCents,
            expiresAt: null,
            metadata: this.buildPurchaseMetadata(addons),
        });
        const payment = this.createPayment({
            subscriptionId: subscription.id,
            checkoutSessionId: checkout.id,
            provider: "mock",
            providerPaymentId: `mock-${subscription.id}`,
            providerStatus: "pending",
            purpose: "activation",
            amountCents: totalAmountCents,
            metadata: {
                ...this.buildPurchaseMetadata(addons),
                productSlug: product.slug,
                planCode: plan.code,
            },
        });
        return {
            checkout,
            payment,
            nextStep: "Simule o webhook em POST /webhooks/payments/mock para ativar a assinatura.",
        };
    }
    async approveMockPayment(subscriptionId) {
        const payment = this.store.payments.find((item) => item.subscriptionId === subscriptionId);
        if (!payment) {
            throw new Error("Pagamento mock nao encontrado.");
        }
        payment.status = "approved";
        payment.providerStatus = "approved";
        payment.paidAt = (0, utils_js_1.nowIso)();
        payment.lastCheckedAt = payment.paidAt;
        const deferProvisioning = this.shouldDeferProvisioning(payment.subscriptionId, payment.purpose);
        const activation = await this.subscriptionService.activateSubscription(subscriptionId, {
            deferProvisioning,
        });
        return {
            payment,
            activation,
        };
    }
    async approvePaymentManually(paymentId) {
        const payment = this.store.payments.find((item) => item.id === paymentId);
        if (!payment) {
            throw new Error("Pagamento nao encontrado.");
        }
        if (payment.status === "approved") {
            return {
                payment,
                activation: this.subscriptionService.getById(payment.subscriptionId),
                alreadyApproved: true,
            };
        }
        payment.status = "approved";
        payment.providerStatus = "approved";
        payment.paidAt = (0, utils_js_1.nowIso)();
        payment.lastCheckedAt = payment.paidAt;
        const activation = payment.purpose === "renewal"
            ? await this.subscriptionService.renewSubscription(payment.subscriptionId, Number(payment.metadata?.quantity ?? 1) > 0 ? Number(payment.metadata.quantity) : 1)
            : await this.subscriptionService.activateSubscription(payment.subscriptionId, {
                deferProvisioning: this.shouldDeferProvisioning(payment.subscriptionId, payment.purpose),
            });
        return {
            payment,
            activation,
            alreadyApproved: false,
        };
    }
    getPaymentById(paymentId) {
        const payment = this.store.payments.find((item) => item.id === paymentId) ?? null;
        if (!payment) {
            return null;
        }
        const checkout = payment.checkoutSessionId
            ? this.store.checkoutSessions.find((item) => item.id === payment.checkoutSessionId) ?? null
            : null;
        return {
            payment,
            checkout,
            subscription: this.subscriptionService.getById(payment.subscriptionId),
        };
    }
    async createEfipayPixCheckout(input) {
        const { customer, plan, product, subscription } = this.subscriptionService.createPendingSubscription(input);
        const addons = this.getSelectedAddons(product.id, input.addonCodes);
        const totalAmountCents = this.calculateTotalAmountCents(plan.priceCents, addons);
        const cartChannelId = String(input?.cartChannelId ?? "").trim() || null;
        const cartMessageId = String(input?.cartMessageId ?? "").trim() || null;
        const charge = await this.efipayClient.createPixCharge({
            amountCents: totalAmountCents,
            description: `${product.name} ${plan.code} ${subscription.id.slice(0, 8)}`,
        });
        const qrCode = charge.loc?.id ? await this.efipayClient.getPixQrCode(charge.loc.id) : null;
        const checkout = this.createCheckoutSession({
            subscriptionId: subscription.id,
            productSlug: product.slug,
            planCode: plan.code,
            addonCodes: addons.map((addon) => addon.code),
            provider: "efipay_pix",
            paymentUrl: qrCode?.linkVisualizacao ?? null,
            pixCode: qrCode?.qrcode ?? null,
            qrCodeImage: qrCode?.imagemQrcode ?? null,
            totalAmountCents,
            expiresAt: charge.calendario?.expiracao
                ? new Date(Date.now() + charge.calendario.expiracao * 1000).toISOString()
                : null,
            metadata: {
                charge,
                qrCode,
                ...this.buildPurchaseMetadata(addons),
                customerDiscordUserId: customer.discordUserId,
                productSlug: product.slug,
                planCode: plan.code,
                cartChannelId,
                cartMessageId,
            },
        });
        const payment = this.createPayment({
            subscriptionId: subscription.id,
            checkoutSessionId: checkout.id,
            provider: "efipay_pix",
            providerPaymentId: String(charge.txid ?? ""),
            providerStatus: String(charge.status ?? "pending"),
            purpose: "activation",
            amountCents: totalAmountCents,
            metadata: {
                ...this.buildPurchaseMetadata(addons),
                productSlug: product.slug,
                planCode: plan.code,
                customerDiscordUserId: customer.discordUserId,
                locId: charge.loc?.id ?? null,
                cartChannelId,
                cartMessageId,
            },
        });
        return {
            checkout,
            payment,
            charge,
            qrCode,
            nextStep: "Aguarde o Pix ser pago e use o webhook da Efipay ou POST /payments/:paymentId/reconcile.",
        };
    }
    async createEfipayPixRenewal(subscriptionId, quantity = 1) {
        const bundle = this.subscriptionService.getRequiredBundle(subscriptionId);
        if (!bundle.product || !bundle.plan || !bundle.customer) {
            throw new Error("Assinatura sem produto/plano/cliente associado para renovacao.");
        }
        const amountCents = bundle.plan.priceCents * quantity;
        const charge = await this.efipayClient.createPixCharge({
            amountCents,
            description: `Renovacao ${bundle.product.name} ${bundle.plan.code} ${bundle.subscription.id.slice(0, 8)}`,
        });
        const qrCode = charge.loc?.id ? await this.efipayClient.getPixQrCode(charge.loc.id) : null;
        const checkout = this.createCheckoutSession({
            subscriptionId,
            productSlug: bundle.product.slug,
            planCode: bundle.plan.code,
            addonCodes: [],
            provider: "efipay_pix",
            paymentUrl: qrCode?.linkVisualizacao ?? null,
            pixCode: qrCode?.qrcode ?? null,
            qrCodeImage: qrCode?.imagemQrcode ?? null,
            totalAmountCents: amountCents,
            expiresAt: charge.calendario?.expiracao
                ? new Date(Date.now() + charge.calendario.expiracao * 1000).toISOString()
                : null,
            metadata: {
                charge,
                qrCode,
                quantity,
            },
        });
        const payment = this.createPayment({
            subscriptionId,
            checkoutSessionId: checkout.id,
            provider: "efipay_pix",
            providerPaymentId: String(charge.txid ?? ""),
            providerStatus: String(charge.status ?? "pending"),
            purpose: "renewal",
            amountCents,
            metadata: {
                productSlug: bundle.product.slug,
                planCode: bundle.plan.code,
                quantity,
                locId: charge.loc?.id ?? null,
            },
        });
        return {
            checkout,
            payment,
            charge,
            qrCode,
        };
    }
    async reconcileEfipayPayment(paymentId) {
        const payment = this.store.payments.find((item) => item.id === paymentId);
        if (!payment) {
            throw new Error("Pagamento nao encontrado.");
        }
        if (payment.provider !== "efipay_pix") {
            throw new Error("Somente pagamentos Efipay Pix podem ser reconciliados por esta rota.");
        }
        const charge = await this.efipayClient.getPixCharge(payment.providerPaymentId);
        payment.providerStatus = String(charge.status ?? payment.providerStatus);
        payment.lastCheckedAt = (0, utils_js_1.nowIso)();
        if (!this.isEfipayChargePaid(charge)) {
            if (String(charge.status ?? "").toUpperCase() === "REMOVIDA_PELO_USUARIO_RECEBEDOR") {
                payment.status = "expired";
            }
            return {
                payment,
                charge,
                activation: null,
            };
        }
        return {
            payment,
            charge,
            activation: await this.approveEfipayPixPayment(payment, charge),
        };
    }
    async handleEfipayWebhook(payload) {
        const txids = await this.efipayClient.resolveWebhookTxids(payload);
        const processed = [];
        const ignored = [];
        for (const txid of txids) {
            const payment = this.store.payments.find((item) => item.provider === "efipay_pix" && item.providerPaymentId === txid);
            if (!payment) {
                ignored.push({ txid, reason: "payment_not_found" });
                continue;
            }
            const reconciliation = await this.reconcileEfipayPayment(payment.id);
            processed.push({
                txid,
                paymentId: payment.id,
                status: reconciliation.payment.status,
                providerStatus: reconciliation.payment.providerStatus,
            });
        }
        return {
            ok: true,
            processed,
            ignored,
        };
    }
    async syncEfipayWebhook() {
        const registration = await this.efipayClient.registerWebhook();
        return {
            ...this.efipayClient.getWebhookStatus(),
            remoteWebhook: registration,
        };
    }
    getEfipayWebhookStatus() {
        return this.efipayClient.getWebhookStatus();
    }
    validateEfipayWebhookHmac(rawValue) {
        return this.efipayClient.validateWebhookHmac(rawValue);
    }
    async approveEfipayPixPayment(payment, charge) {
        if (payment.status === "approved") {
            return this.subscriptionService.getById(payment.subscriptionId);
        }
        payment.status = "approved";
        payment.providerStatus = String(charge.status ?? "CONCLUIDA");
        payment.paidAt = (0, utils_js_1.nowIso)();
        payment.lastCheckedAt = payment.paidAt;
        if (payment.purpose === "renewal") {
            const quantity = Number(payment.metadata.quantity ?? 1);
            return this.subscriptionService.renewSubscription(payment.subscriptionId, quantity > 0 ? quantity : 1);
        }
        return this.subscriptionService.activateSubscription(payment.subscriptionId, {
            deferProvisioning: this.shouldDeferProvisioning(payment.subscriptionId, payment.purpose),
        });
    }
    isEfipayChargePaid(charge) {
        const status = String(charge.status ?? "").toUpperCase();
        return status === "CONCLUIDA" || (Array.isArray(charge.pix) && charge.pix.length > 0);
    }
    createCheckoutSession(input) {
        const checkout = {
            id: (0, utils_js_1.makeId)(),
            createdAt: (0, utils_js_1.nowIso)(),
            ...input,
        };
        this.store.checkoutSessions.push(checkout);
        return checkout;
    }
    createPayment(input) {
        const payment = {
            id: (0, utils_js_1.makeId)(),
            accessToken: (0, utils_js_1.makeSecret)(),
            status: "pending",
            createdAt: (0, utils_js_1.nowIso)(),
            paidAt: null,
            lastCheckedAt: null,
            ...input,
        };
        this.store.payments.push(payment);
        return payment;
    }
    getSelectedAddons(productId, addonCodes = []) {
        return this.catalogService.getAddonsByCodes(productId, addonCodes);
    }
    calculateTotalAmountCents(baseAmountCents, addons) {
        return baseAmountCents + addons.reduce((total, addon) => total + addon.priceCents, 0);
    }
    buildPurchaseMetadata(addons) {
        return {
            addonCodes: addons.map((addon) => addon.code),
            addons: addons.map((addon) => ({
                code: addon.code,
                name: addon.name,
                priceCents: addon.priceCents,
                informationalOnly: addon.informationalOnly,
            })),
        };
    }
    shouldDeferProvisioning(subscriptionId, purpose) {
        if (purpose !== "activation") {
            return false;
        }
        const bundle = this.subscriptionService.getRequiredBundle(subscriptionId);
        return bundle.product?.botProvisioningMode === "customer_token";
    }
}
exports.BillingService = BillingService;
