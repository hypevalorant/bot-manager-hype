"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeSetupSubmissionResult = sanitizeSetupSubmissionResult;
exports.sanitizeCheckoutResponse = sanitizeCheckoutResponse;
exports.sanitizePaymentDetails = sanitizePaymentDetails;
exports.sanitizeSubscriptionBundle = sanitizeSubscriptionBundle;
exports.sanitizeInstance = sanitizeInstance;
exports.sanitizePaymentRecord = sanitizePaymentRecord;
exports.sanitizeActivationResult = sanitizeActivationResult;
function sanitizeInstance(instance, options = {}) {
    if (!instance) {
        return null;
    }
    const { instanceSecret, ...safeInstance } = instance;
    if (options.includeConfig === true) {
        return {
            ...safeInstance,
            config: safeInstance.config ? { ...safeInstance.config } : null,
        };
    }
    const { config, ...withoutConfig } = safeInstance;
    return withoutConfig;
}
function sanitizeSubscriptionBundle(bundle, options = {}) {
    if (!bundle) {
        return null;
    }
    return {
        subscription: bundle.subscription ? { ...bundle.subscription } : null,
        customer: bundle.customer ? { ...bundle.customer } : null,
        product: bundle.product
            ? {
                ...bundle.product,
            }
            : null,
        plan: bundle.plan ? { ...bundle.plan } : null,
        instance: sanitizeInstance(bundle.instance, {
            includeConfig: options.includeInstanceConfig === true,
        }),
    };
}
function sanitizePaymentRecord(payment, options = {}) {
    if (!payment) {
        return null;
    }
    const { accessToken, ...safePayment } = payment;
    return options.includeAccessToken ? { ...safePayment, accessToken } : safePayment;
}
function sanitizeActivationResult(payload) {
    if (!payload) {
        return null;
    }
    if ("customer" in payload || "product" in payload || "plan" in payload) {
        return sanitizeSubscriptionBundle(payload, {
            includeInstanceConfig: false,
        });
    }
    return {
        ...payload,
        instance: sanitizeInstance(payload.instance, {
            includeConfig: false,
        }),
    };
}
function sanitizePaymentDetails(payload, options = {}) {
    if (!payload) {
        return null;
    }
    const payment = sanitizePaymentRecord(payload.payment, options);
    return {
        ...payload,
        payment,
        checkout: payload.checkout ? { ...payload.checkout } : null,
        subscription: sanitizeSubscriptionBundle(payload.subscription, {
            includeInstanceConfig: false,
        }),
    };
}
function sanitizeCheckoutResponse(payload, options = {}) {
    if (!payload) {
        return null;
    }
    return {
        ...payload,
        payment: sanitizePaymentRecord(payload.payment, {
            includeAccessToken: options.includeAccessToken !== false,
        }),
    };
}
function sanitizeSetupSubmissionResult(payload) {
    if (!payload) {
        return null;
    }
    return {
        ...payload,
        instance: sanitizeInstance(payload.instance, {
            includeConfig: false,
        }),
    };
}
