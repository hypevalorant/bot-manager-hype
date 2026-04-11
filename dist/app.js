"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServices = createServices;
exports.buildApp = buildApp;
const cors_1 = __importDefault(require("@fastify/cors"));
const fastify_1 = __importDefault(require("fastify"));
const logger_js_1 = require("./core/logger.js");
const manager_runtime_config_js_1 = require("./core/manager-runtime-config.js");
const persistent_store_js_1 = require("./core/persistent-store.js");
const app_pool_service_js_1 = require("./modules/apps/app-pool.service.js");
const billing_service_js_1 = require("./modules/billing/billing.service.js");
const efipay_client_js_1 = require("./modules/billing/efipay.client.js");
const catalog_service_js_1 = require("./modules/catalog/catalog.service.js");
const discord_bot_client_js_1 = require("./modules/discord/discord-bot.client.js");
const squarecloud_client_js_1 = require("./modules/hosting/squarecloud.client.js");
const squarecloud_provisioning_service_js_1 = require("./modules/hosting/squarecloud.provisioning.service.js");
const source_artifact_service_js_1 = require("./modules/hosting/source-artifact.service.js");
const instance_service_js_1 = require("./modules/instances/instance.service.js");
const purchase_setup_service_js_1 = require("./modules/purchase/purchase-setup.service.js");
const subscription_service_js_1 = require("./modules/subscriptions/subscription.service.js");
const register_routes_js_1 = require("./routes/register-routes.js");
async function createServices() {
    const store = await (0, persistent_store_js_1.createStore)();
    const managerRuntimeConfigService = new manager_runtime_config_js_1.ManagerRuntimeConfigService(store);
    const catalogService = new catalog_service_js_1.CatalogService(store);
    const appPoolService = new app_pool_service_js_1.AppPoolService(store);
    const squareCloudClient = new squarecloud_client_js_1.SquareCloudClient({
        apiKey: process.env.SQUARECLOUD_API_KEY,
        accountId: process.env.SQUARECLOUD_ACCOUNT_ID,
        baseUrl: process.env.SQUARECLOUD_API_BASE_URL,
    });
    const sourceArtifactService = new source_artifact_service_js_1.SourceArtifactService(process.env.SOURCE_ARTIFACTS_DIR ?? "runtime-artifacts", {
        getRuntimeSourceConfig: (sourceSlug) => managerRuntimeConfigService.getRuntimeSourceConfig(sourceSlug),
    });
    const squareCloudProvisioningService = new squarecloud_provisioning_service_js_1.SquareCloudProvisioningService(squareCloudClient, sourceArtifactService, {
        getManagerApiUrl: () => managerRuntimeConfigService.getResolvedAppBaseUrl() ?? "http://localhost:3000",
    });
    const instanceService = new instance_service_js_1.InstanceService(store, appPoolService, process.env.DEFAULT_BOT_PERMISSIONS ?? "8", process.env.SQUARECLOUD_ACCOUNT_ID, squareCloudProvisioningService);
    const subscriptionService = new subscription_service_js_1.SubscriptionService(store, catalogService, instanceService);
    const discordBotClient = new discord_bot_client_js_1.DiscordBotClient({
        defaultPermissions: process.env.DEFAULT_BOT_PERMISSIONS ?? "8",
    });
    const efipayClient = new efipay_client_js_1.EfipayClient(managerRuntimeConfigService.getResolvedEfipayOptions());
    const billingService = new billing_service_js_1.BillingService(store, catalogService, subscriptionService, efipayClient);
    const purchaseSetupService = new purchase_setup_service_js_1.PurchaseSetupService(store, catalogService, subscriptionService, instanceService, discordBotClient, process.env.DEFAULT_BOT_PERMISSIONS ?? "8");
    managerRuntimeConfigService.attachRuntimeTargets({
        efipayClient,
        squareCloudProvisioningService,
    });
    return {
        appPoolService,
        billingService,
        catalogService,
        instanceService,
        managerRuntimeConfigService,
        purchaseSetupService,
        sourceArtifactService,
        squareCloudClient,
        squareCloudProvisioningService,
        store,
        subscriptionService,
    };
}
async function buildApp(services, logger = (0, logger_js_1.createAppLogger)("Manager API")) {
    const resolvedServices = services ?? (await createServices());
    const app = (0, fastify_1.default)({
        logger: false,
    });
    await app.register(cors_1.default, {
        origin: true,
    });
    app.addHook("onResponse", async (_request, _reply) => {
        if (typeof resolvedServices.store?.flush !== "function") {
            return;
        }
        try {
            await resolvedServices.store.flush();
        }
        catch (error) {
            logger.warn({ error: error?.message ?? String(error) }, "Falha ao persistir o estado do manager.");
        }
    });
    await (0, register_routes_js_1.registerRoutes)(app, resolvedServices);
    return app;
}
