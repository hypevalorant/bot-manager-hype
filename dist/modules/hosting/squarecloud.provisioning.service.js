"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquareCloudProvisioningService = void 0;
class SquareCloudProvisioningService {
    squareCloudClient;
    sourceArtifactService;
    options;
    constructor(squareCloudClient, sourceArtifactService, options) {
        this.squareCloudClient = squareCloudClient;
        this.sourceArtifactService = sourceArtifactService;
        this.options = options;
    }
    setManagerApiUrl(managerApiUrl) {
        this.options.managerApiUrl = managerApiUrl ?? this.options.managerApiUrl ?? null;
    }
    getManagerApiUrl() {
        if (typeof this.options.getManagerApiUrl === "function") {
            const resolvedValue = this.options.getManagerApiUrl();
            if (resolvedValue) {
                return resolvedValue;
            }
        }
        return this.options.managerApiUrl ?? "http://localhost:3000";
    }
    isConfigured() {
        return this.squareCloudClient.isConfigured();
    }
    async provisionInstance(instance, discordApp) {
        if (!this.squareCloudClient.isConfigured()) {
            throw new Error("SquareCloud nao configurada para provisionamento real.");
        }
        const artifact = await this.sourceArtifactService.getArtifact(instance.sourceSlug, {
            displayName: discordApp.appName,
        });
        const runtimeOptions = this.sourceArtifactService.getRuntimeOptions(instance.sourceSlug, {
            displayName: discordApp.appName,
        });
        const upload = await this.squareCloudClient.uploadApplication(artifact.fileBuffer, artifact.fileName);
        const appId = upload.response.id;
        await this.squareCloudClient.setAppEnvVars(appId, this.buildRuntimeEnv({
            appId,
            discordApp,
            instance,
            runtimeOptions,
        }));
        await this.squareCloudClient.startApp(appId);
        return {
            appId,
            upload,
        };
    }
    async updateInstance(instance, discordApp) {
        if (!this.squareCloudClient.isConfigured()) {
            throw new Error("SquareCloud nao configurada para atualizacao real.");
        }
        if (!instance.hostingAppId || instance.hostingAppId.startsWith("pending-")) {
            throw new Error("A instancia ainda nao possui uma app real para atualizar.");
        }
        const artifact = await this.sourceArtifactService.getArtifact(instance.sourceSlug, {
            displayName: discordApp.appName,
        });
        const runtimeOptions = this.sourceArtifactService.getRuntimeOptions(instance.sourceSlug, {
            displayName: discordApp.appName,
        });
        const commit = await this.squareCloudClient.commitApplication(instance.hostingAppId, artifact.fileBuffer, artifact.fileName);
        await this.squareCloudClient.setAppEnvVars(instance.hostingAppId, this.buildRuntimeEnv({
            appId: instance.hostingAppId,
            discordApp,
            instance,
            runtimeOptions,
        }));
        await this.squareCloudClient.restartApp(instance.hostingAppId);
        return {
            appId: instance.hostingAppId,
            commit,
        };
    }
    async restartInstance(instance) {
        await this.squareCloudClient.startApp(instance.hostingAppId);
    }
    async suspendInstance(instance) {
        await this.squareCloudClient.stopApp(instance.hostingAppId);
    }
    async deleteInstance(instance) {
        await this.squareCloudClient.deleteApp(instance.hostingAppId);
    }
    buildRuntimeEnv(input) {
        const runtimeEnv = {
            MANAGER_API_URL: this.getManagerApiUrl(),
            INSTANCE_ID: input.instance.id,
            INSTANCE_SECRET: input.instance.instanceSecret,
            INSTANCE_SOURCE_SLUG: input.instance.sourceSlug,
            SOURCE_SLUG: input.instance.sourceSlug,
            SOURCE_VERSION: input.instance.sourceVersion,
            NODE_ENV: "production",
            TOKEN: input.discordApp.botToken,
            DISCORD_TOKEN: input.discordApp.botToken,
            CLIENT_ID: input.discordApp.clientId,
            DISCORD_CLIENT_ID: input.discordApp.clientId,
            APPLICATION_ID: input.discordApp.applicationId,
            DISCORD_APPLICATION_ID: input.discordApp.applicationId,
            DISCORD_APP_NAME: input.discordApp.appName,
            SQUARECLOUD_APP_ID: input.appId,
            SQUARECLOUD_APPLICATION_ID: input.appId,
        };
        if (input.runtimeOptions.entrypoint) {
            runtimeEnv.BOT_RUNTIME_ENTRYPOINT = input.runtimeOptions.entrypoint;
        }
        if (input.runtimeOptions.appPublicUrl) {
            runtimeEnv.APP_PUBLIC_URL = input.runtimeOptions.appPublicUrl;
        }
        if (input.runtimeOptions.transcriptPublicUrl) {
            runtimeEnv.TRANSCRIPT_PUBLIC_URL = input.runtimeOptions.transcriptPublicUrl;
        }
        if (input.discordApp.defaultGuildId) {
            runtimeEnv.GUILD_ID = input.discordApp.defaultGuildId;
            runtimeEnv.DEFAULT_GUILD_ID = input.discordApp.defaultGuildId;
        }
        const ownerDiscordUserId = String(input.instance.config.ownerDiscordUserId ?? "").trim();
        if (ownerDiscordUserId) {
            runtimeEnv.TENANT_CUSTOMER_DISCORD_USER_ID = ownerDiscordUserId;
        }
        const assignedGuildId = String(input.instance.assignedGuildId ?? "").trim();
        if (assignedGuildId) {
            runtimeEnv.TENANT_ASSIGNED_GUILD_ID = assignedGuildId;
        }
        return {
            ...input.discordApp.runtimeEnv,
            ...runtimeEnv,
        };
    }
}
exports.SquareCloudProvisioningService = SquareCloudProvisioningService;
