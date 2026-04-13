"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagerBotService = void 0;
const discord_js_1 = require("discord.js");
const FALLBACK_LOGGER = {
    info: (payload, message) => console.log(message ?? "", payload),
    warn: (payload, message) => console.warn(message ?? "", payload),
    error: (payload, message) => console.error(message ?? "", payload),
};
const STATUS_LABELS = {
    pending: "Pendente",
    active: "Ativa",
    grace: "Em carencia",
    suspended: "Suspensa",
    deleted: "Deletada",
    expired: "Expirada",
    failed: "Falhou",
    provisioning: "Provisionando",
    running: "Rodando",
    approved: "Aprovado",
};
const STATUS_EMOJIS = {
    pending: "[P]",
    active: "[OK]",
    grace: "[WARN]",
    suspended: "[WARN]",
    deleted: "[X]",
    expired: "[X]",
    failed: "[X]",
    provisioning: "[...]",
    running: "[OK]",
    approved: "[OK]",
};
const CUSTOM_IDS = {
    salesBuy: "mgr:sales:buy",
    buyPlanSelect: "mgr:buy:plan",
    buyPlanSelectCartPrefix: "mgr:buy:plan:cart:",
    cartContinuePrefix: "mgr:cart:continue:",
    cartCancelPrefix: "mgr:cart:cancel:",
    cartBackPrefix: "mgr:cart:back:",
    cartAddonBioPrefix: "mgr:cart:addon:bio:",
    cartAddonInfoPrefix: "mgr:cart:addon:info:",
    cartPaymentPrefix: "mgr:cart:payment:",
    pixCopyPrefix: "mgr:pix:copy:",
    pixQrPrefix: "mgr:pix:qr:",
    pixCancelPrefix: "mgr:pix:cancel:",
    renewSelect: "mgr:renew:select",
    appsSetupSelect: "mgr:apps:setup",
    appsSelectPrefix: "mgr:apps:select:",
    appsPagePrefix: "mgr:apps:page:",
    appsViewPrefix: "mgr:apps:view:",
    appsPowerPrefix: "mgr:apps:power:",
    appsSetupButtonPrefix: "mgr:apps:setupbtn:",
    appsRenamePrefix: "mgr:apps:rename:",
    appsTokenPrefix: "mgr:apps:token:",
    appsOwnerPrefix: "mgr:apps:owner:",
    appsTransferPrefix: "mgr:apps:transfer:",
    appsDeletePrefix: "mgr:apps:delete:",
    adminRefresh: "mgr:admin:refresh",
    adminProducts: "mgr:admin:products",
    adminProductsCreate: "mgr:admin:products:create",
    adminProductsSelect: "mgr:admin:products:select",
    adminSubscribers: "mgr:admin:subs",
    adminPermissions: "mgr:admin:perms",
    adminEfipayModal: "mgr:admin:efi:modal",
    adminEfipayCredentials: "mgr:admin:efi:credentials",
    adminEfipayUpload: "mgr:admin:efi:upload",
    adminEfipayValidate: "mgr:admin:efi:validate",
    adminEfipayWebhook: "mgr:admin:efi:webhook",
    adminSales: "mgr:admin:sales",
    adminSalesCartCategory: "mgr:admin:sales:cart-category",
    adminSalesCartCategoryClear: "mgr:admin:sales:cart-category:clear",
    adminSalesCustomerRole: "mgr:admin:sales:customer-role",
    adminSalesCustomerRoleClear: "mgr:admin:sales:customer-role:clear",
    adminSalesStaffRoles: "mgr:admin:sales:staff-roles",
    adminSalesStaffRolesClear: "mgr:admin:sales:staff-roles:clear",
    adminSalesTemplate: "mgr:admin:sales:template",
    adminSalesLogsChannel: "mgr:admin:sales:logs-channel",
    adminSalesLogsChannelClear: "mgr:admin:sales:logs-channel:clear",
    adminSalesInactivity: "mgr:admin:sales:inactivity",
    adminSalesCategorySelect: "mgr:admin:sales:category-select",
    adminSalesCustomerRoleSelect: "mgr:admin:sales:customer-role-select",
    adminSalesStaffRolesSelect: "mgr:admin:sales:staff-roles-select",
    adminSalesLogsChannelSelect: "mgr:admin:sales:logs-channel-select",
    adminBackHome: "mgr:admin:back:home",
    adminBackProducts: "mgr:admin:back:products",
    adminBackEfipay: "mgr:admin:back:efipay",
    adminBackSales: "mgr:admin:back:sales",
    adminProductViewPrefix: "mgr:admin:product:view:",
    adminProductBasicPrefix: "mgr:admin:product:basic:",
    adminProductVisualPrefix: "mgr:admin:product:visual:",
    adminProductApprovedPrefix: "mgr:admin:product:approved:",
    adminProductSourcePrefix: "mgr:admin:product:source:",
    adminProductPlansPrefix: "mgr:admin:product:plans:",
    adminProductRolePrefix: "mgr:admin:product:role:",
    adminProductRoleClearPrefix: "mgr:admin:product:role-clear:",
    adminProductPreviewPrefix: "mgr:admin:product:preview:",
    adminProductPublishPrefix: "mgr:admin:product:publish:",
    adminProductPublishChannelPrefix: "mgr:admin:product:publish-channel:",
    adminProductRoleSelectPrefix: "mgr:admin:product:role-select:",
};
const PURCHASE_CONFIG_CHANNEL_ID = "1491695938622853251";
const MODAL_IDS = {
    efipayConfig: "mgr:modal:efi",
    efipayUpload: "mgr:modal:efi-upload",
    salesTemplate: "mgr:modal:sales-template",
    salesInactivity: "mgr:modal:sales-inactivity",
    productCreate: "mgr:modal:product:create",
    productBasicPrefix: "mgr:modal:product:basic:",
    productVisualPrefix: "mgr:modal:product:visual:",
    productApprovedPrefix: "mgr:modal:product:approved:",
    productSourcePrefix: "mgr:modal:product:source:",
    productPlansPrefix: "mgr:modal:product:plans:",
    botSetupPrefix: "mgr:modal:setup:",
    appRenamePrefix: "mgr:modal:apps:rename:",
    appTokenPrefix: "mgr:modal:apps:token:",
    appOwnerPrefix: "mgr:modal:apps:owner:",
    appTransferPrefix: "mgr:modal:apps:transfer:",
    appDeletePrefix: "mgr:modal:apps:delete:",
};
const PENDING_UPLOAD_TTL_MS = 10 * 60 * 1000;
const ADMIN_PANEL_TRACK_TTL_MS = 15 * 60 * 1000;
const APPS_PANEL_TRACK_TTL_MS = 15 * 60 * 1000;
const APPS_PANEL_REFRESH_INTERVAL_MS = 30 * 1000;
const SQUARECLOUD_DEFAULT_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;
const MAX_P12_BYTES = 10 * 1024 * 1024;
function normalizeTextForMatch(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}
function clampText(value, maxLength, fallback = "") {
    const normalized = String(value ?? fallback ?? "");
    return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
}
function isLikelyHttpUrl(value) {
    const normalized = String(value ?? "").trim();
    return /^https?:\/\//iu.test(normalized);
}
function buildImageAttachmentFromDataUri(value, baseFileName = "pix-qrcode") {
    const normalized = String(value ?? "").trim();
    const match = normalized.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/iu);
    if (!match) {
        return null;
    }
    try {
        const mimeType = String(match[1] ?? "image/png").toLowerCase();
        const base64Payload = String(match[2] ?? "").trim();
        if (!base64Payload) {
            return null;
        }
        const extension = mimeType.split("/")[1]?.replace(/[^a-z0-9]/giu, "") || "png";
        const fileName = `${baseFileName}.${extension}`;
        const buffer = Buffer.from(base64Payload, "base64");
        if (!buffer.length) {
            return null;
        }
        return new discord_js_1.AttachmentBuilder(buffer, { name: fileName });
    }
    catch {
        return null;
    }
}
function normalizeHexColor(value) {
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
function parseDelimitedTopicValue(topic, key) {
    const normalized = String(topic ?? "");
    const matcher = new RegExp(`${key}:([^|]+)`, "iu");
    const match = normalized.match(matcher);
    return String(match?.[1] ?? "").trim() || null;
}
function upsertDelimitedTopicValue(topic, key, value) {
    const normalizedKey = String(key ?? "").trim();
    if (!normalizedKey) {
        return String(topic ?? "").trim();
    }
    const normalizedValue = value === undefined || value === null ? "" : String(value).trim();
    const parts = String(topic ?? "")
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !new RegExp(`^${normalizedKey}:`, "iu").test(part));
    if (normalizedValue) {
        parts.push(`${normalizedKey}:${normalizedValue}`);
    }
    return parts.join(" | ").slice(0, 1024);
}
function inferEfiSandboxFromCertName(fileName, fallbackValue = false) {
    const normalized = normalizeTextForMatch(fileName);
    if (!normalized) {
        return fallbackValue;
    }
    if (normalized.includes("producao") || normalized.includes("production")) {
        return false;
    }
    if (normalized.includes("homologacao") ||
        normalized.includes("sandbox") ||
        normalized.includes("teste") ||
        normalized.includes("hml")) {
        return true;
    }
    return fallbackValue;
}
function isValidP12Attachment(attachment) {
    if (!attachment) {
        return false;
    }
    const name = String(attachment.name ?? "").trim().toLowerCase();
    const contentType = String(attachment.contentType ?? "").trim().toLowerCase();
    if (name.endsWith(".p12")) {
        return true;
    }
    return contentType.includes("pkcs12") || contentType.includes("x-pkcs12");
}
class ManagerBotService {
    dependencies;
    config;
    client = null;
    logger = FALLBACK_LOGGER;
    pendingUploads = new Map();
    trackedAdminPanels = new Map();
    trackedAppsPanels = new Map();
    trackedAppsPanelRefreshTimers = new Map();
    cartStateCache = new Map();
    cartTopicSyncTimers = new Map();
    cartInactivityTimers = new Map();
    cartApprovedTimers = new Map();
    applicationOwnerUserIds = [];
    customerRoleSyncTimer = null;
    constructor(dependencies, config) {
        this.dependencies = dependencies;
        this.config = config;
    }
    isConfigured() {
        return Boolean(this.config.token);
    }
    async start(logger = FALLBACK_LOGGER) {
        this.logger = logger;
        if (!this.config.token) {
            this.logger.info({}, "Manager bot desativado: MANAGER_BOT_TOKEN nao configurado.");
            return;
        }
        if (this.client) {
            return;
        }
        const client = new discord_js_1.Client({
            intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMembers, discord_js_1.GatewayIntentBits.DirectMessages],
            partials: [discord_js_1.Partials.Channel],
        });
        client.once(discord_js_1.Events.ClientReady, async (readyClient) => {
            this.logger.info({
                botUserId: readyClient.user.id,
                botUsername: readyClient.user.tag,
            }, "Manager bot conectado no Discord.");
            if (!this.config.registerCommands) {
                return;
            }
            try {
                await this.registerSlashCommands(readyClient, this.config.guildId ?? null);
                await this.syncAllConfiguredCustomerRoles().catch((error) => {
                    this.logger.warn({ error: error?.message ?? String(error) }, "Falha ao sincronizar cargos de clientes na inicializacao.");
                });
                await this.rehydrateExistingCartTimers().catch((error) => {
                    this.logger.warn({ error: error?.message ?? String(error) }, "Falha ao reidratar timers de carrinho na inicializacao.");
                });
                await this.recoverApprovedCartNotifications().catch((error) => {
                    this.logger.warn({ error: error?.message ?? String(error) }, "Falha ao recuperar carrinhos com pagamento aprovado.");
                });
                this.startCustomerRoleSyncTimer();
            }
            catch (error) {
                this.logger.error({ error: error instanceof Error ? error.message : String(error) }, "Falha ao registrar slash commands do manager bot.");
            }
        });
        client.on(discord_js_1.Events.GuildCreate, (guild) => {
            if (!this.config.registerCommands) {
                return;
            }
            if (this.config.guildId && guild.id !== this.config.guildId) {
                return;
            }
            void this.registerSlashCommands(client, guild.id).catch((error) => {
                this.logger.warn({
                    error: error instanceof Error ? error.message : String(error),
                    guildId: guild.id,
                }, "Falha ao registrar slash commands apos entrada em um servidor.");
            });
        });
        client.on(discord_js_1.Events.InteractionCreate, (interaction) => {
            void this.handleInteraction(interaction);
        });
        client.on(discord_js_1.Events.MessageCreate, (message) => {
            void this.handleMessageCreate(message);
        });
        client.on(discord_js_1.Events.Error, (error) => {
            this.logger.error({ error: error.message }, "Erro no manager bot.");
        });
        this.client = client;
        await client.login(this.config.token);
    }
    async registerSlashCommands(client, preferredGuildId = null) {
        const application = await client.application.fetch();
        this.applicationOwnerUserIds = this.extractApplicationOwnerUserIds(application);
        const rest = new discord_js_1.REST({ version: "10" }).setToken(this.config.token);
        const commandPayload = this.buildCommands().map((command) => command.toJSON());
        let registeredScope = "global";
        if (preferredGuildId) {
            try {
                await rest.put(discord_js_1.Routes.applicationGuildCommands(application.id, preferredGuildId), { body: commandPayload });
                await rest.put(discord_js_1.Routes.applicationCommands(application.id), { body: [] }).catch((error) => {
                    this.logger.warn({
                        error: error instanceof Error ? error.message : String(error),
                    }, "Falha ao remover slash commands globais antigos do manager bot.");
                });
                registeredScope = "guild";
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                const normalized = message.toLowerCase();
                const shouldFallbackToGlobal = normalized.includes("missing access") || normalized.includes("unknown guild") || normalized.includes("missing permissions");
                if (!shouldFallbackToGlobal) {
                    throw error;
                }
                this.logger.warn({
                    error: message,
                    guildId: preferredGuildId,
                }, "Falha ao registrar slash commands no servidor configurado. Tentando registro global.");
                await rest.put(discord_js_1.Routes.applicationCommands(application.id), {
                    body: commandPayload,
                });
            }
        }
        else {
            await rest.put(discord_js_1.Routes.applicationCommands(application.id), {
                body: commandPayload,
            });
        }
        this.logger.info({
            scope: registeredScope,
            commands: commandPayload.map((command) => command.name),
            applicationOwnerUserIds: this.applicationOwnerUserIds,
        }, "Slash commands do manager bot registrados.");
    }
    async stop() {
        if (!this.client) {
            return;
        }
        this.stopCustomerRoleSyncTimer();
        for (const timer of this.trackedAppsPanelRefreshTimers.values()) {
            clearTimeout(timer);
        }
        this.trackedAppsPanelRefreshTimers.clear();
        for (const timer of this.cartTopicSyncTimers.values()) {
            clearTimeout(timer);
        }
        this.cartTopicSyncTimers.clear();
        for (const timer of this.cartInactivityTimers.values()) {
            clearTimeout(timer);
        }
        this.cartInactivityTimers.clear();
        for (const timer of this.cartApprovedTimers.values()) {
            clearTimeout(timer);
        }
        this.cartApprovedTimers.clear();
        this.cartStateCache.clear();
        await this.client.destroy();
        this.client = null;
    }
    buildCommands() {
        return [
            new discord_js_1.SlashCommandBuilder()
                .setName("apps")
                .setDescription("Veja as suas assinaturas, apps e o status do setup."),
            new discord_js_1.SlashCommandBuilder()
                .setName("renovar")
                .setDescription("Gera um novo Pix para renovar uma assinatura sua.")
                .addIntegerOption((option) => option
                .setName("quantidade")
                .setDescription("Quantidade de ciclos para renovar")
                .setMinValue(1)
                .setMaxValue(12)),
            new discord_js_1.SlashCommandBuilder()
                .setName("painel-manager")
                .setDescription("Abre o painel administrativo privado do bot manager."),
            new discord_js_1.SlashCommandBuilder()
                .setName("config")
                .setDescription("Abre atalhos de configuracao do manager.")
                .addSubcommand((subcommand) => subcommand
                .setName("produto")
                .setDescription("Abre a configuracao visual de um produto/painel.")
                .addStringOption((option) => option
                 .setName("produto")
                 .setDescription("Nome ou slug do produto")
                 .setRequired(false)
                 .setAutocomplete(true))),
            new discord_js_1.SlashCommandBuilder()
                .setName("set")
                .setDescription("Publica atalhos rapidos do manager.")
                .addSubcommand((subcommand) => subcommand
                .setName("produto")
                .setDescription("Publica no canal o painel de um produto ja cadastrado.")
                .addStringOption((option) => option
                .setName("produto")
                .setDescription("Nome ou slug do produto")
                .setRequired(true)
                .setAutocomplete(true))
                .addChannelOption((option) => option
                .setName("canal")
                .setDescription("Canal onde o painel sera publicado")
                .setRequired(false)
                .addChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement))),
            new discord_js_1.SlashCommandBuilder()
                .setName("ver-assinantes")
                .setDescription("Lista assinantes, status e principais pendencias.")
                .addStringOption((option) => option
                .setName("status")
                .setDescription("Filtrar por status")
                .setRequired(false)
                .addChoices({ name: "Todos", value: "all" }, { name: "Pendentes", value: "pending" }, { name: "Ativos", value: "active" }, { name: "Carencia", value: "grace" }, { name: "Suspensos", value: "suspended" }, { name: "Deletados", value: "deleted" })),
            new discord_js_1.SlashCommandBuilder()
                .setName("aprovar")
                .setDescription("Aprova manualmente um pagamento pendente.")
                .addStringOption((option) => option
                .setName("payment_id")
                .setDescription("ID do pagamento pendente")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("subscription_id")
                .setDescription("ID da assinatura para localizar o pagamento mais recente")
                .setRequired(false)),
            new discord_js_1.SlashCommandBuilder()
                .setName("atualizar")
                .setDescription("Atualiza a app comprada para a source mais recente desse produto.")
                .addStringOption((option) => option
                .setName("id")
                .setDescription("ID da instancia ou hostingAppId da app comprada")
                .setRequired(true)),
            new discord_js_1.SlashCommandBuilder()
                .setName("perm")
                .setDescription("Gerencia os administradores internos do bot manager.")
                .addSubcommand((subcommand) => subcommand
                .setName("adicionar")
                .setDescription("Adiciona um usuario como administrador do manager.")
                .addUserOption((option) => option
                .setName("usuario")
                .setDescription("Usuario que recebera a permissao")
                .setRequired(true)))
                .addSubcommand((subcommand) => subcommand
                .setName("remover")
                .setDescription("Remove um usuario da lista de administradores do manager.")
                .addUserOption((option) => option
                .setName("usuario")
                .setDescription("Usuario que sera removido")
                .setRequired(true)))
                .addSubcommand((subcommand) => subcommand
                .setName("lista")
                .setDescription("Lista quem possui permissao administrativa no manager.")),
        ];
    }
    async handleInteraction(interaction) {
        try {
            if (typeof interaction.isAutocomplete === "function" && interaction.isAutocomplete()) {
                await this.handleAutocompleteInteraction(interaction);
                return;
            }
            if (interaction.isChatInputCommand()) {
                await this.handleChatInputCommand(interaction);
                return;
            }
            if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
                return;
            }
            if (interaction.isStringSelectMenu()) {
                await this.handleSelectMenuInteraction(interaction);
                return;
            }
            if (typeof interaction.isChannelSelectMenu === "function" && interaction.isChannelSelectMenu()) {
                await this.handleSelectMenuInteraction(interaction);
                return;
            }
            if (typeof interaction.isRoleSelectMenu === "function" && interaction.isRoleSelectMenu()) {
                await this.handleSelectMenuInteraction(interaction);
                return;
            }
            if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
            }
        }
        catch (error) {
            this.logger.error({
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                interactionType: interaction?.type,
                commandName: interaction?.isChatInputCommand?.() ? interaction.commandName : undefined,
                customId: "customId" in interaction ? interaction.customId : undefined,
            }, "Falha ao responder interacao do manager bot.");
            const content = "Nao consegui concluir essa acao agora. Confira a configuracao do manager e tente novamente.";
            await this.safeReply(interaction, content);
        }
    }
    async handleMessageCreate(message) {
        if (message.author?.bot) {
            return;
        }
        this.cleanupPendingUploads();
        this.cleanupTrackedAdminPanels();
        this.cleanupTrackedAppsPanels();
        const pending = this.pendingUploads.get(message.author.id);
        if (!pending || pending.type !== "efipay_cert") {
            return;
        }
        const isSameScope = String(pending.guildId ?? "") === String(message.guildId ?? "") &&
            String(pending.channelId ?? "") === String(message.channelId ?? "");
        if (!isSameScope) {
            return;
        }
        if ((pending.expiresAt ?? 0) <= Date.now()) {
            this.pendingUploads.delete(message.author.id);
            const updated = await this.tryUpdateTrackedAdminPanel(message.author.id, this.buildAdminPanelPayload("Tempo para upload expirado. Clique em `Enviar .p12` novamente."));
            if (!updated) {
                await message.reply("Tempo para upload expirado. Clique em `Enviar .p12` novamente.").catch(() => null);
            }
            return;
        }
        if (normalizeTextForMatch(message.content) === "cancelar") {
            this.pendingUploads.delete(message.author.id);
            const updated = await this.tryUpdateTrackedAdminPanel(message.author.id, this.buildAdminPanelPayload("Importacao do certificado `.p12` cancelada."));
            if (!updated) {
                await message.reply("Importacao do certificado cancelada.").catch(() => null);
            }
            return;
        }
        const attachments = [...message.attachments.values()];
        if (!attachments.length) {
            const updated = await this.tryUpdateTrackedAdminPanel(message.author.id, this.buildAdminPanelPayload("Envie um arquivo `.p12` como anexo no canal atual ou envie `cancelar` para abortar."));
            if (!updated) {
                await message.reply("Envie um arquivo `.p12` como anexo no canal atual.").catch(() => null);
            }
            return;
        }
        const attachment = attachments.find((item) => isValidP12Attachment(item));
        if (!attachment) {
            const updated = await this.tryUpdateTrackedAdminPanel(message.author.id, this.buildAdminPanelPayload("Arquivo invalido. Envie um certificado com extensao `.p12`."));
            if (!updated) {
                await message.reply("Arquivo invalido. Envie um certificado com extensao `.p12`.").catch(() => null);
            }
            return;
        }
        if (Number(attachment.size ?? 0) > MAX_P12_BYTES) {
            const updated = await this.tryUpdateTrackedAdminPanel(message.author.id, this.buildAdminPanelPayload("O arquivo `.p12` deve ter no maximo 10MB."));
            if (!updated) {
                await message.reply("O arquivo `.p12` deve ter no maximo 10MB.").catch(() => null);
            }
            return;
        }
        try {
            const payload = await this.downloadAttachmentBase64(attachment.url);
            if (!payload.base64 || payload.size <= 0) {
                throw new Error("Arquivo recebido esta vazio.");
            }
            if (payload.size > MAX_P12_BYTES) {
                throw new Error("O arquivo `.p12` deve ter no maximo 10MB.");
            }
            const currentEfipay = this.dependencies.managerRuntimeConfigService.getResolvedEfipayOptions();
            const inferredSandbox = inferEfiSandboxFromCertName(`${attachment.name ?? ""}`, Boolean(currentEfipay.sandbox));
            this.dependencies.managerRuntimeConfigService.updateRuntimeConfig({
                certP12Base64: payload.base64,
                certFileName: attachment.name ?? "efipay-cert.p12",
                sandbox: inferredSandbox,
            });
            this.pendingUploads.delete(message.author.id);
            const validation = await this.tryAutoValidateEfipay();
            await this.persistStoreIfNeeded();
            const statusMessage = validation.ok
                ? `Certificado \`.p12\` salvo com sucesso. Ambiente detectado: **${inferredSandbox ? "SANDBOX" : "PRODUCAO"}**. Webhook sincronizado automaticamente.`
                : validation.skipped
                    ? `Certificado \`.p12\` salvo com sucesso. Ambiente detectado: **${inferredSandbox ? "SANDBOX" : "PRODUCAO"}**. ${validation.message}`
                    : `Certificado \`.p12\` salvo, mas a validacao automatica falhou: ${validation.message}`;
            const updated = await this.tryUpdateTrackedAdminPanel(message.author.id, this.buildAdminPanelPayload(statusMessage));
            if (!updated) {
                await message.reply({
                    embeds: [this.buildAdminPanelEmbed(statusMessage)],
                    components: this.buildAdminPanelComponents(),
                }).catch(() => null);
            }
            await message.react(validation.ok ? "✅" : "⚠️").catch(() => null);
        }
        catch (error) {
            this.pendingUploads.delete(message.author.id);
            await this.persistStoreIfNeeded();
            const reason = error instanceof Error ? error.message : String(error);
            const updated = await this.tryUpdateTrackedAdminPanel(message.author.id, this.buildAdminPanelPayload(`Falha ao importar o certificado \`.p12\`: ${reason}`));
            if (!updated) {
                await message.reply(`Falha ao importar o certificado \`.p12\`: ${reason}`).catch(() => null);
            }
            await message.react("❌").catch(() => null);
        }
    }
    async handleChatInputCommand(interaction) {
        switch (interaction.commandName) {
            case "apps":
                await this.handleAppsCommand(interaction);
                return;
            case "renovar":
                await this.handleRenewCommand(interaction);
                return;
            case "setpainel":
                await this.handleSetPanelCommand(interaction);
                return;
            case "criarpainel":
                await this.handleCreatePanelCommand(interaction);
                return;
            case "configpainel":
                await this.handleConfigurePanelCommand(interaction);
                return;
            case "painel-manager":
                await this.handleManagerPanelCommand(interaction);
                return;
            case "config":
                await this.handleConfigCommand(interaction);
                return;
            case "set":
                await this.handleSetCommand(interaction);
                return;
            case "ver-assinantes":
                await this.handleViewSubscribersCommand(interaction);
                return;
            case "aprovar":
                await this.handleApproveCommand(interaction);
                return;
            case "atualizar":
                await this.handleUpdateInstanceCommand(interaction);
                return;
            case "perm":
                await this.handlePermissionCommand(interaction);
                return;
            default:
                await this.replyEphemeral(interaction, "Comando ainda nao tratado pelo manager bot.");
        }
    }
    async handleButtonInteraction(interaction) {
        if (interaction.customId.startsWith(`${CUSTOM_IDS.salesBuy}:`)) {
            await this.handleSalesBuyButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.cartContinuePrefix)) {
            const payload = String(interaction.customId.slice(CUSTOM_IDS.cartContinuePrefix.length) ?? "").trim();
            const separatorIndex = payload.indexOf(":");
            const ownerUserId = separatorIndex >= 0 ? payload.slice(0, separatorIndex) : "";
            const productSlug = separatorIndex >= 0 ? payload.slice(separatorIndex + 1) : "";
            if (interaction.user.id !== ownerUserId && !this.hasAdminAccess(interaction)) {
                await this.replyEphemeral(interaction, "Somente o dono desse carrinho pode continuar a compra.");
                return;
            }
            const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
            if (!product) {
                await this.replyEphemeral(interaction, "Produto nao encontrado para esse carrinho.");
                return;
            }
            await interaction.deferUpdate().catch(() => null);
            const ownerUser = interaction.user.id === ownerUserId
                ? interaction.user
                : (await interaction.guild?.members.fetch(ownerUserId).catch(() => null))?.user ?? { id: ownerUserId, username: ownerUserId };
            const state = await this.persistCartState(interaction.channel, ownerUser, product, {
                ...this.getCartStateFromChannel(interaction.channel, product, interaction.message),
                step: "addons",
            });
            await this.updateCartInteractionMessage(interaction, this.buildCartPanelPayload(product, ownerUser, state));
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.cartBackPrefix)) {
            const payload = String(interaction.customId.slice(CUSTOM_IDS.cartBackPrefix.length) ?? "").trim();
            const separatorIndex = payload.indexOf(":");
            const ownerUserId = separatorIndex >= 0 ? payload.slice(0, separatorIndex) : "";
            const productSlug = separatorIndex >= 0 ? payload.slice(separatorIndex + 1) : "";
            if (interaction.user.id !== ownerUserId && !this.hasAdminAccess(interaction)) {
                await this.replyEphemeral(interaction, "Somente o dono desse carrinho pode alterar essa compra.");
                return;
            }
            const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
            if (!product) {
                await this.replyEphemeral(interaction, "Produto nao encontrado para esse carrinho.");
                return;
            }
            await interaction.deferUpdate().catch(() => null);
            const ownerUser = interaction.user.id === ownerUserId
                ? interaction.user
                : (await interaction.guild?.members.fetch(ownerUserId).catch(() => null))?.user ?? { id: ownerUserId, username: ownerUserId };
            const state = await this.persistCartState(interaction.channel, ownerUser, product, {
                ...this.getCartStateFromChannel(interaction.channel, product, interaction.message),
                step: "plan",
            });
            await this.updateCartInteractionMessage(interaction, this.buildCartPanelPayload(product, ownerUser, state));
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.cartAddonBioPrefix)) {
            const payload = String(interaction.customId.slice(CUSTOM_IDS.cartAddonBioPrefix.length) ?? "").trim();
            const separatorIndex = payload.indexOf(":");
            const ownerUserId = separatorIndex >= 0 ? payload.slice(0, separatorIndex) : "";
            const productSlug = separatorIndex >= 0 ? payload.slice(separatorIndex + 1) : "";
            if (interaction.user.id !== ownerUserId && !this.hasAdminAccess(interaction)) {
                await this.replyEphemeral(interaction, "Somente o dono desse carrinho pode alterar essa compra.");
                return;
            }
            const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
            if (!product) {
                await this.replyEphemeral(interaction, "Produto nao encontrado para esse carrinho.");
                return;
            }
            await interaction.deferUpdate().catch(() => null);
            const ownerUser = interaction.user.id === ownerUserId
                ? interaction.user
                : (await interaction.guild?.members.fetch(ownerUserId).catch(() => null))?.user ?? { id: ownerUserId, username: ownerUserId };
            const state = this.getCartStateFromChannel(interaction.channel, product, interaction.message);
            const addonCodes = new Set(state.addonCodes);
            if (addonCodes.has("custom-bio")) {
                addonCodes.delete("custom-bio");
            }
            else {
                addonCodes.add("custom-bio");
            }
            const nextState = await this.persistCartState(interaction.channel, ownerUser, product, {
                ...state,
                step: "addons",
                addonCodes: [...addonCodes],
            });
            await this.updateCartInteractionMessage(interaction, this.buildCartPanelPayload(product, ownerUser, nextState));
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.cartAddonInfoPrefix)) {
            const payload = String(interaction.customId.slice(CUSTOM_IDS.cartAddonInfoPrefix.length) ?? "").trim();
            const firstSeparatorIndex = payload.indexOf(":");
            const secondSeparatorIndex = firstSeparatorIndex >= 0 ? payload.indexOf(":", firstSeparatorIndex + 1) : -1;
            const addonCode = firstSeparatorIndex >= 0 ? payload.slice(0, firstSeparatorIndex) : "";
            const ownerUserId = secondSeparatorIndex >= 0 ? payload.slice(firstSeparatorIndex + 1, secondSeparatorIndex) : "";
            const productSlug = secondSeparatorIndex >= 0 ? payload.slice(secondSeparatorIndex + 1) : "";
            if (interaction.user.id !== ownerUserId && !this.hasAdminAccess(interaction)) {
                await this.replyEphemeral(interaction, "Somente o dono desse carrinho pode usar esse atalho.");
                return;
            }
            const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
            const addonPool = product?.id ? this.dependencies.catalogService.listAddons(product.id) : (product?.addons ?? []);
            const addon = addonPool.find((item) => item.code === addonCode);
            if (addon && !addon.informationalOnly) {
                await interaction.deferUpdate().catch(() => null);
                const ownerUser = interaction.user.id === ownerUserId
                    ? interaction.user
                    : (await interaction.guild?.members.fetch(ownerUserId).catch(() => null))?.user ?? { id: ownerUserId, username: ownerUserId };
                const state = this.getCartStateFromChannel(interaction.channel, product, interaction.message);
                const addonCodes = new Set(state.addonCodes);
                if (addonCodes.has(addon.code)) {
                    addonCodes.delete(addon.code);
                }
                else {
                    addonCodes.add(addon.code);
                }
                const nextState = await this.persistCartState(interaction.channel, ownerUser, product, {
                    ...state,
                    step: "addons",
                    addonCodes: [...addonCodes],
                });
                await this.updateCartInteractionMessage(interaction, this.buildCartPanelPayload(product, ownerUser, nextState));
                return;
            }
            const fallbackMessages = {
                "auto-restart": "⚡ | O bot reinicia automaticamente em caso de erro. Não se preocupe em pagar a mais por isso.",
                "custom-qr": "🖼️ | O QR Code personalizado com a logo do seu servidor já faz parte do pacote, sem custo extra.",
                "priority-support": "🛡️ | Atualmente não oferecemos um suporte prioritário exclusivo, mas nossa equipe estará sempre disponível para ajudar você, não cobraremos a mais por isso.",
            };
            const informationalMessages = {
                "auto-restart": "⚡ | O bot reinicia automaticamente em caso de erro. Não se preocupe em pagar a mais por isso.\n-# Além disso, conte conosco para solucionar eventuais problemas.",
                "custom-qr": "🖼️ | O QR Code personalizado com a logo do seu servidor já faz parte do pacote, sem custo extra.",
                "priority-support": "🛡️ | Atualmente não oferecemos um suporte prioritário exclusivo, mas nossa equipe estará sempre disponível para ajudar você, não cobraremos a mais por isso.",
            };
            await this.replyEphemeral(interaction, informationalMessages[addonCode] ?? addon?.description ?? fallbackMessages[addonCode] ?? "Esse botão é apenas informativo.");
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.cartCancelPrefix)) {
            const payload = String(interaction.customId.slice(CUSTOM_IDS.cartCancelPrefix.length) ?? "").trim();
            const separatorIndex = payload.indexOf(":");
            const ownerUserId = separatorIndex >= 0 ? payload.slice(0, separatorIndex) : "";
            const productSlug = separatorIndex >= 0 ? payload.slice(separatorIndex + 1) : "";
            if (interaction.user.id !== ownerUserId && !this.hasAdminAccess(interaction)) {
                await this.replyEphemeral(interaction, "Somente o dono desse carrinho pode cancelar a compra.");
                return;
            }
            await interaction.deferUpdate().catch(() => null);
            const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
            if (product) {
                const state = this.getCartStateFromChannel(interaction.channel, product, interaction.message);
                await this.logSalesEvent({
                    type: "cart_closed_manual",
                    userId: ownerUserId || interaction.user.id,
                    channelId: String(interaction.channel?.id ?? "").trim() || null,
                    productName: product.name,
                    planName: this.getCartSelectedPlan(product, state)?.name ?? null,
                    amountCents: this.calculateCartTotalCents(product, state),
                    currency: this.getCartSelectedPlan(product, state)?.currency ?? "BRL",
                    addons: this.getSelectedAddonLogEntries(product, state),
                    note: "Carrinho cancelado manualmente pelo cliente.",
                });
            }
            this.clearCartRuntimeState(interaction.channel?.id);
            if (interaction.channel?.deletable) {
                await interaction.channel.delete("Carrinho cancelado pelo usuario.").catch(() => null);
                return;
            }
            await interaction.message?.edit({
                content: "Carrinho cancelado.",
                embeds: [],
                components: [],
            }).catch(() => null);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.cartPaymentPrefix)) {
            const payload = String(interaction.customId.slice(CUSTOM_IDS.cartPaymentPrefix.length) ?? "").trim();
            const separatorIndex = payload.indexOf(":");
            const ownerUserId = separatorIndex >= 0 ? payload.slice(0, separatorIndex) : "";
            const productSlug = separatorIndex >= 0 ? payload.slice(separatorIndex + 1) : "";
            if (interaction.user.id !== ownerUserId && !this.hasAdminAccess(interaction)) {
                await this.replyEphemeral(interaction, "Somente o dono desse carrinho pode continuar a compra.");
                return;
            }
            const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
            if (!product) {
                await this.replyEphemeral(interaction, "Produto nao encontrado para esse carrinho.");
                return;
            }
            const ownerMember = await interaction.guild?.members.fetch(ownerUserId).catch(() => null);
            const ownerUser = ownerMember?.user ?? (interaction.user.id === ownerUserId ? interaction.user : { id: ownerUserId, username: ownerUserId });
            const state = this.getCartStateFromChannel(interaction.channel, product, interaction.message);
            const selectedPlan = this.getCartSelectedPlan(product, state);
            if (!selectedPlan) {
                await this.replyEphemeral(interaction, "Escolha um plano valido antes de gerar o pagamento.");
                return;
            }
            await interaction.update(this.buildPaymentLoadingPayload(ownerUserId));
            try {
                await this.persistCartState(interaction.channel, ownerUser, product, state);
                const checkout = await this.dependencies.billingService.createEfipayPixCheckout({
                    productSlug: product.slug,
                    planCode: selectedPlan.code,
                    discordUserId: ownerUserId,
                    discordUsername: ownerUser.username,
                    addonCodes: state.addonCodes,
                    cartChannelId: String(interaction.channel?.id ?? "").trim() || null,
                    cartMessageId: String(interaction.message?.id ?? "").trim() || null,
                });
                await this.persistStoreIfNeeded();
                this.clearCartRuntimeState(interaction.channel?.id);
                await interaction.editReply({
                    ...this.buildPixCheckoutResponse({
                        checkout,
                        user: ownerUser,
                        productName: product.name,
                        planName: selectedPlan.name,
                        durationDays: selectedPlan.durationDays ?? 0,
                        addons: this.getCartSelectedAddons(product, state),
                    }),
                });
            }
            catch (error) {
                await interaction.editReply({
                    content: this.limitMessageSize([
                        this.buildUserMention(ownerUserId),
                        "❌ | Não consegui gerar o pagamento agora.",
                        error?.message ?? "Falha desconhecida.",
                        "Se você for da equipe, abra `Configurar Efi` no `/painel-manager` e valide a Efi do manager.",
                    ].filter(Boolean).join("\n")),
                    allowedMentions: this.buildSilentAllowedMentions(ownerUserId),
                    components: [],
                    embeds: [],
                });
            }
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.pixCopyPrefix)) {
            await this.handlePixCopyButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.pixQrPrefix)) {
            await this.handlePixQrButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.pixCancelPrefix)) {
            await this.handlePixCancelButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.appsPagePrefix)) {
            await this.handleAppsPageButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.appsViewPrefix)) {
            await this.handleAppsViewButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.appsPowerPrefix)) {
            await this.handleAppsPowerButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.appsSetupButtonPrefix)) {
            await this.handleAppsSetupButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.appsRenamePrefix)) {
            await this.handleAppsRenameButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.appsTokenPrefix)) {
            await this.handleAppsTokenButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.appsOwnerPrefix)) {
            await this.handleAppsOwnerButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.appsTransferPrefix)) {
            await this.handleAppsTransferButton(interaction);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.appsDeletePrefix)) {
            await this.handleAppsDeleteButton(interaction);
            return;
        }
        switch (interaction.customId) {
            case CUSTOM_IDS.adminRefresh:
                if (!this.ensureAdminAccess(interaction, "atualizar o painel administrativo")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildAdminPanelPayload());
                return;
            case CUSTOM_IDS.adminProducts:
                if (!this.ensureAdminAccess(interaction, "abrir a central de produtos")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildProductCatalogPayload());
                return;
            case CUSTOM_IDS.adminProductsCreate:
                if (!this.ensureAdminAccess(interaction, "criar produto/painel")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.showModal(this.buildCreateProductModal());
                return;
            case CUSTOM_IDS.adminBackHome:
                if (!this.ensureAdminAccess(interaction, "voltar ao painel principal")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildAdminPanelPayload());
                return;
            case CUSTOM_IDS.adminBackProducts:
                if (!this.ensureAdminAccess(interaction, "voltar para a lista de produtos")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildProductCatalogPayload());
                return;
            case CUSTOM_IDS.adminSubscribers:
                if (!this.ensureStaffAccess(interaction, "ver assinantes")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildAdminPanelPayload(undefined, [this.buildSubscribersEmbed("all")], this.buildAdminReturnComponents()));
                return;
            case CUSTOM_IDS.adminPermissions:
                if (!this.ensureAdminAccess(interaction, "ver permissoes internas")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildAdminPanelPayload(undefined, [this.buildPermissionsEmbed(this.dependencies.managerRuntimeConfigService.getResolvedAccessControl())], this.buildAdminReturnComponents()));
                return;
            case CUSTOM_IDS.adminEfipayModal:
                if (!this.ensureAdminAccess(interaction, "abrir a central da Efi do manager")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildEfipayManagementPayload());
                return;
            case CUSTOM_IDS.adminEfipayCredentials:
                if (!this.ensureAdminAccess(interaction, "configurar a Efi do manager")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.showModal(this.buildEfipayConfigModal());
                return;
            case CUSTOM_IDS.adminEfipayUpload:
                if (!this.ensureAdminAccess(interaction, "enviar o certificado da Efi")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.showModal(this.buildEfipayUploadModal());
                return;
            case CUSTOM_IDS.adminEfipayValidate:
                if (!this.ensureAdminAccess(interaction, "validar a Efi do manager")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildEfipayManagementPayload("Validando a Efi do manager..."));
                try {
                    const result = await this.dependencies.managerRuntimeConfigService.validateEfipayConfiguration({ syncWebhook: true });
                    await this.persistStoreIfNeeded();
                    await interaction.editReply({
                        ...this.buildEfipayManagementPayload(`Validacao concluida. Webhook: ${result.remoteWebhook ? "sincronizado" : "sem retorno remoto"}.`),
                    });
                }
                catch (error) {
                    await this.persistStoreIfNeeded();
                    await interaction.editReply({
                        ...this.buildEfipayManagementPayload(`Falha na validacao da Efi: ${error.message}`),
                    });
                }
                return;
            case CUSTOM_IDS.adminEfipayWebhook:
                if (!this.ensureAdminAccess(interaction, "sincronizar o webhook da Efi")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildEfipayManagementPayload("Sincronizando o webhook da Efi..."));
                try {
                    await this.dependencies.managerRuntimeConfigService.syncEfipayWebhook();
                    await this.persistStoreIfNeeded();
                    await interaction.editReply({
                        ...this.buildEfipayManagementPayload("Webhook da Efi sincronizado com sucesso."),
                    });
                }
                catch (error) {
                    await this.persistStoreIfNeeded();
                    await interaction.editReply({
                        ...this.buildEfipayManagementPayload(`Falha ao sincronizar webhook: ${error.message}`),
                    });
                }
                return;
            case CUSTOM_IDS.adminSales:
                if (!this.ensureAdminAccess(interaction, "abrir as configuracoes de vendas")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildSalesManagementPayload());
                return;
            case CUSTOM_IDS.adminSalesCartCategory:
                if (!this.ensureAdminAccess(interaction, "configurar a categoria do carrinho")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildSalesCategoryPayload());
                return;
            case CUSTOM_IDS.adminSalesCartCategoryClear:
                if (!this.ensureAdminAccess(interaction, "limpar a categoria do carrinho")) {
                    return;
                }
                this.dependencies.managerRuntimeConfigService.updateSalesSettings({ cartCategoryId: null });
                await this.persistStoreIfNeeded();
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildSalesManagementPayload("Categoria do carrinho removida."));
                return;
            case CUSTOM_IDS.adminSalesCustomerRole:
                if (!this.ensureAdminAccess(interaction, "configurar o cargo do cliente")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildSalesCustomerRolePayload());
                return;
            case CUSTOM_IDS.adminSalesCustomerRoleClear:
                if (!this.ensureAdminAccess(interaction, "limpar o cargo do cliente")) {
                    return;
                }
                this.dependencies.managerRuntimeConfigService.updateSalesSettings({ customerRoleId: null });
                await this.persistStoreIfNeeded();
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildSalesManagementPayload("Cargo do cliente removido."));
                return;
            case CUSTOM_IDS.adminSalesStaffRoles:
                if (!this.ensureAdminAccess(interaction, "configurar os cargos staff do carrinho")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildSalesStaffRolesPayload());
                return;
            case CUSTOM_IDS.adminSalesStaffRolesClear:
                if (!this.ensureAdminAccess(interaction, "limpar os cargos staff do carrinho")) {
                    return;
                }
                this.dependencies.managerRuntimeConfigService.updateSalesSettings({ cartStaffRoleIds: [] });
                await this.persistStoreIfNeeded();
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildSalesManagementPayload("Cargos staff do carrinho removidos."));
                return;
            case CUSTOM_IDS.adminSalesTemplate:
                if (!this.ensureAdminAccess(interaction, "configurar o nome do canal do carrinho")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.showModal(this.buildSalesTemplateModal());
                return;
            case CUSTOM_IDS.adminSalesLogsChannel:
                if (!this.ensureAdminAccess(interaction, "configurar o canal de logs privados")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildSalesLogsChannelPayload());
                return;
            case CUSTOM_IDS.adminSalesLogsChannelClear:
                if (!this.ensureAdminAccess(interaction, "limpar o canal de logs privados")) {
                    return;
                }
                this.dependencies.managerRuntimeConfigService.updateSalesSettings({ logsChannelId: null });
                await this.persistStoreIfNeeded();
                this.rememberAdminPanelInteraction(interaction);
                await interaction.update(this.buildSalesManagementPayload("Canal de logs privados removido."));
                return;
            case CUSTOM_IDS.adminSalesInactivity:
                if (!this.ensureAdminAccess(interaction, "configurar a expiracao do carrinho")) {
                    return;
                }
                this.rememberAdminPanelInteraction(interaction);
                await interaction.showModal(this.buildSalesInactivityModal());
                return;
            default:
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductBasicPrefix)) {
                    if (!this.ensureAdminAccess(interaction, "editar os dados do produto")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductBasicPrefix.length) ?? "").trim();
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.showModal(this.buildProductBasicsModal(productSlug));
                    return;
                }
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductVisualPrefix)) {
                    if (!this.ensureAdminAccess(interaction, "configurar a vitrine do produto")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductVisualPrefix.length) ?? "").trim();
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.showModal(this.buildProductVisualModal(productSlug));
                    return;
                }
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductApprovedPrefix)) {
                    if (!this.ensureAdminAccess(interaction, "configurar a embed de pagamento aprovado")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductApprovedPrefix.length) ?? "").trim();
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.showModal(this.buildProductApprovedModal(productSlug));
                    return;
                }
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductSourcePrefix)) {
                    if (!this.ensureAdminAccess(interaction, "configurar a source do produto")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductSourcePrefix.length) ?? "").trim();
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.showModal(this.buildProductSourceModal(productSlug));
                    return;
                }
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductPlansPrefix)) {
                    if (!this.ensureAdminAccess(interaction, "configurar os planos do produto")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductPlansPrefix.length) ?? "").trim();
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.showModal(this.buildProductPlansModal(productSlug));
                    return;
                }
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductRolePrefix)) {
                    if (!this.ensureAdminAccess(interaction, "configurar o cargo do produto")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductRolePrefix.length) ?? "").trim();
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.update(this.buildProductRolePayload(productSlug));
                    return;
                }
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductRoleClearPrefix)) {
                    if (!this.ensureAdminAccess(interaction, "limpar o cargo do produto")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductRoleClearPrefix.length) ?? "").trim();
                    this.dependencies.catalogService.updateProduct(productSlug, { customerRoleId: null });
                    await this.persistStoreIfNeeded();
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.update(this.buildProductRolePayload(productSlug, "Cargo do produto removido."));
                    return;
                }
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductViewPrefix)) {
                    if (!this.ensureAdminAccess(interaction, "abrir a configuracao do produto")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductViewPrefix.length) ?? "").trim();
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.update(this.buildProductManagementPayload(productSlug));
                    return;
                }
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductPublishPrefix)) {
                    if (!this.ensureStaffAccess(interaction, "publicar o painel de vendas")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductPublishPrefix.length) ?? "").trim();
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.update(this.buildProductPublishPayload(productSlug));
                    return;
                }
                if (interaction.customId.startsWith(CUSTOM_IDS.adminProductPreviewPrefix)) {
                    if (!this.ensureStaffAccess(interaction, "visualizar o painel de vendas")) {
                        return;
                    }
                    const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductPreviewPrefix.length) ?? "").trim();
                    const product = this.getResolvedProductBySlug(productSlug);
                    if (!product) {
                        await this.replyEphemeral(interaction, "Produto nao encontrado para preview.");
                        return;
                    }
                    await this.replyEphemeral(interaction, this.buildSalesPanelMessage(product));
                    return;
                }
                if (interaction.customId === CUSTOM_IDS.adminBackEfipay) {
                    if (!this.ensureAdminAccess(interaction, "voltar ao painel principal")) {
                        return;
                    }
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.update(this.buildAdminPanelPayload());
                    return;
                }
                if (interaction.customId === CUSTOM_IDS.adminBackSales) {
                    if (!this.ensureAdminAccess(interaction, "voltar para vendas")) {
                        return;
                    }
                    this.rememberAdminPanelInteraction(interaction);
                    await interaction.update(this.buildSalesManagementPayload());
                    return;
                }
                await this.replyEphemeral(interaction, "Botao ainda nao tratado pelo manager bot.");
        }
    }
    async handleSelectMenuInteraction(interaction) {
        if (typeof interaction.customId === "string" && interaction.customId.startsWith(CUSTOM_IDS.buyPlanSelectCartPrefix)) {
            await this.handleCartPlanSelection(interaction);
            return;
        }
        if (typeof interaction.customId === "string" && interaction.customId.startsWith(CUSTOM_IDS.appsSelectPrefix)) {
            await this.handleAppsSelection(interaction);
            return;
        }
        if (interaction.customId === CUSTOM_IDS.adminProductsSelect) {
            if (!this.ensureAdminAccess(interaction, "abrir a configuracao do produto")) {
                return;
            }
            const productSlug = String(interaction.values?.[0] ?? "").trim();
            this.rememberAdminPanelInteraction(interaction);
            await interaction.update(this.buildProductManagementPayload(productSlug));
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.adminProductPublishChannelPrefix)) {
            if (!this.ensureStaffAccess(interaction, "publicar o painel de vendas")) {
                return;
            }
            const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductPublishChannelPrefix.length) ?? "").trim();
            await this.handleProductPublishSelection(interaction, productSlug);
            return;
        }
        if (interaction.customId.startsWith(CUSTOM_IDS.adminProductRoleSelectPrefix)) {
            if (!this.ensureAdminAccess(interaction, "configurar o cargo do produto")) {
                return;
            }
            const productSlug = String(interaction.customId.slice(CUSTOM_IDS.adminProductRoleSelectPrefix.length) ?? "").trim();
            const roleId = String(interaction.values?.[0] ?? "").trim();
            this.dependencies.catalogService.updateProduct(productSlug, { customerRoleId: roleId || null });
            await this.persistStoreIfNeeded();
            this.rememberAdminPanelInteraction(interaction);
            await interaction.update(this.buildProductRolePayload(productSlug, "Cargo do produto atualizado."));
            return;
        }
        if (interaction.customId === CUSTOM_IDS.adminSalesCategorySelect) {
            if (!this.ensureAdminAccess(interaction, "configurar a categoria do carrinho")) {
                return;
            }
            const categoryId = String(interaction.values?.[0] ?? "").trim();
            this.dependencies.managerRuntimeConfigService.updateSalesSettings({ cartCategoryId: categoryId });
            await this.persistStoreIfNeeded();
            this.rememberAdminPanelInteraction(interaction);
            await interaction.update(this.buildSalesManagementPayload("Categoria do carrinho atualizada."));
            return;
        }
        if (interaction.customId === CUSTOM_IDS.adminSalesCustomerRoleSelect) {
            if (!this.ensureAdminAccess(interaction, "configurar o cargo do cliente")) {
                return;
            }
            const roleId = String(interaction.values?.[0] ?? "").trim();
            this.dependencies.managerRuntimeConfigService.updateSalesSettings({ customerRoleId: roleId });
            await this.persistStoreIfNeeded();
            this.rememberAdminPanelInteraction(interaction);
            await interaction.update(this.buildSalesManagementPayload("Cargo do cliente atualizado."));
            return;
        }
        if (interaction.customId === CUSTOM_IDS.adminSalesStaffRolesSelect) {
            if (!this.ensureAdminAccess(interaction, "configurar os cargos staff do carrinho")) {
                return;
            }
            this.dependencies.managerRuntimeConfigService.updateSalesSettings({ cartStaffRoleIds: interaction.values ?? [] });
            await this.persistStoreIfNeeded();
            this.rememberAdminPanelInteraction(interaction);
            await interaction.update(this.buildSalesManagementPayload("Cargos staff do carrinho atualizados."));
            return;
        }
        if (interaction.customId === CUSTOM_IDS.adminSalesLogsChannelSelect) {
            if (!this.ensureAdminAccess(interaction, "configurar o canal de logs privados")) {
                return;
            }
            const channelId = String(interaction.values?.[0] ?? "").trim();
            this.dependencies.managerRuntimeConfigService.updateSalesSettings({ logsChannelId: channelId || null });
            await this.persistStoreIfNeeded();
            this.rememberAdminPanelInteraction(interaction);
            await interaction.update(this.buildSalesManagementPayload("Canal de logs privados atualizado."));
            return;
        }
        switch (interaction.customId) {
            case CUSTOM_IDS.buyPlanSelect:
                await this.handleBuyPlanSelection(interaction);
                return;
            case CUSTOM_IDS.renewSelect:
                await this.handleRenewalSelection(interaction);
                return;
            case CUSTOM_IDS.appsSetupSelect:
                await this.handleSetupSelection(interaction);
                return;
            default:
                await this.replyEphemeral(interaction, "Selecao ainda nao tratada pelo manager bot.");
        }
    }
    async handleModalSubmit(interaction) {
        if (interaction.customId === MODAL_IDS.efipayConfig) {
            await this.handleEfipayConfigModal(interaction);
            return;
        }
        if (interaction.customId === MODAL_IDS.efipayUpload) {
            await this.handleEfipayUploadModal(interaction);
            return;
        }
        if (interaction.customId === MODAL_IDS.salesTemplate) {
            await this.handleSalesTemplateModal(interaction);
            return;
        }
        if (interaction.customId === MODAL_IDS.salesInactivity) {
            await this.handleSalesInactivityModal(interaction);
            return;
        }
        if (interaction.customId === MODAL_IDS.productCreate) {
            await this.handleCreateProductModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.productBasicPrefix)) {
            await this.handleProductBasicsModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.productVisualPrefix)) {
            await this.handleProductVisualModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.productApprovedPrefix)) {
            await this.handleProductApprovedModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.productSourcePrefix)) {
            await this.handleProductSourceModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.productPlansPrefix)) {
            await this.handleProductPlansModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.botSetupPrefix)) {
            await this.handleBotSetupModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.appRenamePrefix)) {
            await this.handleAppsRenameModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.appTokenPrefix)) {
            await this.handleAppsTokenModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.appOwnerPrefix)) {
            await this.handleAppsOwnerModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.appTransferPrefix)) {
            await this.handleAppsTransferModal(interaction);
            return;
        }
        if (interaction.customId.startsWith(MODAL_IDS.appDeletePrefix)) {
            await this.handleAppsDeleteModal(interaction);
            return;
        }
        await this.replyEphemeral(interaction, "Modal ainda nao tratado pelo manager bot.");
    }
    async handleAutocompleteInteraction(interaction) {
        if (!["config", "set"].includes(interaction.commandName)) {
            await interaction.respond([]).catch(() => null);
            return;
        }
        const subcommand = interaction.options.getSubcommand(false);
        if (subcommand !== "produto") {
            await interaction.respond([]).catch(() => null);
            return;
        }
        const focused = interaction.options.getFocused(true);
        if (focused.name !== "produto") {
            await interaction.respond([]).catch(() => null);
            return;
        }
        const choices = this.buildProductAutocompleteChoices(focused.value);
        await interaction.respond(choices).catch(() => null);
    }
    async handleAppsCommand(interaction) {
        const entries = this.buildOwnedAppEntries(interaction.user.id);
        if (entries.length === 0) {
            await this.replyEphemeral(interaction, "Voce ainda nao tem apps comprados no manager. Quando fizer a primeira compra, tudo aparece aqui.");
            return;
        }
        if (interaction.guild) {
            await this.tryGrantCustomerRole(interaction.guild, interaction.user.id).catch(() => null);
        }
        await interaction.deferReply();
        const payload = await this.buildAppsPanelPayload(interaction.user.id);
        const replyMessage = await interaction.editReply(payload);
        this.rememberAppsPanelInteraction(interaction, {
            page: 0,
            selectedKey: null,
            view: "overview",
            panelOwnerUserId: interaction.user.id,
            messageId: replyMessage?.id ?? null,
            channelId: replyMessage?.channelId ?? interaction.channelId ?? null,
        });
    }
    async handleRenewCommand(interaction) {
        const quantity = interaction.options.getInteger("quantidade") ?? 1;
        const bundles = this.dependencies.subscriptionService
            .listByDiscordUserId(interaction.user.id)
            .filter((bundle) => bundle?.subscription && ["active", "grace", "suspended"].includes(bundle.subscription.status));
        if (bundles.length === 0) {
            await this.replyEphemeral(interaction, "Voce nao tem assinaturas renovaveis agora. Use `/apps` para conferir seu status atual.");
            return;
        }
        if (bundles.length === 1) {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const checkout = await this.dependencies.billingService.createEfipayPixRenewal(bundles[0].subscription.id, quantity);
                await interaction.editReply(this.buildPixCheckoutResponse({
                    checkout,
                    user: interaction.user,
                    productName: bundles[0].product?.name ?? "Produto",
                    planName: bundles[0].plan?.name ?? "Plano",
                    durationDays: bundles[0].plan?.durationDays ?? 0,
                }));
            }
            catch (error) {
                await interaction.editReply(`Nao consegui gerar a renovacao agora: ${error.message}`);
            }
            return;
        }
        const options = bundles
            .filter((bundle) => String(bundle?.subscription?.id ?? "").trim())
            .slice(0, 25)
            .map((bundle) => ({
            label: `${bundle.product?.name ?? "Produto"} - ${bundle.plan?.name ?? "Plano"}`.slice(0, 100),
            description: `Status ${this.getStatusLabel(bundle.subscription.status)} - vence ${this.formatIsoDate(bundle.subscription.currentPeriodEnd)}`.slice(0, 100),
            value: `${String(bundle.subscription.id).trim()}|${quantity}`,
        }));
        if (options.length === 0) {
            await this.replyEphemeral(interaction, "Nao encontrei assinaturas validas para renovar agora.");
            return;
        }
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(CUSTOM_IDS.renewSelect)
            .setPlaceholder("Escolha qual assinatura voce quer renovar")
            .addOptions(options));
        await this.replyEphemeral(interaction, {
            content: `Escolha a assinatura que deseja renovar. Quantidade de ciclos: ${quantity}.`,
            components: [row],
        });
    }
    async handleSetPanelCommand(interaction) {
        if (!this.ensureStaffAccess(interaction, "publicar o painel de vendas")) {
            return;
        }
        const productSlug = String(interaction.options.getString("produto_slug", true) ?? "").trim();
        const product = this.getResolvedProductBySlug(productSlug);
        if (!product) {
            await this.replyEphemeral(interaction, "Produto nao encontrado. Abra `/painel-manager` e use a tela **Produtos** para criar ou selecionar um item valido.");
            return;
        }
        const targetChannel = interaction.options.getChannel("canal") ?? interaction.channel;
        if (!targetChannel || !targetChannel.isTextBased?.()) {
            await this.replyEphemeral(interaction, "Escolha um canal de texto valido para publicar o painel.");
            return;
        }
        const result = await this.publishOrUpdateSalesPanel(product, targetChannel);
        await this.replyEphemeral(interaction, `Painel de vendas de **${product.name}** ${result.action === "updated" ? "atualizado" : "publicado"} em ${targetChannel.toString()}.`);
    }
    async handleCreatePanelCommand(interaction) {
        if (!this.ensureAdminAccess(interaction, "criar produto/painel")) {
            return;
        }
        try {
            const product = this.dependencies.catalogService.createProduct({
                slug: interaction.options.getString("slug", true),
                name: interaction.options.getString("nome", true),
                description: interaction.options.getString("descricao") ?? "",
            });
            if (product?.sourceSlug) {
                this.dependencies.managerRuntimeConfigService.updateRuntimeSourceConfig(product.sourceSlug, {
                    displayName: product.name,
                });
            }
            await this.persistStoreIfNeeded();
            await this.replyEphemeral(interaction, {
                content: `Produto **${product.name}** criado com sucesso.`,
                embeds: [this.buildProductConfigurationEmbed(product.slug)],
            });
        }
        catch (error) {
            await this.replyEphemeral(interaction, `Nao consegui criar o produto/painel: ${error.message}`);
        }
    }
    async handleConfigurePanelCommand(interaction) {
        if (!this.ensureAdminAccess(interaction, "configurar produto/painel")) {
            return;
        }
        const productSlug = interaction.options.getString("produto_slug", true);
        const sourceSlug = interaction.options.getString("source_slug") ?? productSlug;
        const sourceType = interaction.options.getString("source_tipo");
        const sourceValue = this.normalizeConfigStringInput(interaction.options.getString("source_valor"));
        const sourceRef = this.normalizeConfigStringInput(interaction.options.getString("source_ref"));
        const sourcePath = this.normalizeConfigStringInput(interaction.options.getString("source_path"));
        const sourceToken = this.normalizeConfigStringInput(interaction.options.getString("source_token"));
        const sourceExcludePaths = this.parseCsvConfigList(interaction.options.getString("source_excluir"));
        const planPrices = {
            weekly: interaction.options.getInteger("semanal") ?? undefined,
            monthly: interaction.options.getInteger("mensal") ?? undefined,
            quarterly: interaction.options.getInteger("trimestral") ?? undefined,
            semiannual: interaction.options.getInteger("semestral") ?? undefined,
            annual: interaction.options.getInteger("anual") ?? undefined,
        };
        try {
            const product = this.dependencies.catalogService.updateProduct(productSlug, {
                name: interaction.options.getString("nome") ?? undefined,
                description: interaction.options.getString("descricao") ?? undefined,
                sourceSlug,
                tutorialUrl: interaction.options.getString("tutorial_url") ?? undefined,
                planPrices,
            });
            if (sourceType) {
                if (!sourceValue) {
                    throw new Error("Informe `source_valor` quando usar `source_tipo`.");
                }
                const currentSourceConfig = this.dependencies.managerRuntimeConfigService.getRuntimeSourceConfig(sourceSlug) ?? {};
                const sourceUpdate = {
                    displayName: product?.name,
                };
                if (sourceType === "artifact_path") {
                    sourceUpdate.artifactPath = sourceValue;
                    sourceUpdate.projectDir = null;
                    sourceUpdate.githubRepo = null;
                    sourceUpdate.githubRef = null;
                    sourceUpdate.githubPath = null;
                    sourceUpdate.githubArchiveUrl = null;
                    sourceUpdate.githubToken = null;
                }
                if (sourceType === "project_dir") {
                    sourceUpdate.projectDir = sourceValue;
                    sourceUpdate.artifactPath = null;
                    sourceUpdate.githubRepo = null;
                    sourceUpdate.githubRef = null;
                    sourceUpdate.githubPath = null;
                    sourceUpdate.githubArchiveUrl = null;
                    sourceUpdate.githubToken = null;
                }
                if (sourceType === "github_repo") {
                    sourceUpdate.artifactPath = null;
                    sourceUpdate.projectDir = null;
                    sourceUpdate.githubRepo = this.normalizeGitHubRepoInput(sourceValue);
                    sourceUpdate.githubRef = sourceRef ?? currentSourceConfig.githubRef ?? "main";
                    if (sourcePath !== undefined) {
                        sourceUpdate.githubPath = sourcePath;
                    }
                    if (sourceToken !== undefined) {
                        sourceUpdate.githubToken = sourceToken;
                    }
                }
                if (sourceExcludePaths !== undefined) {
                    sourceUpdate.excludePaths = sourceExcludePaths;
                }
                this.dependencies.managerRuntimeConfigService.updateRuntimeSourceConfig(sourceSlug, sourceUpdate);
            }
            else if (product?.sourceSlug) {
                const sourceUpdate = {
                    displayName: product.name,
                };
                if (sourceExcludePaths !== undefined) {
                    sourceUpdate.excludePaths = sourceExcludePaths;
                }
                if (sourceRef !== undefined) {
                    sourceUpdate.githubRef = sourceRef ?? "main";
                }
                if (sourcePath !== undefined) {
                    sourceUpdate.githubPath = sourcePath;
                }
                if (sourceToken !== undefined) {
                    sourceUpdate.githubToken = sourceToken;
                }
                this.dependencies.managerRuntimeConfigService.updateRuntimeSourceConfig(product.sourceSlug, sourceUpdate);
            }
            await this.persistStoreIfNeeded();
            await this.syncPublishedSalesPanel(productSlug).catch((error) => {
                this.logger.warn({ error: error?.message ?? String(error), productSlug }, "Falha ao sincronizar painel publicado apos atualizar via comando.");
            });
            const warnings = [];
            if (sourceType === "project_dir") {
                warnings.push("Aviso: `project_dir` so funciona se essa pasta existir no servidor hospedado. Para producao, prefira `artifact_path` ou `github_repo`.");
            }
            if (sourceType === "github_repo" && sourceToken) {
                warnings.push("Repo GitHub privado configurado com token salvo no runtime do manager.");
            }
            await this.replyEphemeral(interaction, {
                content: warnings.join("\n") || "Produto/painel configurado com sucesso.",
                embeds: [this.buildProductConfigurationEmbed(productSlug)],
            });
        }
        catch (error) {
            await this.replyEphemeral(interaction, `Nao consegui configurar o produto/painel: ${error.message}`);
        }
    }
    async handleCreateProductModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "criar produto/painel")) {
            return;
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const product = this.dependencies.catalogService.createProduct({
                slug: interaction.fields.getTextInputValue("product_slug"),
                name: interaction.fields.getTextInputValue("product_name"),
                description: interaction.fields.getTextInputValue("product_description"),
            });
            if (product?.sourceSlug) {
                this.dependencies.managerRuntimeConfigService.updateRuntimeSourceConfig(product.sourceSlug, {
                    displayName: product.name,
                });
            }
            await this.persistStoreIfNeeded();
            const payload = this.buildProductManagementPayload(product.slug, `Produto **${product.name}** criado com sucesso.`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
        catch (error) {
            const message = `Nao consegui criar o produto/painel: ${error.message}`;
            const payload = this.buildProductCatalogPayload(message);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
    }
    async handleProductBasicsModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "editar os dados do produto")) {
            return;
        }
        const productSlug = String(interaction.customId.slice(MODAL_IDS.productBasicPrefix.length) ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const currentProduct = this.dependencies.catalogService.getProductBySlug(productSlug);
            const currentPanelConfig = currentProduct?.panelConfig ?? {};
            const productName = interaction.fields.getTextInputValue("product_name");
            const productDescription = interaction.fields.getTextInputValue("product_description");
            const product = this.dependencies.catalogService.updateProduct(productSlug, {
                name: productName,
                description: productDescription,
                tutorialUrl: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("product_tutorial_url")),
                panelConfig: {
                    ...currentPanelConfig,
                    title: this.normalizeConfigStringInput(productName) ?? currentPanelConfig.title ?? null,
                    summary: this.normalizeConfigStringInput(productDescription) ?? currentPanelConfig.summary ?? null,
                    details: currentPanelConfig.details ?? null,
                    imageUrl: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("panel_image_url")) ?? currentPanelConfig.imageUrl ?? null,
                    previewUrl: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("panel_preview_url")) ?? currentPanelConfig.previewUrl ?? null,
                    buttonLabel: currentPanelConfig.buttonLabel ?? null,
                    pricePrefix: currentPanelConfig.pricePrefix ?? "Planos a partir de",
                    footerText: currentPanelConfig.footerText ?? null,
                },
            });
            if (product?.sourceSlug) {
                this.dependencies.managerRuntimeConfigService.updateRuntimeSourceConfig(product.sourceSlug, {
                    displayName: product.name,
                });
            }
            await this.persistStoreIfNeeded();
            await this.syncPublishedSalesPanel(productSlug).catch((error) => {
                this.logger.warn({ error: error?.message ?? String(error), productSlug }, "Falha ao sincronizar painel publicado apos atualizar o produto.");
            });
            const payload = this.buildProductManagementPayload(productSlug, "Configuracao do produto atualizada.");
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
        catch (error) {
            const payload = this.buildProductManagementPayload(productSlug, `Falha ao atualizar os dados do produto: ${error.message}`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
    }
    async handleProductVisualModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "configurar a vitrine do produto")) {
            return;
        }
        const productSlug = String(interaction.customId.slice(MODAL_IDS.productVisualPrefix.length) ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const product = this.dependencies.catalogService.getProductBySlug(productSlug);
            const currentPanelConfig = product?.panelConfig ?? {};
            this.dependencies.catalogService.updateProduct(productSlug, {
                panelConfig: {
                    ...currentPanelConfig,
                    title: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("panel_title")),
                    summary: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("panel_summary")),
                    details: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("panel_details")),
                    imageUrl: currentPanelConfig.imageUrl ?? null,
                    embedColor: this.normalizePanelEmbedColorInput(interaction.fields.getTextInputValue("panel_embed_color")),
                    buttonLabel: currentPanelConfig.buttonLabel ?? null,
                    pricePrefix: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("panel_price_prefix")),
                    footerText: currentPanelConfig.footerText ?? null,
                },
            });
            await this.persistStoreIfNeeded();
            await this.syncPublishedSalesPanel(productSlug).catch((error) => {
                this.logger.warn({ error: error?.message ?? String(error), productSlug }, "Falha ao sincronizar painel publicado apos atualizar a vitrine.");
            });
            const payload = this.buildProductManagementPayload(productSlug, "Visual do produto atualizado.");
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
        catch (error) {
            const payload = this.buildProductManagementPayload(productSlug, `Falha ao atualizar a vitrine do produto: ${error.message}`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
    }
    async handleProductApprovedModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "configurar a embed de pagamento aprovado")) {
            return;
        }
        const productSlug = String(interaction.customId.slice(MODAL_IDS.productApprovedPrefix.length) ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const product = this.dependencies.catalogService.getProductBySlug(productSlug);
            const currentPanelConfig = product?.panelConfig ?? {};
            this.dependencies.catalogService.updateProduct(productSlug, {
                panelConfig: {
                    ...currentPanelConfig,
                    approvedTitle: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("approved_title")),
                    approvedDescription: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("approved_description")),
                    approvedImageUrl: this.normalizeConfigStringInput(interaction.fields.getTextInputValue("approved_image_url")),
                    approvedEmbedColor: this.normalizePanelEmbedColorInput(interaction.fields.getTextInputValue("approved_embed_color")),
                },
            });
            await this.persistStoreIfNeeded();
            const payload = this.buildProductManagementPayload(productSlug, "Embed de pagamento aprovado atualizada.");
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
        catch (error) {
            const payload = this.buildProductManagementPayload(productSlug, `Falha ao atualizar a embed de pagamento aprovado: ${error.message}`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
    }
    async handleProductSourceModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "configurar a source do produto")) {
            return;
        }
        const productSlug = String(interaction.customId.slice(MODAL_IDS.productSourcePrefix.length) ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const nextSourceSlug = this.normalizeConfigStringInput(interaction.fields.getTextInputValue("source_slug")) ?? productSlug;
            const githubRepoInput = interaction.fields.getTextInputValue("source_repo");
            const githubRepo = this.normalizeGitHubRepoInput(githubRepoInput);
            const githubRef = this.normalizeConfigStringInput(interaction.fields.getTextInputValue("source_ref")) ?? "main";
            const githubPath = this.normalizeConfigStringInput(interaction.fields.getTextInputValue("source_path"));
            const excludePaths = this.parseCsvConfigList(interaction.fields.getTextInputValue("source_exclude"));
            const product = this.dependencies.catalogService.updateProduct(productSlug, {
                sourceSlug: nextSourceSlug,
            });
            this.dependencies.managerRuntimeConfigService.updateRuntimeSourceConfig(product?.sourceSlug ?? nextSourceSlug, {
                displayName: product?.name,
                artifactPath: null,
                projectDir: null,
                githubRepo,
                githubRef,
                githubPath,
                excludePaths,
            });
            await this.persistStoreIfNeeded();
            const payload = this.buildProductManagementPayload(productSlug, "Source do produto atualizada para o GitHub.");
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
        catch (error) {
            const payload = this.buildProductManagementPayload(productSlug, `Falha ao atualizar a source do produto: ${error.message}`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
    }
    async handleProductPlansModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "configurar os planos do produto")) {
            return;
        }
        const productSlug = String(interaction.customId.slice(MODAL_IDS.productPlansPrefix.length) ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const parsePlanField = (fieldId) => {
                return this.parseCurrencyInputToCents(interaction.fields.getTextInputValue(fieldId));
            };
            this.dependencies.catalogService.updateProduct(productSlug, {
                planPrices: {
                    weekly: parsePlanField("plan_weekly"),
                    monthly: parsePlanField("plan_monthly"),
                    quarterly: parsePlanField("plan_quarterly"),
                    semiannual: parsePlanField("plan_semiannual"),
                    annual: parsePlanField("plan_annual"),
                },
            });
            await this.persistStoreIfNeeded();
            await this.syncPublishedSalesPanel(productSlug).catch((error) => {
                this.logger.warn({ error: error?.message ?? String(error), productSlug }, "Falha ao sincronizar painel publicado apos atualizar os planos.");
            });
            const payload = this.buildProductManagementPayload(productSlug, "Planos atualizados com sucesso.");
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
        catch (error) {
            const payload = this.buildProductManagementPayload(productSlug, `Falha ao atualizar os planos: ${error.message}`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
    }
    async handleProductPublishSelection(interaction, productSlug) {
        const selectedChannelId = String(interaction.values?.[0] ?? "").trim();
        this.rememberAdminPanelInteraction(interaction);
        const product = this.getResolvedProductBySlug(productSlug);
        if (!product) {
            await interaction.update(this.buildProductCatalogPayload("Produto nao encontrado para publicacao."));
            return;
        }
        const targetChannel = interaction.guild?.channels?.cache?.get(selectedChannelId) ??
            (selectedChannelId ? await interaction.guild?.channels.fetch(selectedChannelId).catch(() => null) : null);
        if (!targetChannel || !targetChannel.isTextBased?.()) {
            await interaction.update(this.buildProductPublishPayload(productSlug, "Escolha um canal de texto valido para publicar o painel."));
            return;
        }
        try {
            const result = await this.publishOrUpdateSalesPanel(product, targetChannel);
            await interaction.update(this.buildProductManagementPayload(productSlug, `Painel de vendas de **${product.name}** ${result.action === "updated" ? "atualizado" : "publicado"} em ${targetChannel.toString()}.`));
        }
        catch (error) {
            await interaction.update(this.buildProductPublishPayload(productSlug, `Falha ao publicar o painel: ${error.message}`));
        }
    }
    async handleSalesTemplateModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "configurar o nome do canal do carrinho")) {
            return;
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const template = String(interaction.fields.getTextInputValue("sales_cart_channel_template") ?? "").trim();
            this.dependencies.managerRuntimeConfigService.updateSalesSettings({
                cartChannelNameTemplate: template || "🛒・{guild}",
            });
            await this.persistStoreIfNeeded();
            const payload = this.buildSalesManagementPayload("Template do canal do carrinho atualizado.");
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
        catch (error) {
            const payload = this.buildSalesManagementPayload(`Falha ao atualizar o template do canal: ${error.message}`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
    }
    async handleSalesInactivityModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "configurar a expiracao do carrinho")) {
            return;
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const rawValue = String(interaction.fields.getTextInputValue("sales_cart_inactivity_minutes") ?? "").trim().replace(",", ".");
            const parsedMinutes = Number(rawValue);
            if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
                throw new Error("Informe um tempo valido em minutos.");
            }
            const normalizedMinutes = Math.min(5, Math.max(1, Math.round(parsedMinutes)));
            this.dependencies.managerRuntimeConfigService.updateSalesSettings({
                cartInactivityMinutes: normalizedMinutes,
            });
            await this.persistStoreIfNeeded();
            await this.rehydrateExistingCartTimers().catch(() => null);
            const payload = this.buildSalesManagementPayload(`Expiracao dos carrinhos atualizada para ${normalizedMinutes} minuto(s).`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
        catch (error) {
            const payload = this.buildSalesManagementPayload(`Falha ao atualizar a expiracao do carrinho: ${error.message}`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(payload);
        }
    }
    async handleCartPlanSelection(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.buyPlanSelectCartPrefix.length) ?? "").trim();
        const separatorIndex = payload.indexOf(":");
        const ownerUserId = separatorIndex >= 0 ? payload.slice(0, separatorIndex) : "";
        const productSlug = separatorIndex >= 0 ? payload.slice(separatorIndex + 1) : "";
        if (!ownerUserId || !productSlug) {
            await this.replyEphemeral(interaction, "Carrinho invalido.");
            return;
        }
        if (interaction.user.id !== ownerUserId && !this.hasAdminAccess(interaction)) {
            await this.replyEphemeral(interaction, "Somente o dono desse carrinho pode continuar a compra.");
            return;
        }
        const [_selectedProductSlug, planCode] = String(interaction.values?.[0] ?? "").split("|");
        const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
        if (!product) {
            await this.replyEphemeral(interaction, "Nenhum produto esta disponivel no manager.");
            return;
        }
        await interaction.deferUpdate().catch(() => null);
        const ownerUser = interaction.user.id === ownerUserId
            ? interaction.user
            : (await interaction.guild?.members.fetch(ownerUserId).catch(() => null))?.user ?? { id: ownerUserId, username: ownerUserId };
        try {
            const currentState = this.getCartStateFromChannel(interaction.channel, product, interaction.message);
            const nextState = await this.persistCartState(interaction.channel, ownerUser, product, {
                ...currentState,
                planCode,
                step: "plan",
            });
            await this.updateCartInteractionMessage(interaction, this.buildCartPanelPayload(product, ownerUser, nextState));
        }
        catch (error) {
            await this.replyEphemeral(interaction, `Nao consegui atualizar o carrinho agora: ${error?.message ?? "falha desconhecida"}`);
        }
    }
    async createOrReuseCartChannel(guild, user, product) {
        const sales = this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings();
        const channelName = this.resolveCartChannelName(sales.cartChannelNameTemplate, guild, user, product);
        const existing = this.findCartChannelForUser(guild, user.id);
        if (existing) {
            const updates = {};
            if (existing.name !== channelName) {
                updates.name = channelName;
            }
            if (sales.cartCategoryId && existing.parentId !== sales.cartCategoryId) {
                updates.parent = sales.cartCategoryId;
            }
            if (Object.keys(updates).length > 0 && typeof existing.edit === "function") {
                await existing.edit(updates).catch(() => null);
            }
            return { channel: existing, created: false };
        }
        const botUserId = this.client?.user?.id;
        if (!botUserId) {
            throw new Error("Bot do manager ainda nao esta pronto para abrir carrinhos.");
        }
        const rawPermissionOverwrites = [
            {
                id: guild.roles.everyone.id,
                type: discord_js_1.OverwriteType.Role,
                deny: [discord_js_1.PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                type: discord_js_1.OverwriteType.Member,
                allow: [
                    discord_js_1.PermissionFlagsBits.ViewChannel,
                    discord_js_1.PermissionFlagsBits.SendMessages,
                    discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                    discord_js_1.PermissionFlagsBits.AttachFiles,
                    discord_js_1.PermissionFlagsBits.EmbedLinks,
                ],
            },
            {
                id: botUserId,
                type: discord_js_1.OverwriteType.Member,
                allow: [
                    discord_js_1.PermissionFlagsBits.ViewChannel,
                    discord_js_1.PermissionFlagsBits.SendMessages,
                    discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                    discord_js_1.PermissionFlagsBits.AttachFiles,
                    discord_js_1.PermissionFlagsBits.EmbedLinks,
                    discord_js_1.PermissionFlagsBits.ManageChannels,
                    discord_js_1.PermissionFlagsBits.ManageMessages,
                ],
            },
            ...sales.cartStaffRoleIds.map((roleId) => ({
                id: roleId,
                type: discord_js_1.OverwriteType.Role,
                allow: [
                    discord_js_1.PermissionFlagsBits.ViewChannel,
                    discord_js_1.PermissionFlagsBits.SendMessages,
                    discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                ],
            })),
            ...this.dependencies.managerRuntimeConfigService.getResolvedAccessControl().adminUserIds.map((userId) => ({
                id: userId,
                type: discord_js_1.OverwriteType.Member,
                allow: [
                    discord_js_1.PermissionFlagsBits.ViewChannel,
                    discord_js_1.PermissionFlagsBits.SendMessages,
                    discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                    discord_js_1.PermissionFlagsBits.ManageMessages,
                ],
            })),
            ...this.applicationOwnerUserIds.map((userId) => ({
                id: userId,
                type: discord_js_1.OverwriteType.Member,
                allow: [
                    discord_js_1.PermissionFlagsBits.ViewChannel,
                    discord_js_1.PermissionFlagsBits.SendMessages,
                    discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                    discord_js_1.PermissionFlagsBits.ManageMessages,
                ],
            })),
        ];
        const permissionOverwriteMap = new Map();
        for (const overwrite of rawPermissionOverwrites) {
            if (!overwrite?.id) {
                continue;
            }
            permissionOverwriteMap.set(String(overwrite.id), overwrite);
        }
        const permissionOverwrites = [...permissionOverwriteMap.values()];
        const createdChannel = await guild.channels.create({
            name: channelName,
            type: discord_js_1.ChannelType.GuildText,
            parent: sales.cartCategoryId ?? undefined,
            topic: this.buildCartTopic(user, product, this.normalizeCartState({ step: "plan" }, product)),
            permissionOverwrites,
        });
        return { channel: createdChannel, created: true };
    }
    findCartChannelForUser(guild, userId) {
        return guild.channels.cache.find((channel) => channel?.type === discord_js_1.ChannelType.GuildText &&
            String(channel.topic ?? "").includes(`user:${userId}`)) ?? null;
    }
    findCartChannelForUserAndProduct(channels, userId, productSlug) {
        const normalizedUserId = String(userId ?? "").trim();
        const normalizedProductSlug = String(productSlug ?? "").trim();
        if (!normalizedUserId || !normalizedProductSlug) {
            return null;
        }
        for (const channel of channels?.values?.() ?? channels ?? []) {
            if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                continue;
            }
            const topic = String(channel.topic ?? "");
            if (topic.includes(`user:${normalizedUserId}`) && topic.includes(`product:${normalizedProductSlug}`)) {
                return channel;
            }
        }
        return null;
    }
    async findCartChannelForApprovedPayment(userId, productSlug) {
        const normalizedUserId = String(userId ?? "").trim();
        const normalizedProductSlug = String(productSlug ?? "").trim();
        if (!this.client || !normalizedUserId || !normalizedProductSlug) {
            return null;
        }
        for (const guild of this.client.guilds.cache.values()) {
            const cachedMatch = this.findCartChannelForUserAndProduct(guild.channels?.cache, normalizedUserId, normalizedProductSlug);
            if (cachedMatch) {
                return cachedMatch;
            }
            const fetchedChannels = await guild.channels.fetch().catch(() => null);
            const fetchedMatch = this.findCartChannelForUserAndProduct(fetchedChannels, normalizedUserId, normalizedProductSlug);
            if (fetchedMatch) {
                return fetchedMatch;
            }
        }
        return null;
    }
    async resolveCartTrackingForBundle(bundle) {
        if (!this.client || !bundle?.payment) {
            return { channel: null, channelId: null, message: null, messageId: null };
        }
        const ownerUserId = this.getPaymentOwnerDiscordUserId(bundle);
        const productSlug = String(bundle?.payment?.metadata?.productSlug ?? bundle?.checkout?.productSlug ?? bundle?.subscription?.product?.slug ?? "").trim();
        let channelId = String(bundle?.payment?.metadata?.cartChannelId ?? bundle?.checkout?.metadata?.cartChannelId ?? "").trim() || null;
        let messageId = String(bundle?.payment?.metadata?.cartMessageId ?? bundle?.checkout?.metadata?.cartMessageId ?? "").trim() || null;
        let channel = channelId
            ? this.client.channels.cache.get(channelId) ?? (await this.client.channels.fetch(channelId).catch(() => null))
            : null;
        if (!channel?.isTextBased?.()) {
            channel = await this.findCartChannelForApprovedPayment(ownerUserId, productSlug);
            channelId = String(channel?.id ?? "").trim() || null;
        }
        let message = null;
        if (messageId && channel?.messages?.fetch) {
            message = await channel.messages.fetch(messageId).catch(() => null);
        }
        if (!message && channel?.messages?.fetch) {
            const recentMessages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
            message = this.findCartMessage(recentMessages, ownerUserId, productSlug);
            messageId = String(message?.id ?? "").trim() || null;
        }
        return { channel, channelId, message, messageId };
    }
    async persistRecoveredCartTracking(bundle, tracking) {
        const channelId = String(tracking?.channelId ?? "").trim() || null;
        const messageId = String(tracking?.messageId ?? "").trim() || null;
        if (!bundle?.payment || (!channelId && !messageId)) {
            return false;
        }
        let changed = false;
        if (!bundle.payment.metadata || typeof bundle.payment.metadata !== "object") {
            bundle.payment.metadata = {};
            changed = true;
        }
        if (bundle.checkout && (!bundle.checkout.metadata || typeof bundle.checkout.metadata !== "object")) {
            bundle.checkout.metadata = {};
            changed = true;
        }
        if (channelId && bundle.payment.metadata.cartChannelId !== channelId) {
            bundle.payment.metadata.cartChannelId = channelId;
            changed = true;
        }
        if (messageId && bundle.payment.metadata.cartMessageId !== messageId) {
            bundle.payment.metadata.cartMessageId = messageId;
            changed = true;
        }
        if (bundle.checkout) {
            if (channelId && bundle.checkout.metadata.cartChannelId !== channelId) {
                bundle.checkout.metadata.cartChannelId = channelId;
                changed = true;
            }
            if (messageId && bundle.checkout.metadata.cartMessageId !== messageId) {
                bundle.checkout.metadata.cartMessageId = messageId;
                changed = true;
            }
        }
        if (changed) {
            await this.persistStoreIfNeeded();
        }
        return changed;
    }
    resolveCartChannelName(template, guild, user, product) {
        const configuredTemplate = String(template ?? "").trim();
        const rawTemplate = !configuredTemplate || configuredTemplate === "carrinho-{user}"
            ? "🛒・{guild}"
            : configuredTemplate;
        const resolved = rawTemplate
            .replace(/\{user(name)?\}/giu, user.username)
            .replace(/\{guild(name)?\}/giu, guild?.name ?? "servidor")
            .replace(/\{server(name)?\}/giu, guild?.name ?? "servidor")
            .replace(/\{produto\}/giu, product.slug)
            .replace(/\{product\}/giu, product.slug);
        return resolved
            .normalize("NFKC")
            .toLowerCase()
            .replace(/[\r\n\t]+/gu, " ")
            .replace(/\s+/gu, "-")
            .replace(/[\\/:*?"<>|#@`']/gu, "")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 90) || `🛒・${String(guild?.name ?? user.username ?? "cliente").trim() || "cliente"}`
            .toLowerCase()
            .replace(/[\r\n\t]+/gu, " ")
            .replace(/\s+/gu, "-")
            .replace(/[\\/:*?"<>|#@`']/gu, "")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 90);
    }
    async upsertCartPanelMessage(channel, user, product) {
        const existingMessages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
        const state = this.getCartStateFromChannel(channel, product);
        const existing = this.findCartMessage(existingMessages, user.id, product.slug);
        const payload = this.buildCartPanelPayload(product, user, state);
        if (existing) {
            await existing.edit(payload);
            return existing;
        }
        return channel.send(payload);
    }
    async tryGrantCustomerRole(guild, userId) {
        const sales = this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings();
        const bundles = this.dependencies.subscriptionService
            .listByDiscordUserId(userId)
            .filter((bundle) => ["active", "grace"].includes(String(bundle?.subscription?.status ?? "").toLowerCase()));
        if (bundles.length === 0) {
            return false;
        }
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return false;
        }
        const roleIds = new Set();
        if (sales.autoAssignCustomerRole && sales.customerRoleId) {
            roleIds.add(sales.customerRoleId);
        }
        for (const bundle of bundles) {
            const productRoleId = String(bundle?.product?.customerRoleId ?? "").trim();
            if (productRoleId) {
                roleIds.add(productRoleId);
            }
        }
        let grantedAny = false;
        for (const roleId of roleIds) {
            if (member.roles.cache.has(roleId)) {
                continue;
            }
            await member.roles.add(roleId, "Cliente com assinatura ativa no manager").catch(() => null);
            grantedAny = true;
        }
        return grantedAny || roleIds.size > 0;
    }
    startCustomerRoleSyncTimer() {
        this.stopCustomerRoleSyncTimer();
        this.customerRoleSyncTimer = setInterval(() => {
            void this.syncAllConfiguredCustomerRoles().catch((error) => {
                this.logger.warn({ error: error?.message ?? String(error) }, "Falha ao sincronizar cargos de clientes.");
            });
        }, 5 * 60 * 1000);
    }
    stopCustomerRoleSyncTimer() {
        if (!this.customerRoleSyncTimer) {
            return;
        }
        clearInterval(this.customerRoleSyncTimer);
        this.customerRoleSyncTimer = null;
    }
    async syncAllConfiguredCustomerRoles() {
        if (!this.client) {
            return;
        }
        const activeUserIds = [...new Set(this.dependencies.store.subscriptions
                .filter((subscription) => ["active", "grace"].includes(String(subscription.status ?? "").toLowerCase()))
                .map((subscription) => {
                const customer = this.dependencies.store.customers.find((entry) => entry.id === subscription.customerId);
                return String(subscription.commercialOwnerDiscordUserId ?? customer?.discordUserId ?? "").trim();
            })
                .filter(Boolean))];
        if (activeUserIds.length === 0) {
            return;
        }
        for (const guild of this.client.guilds.cache.values()) {
            const sales = this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings();
            const hasProductRoles = this.dependencies.catalogService
                .listProducts()
                .some((product) => String(product?.customerRoleId ?? "").trim());
            if ((!sales.autoAssignCustomerRole || !sales.customerRoleId) && !hasProductRoles) {
                continue;
            }
            for (const userId of activeUserIds) {
                await this.tryGrantCustomerRole(guild, userId).catch(() => null);
            }
        }
    }
    async handleManagerPanelCommand(interaction) {
        if (!this.ensureAdminAccess(interaction, "abrir o painel do manager")) {
            return;
        }
        try {
            await this.replyEphemeral(interaction, this.buildAdminPanelPayload());
            this.rememberAdminPanelInteraction(interaction);
        }
        catch (error) {
            this.logger.warn({
                error: error instanceof Error ? error.message : String(error),
            }, "Falha ao abrir o painel principal com componentes completos. Tentando versao simplificada.");
            await this.replyEphemeral(interaction, this.buildAdminPanelPayload("Painel aberto em modo simplificado para contornar uma incompatibilidade visual temporaria.", [], this.buildAdminPanelComponents(false)));
            this.rememberAdminPanelInteraction(interaction);
        }
    }
    async handleConfigCommand(interaction) {
        if (!this.ensureAdminAccess(interaction, "abrir a configuracao visual")) {
            return;
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand !== "produto") {
            await this.replyEphemeral(interaction, "Subcomando ainda nao tratado.");
            return;
        }
        const search = String(interaction.options.getString("produto") ?? interaction.options.getString("name") ?? "").trim();
        const product = this.findProductBySearch(search);
        if (!product) {
            await this.replyEphemeral(interaction, search
                ? `Nao encontrei produto com o nome/slug \`${search}\`.`
                : "Nenhum produto encontrado. Use `/painel-manager` > `Produtos` para criar o primeiro.");
            return;
        }
        const payload = this.buildProductManagementPayload(product.slug, `Produto **${product.name}** aberto na configuracao visual.`);
        await this.replyEphemeral(interaction, payload);
        this.rememberAdminPanelInteraction(interaction);
    }
    async handleSetCommand(interaction) {
        if (!this.ensureStaffAccess(interaction, "publicar o painel de um produto")) {
            return;
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand !== "produto") {
            await this.replyEphemeral(interaction, "Subcomando ainda nao tratado.");
            return;
        }
        const search = String(interaction.options.getString("produto", true) ?? "").trim();
        const product = this.findProductBySearch(search);
        if (!product) {
            await this.replyEphemeral(interaction, `Nao encontrei produto com o nome/slug \`${search}\`.`);
            return;
        }
        const targetChannel = interaction.options.getChannel("canal") ?? interaction.channel;
        if (!targetChannel || !targetChannel.isTextBased?.()) {
            await this.replyEphemeral(interaction, "Escolha um canal de texto valido para publicar o painel.");
            return;
        }
        const result = await this.publishOrUpdateSalesPanel(product, targetChannel);
        await this.replyEphemeral(interaction, `Painel de vendas de **${product.name}** ${result.action === "updated" ? "atualizado" : "publicado"} em ${targetChannel.toString()}.`);
    }
    async handleViewSubscribersCommand(interaction) {
        if (!this.ensureStaffAccess(interaction, "ver assinantes")) {
            return;
        }
        const status = interaction.options.getString("status") ?? "all";
        await this.replyEphemeral(interaction, { embeds: [this.buildSubscribersEmbed(status)] });
    }
    async handleApproveCommand(interaction) {
        if (!this.ensureAdminAccess(interaction, "aprovar pagamentos")) {
            return;
        }
        const paymentIdInput = String(interaction.options.getString("payment_id") ?? "").trim();
        const subscriptionIdInput = String(interaction.options.getString("subscription_id") ?? "").trim();
        let paymentId = paymentIdInput;
        if (!paymentId && subscriptionIdInput) {
            paymentId = this.findLatestPendingPaymentIdBySubscription(subscriptionIdInput) ?? "";
        }
        if (!paymentId) {
            await this.replyEphemeral(interaction, { embeds: [this.buildPendingPaymentsEmbed()] });
            return;
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const result = await this.dependencies.billingService.approvePaymentManually(paymentId);
            await this.persistStoreIfNeeded();
            await this.syncApprovedPaymentToCart(result.payment.id).catch(() => null);
            const activation = result.activation;
            const summary = [
                result.alreadyApproved ? "Esse pagamento ja estava aprovado." : "Pagamento aprovado manualmente.",
                `Pagamento: \`${result.payment.id}\``,
                `Assinatura: \`${result.payment.subscriptionId}\``,
                activation?.subscription?.status
                    ? `Status final: ${this.getStatusLabel(activation.subscription.status)}`
                    : null,
                activation?.awaitingBotSetup ? "Agora o cliente pode usar `/apps` e clicar em configurar bot." : null,
                activation?.instance?.installUrl ? `Install URL: ${activation.instance.installUrl}` : null,
            ]
                .filter(Boolean)
                .join("\n");
            await interaction.editReply(summary);
        }
        catch (error) {
            await interaction.editReply(`Nao consegui aprovar esse pagamento: ${error.message}`);
        }
    }
    async handleUpdateInstanceCommand(interaction) {
        const targetId = String(interaction.options.getString("id", true) ?? "").trim();
        const instance = this.dependencies.instanceService.getById(targetId) ??
            this.dependencies.instanceService.getByHostingAppId(targetId);
        if (!instance) {
            await this.replyEphemeral(interaction, "Nao encontrei nenhuma app comprada com esse ID.");
            return;
        }
        if (!this.canUpdateInstance(interaction.user.id, instance)) {
            await this.replyEphemeral(interaction, "Voce so pode atualizar apps compradas que pertencem a voce.");
            return;
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const result = await this.dependencies.instanceService.updateRuntime(targetId);
            await this.persistStoreIfNeeded();
            await interaction.editReply([
                "Aplicacao atualizada para a source mais recente do produto.",
                `Instancia: \`${result.instance.id}\``,
                `SquareCloud App: ${result.instance.hostingAppId}`,
                `Source slug: ${result.instance.sourceSlug}`,
                `Config version: ${result.instance.configVersion}`,
            ].join("\n"));
        }
        catch (error) {
            await interaction.editReply(`Nao consegui atualizar essa aplicacao: ${error.message}`);
        }
    }
    async handlePermissionCommand(interaction) {
        const subcommand = interaction.options.getSubcommand(true);
        if (!this.ensureAdminAccess(interaction, "gerenciar permissoes internas")) {
            return;
        }
        if (subcommand === "lista") {
            await this.replyEphemeral(interaction, {
                embeds: [this.buildPermissionsEmbed(this.dependencies.managerRuntimeConfigService.getResolvedAccessControl())],
            });
            return;
        }
        const user = interaction.options.getUser("usuario", true);
        if (subcommand === "adicionar") {
            if (this.applicationOwnerUserIds.includes(user.id)) {
                await this.replyEphemeral(interaction, "Esse usuario ja e dono da aplicacao do bot e ja possui acesso total.");
                return;
            }
            const access = this.dependencies.managerRuntimeConfigService.updateAccessControl({
                addAdminUserIds: [user.id],
            });
            await this.persistStoreIfNeeded();
            await this.replyEphemeral(interaction, {
                content: `Permissao administrativa adicionada para ${user.toString()}.`,
                embeds: [this.buildPermissionsEmbed(access)],
            });
            return;
        }
        if (subcommand === "remover") {
            if (this.applicationOwnerUserIds.includes(user.id)) {
                await this.replyEphemeral(interaction, "O dono da aplicacao do bot nao pode ser removido das permissoes internas.");
                return;
            }
            const access = this.dependencies.managerRuntimeConfigService.updateAccessControl({
                removeAdminUserIds: [user.id],
            });
            await this.persistStoreIfNeeded();
            await this.replyEphemeral(interaction, {
                content: `Permissao administrativa removida de ${user.toString()}.`,
                embeds: [this.buildPermissionsEmbed(access)],
            });
        }
    }
    async handleSalesBuyButton(interaction) {
        const productSlug = String(interaction.customId.split(":").slice(3).join(":") || "").trim();
        const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
        if (!product) {
            await this.replyEphemeral(interaction, "Nenhum produto foi cadastrado no catalogo do manager.");
            return;
        }
        if (interaction.guild) {
            const sales = this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings();
            if (sales.cartCategoryId) {
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                try {
                    const { channel, created } = await this.createOrReuseCartChannel(interaction.guild, interaction.user, product);
                    const state = await this.persistCartState(channel, interaction.user, product, { step: "plan" });
                    await this.upsertCartPanelMessage(channel, interaction.user, product);
                    await this.logSalesEvent({
                        type: created ? "cart_opened" : "cart_reopened",
                        userId: interaction.user.id,
                        channelId: String(channel.id ?? "").trim() || null,
                        productName: product.name,
                        planName: this.getCartSelectedPlan(product, state)?.name ?? null,
                        amountCents: this.calculateCartTotalCents(product, state),
                        currency: this.getCartSelectedPlan(product, state)?.currency ?? "BRL",
                        addons: this.getSelectedAddonLogEntries(product, state),
                        note: created
                            ? "Carrinho privado criado pelo painel de vendas."
                            : "Carrinho privado reutilizado para continuar a compra.",
                    });
                    await interaction.editReply(this.buildCartOpenedPayload(interaction.guild, interaction.user, channel, created));
                    return;
                }
                catch (error) {
                    await interaction.editReply(this.limitMessageSize(`Nao consegui abrir seu carrinho agora: ${error.message}`)).catch(() => null);
                    return;
                }
            }
        }
        const options = product.plans.slice(0, 25).map((plan) => ({
            label: `${plan.name} - ${this.formatCurrency(plan.priceCents, plan.currency)}`.slice(0, 100),
            description: `${plan.description} - grace ${plan.graceDays}d`.slice(0, 100),
            value: `${product.slug}|${plan.code}`,
        }));
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(CUSTOM_IDS.buyPlanSelect)
            .setPlaceholder("Escolha o plano para gerar seu Pix")
            .addOptions(options));
        await this.replyEphemeral(interaction, {
            content: [
                `Produto selecionado: **${product.name}**`,
                "Escolha o plano abaixo para eu gerar o Pix da sua assinatura.",
            ].join("\n"),
            components: [row],
        });
    }
    async handleBuyPlanSelection(interaction) {
        const [productSlug, planCode] = String(interaction.values[0] ?? "").split("|");
        const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
        if (!product) {
            await this.replyEphemeral(interaction, "Nenhum produto esta disponivel no manager.");
            return;
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const checkout = await this.dependencies.billingService.createEfipayPixCheckout({
                productSlug: product.slug,
                planCode,
                discordUserId: interaction.user.id,
                discordUsername: interaction.user.username,
                addonCodes: [],
            });
            await this.persistStoreIfNeeded();
            const plan = product.plans.find((item) => item.code === planCode) ?? null;
            await interaction.editReply(this.buildPixCheckoutResponse({
                checkout,
                user: interaction.user,
                productName: product.name,
                planName: plan?.name ?? planCode,
                durationDays: plan?.durationDays ?? 0,
            }));
        }
        catch (error) {
            await interaction.editReply([
                "Nao consegui gerar o Pix agora.",
                error?.message ?? "Falha desconhecida.",
                "Se voce for da equipe, confira `/painel-manager` e valide a Efi do manager.",
            ].join("\n"));
        }
    }
    async handleRenewalSelection(interaction) {
        const rawValue = interaction.values[0] ?? "";
        const [subscriptionId, quantityRaw] = rawValue.split("|");
        const quantity = Math.max(1, Number(quantityRaw ?? 1) || 1);
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const bundle = this.dependencies.subscriptionService.getRequiredBundle(subscriptionId);
            if (!this.canManageSubscription(interaction.user.id, bundle.subscription)) {
                await interaction.editReply("Essa assinatura nao pertence a voce.");
                return;
            }
            const checkout = await this.dependencies.billingService.createEfipayPixRenewal(subscriptionId, quantity);
            await this.persistStoreIfNeeded();
            await interaction.editReply(this.buildPixCheckoutResponse({
                checkout,
                user: interaction.user,
                productName: bundle.product?.name ?? "Produto",
                planName: bundle.plan?.name ?? "Plano",
                durationDays: bundle.plan?.durationDays ?? 0,
            }));
        }
        catch (error) {
            await interaction.editReply(`Nao consegui gerar a renovacao agora: ${error.message}`);
        }
    }
    async handleSetupSelection(interaction) {
        const subscriptionId = interaction.values[0];
        const bundle = this.dependencies.subscriptionService.getRequiredBundle(subscriptionId);
        if (!this.canManageSubscription(interaction.user.id, bundle.subscription)) {
            await this.replyEphemeral(interaction, "Essa assinatura nao pertence a voce.");
            return;
        }
        const payment = this.findApprovedActivationPayment(subscriptionId);
        if (!payment) {
            await this.replyEphemeral(interaction, "Nao achei um pagamento de ativacao aprovado para essa assinatura.");
            return;
        }
        try {
            this.dependencies.purchaseSetupService.resetSetupSession(payment.id);
            await this.persistStoreIfNeeded();
            await interaction.showModal(this.buildBotSetupModal(payment.id, bundle, payment));
        }
        catch (error) {
            await this.replyEphemeral(interaction, `Nao consegui abrir o setup agora: ${error.message}`);
        }
    }
    async handleEfipayConfigModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "salvar a configuracao da Efi")) {
            return;
        }
        const currentEfipay = this.dependencies.managerRuntimeConfigService.getResolvedEfipayOptions();
        const currentAppBaseUrl = this.dependencies.managerRuntimeConfigService.getResolvedAppBaseUrl();
        const clientId = String(interaction.fields.getTextInputValue("efi_client_id") ?? "").trim();
        const clientSecret = String(interaction.fields.getTextInputValue("efi_client_secret") ?? "").trim();
        const pixKey = String(interaction.fields.getTextInputValue("efi_pix_key") ?? "").trim();
        const appBaseUrl = String(interaction.fields.getTextInputValue("efi_app_base_url") ?? "").trim();
        const webhookPath = String(interaction.fields.getTextInputValue("efi_webhook_path") ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const snapshot = this.dependencies.managerRuntimeConfigService.updateRuntimeConfig({
            clientId: clientId || currentEfipay.clientId || undefined,
            clientSecret: clientSecret || currentEfipay.clientSecret || undefined,
            pixKey: pixKey || currentEfipay.pixKey || undefined,
            appBaseUrl: appBaseUrl || currentAppBaseUrl || undefined,
            webhookPath: webhookPath || currentEfipay.webhookPath || undefined,
        });
        const validation = await this.tryAutoValidateEfipay();
        await this.persistStoreIfNeeded();
        const lines = [
            "Configuracao da Efi atualizada no bot manager.",
            `Client ID salvo: ${snapshot.billing.efipay.configuredFields.clientId ? "sim" : "nao"}.`,
            `Client Secret salvo: ${snapshot.billing.efipay.configuredFields.clientSecret ? "sim" : "nao"}.`,
            `Pix key salva: ${snapshot.billing.efipay.configuredFields.pixKey ? "sim" : "nao"}.`,
            `APP_BASE_URL: ${snapshot.appBaseUrl ?? "nao definida"}.`,
            validation.ok
                ? "Validacao automatica concluida e webhook sincronizado."
                : validation.skipped
                    ? validation.message
                    : `Validacao automatica falhou: ${validation.message}`,
        ];
        const payload = this.buildEfipayManagementPayload(lines.join("\n"));
        const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, payload);
        if (updated) {
            await interaction.deleteReply().catch(() => null);
            return;
        }
        await interaction.editReply(payload);
    }
    async handleEfipayUploadModal(interaction) {
        if (!this.ensureAdminAccess(interaction, "enviar o certificado da Efi")) {
            return;
        }
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const uploadedFiles = interaction.fields.getUploadedFiles("efi_cert_p12_upload", true);
            const p12Attachment = [...uploadedFiles.values()].find((item) => isValidP12Attachment(item));
            if (!p12Attachment) {
                throw new Error("Envie um certificado .p12 valido.");
            }
            if (Number(p12Attachment.size ?? 0) > MAX_P12_BYTES) {
                throw new Error("O arquivo .p12 deve ter no maximo 10MB.");
            }
            const certPassphrase = String(interaction.fields.getTextInputValue("efi_cert_p12_passphrase") ?? "").trim();
            const payload = await this.downloadAttachmentBase64(p12Attachment.url);
            if (!payload.base64 || payload.size <= 0) {
                throw new Error("Arquivo recebido esta vazio.");
            }
            const currentEfipay = this.dependencies.managerRuntimeConfigService.getResolvedEfipayOptions();
            const inferredSandbox = inferEfiSandboxFromCertName(`${p12Attachment.name ?? ""}`, Boolean(currentEfipay.sandbox));
            const nextConfig = {
                certP12Base64: payload.base64,
                certFileName: p12Attachment.name ?? "efipay-cert.p12",
                sandbox: inferredSandbox,
            };
            if (certPassphrase) {
                nextConfig.certP12Passphrase = certPassphrase;
            }
            this.dependencies.managerRuntimeConfigService.updateRuntimeConfig(nextConfig);
            const validation = await this.tryAutoValidateEfipay();
            await this.persistStoreIfNeeded();
            const statusMessage = validation.ok
                ? `Certificado \`.p12\` salvo com sucesso. Ambiente detectado: **${inferredSandbox ? "SANDBOX" : "PRODUCAO"}**. Webhook sincronizado automaticamente.`
                : validation.skipped
                    ? `Certificado \`.p12\` salvo com sucesso. Ambiente detectado: **${inferredSandbox ? "SANDBOX" : "PRODUCAO"}**. ${validation.message}`
                    : `Certificado \`.p12\` salvo, mas a validacao automatica falhou: ${validation.message}`;
            const panelPayload = this.buildEfipayManagementPayload(statusMessage);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, panelPayload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(panelPayload);
        }
        catch (error) {
            await this.persistStoreIfNeeded();
            const reason = error instanceof Error ? error.message : String(error);
            const panelPayload = this.buildEfipayManagementPayload(`Falha ao importar o certificado \`.p12\`: ${reason}`);
            const updated = await this.tryUpdateTrackedAdminPanel(interaction.user.id, panelPayload);
            if (updated) {
                await interaction.deleteReply().catch(() => null);
                return;
            }
            await interaction.editReply(panelPayload);
        }
    }
    async handleBotSetupModal(interaction) {
        const paymentId = interaction.customId.slice(MODAL_IDS.botSetupPrefix.length);
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            await interaction.editReply("🔄 | Configurando o seu bot...");
            let customBioText = "";
            try {
                customBioText = interaction.fields.getTextInputValue("setup_custom_bio_text");
            }
            catch {
                customBioText = "";
            }
            const result = await this.dependencies.purchaseSetupService.submitBotForProvisioning(paymentId, {
                applicationName: interaction.fields.getTextInputValue("setup_application_name"),
                botToken: interaction.fields.getTextInputValue("setup_bot_token"),
                ownerDiscordUserId: interaction.fields.getTextInputValue("setup_owner_discord_user_id"),
                customBioText,
            }, {
                onProgress: async (progress) => {
                    const message = String(progress?.message ?? "").trim();
                    if (!message) {
                        return;
                    }
                    await interaction.editReply(message).catch(() => null);
                },
            });
            await this.persistStoreIfNeeded();
            const successMessage = String(result?.successMessage ?? "").trim() ||
                "✅ | Bot ligado! Seu sistema já está funcionando, use /botsetup no seu servidor para efetuar as primeiras configurações!";
            const payload = await this.buildAppsPanelPayload(interaction.user.id, 0, result.instance?.id ? `inst_${result.instance.id}` : null, "overview", "Bot ligado com sucesso.");
            const updated = await this.tryUpdateTrackedAppsPanel(interaction.user.id, payload);
            await interaction.editReply(successMessage);
            if (!updated) {
                return;
            }
        }
        catch (error) {
            const payload = await this.buildAppsPanelPayload(interaction.user.id, 0, null, "overview", `Não consegui provisionar seu bot agora: ${error.message}`);
            const updated = await this.tryUpdateTrackedAppsPanel(interaction.user.id, payload);
            await interaction.editReply(`❌ | Não consegui provisionar seu bot agora: ${error.message}`);
            if (!updated) {
                return;
            }
        }
    }
    async handleAppsSelection(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsSelectPrefix.length) ?? "").trim();
        const [pageRaw, viewRaw] = payload.split(":");
        const selectedKey = String(interaction.values?.[0] ?? "").trim();
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const requestedView = viewRaw === "settings" ? "settings" : "overview";
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        if (!context.entry) {
            await this.replyEphemeral(interaction, "NÃ£o encontrei a aplicaÃ§Ã£o selecionada.");
            return;
        }
        if (!this.canAccessAppEntry(interaction.user.id, context.entry)) {
            await this.replyEphemeral(interaction, this.buildAppsAccessDeniedMessage());
            return;
        }
        await interaction.update(this.buildAppsLoadingPayload()).catch(async () => {
            await interaction.deferUpdate().catch(() => null);
        });
        try {
            const nextPanel = await this.buildAppsPanelViewPayload(context.panelOwnerUserId, context.state.page, context.entry.key, requestedView, context.entry);
            this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: context.entry.key, view: nextPanel.view, panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
            await interaction.editReply(nextPanel.payload).catch(async () => {
                await interaction.message?.edit(nextPanel.payload).catch(() => null);
            });
        }
        catch (error) {
            const failurePayload = await this.buildAppsPanelPayload(context.panelOwnerUserId, context.state.page, context.entry.key, "overview", `Nao consegui carregar essa aplicacao agora: ${error?.message ?? "erro desconhecido"}`);
            this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: context.entry.key, view: "overview", panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
            await interaction.editReply(failurePayload).catch(async () => {
                await interaction.message?.edit(failurePayload).catch(() => null);
            });
        }
    }
    async handleAppsPageButton(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsPagePrefix.length) ?? "").trim();
        const [pageRaw, selectedKeyRaw, viewRaw] = payload.split(":");
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        const requestedView = viewRaw === "settings" ? "settings" : "overview";
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        if (!context.entry) {
            await this.replyEphemeral(interaction, "NÃ£o encontrei a aplicaÃ§Ã£o selecionada.");
            return;
        }
        if (!this.canAccessAppEntry(interaction.user.id, context.entry)) {
            await this.replyEphemeral(interaction, this.buildAppsAccessDeniedMessage());
            return;
        }
        const nextPanel = await this.buildAppsPanelViewPayload(context.panelOwnerUserId, context.state.page, context.entry.key, requestedView, context.entry);
        this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: context.entry.key, view: nextPanel.view, panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
        await interaction.update(nextPanel.payload).catch(() => null);
    }
    async handleAppsViewButton(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsViewPrefix.length) ?? "").trim();
        const [viewRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        const requestedView = viewRaw === "settings" ? "settings" : "overview";
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        if (!context.entry) {
            await this.replyEphemeral(interaction, "NÃ£o encontrei a aplicaÃ§Ã£o selecionada.");
            return;
        }
        if (!this.canAccessAppEntry(interaction.user.id, context.entry)) {
            await this.replyEphemeral(interaction, this.buildAppsAccessDeniedMessage());
            return;
        }
        const nextPanel = await this.buildAppsPanelViewPayload(context.panelOwnerUserId, context.state.page, context.entry.key, requestedView, context.entry);
        this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: context.entry.key, view: nextPanel.view, panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
        await interaction.update(nextPanel.payload).catch(() => null);
    }
    async handleAppsPowerButton(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsPowerPrefix.length) ?? "").trim();
        const [action, pageRaw, selectedKeyRaw] = payload.split(":");
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        const entry = context.entry;
        if (!entry?.instance) {
            await this.replyEphemeral(interaction, "Não encontrei a aplicação selecionada para executar essa ação.");
            return;
        }
        if (!this.canAccessAppEntry(interaction.user.id, entry)) {
            await this.replyEphemeral(interaction, this.buildAppsAccessDeniedMessage());
            return;
        }
        this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: entry.key, view: "overview", panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
        await interaction.deferUpdate();
        try {
            const overview = await this.loadSquareCloudAppOverview(entry.instance);
            const powerState = this.getAppsPowerState(entry, overview);
            if (action === "start" && !powerState.canStart) {
                const message = powerState.state === "unprovisioned"
                    ? "A aplicação ainda não foi provisionada na Square Cloud."
                    : "A aplicação já está ligada ou inicializando.";
                const payload = await this.buildAppsPanelPayload(context.panelOwnerUserId, context.state.page, entry.key, "overview", message);
                const updated = await this.tryUpdateTrackedAppsPanel(context.panelOwnerUserId, payload);
                if (!updated) {
                    await interaction.message?.edit(payload).catch(() => null);
                }
                return;
            }
            if (action === "stop" && !powerState.canStop) {
                const message = powerState.state === "unprovisioned"
                    ? "A aplicação ainda não foi provisionada na Square Cloud."
                    : "A aplicação já está desligada.";
                const payload = await this.buildAppsPanelPayload(context.panelOwnerUserId, context.state.page, entry.key, "overview", message);
                const updated = await this.tryUpdateTrackedAppsPanel(context.panelOwnerUserId, payload);
                if (!updated) {
                    await interaction.message?.edit(payload).catch(() => null);
                }
                return;
            }
            const processingMessages = {
                start: "\u2B06\uFE0F | Ligando sua aplica\u00E7\u00E3o...",
                stop: "\u2B07\uFE0F | Desligando sua aplica\u00E7\u00E3o...",
                restart: "\uD83D\uDD04 | Reiniciando sua aplica\u00E7\u00E3o...",
            };
            const processingPayload = await this.buildAppsPanelPayload(context.panelOwnerUserId, context.state.page, entry.key, "overview", processingMessages[action] ?? "\u23F3 | Atualizando sua aplica\u00E7\u00E3o...");
            const processingUpdated = await this.tryUpdateTrackedAppsPanel(context.panelOwnerUserId, processingPayload);
            if (!processingUpdated) {
                await interaction.message?.edit(processingPayload).catch(() => null);
            }
            if (action === "start") {
                entry.instance.status = "provisioning";
                entry.instance.updatedAt = new Date().toISOString();
                await this.persistStoreIfNeeded();
                let boot = null;
                if (this.dependencies.squareCloudProvisioningService && !String(entry.instance.hostingAppId ?? "").startsWith("pending-")) {
                    boot = await this.dependencies.squareCloudProvisioningService.bootProvisionedApp(entry.instance.hostingAppId);
                    if (!boot?.running) {
                        entry.instance.status = "failed";
                        entry.instance.updatedAt = new Date().toISOString();
                        await this.persistStoreIfNeeded();
                        throw new Error(this.buildSquareCloudBootFailureMessage(boot, "A SquareCloud iniciou o app, mas ele nÃ£o ficou em execuÃ§Ã£o."));
                    }
                }
                else if (this.dependencies.squareCloudClient?.isConfigured?.() && !String(entry.instance.hostingAppId ?? "").startsWith("pending-")) {
                    await this.dependencies.squareCloudClient.startApp(entry.instance.hostingAppId);
                }
                if (!entry.instance.lastHeartbeatAt) {
                    entry.instance.status = "provisioning";
                }
            }
            else if (action === "stop") {
                if (this.dependencies.squareCloudClient?.isConfigured?.() && !String(entry.instance.hostingAppId ?? "").startsWith("pending-")) {
                    await this.dependencies.squareCloudClient.stopApp(entry.instance.hostingAppId);
                }
                entry.instance.status = "suspended";
            }
            else if (action === "restart") {
                entry.instance.status = "provisioning";
                entry.instance.updatedAt = new Date().toISOString();
                await this.persistStoreIfNeeded();
                let boot = null;
                if (this.dependencies.squareCloudProvisioningService && !String(entry.instance.hostingAppId ?? "").startsWith("pending-")) {
                    boot = await this.dependencies.squareCloudProvisioningService.bootProvisionedApp(entry.instance.hostingAppId);
                    if (!boot?.running) {
                        entry.instance.status = "failed";
                        entry.instance.updatedAt = new Date().toISOString();
                        await this.persistStoreIfNeeded();
                        throw new Error(this.buildSquareCloudBootFailureMessage(boot, "A SquareCloud reiniciou o app, mas ele nÃ£o ficou em execuÃ§Ã£o."));
                    }
                }
                else if (this.dependencies.squareCloudClient?.isConfigured?.() && !String(entry.instance.hostingAppId ?? "").startsWith("pending-")) {
                    await this.dependencies.squareCloudClient.restartApp(entry.instance.hostingAppId);
                    await this.dependencies.squareCloudClient.startApp(entry.instance.hostingAppId).catch(() => null);
                }
                if (!entry.instance.lastHeartbeatAt) {
                    entry.instance.status = "provisioning";
                }
            }
            entry.instance.updatedAt = new Date().toISOString();
            await this.persistStoreIfNeeded();
            const actionLabels = {
                start: "Aplicação ligada com sucesso.",
                stop: "Aplicação desligada com sucesso.",
                restart: "Aplicação reiniciada com sucesso.",
            };
            actionLabels.start = "\u2705 | Aplica\u00E7\u00E3o ligada com sucesso!";
            actionLabels.stop = "\u2705 | Aplica\u00E7\u00E3o desligada com sucesso!";
            actionLabels.restart = "\u2705 | Aplica\u00E7\u00E3o reiniciada com sucesso!";
            const successPayload = await this.buildAppsPanelPayload(context.panelOwnerUserId, context.state.page, entry.key, "overview", actionLabels[action] ?? "\u2705 | Aplica\u00E7\u00E3o atualizada.");
            const updated = await this.tryUpdateTrackedAppsPanel(context.panelOwnerUserId, successPayload);
            if (!updated) {
                await interaction.message?.edit(successPayload).catch(() => null);
            }
        }
        catch (error) {
            const failurePayload = await this.buildAppsPanelPayload(context.panelOwnerUserId, context.state.page, entry.key, "overview", `\u274C | Falha ao executar essa a\u00E7\u00E3o: ${error?.message ?? "erro desconhecido"}`);
            const updated = await this.tryUpdateTrackedAppsPanel(context.panelOwnerUserId, failurePayload);
            if (!updated) {
                await interaction.message?.edit(failurePayload).catch(() => null);
            }
        }
    }
    async handleAppsSetupButton(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsSetupButtonPrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        const entry = context.entry;
        if (!entry?.bundle) {
            await this.replyEphemeral(interaction, "Não encontrei a assinatura selecionada.");
            return;
        }
        if (!this.canManageSubscription(interaction.user.id, entry.bundle.subscription)) {
            await this.replyEphemeral(interaction, "Essa assinatura não pertence a você.");
            return;
        }
        const payment = this.findApprovedActivationPayment(entry.bundle.subscription.id);
        if (!payment) {
            await this.replyEphemeral(interaction, "Não achei um pagamento de ativação aprovado para essa assinatura.");
            return;
        }
        this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: entry.key, view: "overview", panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
        try {
            this.dependencies.purchaseSetupService.resetSetupSession(payment.id);
            await this.persistStoreIfNeeded();
            await interaction.showModal(this.buildBotSetupModal(payment.id, entry.bundle, payment));
        }
        catch (error) {
            await this.replyEphemeral(interaction, `Não consegui abrir o setup agora: ${error.message}`);
        }
    }
    async handleAppsRenameButton(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsRenamePrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        const entry = context.entry;
        if (!entry?.instance || !entry.discordApp) {
            await this.replyEphemeral(interaction, "Não encontrei a aplicação selecionada para renomear.");
            return;
        }
        if (!this.canAccessAppEntry(interaction.user.id, entry)) {
            await this.replyEphemeral(interaction, this.buildAppsAccessDeniedMessage());
            return;
        }
        this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: entry.key, view: "settings", panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
        await interaction.showModal(this.buildAppsRenameModal(context.panelOwnerUserId, context.state.page, entry));
    }
    async handleAppsTokenButton(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsTokenPrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        const entry = context.entry;
        if (!entry?.instance || !entry.discordApp) {
            await this.replyEphemeral(interaction, "Não encontrei a aplicação selecionada para trocar o token.");
            return;
        }
        if (!this.canAccessAppEntry(interaction.user.id, entry)) {
            await this.replyEphemeral(interaction, this.buildAppsAccessDeniedMessage());
            return;
        }
        this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: entry.key, view: "settings", panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
        await interaction.showModal(this.buildAppsTokenModal(context.panelOwnerUserId, context.state.page, entry));
    }
    async handleAppsOwnerButton(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsOwnerPrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        const entry = context.entry;
        if (!entry?.instance || !entry.discordApp) {
            await this.replyEphemeral(interaction, "Não encontrei a aplicação selecionada para trocar o dono do bot.");
            return;
        }
        if (!this.canAccessAppEntry(interaction.user.id, entry)) {
            await this.replyEphemeral(interaction, this.buildAppsAccessDeniedMessage());
            return;
        }
        this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: entry.key, view: "settings", panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
        await interaction.showModal(this.buildAppsOwnerModal(context.panelOwnerUserId, context.state.page, entry));
    }
    async handleAppsTransferButton(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsTransferPrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        const entry = context.entry;
        if (!entry?.bundle) {
            await this.replyEphemeral(interaction, "Não encontrei a aplicação selecionada para transferir.");
            return;
        }
        if (!this.canManageSubscription(interaction.user.id, entry.bundle.subscription)) {
            await this.replyEphemeral(interaction, "Somente admins ou o dono comercial da assinatura podem transferir essa aplicaÃ§Ã£o.");
            return;
        }
        this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: entry.key, view: "settings", panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
        await interaction.showModal(this.buildAppsTransferModal(context.panelOwnerUserId, context.state.page, entry));
    }
    async handleAppsDeleteButton(interaction) {
        const payload = String(interaction.customId.slice(CUSTOM_IDS.appsDeletePrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        const context = this.resolveAppsPanelContext(interaction, page, selectedKey);
        const entry = context.entry;
        if (!entry?.instance) {
            await this.replyEphemeral(interaction, "Não encontrei a aplicação selecionada para deletar.");
            return;
        }
        if (!entry?.bundle?.subscription || !this.canManageSubscription(interaction.user.id, entry.bundle.subscription)) {
            await this.replyEphemeral(interaction, "Somente admins ou o dono comercial da assinatura podem deletar essa aplicaÃ§Ã£o.");
            return;
        }
        this.rememberAppsPanelInteraction(interaction, { page: context.state.page, selectedKey: entry.key, view: "settings", panelOwnerUserId: context.panelOwnerUserId, messageId: interaction.message?.id ?? null, channelId: interaction.channelId ?? null });
        await interaction.showModal(this.buildAppsDeleteModal(context.panelOwnerUserId, context.state.page, entry));
    }
    async handleAppsRenameModal(interaction) {
        const payload = String(interaction.customId.slice(MODAL_IDS.appRenamePrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const entry = this.findOwnedAppEntryByKey(panelOwnerUserId, selectedKey);
            if (!entry?.instance || !entry.discordApp) {
                throw new Error("Aplicação não encontrada.");
            }
            if (!this.canAccessAppEntry(interaction.user.id, entry)) {
                throw new Error(this.buildAppsAccessDeniedMessage());
            }
            const desiredName = String(interaction.fields.getTextInputValue("apps_rename_name") ?? "").trim();
            if (!desiredName) {
                throw new Error("Informe o novo nome da aplicação.");
            }
            await this.dependencies.discordBotClient.updateBotUsername(entry.discordApp.botToken, desiredName);
            const inspection = await this.dependencies.discordBotClient.inspectBotToken(entry.discordApp.botToken);
            entry.discordApp.appName = String(inspection.botUsername || inspection.applicationName || desiredName).trim();
            entry.discordApp.applicationId = String(inspection.applicationId ?? entry.discordApp.applicationId).trim();
            entry.discordApp.clientId = String(inspection.clientId ?? entry.discordApp.clientId).trim();
            entry.instance.installUrl = String(inspection.inviteUrl ?? entry.instance.installUrl ?? "").trim() || entry.instance.installUrl;
            entry.instance.config.discordAppName = entry.discordApp.appName;
            entry.instance.config.discordApplicationId = entry.discordApp.applicationId;
            entry.instance.config.discordClientId = entry.discordApp.clientId;
            entry.instance.updatedAt = new Date().toISOString();
            await this.syncManagedInstanceRuntime(entry.instance, entry.discordApp);
            await this.persistStoreIfNeeded();
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, "settings", "Nome da aplicação atualizado com sucesso."), panelOwnerUserId);
        }
        catch (error) {
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, "settings", `Falha ao alterar o nome da aplicação: ${error?.message ?? "erro desconhecido"}`), panelOwnerUserId);
        }
    }
    async handleAppsTokenModal(interaction) {
        const payload = String(interaction.customId.slice(MODAL_IDS.appTokenPrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const entry = this.findOwnedAppEntryByKey(panelOwnerUserId, selectedKey);
            if (!entry?.instance || !entry.discordApp) {
                throw new Error("Aplicação não encontrada.");
            }
            if (!this.canAccessAppEntry(interaction.user.id, entry)) {
                throw new Error(this.buildAppsAccessDeniedMessage());
            }
            const nextToken = String(interaction.fields.getTextInputValue("apps_token_value") ?? "").trim();
            if (!nextToken) {
                throw new Error("Informe o novo token do bot.");
            }
            const inspection = await this.dependencies.discordBotClient.inspectBotToken(nextToken);
            entry.discordApp.botToken = nextToken;
            entry.discordApp.applicationId = String(inspection.applicationId ?? entry.discordApp.applicationId).trim();
            entry.discordApp.clientId = String(inspection.clientId ?? entry.discordApp.clientId).trim();
            entry.discordApp.appName = String(inspection.botUsername || inspection.applicationName || entry.discordApp.appName).trim();
            entry.instance.installUrl = String(inspection.inviteUrl ?? entry.instance.installUrl ?? "").trim() || entry.instance.installUrl;
            entry.instance.config.discordAppName = entry.discordApp.appName;
            entry.instance.config.discordApplicationId = entry.discordApp.applicationId;
            entry.instance.config.discordClientId = entry.discordApp.clientId;
            entry.instance.updatedAt = new Date().toISOString();
            await this.syncManagedInstanceRuntime(entry.instance, entry.discordApp);
            await this.persistStoreIfNeeded();
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, "settings", "Token da aplicação atualizado com sucesso."), panelOwnerUserId);
        }
        catch (error) {
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, "settings", `Falha ao alterar o token da aplicação: ${error?.message ?? "erro desconhecido"}`), panelOwnerUserId);
        }
    }
    async handleAppsOwnerModal(interaction) {
        const payload = String(interaction.customId.slice(MODAL_IDS.appOwnerPrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const entry = this.findOwnedAppEntryByKey(panelOwnerUserId, selectedKey);
            if (!entry?.instance || !entry.discordApp) {
                throw new Error("Aplicação não encontrada.");
            }
            if (!this.canAccessAppEntry(interaction.user.id, entry)) {
                throw new Error(this.buildAppsAccessDeniedMessage());
            }
            const nextOwnerDiscordUserId = String(interaction.fields.getTextInputValue("apps_owner_user_id") ?? "").trim();
            if (!/^\d{5,32}$/u.test(nextOwnerDiscordUserId)) {
                throw new Error("Informe um Discord User ID válido.");
            }
            entry.instance.config.ownerDiscordUserId = nextOwnerDiscordUserId;
            entry.discordApp.runtimeEnv = {
                ...(entry.discordApp.runtimeEnv ?? {}),
                CUSTOMER_OWNER_DISCORD_USER_ID: nextOwnerDiscordUserId,
            };
            entry.instance.updatedAt = new Date().toISOString();
            await this.syncManagedInstanceRuntime(entry.instance, entry.discordApp);
            await this.persistStoreIfNeeded();
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, "settings", "Dono do bot atualizado com sucesso."), panelOwnerUserId);
        }
        catch (error) {
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, "settings", `Falha ao alterar o dono do bot: ${error?.message ?? "erro desconhecido"}`), panelOwnerUserId);
        }
    }
    async handleAppsTransferModal(interaction) {
        const payload = String(interaction.customId.slice(MODAL_IDS.appTransferPrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const entry = this.findOwnedAppEntryByKey(panelOwnerUserId, selectedKey);
            if (!entry?.bundle?.subscription) {
                throw new Error("Aplicação não encontrada.");
            }
            if (!this.canManageSubscription(interaction.user.id, entry.bundle.subscription)) {
                throw new Error("Somente admins ou o dono comercial da assinatura podem transferir essa aplicação.");
            }
            const nextCommercialOwnerDiscordUserId = String(interaction.fields.getTextInputValue("apps_transfer_user_id") ?? "").trim();
            if (!/^\d{5,32}$/u.test(nextCommercialOwnerDiscordUserId)) {
                throw new Error("Informe um Discord User ID válido.");
            }
            if (nextCommercialOwnerDiscordUserId === String(entry.bundle.subscription.commercialOwnerDiscordUserId ?? "").trim()) {
                throw new Error("Essa aplicação já pertence a esse usuário.");
            }
            entry.bundle.subscription.commercialOwnerDiscordUserId = nextCommercialOwnerDiscordUserId;
            entry.bundle.subscription.updatedAt = new Date().toISOString();
            await this.persistStoreIfNeeded();
            if (interaction.guild) {
                await this.tryGrantCustomerRole(interaction.guild, nextCommercialOwnerDiscordUserId).catch(() => null);
            }
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, null, "overview", `Posse da aplicação transferida para <@${nextCommercialOwnerDiscordUserId}>. Ela não aparecerá mais no seu /apps.`), panelOwnerUserId);
        }
        catch (error) {
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, "settings", `Falha ao transferir a posse da aplicação: ${error?.message ?? "erro desconhecido"}`), panelOwnerUserId);
        }
    }
    async handleAppsDeleteModal(interaction) {
        const payload = String(interaction.customId.slice(MODAL_IDS.appDeletePrefix.length) ?? "").trim();
        const [panelOwnerUserIdRaw, pageRaw, selectedKeyRaw] = payload.split(":");
        const panelOwnerUserId = String(panelOwnerUserIdRaw ?? "").trim() || interaction.user.id;
        const page = Math.max(0, Number(pageRaw ?? 0) || 0);
        const selectedKey = String(selectedKeyRaw ?? "").trim();
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const entry = this.findOwnedAppEntryByKey(panelOwnerUserId, selectedKey);
            if (!entry?.instance || !entry.bundle?.subscription) {
                throw new Error("Aplicação não encontrada.");
            }
            if (!this.canManageSubscription(interaction.user.id, entry.bundle.subscription)) {
                throw new Error("Somente admins ou o dono comercial da assinatura podem deletar essa aplicação.");
            }
            const confirmation = normalizeTextForMatch(interaction.fields.getTextInputValue("apps_delete_confirm"));
            const acceptedValues = new Set([
                "deletar",
                "delete",
                normalizeTextForMatch(entry.instance.id),
                normalizeTextForMatch(entry.instance.hostingAppId),
            ]);
            if (!acceptedValues.has(confirmation)) {
                throw new Error("Confirmação inválida. Digite DELETAR ou o ID da aplicação.");
            }
            await this.dependencies.instanceService.deleteBySubscription(entry.bundle.subscription.id);
            entry.bundle.subscription.status = "deleted";
            entry.bundle.subscription.updatedAt = new Date().toISOString();
            await this.persistStoreIfNeeded();
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, null, "overview", "Aplicação deletada com sucesso."), panelOwnerUserId);
        }
        catch (error) {
            await this.updateAppsModalReply(interaction, await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, "settings", `Falha ao deletar a aplicação: ${error?.message ?? "erro desconhecido"}`), panelOwnerUserId);
        }
    }
    buildSalesPanelMessage(product = null) {
        const resolvedProduct = product ?? this.getPrimaryProduct();
        const buttonLabel = String(resolvedProduct?.panelConfig?.buttonLabel ?? "").trim() || "Adicionar ao Carrinho";
        const previewUrl = String(resolvedProduct?.panelConfig?.previewUrl ?? "").trim();
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`${CUSTOM_IDS.salesBuy}:${resolvedProduct?.slug ?? "default"}`)
            .setLabel(buttonLabel)
            .setEmoji("\uD83D\uDED2")
            .setStyle(discord_js_1.ButtonStyle.Success));
        if (isLikelyHttpUrl(previewUrl)) {
            row.addComponents(new discord_js_1.ButtonBuilder()
                .setLabel("Preview")
                .setEmoji("\uD83C\uDFAC")
                .setStyle(discord_js_1.ButtonStyle.Link)
                .setURL(previewUrl));
        }
        return {
            embeds: [this.buildSalesPanelEmbed(resolvedProduct)],
            components: [row],
        };
    }
    async findExistingSalesPanelMessage(channel, product) {
        if (!channel?.isTextBased?.() || typeof channel.messages?.fetch !== "function") {
            return null;
        }
        const botUserId = this.client?.user?.id;
        const expectedCustomId = `${CUSTOM_IDS.salesBuy}:${product?.slug ?? ""}`;
        if (!expectedCustomId || !botUserId) {
            return null;
        }
        const recentMessages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
        return recentMessages?.find((message) => message.author?.id === botUserId &&
            message.components?.some((row) => row.components?.some((component) => String(component.customId ?? "") === expectedCustomId))) ?? null;
    }
    async publishOrUpdateSalesPanel(product, targetChannel = null) {
        const resolvedProduct = this.getResolvedProductBySlug(product?.slug) ?? product;
        if (!resolvedProduct) {
            throw new Error("Produto nao encontrado para publicar/atualizar o painel.");
        }
        const panelConfig = resolvedProduct.panelConfig ?? {};
        const storedChannelId = String(panelConfig.publishedChannelId ?? "").trim();
        const storedMessageId = String(panelConfig.publishedMessageId ?? "").trim();
        const existingChannel = storedChannelId && this.client
            ? await this.client.channels.fetch(storedChannelId).catch(() => null)
            : null;
        const existingMessage = storedMessageId &&
            existingChannel?.isTextBased?.() &&
            typeof existingChannel.messages?.fetch === "function"
            ? await existingChannel.messages.fetch(storedMessageId).catch(() => null)
            : null;
        if (!targetChannel && existingMessage) {
            await existingMessage.edit(this.buildSalesPanelMessage(resolvedProduct));
            return {
                action: "updated",
                channel: existingChannel,
                message: existingMessage,
            };
        }
        if (targetChannel && existingMessage && existingChannel?.id === targetChannel.id) {
            await existingMessage.edit(this.buildSalesPanelMessage(resolvedProduct));
            return {
                action: "updated",
                channel: existingChannel,
                message: existingMessage,
            };
        }
        if (targetChannel && existingMessage && existingChannel?.id !== targetChannel.id) {
            await existingMessage.delete().catch(() => null);
        }
        const publishChannel = targetChannel ?? existingChannel;
        if (!publishChannel || !publishChannel.isTextBased?.()) {
            if (storedChannelId || storedMessageId) {
                this.dependencies.catalogService.updateProduct(resolvedProduct.slug, {
                    panelConfig: {
                        ...panelConfig,
                        publishedChannelId: null,
                        publishedMessageId: null,
                    },
                });
                await this.persistStoreIfNeeded();
                if (!targetChannel) {
                    return {
                        action: "cleared",
                        channel: null,
                        message: null,
                    };
                }
            }
            throw new Error("Canal de texto invalido para publicar/atualizar o painel.");
        }
        const adoptableMessage = targetChannel && !existingMessage
            ? await this.findExistingSalesPanelMessage(publishChannel, resolvedProduct)
            : null;
        if (adoptableMessage) {
            await adoptableMessage.edit(this.buildSalesPanelMessage(resolvedProduct));
            this.dependencies.catalogService.updateProduct(resolvedProduct.slug, {
                panelConfig: {
                    ...panelConfig,
                    publishedChannelId: String(publishChannel.id ?? "").trim() || null,
                    publishedMessageId: String(adoptableMessage.id ?? "").trim() || null,
                },
            });
            await this.persistStoreIfNeeded();
            return {
                action: "updated",
                channel: publishChannel,
                message: adoptableMessage,
            };
        }
        const publishedMessage = await publishChannel.send(this.buildSalesPanelMessage(resolvedProduct));
        this.dependencies.catalogService.updateProduct(resolvedProduct.slug, {
            panelConfig: {
                ...panelConfig,
                publishedChannelId: String(publishChannel.id ?? "").trim() || null,
                publishedMessageId: String(publishedMessage.id ?? "").trim() || null,
            },
        });
        await this.persistStoreIfNeeded();
        return {
            action: "published",
            channel: publishChannel,
            message: publishedMessage,
        };
    }
    async syncPublishedSalesPanel(productSlug) {
        const product = this.getResolvedProductBySlug(productSlug);
        const panelConfig = product?.panelConfig ?? {};
        if (!product || !panelConfig.publishedChannelId || !panelConfig.publishedMessageId) {
            return false;
        }
        await this.publishOrUpdateSalesPanel(product, null);
        return true;
    }
    buildSalesPanelEmbed(product = null) {
        const resolvedProduct = product ?? this.getPrimaryProduct();
        const sales = this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings();
        const panelConfig = resolvedProduct?.panelConfig ?? {};
        const title = String(panelConfig.title ?? "").trim() || `${resolvedProduct?.name ?? "Bot Manager"} | Assinaturas`;
        const summary = String(panelConfig.summary ?? "").trim() || resolvedProduct?.description || "Nenhum produto ativo no catalogo.";
        const details = String(panelConfig.details ?? "").trim();
        const footerText = String(panelConfig.footerText ?? "").trim();
        const lowestPlan = resolvedProduct?.plans?.length
            ? [...resolvedProduct.plans].sort((left, right) => Number(left.priceCents ?? 0) - Number(right.priceCents ?? 0))[0]
            : null;
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(this.resolveProductPanelColor(resolvedProduct, 0x1f8b4c))
            .setTitle(title)
            .setDescription(this.limitMessageSize([
            summary,
            details || null,
            "",
            "Fluxo:",
            "1. Clique em adicionar ao carrinho",
            sales.cartCategoryId ? "2. Seu carrinho privado sera aberto automaticamente" : "2. Escolha o plano",
            sales.cartCategoryId ? "3. Escolha o plano e os adicionais" : "3. Gere e pague o Pix",
            sales.cartCategoryId ? "4. Gere e pague o Pix dentro do carrinho" : "4. Depois acompanhe tudo em `/apps`",
            sales.cartCategoryId ? "5. Depois acompanhe tudo em `/apps`" : "5. Para renovacao futura, use `/renovar`",
            footerText || null,
        ].filter(Boolean).join("\n")));
        if (lowestPlan) {
            embed.addFields({
                name: String(panelConfig.pricePrefix ?? "").trim() || "Planos a partir de",
                value: `**${this.formatCurrency(lowestPlan.priceCents, lowestPlan.currency)}**`,
                inline: false,
            });
        }
        if (resolvedProduct?.plans?.length) {
            embed.addFields({
                name: "Planos",
                value: resolvedProduct.plans
                    .map((plan) => `- ${plan.name}: ${this.formatCurrency(plan.priceCents, plan.currency)}`)
                    .join("\n")
                    .slice(0, 1024),
            });
        }
        if (isLikelyHttpUrl(panelConfig.imageUrl)) {
            embed.setImage(panelConfig.imageUrl);
        }
        return embed;
    }
    buildCartPanelPayload(product, user, rawState) {
        const state = this.normalizeCartState(rawState, product);
        return {
            content: this.buildUserMention(user),
            allowedMentions: this.buildSilentAllowedMentions(user),
            embeds: [this.buildCartPanelEmbed(product, user, state)],
            components: this.buildCartPanelComponents(product, user.id, state),
        };
    }
    async updateCartInteractionMessage(interaction, payload) {
        const messageId = String(interaction?.message?.id ?? "").trim();
        const channel = interaction?.channel;
        if (interaction.deferred && messageId && channel?.messages?.edit) {
            await channel.messages.edit(messageId, payload);
            return;
        }
        if (!interaction.deferred && !interaction.replied && typeof interaction.update === "function") {
            await interaction.update(payload);
            return;
        }
        await interaction.editReply(payload);
    }
    buildCartPanelEmbed(product, user, rawState) {
        const state = this.normalizeCartState(rawState, product);
        const selectedPlan = this.getCartSelectedPlan(product, state);
        const selectedAddons = this.getCartSelectedAddons(product, state);
        const totalAmountCents = this.calculateCartTotalCents(product, state);
        const compactCurrency = (amountCents, currency = "BRL") => this.formatCurrency(amountCents, currency).replace(/\s+/gu, "");
        const configuredPanelTitle = String(product?.panelConfig?.title ?? "").trim();
        const cartTitleBase = configuredPanelTitle
            ? String(configuredPanelTitle.split("|")[0] ?? configuredPanelTitle).trim()
            : String(product?.name ?? "Manager").trim();
        const cartTitle = `${cartTitleBase || "Manager"} | Carrinho`;
        const addonsSummaryBlock = [
            "```diff",
            ...(selectedAddons.length > 0
                ? selectedAddons.map((addon) => `+ ${addon.name}${addon.priceCents > 0 ? `  +${compactCurrency(addon.priceCents, addon.currency ?? "BRL")}` : ""}`)
                : ["+ Nenhum"]),
            "```",
        ].join("\n");
        if (state.step === "addons") {
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(this.resolveProductPanelColor(product, 0xf59e0b))
                .setTitle("MANAGER | Adicionais")
                .setDescription(this.limitMessageSize([
                "**Resumo da compra**",
                `${product.name} (${selectedPlan?.durationDays ?? 0} dias) - **${compactCurrency(selectedPlan?.priceCents ?? 0, selectedPlan?.currency ?? "BRL")}**`,
                "",
                "**Adicionais**",
                addonsSummaryBlock,
                "**Valor a pagar**",
                `**${compactCurrency(totalAmountCents)}**`,
            ].join("\n")));
            this.applyUserEmbedIdentity(embed, user);
            if (isLikelyHttpUrl(product?.panelConfig?.imageUrl)) {
                embed.setThumbnail(product.panelConfig.imageUrl);
            }
            return embed;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(this.resolveProductPanelColor(product, 0x2563eb))
            .setTitle(cartTitle)
            .setDescription(this.limitMessageSize([
            `👋 | Olá <@${user.id}>,`,
            "• **Selecione um plano para seu bot.**",
        ].join("\n")))
            .addFields({
            name: "Produto",
            value: `\`\`\`${product.name}\`\`\``,
            inline: false,
        }, {
            name: "Preço",
            value: compactCurrency(selectedPlan?.priceCents ?? 0, selectedPlan?.currency ?? "BRL"),
            inline: true,
        }, {
            name: "Duração",
            value: `${selectedPlan?.durationDays ?? 0} dias`,
            inline: true,
        });
        if (isLikelyHttpUrl(product?.panelConfig?.imageUrl)) {
            embed.setThumbnail(product.panelConfig.imageUrl);
        }
        this.applyUserEmbedIdentity(embed, user);
        return embed;
    }
    buildCartPanelComponents(product, ownerUserId, rawState) {
        const state = this.normalizeCartState(rawState, product);
        const selectedAddons = new Set(state.addonCodes);
        if (state.step === "addons") {
            return [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.cartAddonBioPrefix}${ownerUserId}:${product.slug}`)
                    .setLabel("Bio Personalizada")
                    .setEmoji("\uD83D\uDCDD")
                    .setStyle(selectedAddons.has("custom-bio") ? discord_js_1.ButtonStyle.Success : discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.cartAddonInfoPrefix}auto-restart:${ownerUserId}:${product.slug}`)
                    .setLabel("AutoRestart")
                    .setEmoji("\u26A1")
                    .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.cartAddonInfoPrefix}custom-qr:${ownerUserId}:${product.slug}`)
                    .setLabel("QR Code Personalizado")
                    .setEmoji("\uD83D\uDDBC\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.cartAddonInfoPrefix}priority-support:${ownerUserId}:${product.slug}`)
                    .setLabel("Suporte Prioritário")
                    .setEmoji("\uD83D\uDEE1\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Primary)),
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.cartPaymentPrefix}${ownerUserId}:${product.slug}`)
                    .setLabel("Continuar para Pagamento")
                    .setEmoji("\u2705")
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.cartBackPrefix}${ownerUserId}:${product.slug}`)
                    .setLabel("Voltar")
                    .setEmoji("\u2B05\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.cartCancelPrefix}${ownerUserId}:${product.slug}`)
                    .setLabel("Cancelar")
                    .setEmoji("\u274C")
                    .setStyle(discord_js_1.ButtonStyle.Danger)),
            ];
        }
        const options = product.plans.slice(0, 25).map((plan) => ({
            label: `${plan.name}`.slice(0, 100),
            description: `${plan.description} • ${this.formatCurrency(plan.priceCents, plan.currency)}`.slice(0, 100),
            value: `${product.slug}|${plan.code}`,
            emoji: { name: plan.code === "weekly" ? "\uD83D\uDDD3\uFE0F" : "\uD83D\uDCC5" },
            default: plan.code === state.planCode,
        }));
        return [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(`${CUSTOM_IDS.buyPlanSelectCartPrefix}${ownerUserId}:${product.slug}`)
                .setPlaceholder("📅 Escolha o plano")
                .addOptions(options)),
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.cartContinuePrefix}${ownerUserId}:${product.slug}`)
                .setLabel("Continuar")
                .setEmoji("\u2705")
                .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.cartCancelPrefix}${ownerUserId}:${product.slug}`)
                .setLabel("Cancelar")
                .setEmoji("\u274C")
                .setStyle(discord_js_1.ButtonStyle.Danger)),
        ];
    }
    buildAdminPanelEmbed(message) {
        const snapshot = this.dependencies.managerRuntimeConfigService.getAdminSnapshot();
        const access = snapshot.access;
        const subscriptions = this.dependencies.store.subscriptions;
        const instances = this.dependencies.store.instances;
        const statusCounts = this.countByStatus(subscriptions.map((item) => item.status));
        const instanceCounts = this.countByStatus(instances.map((item) => item.status));
        const descriptionLines = [
            message ? `**Atualizacao**\n${message}\n` : null,
            `App Base URL: ${snapshot.appBaseUrl ?? "nao definida"}`,
            "Use os botoes abaixo para abrir as areas de Produtos, Vendas e Efi.",
        ].filter(Boolean);
        return new discord_js_1.EmbedBuilder()
            .setColor(0x0f172a)
            .setTitle("Painel Administrativo | Bot Manager")
            .setDescription(this.limitMessageSize(descriptionLines.join("\n")))
            .addFields({
            name: "Assinaturas",
            value: [
                `Total: ${subscriptions.length}`,
                `Ativas: ${statusCounts.active ?? 0}`,
                `Pendentes: ${statusCounts.pending ?? 0}`,
                `Carencia: ${statusCounts.grace ?? 0}`,
                `Suspensas: ${statusCounts.suspended ?? 0}`,
            ].join("\n"),
            inline: true,
        }, {
            name: "Instancias",
            value: [
                `Total: ${instances.length}`,
                `Rodando: ${instanceCounts.running ?? 0}`,
                `Provisionando: ${instanceCounts.provisioning ?? 0}`,
                `Suspensas: ${instanceCounts.suspended ?? 0}`,
                `Falha: ${instanceCounts.failed ?? 0}`,
            ].join("\n"),
            inline: true,
        }, {
            name: "Acesso",
            value: [
                `Dono(s) da aplicacao: ${this.applicationOwnerUserIds.length}`,
                `Usuarios com permissao: ${access.adminUserIds.length}`,
            ].join("\n"),
            inline: true,
        });
    }
    buildAdminPanelPayload(message, extraEmbeds = [], components = null) {
        return {
            embeds: [this.buildAdminPanelEmbed(message), ...extraEmbeds.filter(Boolean)],
            components: components ?? this.buildAdminPanelComponents(),
        };
    }
    buildAdminPanelComponents(includeEmojis = true) {
        const applyEmoji = (button, emoji) => {
            if (includeEmojis && emoji) {
                button.setEmoji(emoji);
            }
            return button;
        };
        return [
            new discord_js_1.ActionRowBuilder().addComponents(applyEmoji(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminRefresh)
                .setLabel("Atualizar")
                .setStyle(discord_js_1.ButtonStyle.Secondary), "\uD83D\uDD04"), applyEmoji(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminProducts)
                .setLabel("Produtos")
                .setStyle(discord_js_1.ButtonStyle.Primary), "\uD83D\uDCE6"), applyEmoji(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminSales)
                .setLabel("Configurar Vendas")
                .setStyle(discord_js_1.ButtonStyle.Primary), "\uD83D\uDED2"), applyEmoji(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminEfipayModal)
                .setLabel("Configurar Efi")
                .setStyle(discord_js_1.ButtonStyle.Primary), "\uD83D\uDCB3")),
            new discord_js_1.ActionRowBuilder().addComponents(applyEmoji(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminSubscribers)
                .setLabel("Ver Assinantes")
                .setStyle(discord_js_1.ButtonStyle.Secondary), "\uD83D\uDC65"), applyEmoji(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminPermissions)
                .setLabel("Permissoes")
                .setStyle(discord_js_1.ButtonStyle.Secondary), "\uD83D\uDD10")),
        ];
    }
    buildEfipayManagementEmbed(message) {
        const snapshot = this.dependencies.managerRuntimeConfigService.getAdminSnapshot();
        const efipay = snapshot.billing.efipay;
        return new discord_js_1.EmbedBuilder()
            .setColor(0x1d4ed8)
            .setTitle("Configurar Efi | Bot Manager")
            .setDescription(this.limitMessageSize([
            message ? `**Atualizacao**\n${message}\n` : null,
            `APP_BASE_URL: ${snapshot.appBaseUrl ?? "nao definida"}`,
            `Pix pronto: ${efipay.status.canCreatePixCharges ? "sim" : "nao"}`,
            `Webhook pronto: ${efipay.status.canRegisterWebhook && efipay.status.webhookPublicUrlReady ? "sim" : "nao"}`,
            efipay.status.lastValidationError ? `Ultimo erro: ${efipay.status.lastValidationError}` : null,
        ].filter(Boolean).join("\n")))
            .addFields({
            name: "Credenciais",
            value: [
                `Client ID: ${efipay.configuredFields.clientId ? "ok" : "faltando"}`,
                `Client Secret: ${efipay.configuredFields.clientSecret ? "ok" : "faltando"}`,
                `Pix key: ${efipay.configuredFields.pixKey ? "ok" : "faltando"}`,
                `Certificado: ${efipay.configuredFields.certificate ? "ok" : "faltando"}`,
            ].join("\n"),
            inline: true,
        }, {
            name: "Webhook",
            value: [
                `Path: ${efipay.values.webhookPath ?? "/webhooks/efipay"}`,
                `Auto sync: ${efipay.values.autoSyncWebhook ? "sim" : "nao"}`,
                `Ultima validacao: ${efipay.status.lastValidatedAt ? this.formatIsoDate(efipay.status.lastValidatedAt) : "nunca"}`,
                `Ultimo sync: ${efipay.status.lastWebhookSyncAt ? this.formatIsoDate(efipay.status.lastWebhookSyncAt) : "nunca"}`,
            ].join("\n"),
            inline: true,
        });
    }
    buildEfipayManagementPayload(message) {
        return {
            embeds: [this.buildEfipayManagementEmbed(message)],
            components: this.buildEfipayManagementComponents(),
        };
    }
    buildEfipayManagementComponents() {
        return [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminEfipayCredentials)
                .setLabel("Credenciais")
                .setEmoji("\uD83D\uDD11")
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminEfipayUpload)
                .setLabel("Enviar .p12")
                .setEmoji("\uD83D\uDCCE")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminEfipayValidate)
                .setLabel("Validar Efi")
                .setEmoji("\u2705")
                .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminEfipayWebhook)
                .setLabel("Sincronizar Webhook")
                .setEmoji("\uD83C\uDF10")
                .setStyle(discord_js_1.ButtonStyle.Primary)),
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminBackHome)
                .setLabel("Voltar")
                .setEmoji("\u2B05\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
        ];
    }
    buildSalesManagementEmbed(message) {
        const snapshot = this.dependencies.managerRuntimeConfigService.getAdminSnapshot();
        const sales = snapshot.sales ?? {};
        return new discord_js_1.EmbedBuilder()
            .setColor(0x0f766e)
            .setTitle("Configurar Vendas | Carrinho")
            .setDescription(this.limitMessageSize([
            message ? `**Atualizacao**\n${message}\n` : null,
            "Defina onde os carrinhos privados vao abrir, quem pode ver, para onde os logs vao e em quanto tempo o carrinho fecha sozinho.",
        ].filter(Boolean).join("\n")))
            .addFields({
            name: "Carrinho",
            value: [
                `Categoria: ${sales.cartCategoryId ? `<#${sales.cartCategoryId}>` : "nao definida"}`,
                `Template do canal: ${sales.cartChannelNameTemplate ?? "🛒・{guild}"}`,
                `Expiracao: ${Math.max(1, Number(sales.cartInactivityMinutes ?? 5))} minuto(s)`,
            ].join("\n"),
            inline: true,
        }, {
            name: "Cargos",
            value: [
                `Cargo do cliente: ${sales.customerRoleId ? `<@&${sales.customerRoleId}>` : "nao definido"}`,
                `Staff do carrinho: ${Array.isArray(sales.cartStaffRoleIds) && sales.cartStaffRoleIds.length > 0
                    ? sales.cartStaffRoleIds.map((id) => `<@&${id}>`).join(", ")
                    : "nenhum"}`,
            ].join("\n"),
            inline: true,
        }, {
            name: "Logs Privados",
            value: [
                `Canal: ${sales.logsChannelId ? `<#${sales.logsChannelId}>` : "nao definido"}`,
                "Eventos: abertura, reabertura, cancelamento, inatividade, checkout, pagamento e setup",
            ].join("\n"),
            inline: false,
        });
    }
    buildSalesManagementPayload(message) {
        return {
            embeds: [this.buildSalesManagementEmbed(message)],
            components: this.buildSalesManagementComponents(),
        };
    }
    buildSalesManagementComponents() {
        return [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminSalesCartCategory)
                .setLabel("Categoria do Carrinho")
                .setEmoji("\uD83D\uDDC2\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminSalesCustomerRole)
                .setLabel("Cargo do Cliente")
                .setEmoji("\uD83C\uDF96\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminSalesStaffRoles)
                .setLabel("Staff do Carrinho")
                .setEmoji("\uD83D\uDEE1\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminSalesTemplate)
                .setLabel("Nome do Canal")
                .setEmoji("\u270F\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminSalesLogsChannel)
                .setLabel("Canal de Logs")
                .setEmoji("\uD83D\uDCDC")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminSalesInactivity)
                .setLabel("Expiracao")
                .setEmoji("\u23F1\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminBackHome)
                .setLabel("Voltar")
                .setEmoji("\u2B05\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
        ];
    }
    buildSalesCategoryPayload(message) {
        return {
            embeds: [this.buildSalesManagementEmbed(message ?? "Selecione abaixo a categoria onde os carrinhos privados serao abertos.")],
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder()
                    .setCustomId(CUSTOM_IDS.adminSalesCategorySelect)
                    .setPlaceholder("Selecione a categoria do carrinho")
                    .setChannelTypes(discord_js_1.ChannelType.GuildCategory)
                    .setMinValues(1)
                    .setMaxValues(1)),
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(CUSTOM_IDS.adminSalesCartCategoryClear)
                    .setLabel("Limpar")
                    .setEmoji("\uD83E\uDDF9")
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId(CUSTOM_IDS.adminBackSales)
                    .setLabel("Voltar")
                    .setEmoji("\u2B05\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Secondary)),
            ],
        };
    }
    buildSalesCustomerRolePayload(message) {
        return {
            embeds: [this.buildSalesManagementEmbed(message ?? "Selecione o cargo que sera entregue ao cliente com assinatura ativa.")],
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder()
                    .setCustomId(CUSTOM_IDS.adminSalesCustomerRoleSelect)
                    .setPlaceholder("Selecione o cargo do cliente")
                    .setMinValues(1)
                    .setMaxValues(1)),
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(CUSTOM_IDS.adminSalesCustomerRoleClear)
                    .setLabel("Limpar")
                    .setEmoji("\uD83E\uDDF9")
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId(CUSTOM_IDS.adminBackSales)
                    .setLabel("Voltar")
                    .setEmoji("\u2B05\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Secondary)),
            ],
        };
    }
    buildSalesStaffRolesPayload(message) {
        return {
            embeds: [this.buildSalesManagementEmbed(message ?? "Selecione os cargos da equipe que poderao ver todos os carrinhos.")],
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder()
                    .setCustomId(CUSTOM_IDS.adminSalesStaffRolesSelect)
                    .setPlaceholder("Selecione os cargos staff do carrinho")
                    .setMinValues(1)
                    .setMaxValues(10)),
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(CUSTOM_IDS.adminSalesStaffRolesClear)
                    .setLabel("Limpar")
                    .setEmoji("\uD83E\uDDF9")
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId(CUSTOM_IDS.adminBackSales)
                    .setLabel("Voltar")
                    .setEmoji("\u2B05\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Secondary)),
            ],
        };
    }
    buildSalesLogsChannelPayload(message) {
        return {
            embeds: [this.buildSalesManagementEmbed(message ?? "Selecione o canal privado onde o manager vai registrar abertura de carrinho, compras e setup.")],
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder()
                    .setCustomId(CUSTOM_IDS.adminSalesLogsChannelSelect)
                    .setPlaceholder("Selecione o canal de logs privados")
                    .setChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement)
                    .setMinValues(1)
                    .setMaxValues(1)),
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(CUSTOM_IDS.adminSalesLogsChannelClear)
                    .setLabel("Limpar")
                    .setEmoji("\uD83E\uDDF9")
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId(CUSTOM_IDS.adminBackSales)
                    .setLabel("Voltar")
                    .setEmoji("\u2B05\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Secondary)),
            ],
        };
    }
    buildAdminReturnComponents() {
        return [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminBackHome)
                .setLabel("Voltar")
                .setEmoji("\u2B05\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminProducts)
                .setLabel("Produtos")
                .setEmoji("\uD83D\uDCE6")
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminRefresh)
                .setLabel("Atualizar")
                .setEmoji("\uD83D\uDD04")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
        ];
    }
    buildProductCatalogPayload(message) {
        return this.buildAdminPanelPayload(message ?? "Use os botoes abaixo para criar, escolher e configurar seus produtos sem depender de comandos longos.", [this.buildProductsEmbed()], this.buildProductCatalogComponents());
    }
    buildProductManagementPayload(productSlug, message) {
        return this.buildAdminPanelPayload(message ?? "Use os botoes abaixo para editar o produto selecionado.", [this.buildProductConfigurationEmbed(productSlug)], this.buildProductManagementComponents(productSlug));
    }
    buildProductPublishPayload(productSlug, message) {
        const product = this.getResolvedProductBySlug(productSlug);
        const publishEmbed = new discord_js_1.EmbedBuilder()
            .setColor(0x7c3aed)
            .setTitle(`Publicar Painel | ${product?.name ?? productSlug}`)
            .setDescription(this.limitMessageSize([
            message ?? "Escolha abaixo o canal onde o painel de vendas desse produto sera publicado.",
            product ? `Produto: **${product.name}**` : null,
            product ? `Slug: \`${product.slug}\`` : null,
        ].filter(Boolean).join("\n")));
        return this.buildAdminPanelPayload(message, [publishEmbed], this.buildProductPublishComponents(productSlug));
    }
    buildProductsEmbed() {
        const products = this.dependencies.catalogService.listProducts();
        return new discord_js_1.EmbedBuilder()
            .setColor(0x2563eb)
            .setTitle("Produtos e Paineis")
            .setDescription(this.limitMessageSize(products.length === 0
            ? "Nenhum produto cadastrado ainda. Clique em **Criar Produto** para comecar."
            : products
                .slice(0, 20)
                .map((product, index) => {
                const runtimeSource = this.dependencies.managerRuntimeConfigService.getRuntimeSourceConfig(product.sourceSlug);
                const sourceLabel = runtimeSource?.githubRepo
                    ? runtimeSource.githubRepo
                    : runtimeSource?.artifactPath ?? runtimeSource?.projectDir ?? "nao configurada";
                return [
                    `${index + 1}. **${product.name}**`,
                    `Slug: \`${product.slug}\``,
                    `Source: ${sourceLabel}`,
                    `Planos: ${product.plans.length}`,
                ].join("\n");
            })
                .join("\n\n")));
    }
    buildProductCatalogComponents() {
        const rows = [];
        const products = this.dependencies.catalogService
            .listProducts()
            .filter((product) => String(product?.slug ?? "").trim())
            .slice(0, 25);
        if (products.length > 0) {
            rows.push(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(CUSTOM_IDS.adminProductsSelect)
                .setPlaceholder("Escolha um produto para configurar")
                .addOptions(products.map((product) => {
                const runtimeSource = this.dependencies.managerRuntimeConfigService.getRuntimeSourceConfig(product.sourceSlug);
                const sourceStatus = runtimeSource?.githubRepo || runtimeSource?.artifactPath || runtimeSource?.projectDir ? "source ok" : "source pendente";
                return {
                    label: clampText(product.name, 100, product.slug || "Produto"),
                    description: clampText(`${product.slug} - ${sourceStatus}`, 100, "Produto sem slug"),
                    value: String(product.slug).trim(),
                };
            }))));
        }
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(CUSTOM_IDS.adminProductsCreate)
            .setLabel("Criar Produto")
            .setEmoji("\u2795")
            .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
            .setCustomId(CUSTOM_IDS.adminBackHome)
            .setLabel("Voltar")
            .setEmoji("\u2B05\uFE0F")
            .setStyle(discord_js_1.ButtonStyle.Secondary)));
        return rows;
    }
    buildProductManagementComponents(productSlug) {
        return [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductBasicPrefix}${productSlug}`)
                .setLabel("Configurar Produto")
                .setEmoji("\uD83D\uDCDD")
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductVisualPrefix}${productSlug}`)
                .setLabel("Visual")
                .setEmoji("\uD83C\uDFA8")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductApprovedPrefix}${productSlug}`)
                .setLabel("Aprovado")
                .setEmoji("\u2705")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductSourcePrefix}${productSlug}`)
                .setLabel("Source GitHub")
                .setEmoji("\uD83D\uDD17")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductPlansPrefix}${productSlug}`)
                .setLabel("Assinaturas")
                .setEmoji("\uD83D\uDCB0")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductRolePrefix}${productSlug}`)
                .setLabel("Cargo")
                .setEmoji("\uD83C\uDF96\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductPreviewPrefix}${productSlug}`)
                .setLabel("Preview")
                .setEmoji("\uD83D\uDC40")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductPublishPrefix}${productSlug}`)
                .setLabel("Publicar Painel")
                .setEmoji("\uD83D\uDCE3")
                .setStyle(discord_js_1.ButtonStyle.Success)),
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminProductsCreate)
                .setLabel("Novo Produto")
                .setEmoji("\u2795")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminBackProducts)
                .setLabel("Voltar")
                .setEmoji("\u2B05\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
        ];
    }
    buildProductPublishComponents(productSlug) {
        return [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductPublishChannelPrefix}${productSlug}`)
                .setPlaceholder("Escolha o canal para publicar o painel")
                .setChannelTypes(discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement)
                .setMinValues(1)
                .setMaxValues(1)),
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductViewPrefix}${productSlug}`)
                .setLabel("Voltar")
                .setEmoji("\u2B05\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
        ];
    }
    buildProductRolePayload(productSlug, message) {
        const product = this.dependencies.catalogService.getProductBySlug(productSlug);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`Cargo | ${product?.name ?? productSlug}`)
            .setDescription(this.limitMessageSize([
            message ?? "Selecione abaixo o cargo que o cliente deve receber ao comprar este produto.",
            product ? `Produto: **${product.name}**` : null,
            product ? `Slug: \`${product.slug}\`` : null,
            `Cargo atual: ${product?.customerRoleId ? `<@&${product.customerRoleId}>` : "nenhum"}`,
        ].filter(Boolean).join("\n")));
        return this.buildAdminPanelPayload(message, [embed], [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.RoleSelectMenuBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductRoleSelectPrefix}${productSlug}`)
                .setPlaceholder("Selecione o cargo do produto")
                .setMinValues(1)
                .setMaxValues(1)),
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductRoleClearPrefix}${productSlug}`)
                .setLabel("Limpar")
                .setEmoji("\uD83E\uDDF9")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.adminProductViewPrefix}${productSlug}`)
                .setLabel("Voltar")
                .setEmoji("\u2B05\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
        ]);
    }
    buildAppEntryFromBundle(bundle) {
        const instance = bundle?.instance ?? null;
        const discordApp = instance
            ? this.dependencies.store.discordApps.find((entry) => entry.id === instance.discordAppId) ?? null
            : null;
        const setupReady = !instance &&
            bundle?.product?.botProvisioningMode === "customer_token" &&
            bundle?.subscription?.status === "active" &&
            Boolean(this.findApprovedActivationPayment(bundle.subscription.id));
        const displayName = clampText(instance?.config?.discordAppName ??
            discordApp?.appName ??
            bundle?.product?.name ??
            "AplicaÃ§Ã£o", 100, "AplicaÃ§Ã£o");
        const subtitle = clampText(instance?.hostingAppId ??
            bundle?.subscription?.id ??
            bundle?.product?.slug ??
            "app", 100, "app");
        return {
            key: instance ? `inst_${instance.id}` : `sub_${bundle?.subscription?.id}`,
            bundle,
            instance,
            discordApp,
            setupReady,
            displayName,
            subtitle,
        };
    }
    listManagedAppBundles() {
        return this.dependencies.store.subscriptions
            .map((subscription) => this.dependencies.subscriptionService.getById(subscription.id))
            .filter(Boolean)
            .filter((bundle) => ["active", "grace", "suspended"].includes(String(bundle?.subscription?.status ?? "").toLowerCase()));
    }
    isBotApplicationOwner(userId, entry) {
        const normalizedUserId = String(userId ?? "").trim();
        if (!normalizedUserId || !entry) {
            return false;
        }
        const ownerCandidates = [
            entry.instance?.config?.ownerDiscordUserId,
            entry.discordApp?.runtimeEnv?.CUSTOMER_OWNER_DISCORD_USER_ID,
        ]
            .map((value) => String(value ?? "").trim())
            .filter(Boolean);
        return ownerCandidates.includes(normalizedUserId);
    }
    canAccessAppEntry(userId, entry) {
        const normalizedUserId = String(userId ?? "").trim();
        if (!normalizedUserId || !entry) {
            return false;
        }
        if (this.hasAdminAccess({ user: { id: normalizedUserId } })) {
            return true;
        }
        if (entry.bundle?.subscription && this.canManageSubscription(normalizedUserId, entry.bundle.subscription)) {
            return true;
        }
        return this.isBotApplicationOwner(normalizedUserId, entry);
    }
    buildOwnedAppEntries(userId) {
        const normalizedUserId = String(userId ?? "").trim();
        return this.listManagedAppBundles()
            .map((bundle) => this.buildAppEntryFromBundle(bundle))
            .filter((entry) => this.canAccessAppEntry(normalizedUserId, entry))
            .sort((left, right) => {
            const leftDate = Date.parse(left.instance?.updatedAt ?? left.bundle.subscription.updatedAt ?? left.bundle.subscription.createdAt ?? 0);
            const rightDate = Date.parse(right.instance?.updatedAt ?? right.bundle.subscription.updatedAt ?? right.bundle.subscription.createdAt ?? 0);
            return rightDate - leftDate;
        });
        return this.dependencies.subscriptionService
            .listByDiscordUserId(userId)
            .filter(Boolean)
            .filter((bundle) => ["active", "grace", "suspended"].includes(String(bundle?.subscription?.status ?? "").toLowerCase()))
            .map((bundle) => {
            const instance = bundle.instance ?? null;
            const discordApp = instance
                ? this.dependencies.store.discordApps.find((entry) => entry.id === instance.discordAppId) ?? null
                : null;
            const setupReady = !instance &&
                bundle.product?.botProvisioningMode === "customer_token" &&
                bundle.subscription.status === "active" &&
                Boolean(this.findApprovedActivationPayment(bundle.subscription.id));
            const displayName = clampText(instance?.config?.discordAppName ??
                discordApp?.appName ??
                bundle.product?.name ??
                "Aplicacao", 100, "Aplicacao");
            const subtitle = clampText(instance?.hostingAppId ??
                bundle.subscription.id ??
                bundle.product?.slug ??
                "app", 100, "app");
            return {
                key: instance ? `inst_${instance.id}` : `sub_${bundle.subscription.id}`,
                bundle,
                instance,
                discordApp,
                setupReady,
                displayName,
                subtitle,
            };
        })
            .sort((left, right) => {
            const leftDate = Date.parse(left.instance?.updatedAt ?? left.bundle.subscription.updatedAt ?? left.bundle.subscription.createdAt ?? 0);
            const rightDate = Date.parse(right.instance?.updatedAt ?? right.bundle.subscription.updatedAt ?? right.bundle.subscription.createdAt ?? 0);
            return rightDate - leftDate;
        });
    }
    findOwnedAppEntryByKey(userId, key) {
        const normalizedKey = String(key ?? "").trim();
        if (!normalizedKey) {
            return null;
        }
        return this.buildOwnedAppEntries(userId).find((entry) => entry.key === normalizedKey) ?? null;
    }
    findManagedAppEntryByKey(key) {
        const normalizedKey = String(key ?? "").trim();
        if (!normalizedKey) {
            return null;
        }
        return this.listManagedAppBundles()
            .map((bundle) => this.buildAppEntryFromBundle(bundle))
            .find((entry) => entry.key === normalizedKey) ?? null;
    }
    findTrackedAppsPanelByMessage(messageId, channelId = null) {
        const normalizedMessageId = String(messageId ?? "").trim();
        const normalizedChannelId = String(channelId ?? "").trim();
        if (!normalizedMessageId) {
            return null;
        }
        for (const [ownerUserId, tracked] of this.trackedAppsPanels.entries()) {
            if (String(tracked?.messageId ?? "").trim() !== normalizedMessageId) {
                continue;
            }
            if (normalizedChannelId && String(tracked?.channelId ?? "").trim() && String(tracked.channelId).trim() !== normalizedChannelId) {
                continue;
            }
            return { ownerUserId, tracked };
        }
        return null;
    }
    resolveAppsPanelContext(interaction, requestedPage = 0, selectedKey = null) {
        const trackedPanel = this.findTrackedAppsPanelByMessage(interaction?.message?.id, interaction?.channelId ?? null);
        const panelOwnerUserId = String(trackedPanel?.ownerUserId ?? interaction?.user?.id ?? "").trim();
        const entries = this.buildOwnedAppEntries(panelOwnerUserId);
        const state = this.resolveAppsSelection(entries, requestedPage, selectedKey);
        return {
            panelOwnerUserId,
            trackedPanel,
            entries,
            state,
            entry: state.selected ?? entries[0] ?? null,
        };
    }
    buildAppsAccessDeniedMessage() {
        return "Somente admins, o dono comercial da assinatura ou o dono configurado do bot podem usar esse painel.";
    }
    canOpenAppsSettings(entry, overview = null) {
        if (!entry?.instance) {
            return false;
        }
        return this.getAppsPowerState(entry, overview).state === "running";
    }
    async buildAppsPanelViewPayload(panelOwnerUserId, page, selectedKey, requestedView, entry, notice = null) {
        const normalizedView = requestedView === "settings" ? "settings" : "overview";
        if (normalizedView === "settings") {
            const overview = entry?.instance ? await this.loadSquareCloudAppOverview(entry.instance) : null;
            if (!this.canOpenAppsSettings(entry, overview)) {
                return {
                    view: "overview",
                    payload: await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, "overview", "Seu bot est\u00E1 desligado, para entrar nas configura\u00E7\u00F5es dele voc\u00EA deve lig\u00E1-lo!"),
                };
            }
        }
        return {
            view: normalizedView,
            payload: await this.buildAppsPanelPayload(panelOwnerUserId, page, selectedKey, normalizedView, notice),
        };
    }
    resolveAppsSelection(entries, requestedPage = 0, selectedKey = null) {
        const pageSize = 25;
        const total = entries.length;
        const pageCount = Math.max(1, Math.ceil(Math.max(total, 1) / pageSize));
        const selectedIndex = selectedKey ? entries.findIndex((entry) => entry.key === selectedKey) : -1;
        const preferredPage = selectedIndex >= 0 ? Math.floor(selectedIndex / pageSize) : requestedPage;
        const safePage = Math.max(0, Math.min(Number(preferredPage) || 0, pageCount - 1));
        const pageEntries = entries.slice(safePage * pageSize, safePage * pageSize + pageSize);
        const selected = pageEntries.find((entry) => entry.key === selectedKey) ?? pageEntries[0] ?? null;
        return {
            page: safePage,
            pageCount,
            pageEntries,
            selected,
        };
    }
    async buildAppsPanelPayload(userId, requestedPage = 0, selectedKey = null, view = "overview", notice = null) {
        const entries = this.buildOwnedAppEntries(userId);
        if (entries.length === 0) {
            return {
                content: "",
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setColor(0xdc2626)
                        .setTitle("Suas aplicações")
                        .setDescription(this.limitMessageSize([
                        notice ?? null,
                        "Você não tem nenhuma aplicação liberada no seu /apps agora.",
                        "Compras pendentes ou não aprovadas ainda não aparecem aqui.",
                    ].filter(Boolean).join("\n\n"))),
                ],
                components: [],
            };
        }
        const state = this.resolveAppsSelection(entries, requestedPage, selectedKey);
        const selectedEntry = state.selected ?? entries[0];
        const squareCloudOverview = selectedEntry?.instance ? await this.loadSquareCloudAppOverview(selectedEntry.instance) : null;
        const currentView = view === "settings" ? "settings" : "overview";
        const embed = currentView === "settings"
            ? this.buildAppsSettingsEmbed(selectedEntry, notice)
            : this.buildAppsOverviewEmbed(selectedEntry, squareCloudOverview, notice);
        const actionRows = currentView === "settings"
            ? this.buildAppsSettingsComponents(userId, selectedEntry, state.page)
            : this.buildAppsOverviewComponents(userId, selectedEntry, state.page, squareCloudOverview);
        const selectRow = this.buildAppsSelectRow(state.pageEntries, state.page, currentView, selectedEntry?.key ?? "");
        const paginationRow = this.buildAppsPaginationRow(state.page, state.pageCount, selectedEntry?.key ?? "", currentView);
        return {
            content: "",
            embeds: [embed],
            components: [...actionRows, selectRow, paginationRow].filter(Boolean),
        };
    }
    async loadSquareCloudAppOverview(instance) {
        if (!instance?.hostingAppId || instance.hostingAppId.startsWith("pending-")) {
            return null;
        }
        if (!this.dependencies.squareCloudClient?.isConfigured?.()) {
            return null;
        }
        try {
            const [info, status] = await Promise.all([
                this.dependencies.squareCloudClient.getAppInfo(instance.hostingAppId),
                this.dependencies.squareCloudClient.getAppStatus(instance.hostingAppId),
            ]);
            return {
                info: info?.response ?? info ?? null,
                status: status?.response ?? status ?? null,
                error: null,
            };
        }
        catch (error) {
            return {
                info: null,
                status: null,
                error: error?.message ?? "Nao consegui consultar a SquareCloud.",
            };
        }
    }
    buildAppsOverviewEmbed(entry, overview, notice) {
        if (!entry) {
            return new discord_js_1.EmbedBuilder()
                .setColor(0x2563eb)
                .setTitle("Suas aplicações")
                .setDescription("Selecione uma aplicação para continuar.");
        }
        const instance = entry.instance;
        const bundle = entry.bundle;
        const metrics = this.extractAppsOverviewMetrics(instance, overview);
        const embedColor = metrics.tone === "success" ? 0x22c55e : metrics.tone === "danger" ? 0xef4444 : 0x2563eb;
        const statusFieldLabel = metrics.tone === "success" ? "\uD83D\uDFE2 | Status" : metrics.tone === "danger" ? "\uD83D\uDD34 | Status" : "\uD83D\uDFE1 | Status";
        const statusIcon = metrics.tone === "success" ? "🟢" : metrics.tone === "danger" ? "🔴" : "🟡";
        const lines = [
            notice ? `**Atualização**\n${notice}` : null,
            instance
                ? [
                    `**Aplicação:** ${entry.displayName} (${bundle.product?.name ?? "Produto"})`,
                    "",
                    `🟢 | **Status**`,
                    metrics.status,
                    "",
                    `🖥️ | **CPU**`,
                    metrics.cpu,
                    `💾 | **Memória RAM**`,
                    metrics.ram,
                    `🗂️ | **SSD**`,
                    metrics.ssd,
                    `🌐 | **Network (Total)**`,
                    metrics.networkTotal,
                    `🌐 | **Network (Now)**`,
                    metrics.networkNow,
                    `⏰ | **Uptime**`,
                    metrics.uptime,
                    "",
                    `🕓 | **Expira em**`,
                    `${this.formatIsoDate(instance.expiresAt)} (${this.formatRelativeTimestamp(instance.expiresAt)})`,
                    "",
                    metrics.error ? `Aviso da SquareCloud: ${metrics.error}` : null,
                    metrics.error ? "" : null,
                    "**ID**",
                    `\`${instance.id}\``,
                ].filter(Boolean).join("\n")
                : [
                    `**Aplicação:** ${entry.displayName} (${bundle.product?.name ?? "Produto"})`,
                    "",
                    `Status da assinatura: **${this.getStatusLabel(bundle.subscription.status)}**`,
                    bundle.plan ? `Plano atual: **${bundle.plan.name}**` : null,
                    bundle.subscription.currentPeriodEnd
                        ? `Expira em: ${this.formatIsoDate(bundle.subscription.currentPeriodEnd)} (${this.formatRelativeTimestamp(bundle.subscription.currentPeriodEnd)})`
                        : "Expira em: aguardando ativação",
                    entry.setupReady
                        ? "Seu pagamento já foi aprovado. Clique em **🤖 Configurar Bot** para enviar nome, token e dono do bot."
                        : "Essa compra ainda não possui uma instância provisionada.",
                ].filter(Boolean).join("\n"),
        ].filter(Boolean);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embedColor)
            .setTitle("Manager | Suas Aplicações")
            .setDescription(this.limitMessageSize(lines.join("\n\n")));
        const formatCodeValue = (value) => {
            const normalized = String(value ?? "--").trim() || "--";
            return `\`${normalized.replace(/`/g, "'")}\``;
        };
        const formatPlainValue = (value, fallback = "--") => {
            const normalized = String(value ?? "").trim();
            return normalized || fallback;
        };
        if (instance) {
            const descriptionLines = [
                notice ? `**AtualizaÃ§Ã£o**\n${notice}` : null,
                `**AplicaÃ§Ã£o:** ${entry.displayName} (${bundle.product?.name ?? "Produto"})`,
            ].filter(Boolean);
            const expirationLabel = instance.expiresAt
                ? `${this.formatIsoDate(instance.expiresAt)} (${this.formatRelativeTimestamp(instance.expiresAt)})`
                : "Aguardando definiÃ§Ã£o";
            embed
                .setDescription(this.limitMessageSize(descriptionLines.join("\n\n")))
                .setFields({ name: "\uD83D\uDFE2 | Status", value: formatCodeValue(metrics.status), inline: false }, { name: "\uD83D\uDDA5\uFE0F | Cpu", value: formatCodeValue(metrics.cpu), inline: true }, { name: "\uD83D\uDCBE | MemÃ³ria Ram", value: formatCodeValue(metrics.ram), inline: true }, { name: "\uD83D\uDDD2\uFE0F | SSD", value: formatCodeValue(metrics.ssd), inline: true }, { name: "\uD83C\uDF10 | Network(Total)", value: formatCodeValue(metrics.networkTotal), inline: true }, { name: "\uD83C\uDF10 | Network(Now)", value: formatCodeValue(metrics.networkNow), inline: true }, { name: "\u23F0 | Uptime", value: formatCodeValue(metrics.uptime), inline: true }, { name: "\uD83D\uDD53 | Expira em", value: formatCodeValue(expirationLabel), inline: false }, { name: "ID", value: formatCodeValue(instance.id), inline: false });
            if (metrics.error) {
                embed.addFields({ name: "\u26A0\uFE0F | Aviso da SquareCloud", value: this.limitMessageSize(String(metrics.error)), inline: false });
            }
            const normalizedDescriptionLines = [
                notice ? `**Atualizacao**\n${notice}` : null,
                `**Aplicacao:** ${entry.displayName} (${bundle.product?.name ?? "Produto"})`,
            ].filter(Boolean);
            const normalizedExpirationLabel = instance.expiresAt
                ? `${this.formatIsoDate(instance.expiresAt)} (${this.formatRelativeTimestamp(instance.expiresAt)})`
                : "Aguardando definicao";
            embed
                .setDescription(this.limitMessageSize(normalizedDescriptionLines.join("\n\n")))
                .setFields({ name: "\uD83D\uDFE2 | Status", value: formatCodeValue(metrics.status), inline: false }, { name: "\uD83D\uDDA5\uFE0F | Cpu", value: formatCodeValue(metrics.cpu), inline: true }, { name: "\uD83D\uDCBE | Memoria Ram", value: formatCodeValue(metrics.ram), inline: true }, { name: "\uD83D\uDDD2\uFE0F | SSD", value: formatCodeValue(metrics.ssd), inline: true }, { name: "\uD83C\uDF10 | Network(Total)", value: formatCodeValue(metrics.networkTotal), inline: true }, { name: "\uD83C\uDF10 | Network(Now)", value: formatCodeValue(metrics.networkNow), inline: true }, { name: "\u23F0 | Uptime", value: formatPlainValue(metrics.uptime), inline: true }, { name: "\uD83D\uDD53 | Expira em", value: formatPlainValue(normalizedExpirationLabel), inline: false }, { name: "ID", value: formatCodeValue(instance.id), inline: false });
            if (metrics.error) {
                embed.addFields({ name: "\u26A0\uFE0F | Aviso da SquareCloud", value: this.limitMessageSize(String(metrics.error)), inline: false });
            }
        }
        const imageUrl = String(bundle.product?.panelConfig?.imageUrl ?? "").trim();
        if (isLikelyHttpUrl(imageUrl)) {
            embed.setThumbnail(imageUrl);
        }
        return embed;
    }
    buildAppsSettingsEmbed(entry, notice) {
        if (!entry) {
            return new discord_js_1.EmbedBuilder()
                .setColor(0x6b7280)
                .setTitle("Configurações da Aplicação")
                .setDescription("Selecione uma aplicação para continuar.");
        }
        const instance = entry.instance;
        const bundle = entry.bundle;
        const discordApp = entry.discordApp;
        const lines = [
            notice ? `**Atualização**\n${notice}` : null,
            `**Aplicação:** ${entry.displayName}`,
            `**Produto:** ${bundle.product?.name ?? "Produto"}`,
            `**Plano:** ${bundle.plan?.name ?? "Não definido"}`,
            `**Status da assinatura:** ${this.getStatusLabel(bundle.subscription.status)}`,
            "",
            `**Nome atual da aplicação:** ${discordApp?.appName ?? instance?.config?.discordAppName ?? entry.displayName}`,
            `**Application ID:** ${discordApp?.applicationId ?? instance?.config?.discordApplicationId ?? "não definido"}`,
            `**Client ID:** ${discordApp?.clientId ?? instance?.config?.discordClientId ?? "não definido"}`,
            `**Dono do bot:** ${instance?.config?.ownerDiscordUserId ? `<@${instance.config.ownerDiscordUserId}>` : "não definido"}`,
            `**Posse comercial:** ${bundle.subscription.commercialOwnerDiscordUserId ? `<@${bundle.subscription.commercialOwnerDiscordUserId}>` : "não definido"}`,
            `**SquareCloud App:** ${instance?.hostingAppId ?? "não provisionada"}`,
            instance?.installUrl ? `**Link para adicionar seu bot:** ${instance.installUrl}` : null,
            "",
            "Use os botões abaixo para renomear, trocar token, alterar dono do bot, transferir a posse comercial ou deletar a aplicação.",
        ].filter(Boolean);
        return new discord_js_1.EmbedBuilder()
            .setColor(0x374151)
            .setTitle("Configurações da Aplicação")
            .setDescription(this.limitMessageSize(lines.join("\n")));
    }
    pickAppsRuntimeStatusValue(overview = null) {
        const status = overview?.status ?? {};
        const info = overview?.info ?? {};
        return this.pickNestedValue(status, [
            "status",
            "state",
            "running",
            "currentStatus",
            "container.status",
            "container.state",
            "container.running",
            "usage.status",
            "usage.state",
            "usage.running",
            "stats.status",
            "stats.state",
            "stats.running",
            "response.status",
            "response.state",
            "response.running",
        ]) ??
            this.pickNestedValue(info, [
                "status",
                "state",
                "running",
                "currentStatus",
                "container.status",
                "container.state",
                "container.running",
                "application.status",
                "application.state",
                "application.running",
                "response.status",
                "response.state",
                "response.running",
            ]);
    }
    normalizeAppsRuntimeState(rawStatus, instanceStatus = "") {
        if (typeof rawStatus === "boolean") {
            return rawStatus ? "running" : "stopped";
        }
        if (typeof rawStatus === "number") {
            return rawStatus > 0 ? "running" : "stopped";
        }
        if (typeof rawStatus === "string" && rawStatus.trim()) {
            const normalized = rawStatus.trim().toLowerCase();
            if (["running", "online", "started", "ready", "active", "em execucao", "em execução", "rodando"].some((token) => normalized.includes(token))) {
                return "running";
            }
            if (["starting", "deploying", "provisioning", "pending", "inicializando", "provisionando"].some((token) => normalized.includes(token))) {
                return "starting";
            }
            if (["offline", "stopped", "stop", "exited", "exit", "dead", "crashed", "error", "failed", "suspended", "desligada", "desligado"].some((token) => normalized.includes(token))) {
                return "stopped";
            }
        }
        const normalizedInstanceStatus = String(instanceStatus ?? "").trim().toLowerCase();
        if (["running", "active"].includes(normalizedInstanceStatus)) {
            return "running";
        }
        if (["provisioning", "starting"].includes(normalizedInstanceStatus)) {
            return "starting";
        }
        if (["stopped", "suspended", "failed", "deleted", "expired", "exited"].includes(normalizedInstanceStatus)) {
            return "stopped";
        }
        return "";
    }
    formatAppsPowerStateLabel(powerState) {
        const state = String(powerState?.state ?? "").trim();
        const rawStatus = String(powerState?.rawStatus ?? "").trim();
        const labels = {
            running: "Em execução",
            starting: "Inicializando",
            stopped: "Desligada",
            unprovisioned: "Não provisionada",
            unknown: "Status desconhecido",
        };
        const label = labels[state] ?? labels.unknown;
        if (rawStatus && !["true", "false"].includes(rawStatus.toLowerCase())) {
            const normalizedRaw = rawStatus.toLowerCase();
            const normalizedLabel = label.toLowerCase();
            const equivalentStates = {
                running: ["running", "online", "started", "ready", "active", "em execucao", "em execuÃ§Ã£o", "rodando"],
                starting: ["starting", "deploying", "provisioning", "pending", "inicializando", "provisionando"],
                stopped: ["offline", "stopped", "stop", "exited", "exit", "dead", "crashed", "error", "failed", "suspended", "desligada", "desligado"],
                unprovisioned: ["pending", "unprovisioned", "nao provisionada", "nÃ£o provisionada"],
            };
            const hasEquivalentMeaning = (equivalentStates[state] ?? []).some((token) => normalizedRaw.includes(token));
            if (!hasEquivalentMeaning && !normalizedLabel.includes(normalizedRaw) && !normalizedRaw.includes(normalizedLabel)) {
                return `${label} (${rawStatus})`;
            }
        }
        return label;
    }
    buildSquareCloudBootFailureMessage(boot, fallbackMessage) {
        const attempts = Array.isArray(boot?.attempts) ? boot.attempts : [];
        const latestStatusAttempt = [...attempts]
            .reverse()
            .find((attempt) => String(attempt?.action ?? "").startsWith("status_check") && attempt?.result);
        const rawStatus = this.pickAppsRuntimeStatusValue({
            status: latestStatusAttempt?.result?.response ?? latestStatusAttempt?.result ?? null,
            info: null,
        });
        const latestErrorAttempt = [...attempts].reverse().find((attempt) => attempt?.error);
        return [
            fallbackMessage,
            rawStatus !== undefined && rawStatus !== null && String(rawStatus).trim()
                ? `Status atual: ${String(rawStatus).trim()}.`
                : null,
            latestErrorAttempt?.error ? `Último erro: ${latestErrorAttempt.error}.` : null,
        ].filter(Boolean).join(" ");
    }
    getAppsPowerState(entry, overview = null) {
        const instance = entry?.instance ?? null;
        const noHostingApp = !instance?.hostingAppId || String(instance.hostingAppId).startsWith("pending-");
        if (noHostingApp) {
            return {
                canStart: false,
                canStop: false,
                state: "unprovisioned",
                rawStatus: null,
            };
        }
        const rawStatus = this.pickAppsRuntimeStatusValue(overview);
        const normalizedState = this.normalizeAppsRuntimeState(rawStatus, instance?.status);
        return {
            canStart: normalizedState !== "running" && normalizedState !== "starting",
            canStop: normalizedState !== "stopped",
            state: normalizedState || "unknown",
            rawStatus,
        };
    }
    buildAppsOverviewComponents(panelOwnerUserId, entry, page, overview = null) {
        if (!entry) {
            return [];
        }
        if (entry.instance) {
            const powerState = this.getAppsPowerState(entry, overview);
            return [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.appsPowerPrefix}start:${page}:${entry.key}`)
                    .setLabel("Ligar")
                    .setEmoji("\u2B06\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Success)
                    .setDisabled(!powerState.canStart), new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.appsPowerPrefix}stop:${page}:${entry.key}`)
                    .setLabel("Desligar")
                    .setEmoji("\u2B07\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Danger)
                    .setDisabled(!powerState.canStop), new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.appsPowerPrefix}restart:${page}:${entry.key}`)
                    .setLabel("Reiniciar")
                    .setEmoji("\uD83D\uDD04")
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.appsViewPrefix}overview:${page}:${entry.key}`)
                    .setLabel("Atualizar")
                    .setEmoji("\uD83D\uDD04")
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.appsViewPrefix}settings:${page}:${entry.key}`)
                    .setLabel("Configurações")
                    .setEmoji("\u2699\uFE0F")
                    .setStyle(discord_js_1.ButtonStyle.Secondary)),
            ];
        }
        if (entry.setupReady) {
            const rows = [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.appsSetupButtonPrefix}${panelOwnerUserId}:${page}:${entry.key}`)
                    .setLabel("Configurar Bot")
                    .setEmoji("\uD83E\uDD16")
                    .setStyle(discord_js_1.ButtonStyle.Primary), ...(isLikelyHttpUrl(entry.bundle.product?.tutorialUrl)
                    ? [
                        new discord_js_1.ButtonBuilder()
                    .setLabel("Tutorial")
                    .setEmoji("\uD83D\uDCF9")
                    .setStyle(discord_js_1.ButtonStyle.Link)
                    .setURL(entry.bundle.product.tutorialUrl),
                    ]
                    : [])),
            ];
            return rows;
        }
        return [];
    }
    buildAppsSettingsComponents(panelOwnerUserId, entry, page) {
        if (!entry?.instance) {
            return this.buildAppsOverviewComponents(panelOwnerUserId, entry, page);
        }
        const rows = [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.appsRenamePrefix}${panelOwnerUserId}:${page}:${entry.key}`)
                .setLabel("Alterar Nome da Aplicação")
                .setEmoji("\u270F\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.appsTokenPrefix}${panelOwnerUserId}:${page}:${entry.key}`)
                .setLabel("Alterar Token")
                .setEmoji("\uD83D\uDD11")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.appsOwnerPrefix}${panelOwnerUserId}:${page}:${entry.key}`)
                .setLabel("Alterar Dono do Bot")
                .setEmoji("\uD83D\uDD27")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.appsTransferPrefix}${panelOwnerUserId}:${page}:${entry.key}`)
                .setLabel("Transferir Posse da Aplicação")
                .setEmoji("\uD83D\uDCCB")
                .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.appsDeletePrefix}${panelOwnerUserId}:${page}:${entry.key}`)
                .setLabel("Deletar Aplicação")
                .setEmoji("\uD83D\uDDD1\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Danger), entry.instance.installUrl
                ? new discord_js_1.ButtonBuilder()
                    .setLabel("Link Para Adicionar seu Bot")
                    .setEmoji("\uD83E\uDD16")
                    .setStyle(discord_js_1.ButtonStyle.Link)
                    .setURL(entry.instance.installUrl)
                : new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.appsViewPrefix}overview:${page}:${entry.key}`)
                    .setLabel("Link indisponivel")
                    .setEmoji("\uD83D\uDD17")
                    .setStyle(discord_js_1.ButtonStyle.Secondary)
                    .setDisabled(true), new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.appsViewPrefix}overview:${page}:${entry.key}`)
                .setLabel("Voltar")
                .setEmoji("\u2B05\uFE0F")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
        ];
        return rows;
    }
    buildAppsSelectRow(pageEntries, page, view, selectedKey) {
        const options = pageEntries
            .map((entry) => {
            const label = clampText(`${entry.displayName} - ${entry.subtitle}`, 100, entry.displayName);
            const description = clampText(entry.instance
                ? `${entry.bundle.product?.name ?? "Produto"} | ${this.getStatusLabel(entry.instance.status)}`
                : entry.setupReady
                    ? `${entry.bundle.product?.name ?? "Produto"} | aguardando configuração`
                    : `${entry.bundle.product?.name ?? "Produto"} | ${this.getStatusLabel(entry.bundle.subscription.status)}`, 100, entry.bundle.product?.name ?? "Produto");
            return new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel(label)
                .setDescription(description)
                .setValue(entry.key)
                .setDefault(entry.key === selectedKey);
        });
        return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`${CUSTOM_IDS.appsSelectPrefix}${page}:${view}`)
            .setPlaceholder("Selecione uma aplicação")
            .addOptions(options));
    }
    buildAppsPaginationRow(page, pageCount, selectedKey, view) {
        return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`${CUSTOM_IDS.appsPagePrefix}0:${selectedKey}:${view}:first`)
            .setEmoji("\u23EE\uFE0F")
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(page <= 0), new discord_js_1.ButtonBuilder()
            .setCustomId(`${CUSTOM_IDS.appsPagePrefix}${Math.max(0, page - 1)}:${selectedKey}:${view}:prev`)
            .setEmoji("\u2B05\uFE0F")
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(page <= 0), new discord_js_1.ButtonBuilder()
            .setCustomId(`${CUSTOM_IDS.appsPagePrefix}${page}:${selectedKey}:${view}:current`)
            .setLabel(`Página ${page + 1}`)
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setDisabled(true), new discord_js_1.ButtonBuilder()
            .setCustomId(`${CUSTOM_IDS.appsPagePrefix}${Math.min(pageCount - 1, page + 1)}:${selectedKey}:${view}:next`)
            .setEmoji("\u27A1\uFE0F")
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(page >= pageCount - 1), new discord_js_1.ButtonBuilder()
            .setCustomId(`${CUSTOM_IDS.appsPagePrefix}${Math.max(0, pageCount - 1)}:${selectedKey}:${view}:last`)
            .setEmoji("\u23ED\uFE0F")
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(page >= pageCount - 1));
    }
    buildAppsRenameModal(panelOwnerUserId, page, entry) {
        const nameInput = new discord_js_1.TextInputBuilder()
            .setCustomId("apps_rename_name")
            .setLabel("Novo nome da aplicação")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setValue(String(entry.discordApp?.appName ?? entry.instance?.config?.discordAppName ?? entry.displayName).slice(0, 100));
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.appRenamePrefix}${panelOwnerUserId}:${page}:${entry.key}`)
            .setTitle("Alterar Nome da Aplicação")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(nameInput));
    }
    buildAppsTokenModal(panelOwnerUserId, page, entry) {
        const tokenInput = new discord_js_1.TextInputBuilder()
            .setCustomId("apps_token_value")
            .setLabel("Novo token do bot")
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(true)
            .setPlaceholder("Cole aqui o token do bot");
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.appTokenPrefix}${panelOwnerUserId}:${page}:${entry.key}`)
            .setTitle(`Token | ${entry.displayName}`.slice(0, 45))
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(tokenInput));
    }
    buildAppsOwnerModal(panelOwnerUserId, page, entry) {
        const ownerInput = new discord_js_1.TextInputBuilder()
            .setCustomId("apps_owner_user_id")
            .setLabel("Novo dono do bot (Discord ID)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setValue(String(entry.instance?.config?.ownerDiscordUserId ?? "").slice(0, 32));
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.appOwnerPrefix}${panelOwnerUserId}:${page}:${entry.key}`)
            .setTitle("Alterar Dono do Bot")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(ownerInput));
    }
    buildAppsTransferModal(panelOwnerUserId, page, entry) {
        const transferInput = new discord_js_1.TextInputBuilder()
            .setCustomId("apps_transfer_user_id")
            .setLabel("Novo dono comercial (Discord ID)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setValue(String(entry.bundle.subscription.commercialOwnerDiscordUserId ?? "").slice(0, 32));
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.appTransferPrefix}${panelOwnerUserId}:${page}:${entry.key}`)
            .setTitle("Transferir Posse da Aplicação")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(transferInput));
    }
    buildAppsDeleteModal(panelOwnerUserId, page, entry) {
        const deleteInput = new discord_js_1.TextInputBuilder()
            .setCustomId("apps_delete_confirm")
            .setLabel("Digite DELETAR ou o ID da aplicação")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder(entry.instance?.id ?? "DELETAR");
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.appDeletePrefix}${panelOwnerUserId}:${page}:${entry.key}`)
            .setTitle("Deletar Aplicação")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(deleteInput));
    }
    buildSubscribersEmbed(statusFilter = "all") {
        const bundles = this.dependencies.store.subscriptions
            .map((subscription) => this.dependencies.subscriptionService.getById(subscription.id))
            .filter(Boolean)
            .filter((bundle) => statusFilter === "all" || bundle.subscription.status === statusFilter);
        const lines = bundles.slice(0, 12).flatMap((bundle, index) => {
            return [
                `${index + 1}. ${STATUS_EMOJIS[bundle.subscription.status] ?? "-"} <@${bundle.subscription.commercialOwnerDiscordUserId ?? bundle.customer?.discordUserId}>`,
                `Status: ${this.getStatusLabel(bundle.subscription.status)} - Produto: ${bundle.product?.name ?? "Produto"}`,
                `Assinatura: \`${bundle.subscription.id}\``,
                bundle.subscription.currentPeriodEnd ? `Vence: ${this.formatIsoDate(bundle.subscription.currentPeriodEnd)}` : "Vencimento: nao iniciado",
                bundle.instance?.hostingAppId ? `SquareCloud App: ${bundle.instance.hostingAppId}` : "Sem app provisionada ainda",
                "",
            ];
        });
        const total = bundles.length;
        return new discord_js_1.EmbedBuilder()
            .setColor(0x7c3aed)
            .setTitle(`Assinantes | ${statusFilter === "all" ? "todos" : this.getStatusLabel(statusFilter)}`)
            .setDescription(this.limitMessageSize(total === 0
            ? "Nenhum assinante encontrado para esse filtro."
            : [`Total encontrado: ${total}`, "", ...lines].join("\n")));
    }
    buildPendingPaymentsEmbed() {
        const pendingPayments = this.dependencies.store.payments
            .filter((payment) => payment.status === "pending")
            .slice(-10)
            .reverse();
        const lines = pendingPayments.flatMap((payment, index) => {
            const bundle = this.dependencies.subscriptionService.getById(payment.subscriptionId);
            return [
                `${index + 1}. ${bundle?.subscription?.commercialOwnerDiscordUserId ? `<@${bundle.subscription.commercialOwnerDiscordUserId}>` : bundle?.customer?.discordUserId ? `<@${bundle.customer.discordUserId}>` : "Cliente"} - ${bundle?.product?.name ?? "Produto"}`,
                `Payment ID: \`${payment.id}\``,
                `Subscription ID: \`${payment.subscriptionId}\``,
                `Valor: ${this.formatCurrency(payment.amountCents)}`,
                `Provider: ${payment.provider}`,
                "",
            ];
        });
        return new discord_js_1.EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle("Pagamentos pendentes")
            .setDescription(this.limitMessageSize(lines.join("\n").trim() || "Nao ha pagamentos pendentes agora."));
    }
    buildProductConfigurationEmbed(productSlug) {
        const product = this.dependencies.catalogService.listProducts().find((item) => item.slug === productSlug);
        if (!product) {
            return new discord_js_1.EmbedBuilder()
                .setColor(0xdc2626)
                .setTitle("Produto nao encontrado")
                .setDescription("Nao encontrei esse produto no catalogo do manager.");
        }
        const runtimeSource = this.dependencies.managerRuntimeConfigService.getRuntimeSourceConfig(product.sourceSlug);
        const artifactResolution = this.dependencies.sourceArtifactService?.resolveArtifact?.(product.sourceSlug) ?? null;
        const sourceMode = runtimeSource?.githubRepo
            ? "github_repo"
            : runtimeSource?.artifactPath
                ? "artifact_path"
                : runtimeSource?.projectDir
                    ? "project_dir"
                    : artifactResolution?.mode ?? "nao configurada";
        const sourceLocation = runtimeSource?.artifactPath ??
            runtimeSource?.projectDir ??
            runtimeSource?.githubRepo ??
            artifactResolution?.sourcePath ??
            "nao configurada";
        const readinessLabel = artifactResolution?.error ? "pendente" : "ok";
        const panelConfig = product.panelConfig ?? {};
        return new discord_js_1.EmbedBuilder()
            .setColor(this.resolveProductPanelColor(product, 0x2563eb))
            .setTitle(`Produto | ${product.name}`)
            .setDescription(this.limitMessageSize(product.description || "Sem descricao cadastrada."))
            .addFields({
            name: "Resumo",
            value: [
                `Slug: \`${product.slug}\``,
                `Source slug: \`${product.sourceSlug}\``,
                `Provisionamento: ${product.botProvisioningMode}`,
                `Tutorial: ${product.tutorialUrl ?? "nao definido"}`,
                `Preview: ${panelConfig.previewUrl ?? "nao definido"}`,
                `Canal publicado: ${panelConfig.publishedChannelId ? `<#${panelConfig.publishedChannelId}>` : "nao publicado"}`,
                `Cargo do produto: ${product.customerRoleId ? `<@&${product.customerRoleId}>` : "nao definido"}`,
                `Pronto para venda: ${readinessLabel}`,
            ].join("\n").slice(0, 1024),
            inline: false,
        }, {
            name: "Source Atual",
            value: [
                `Tipo: ${sourceMode}`,
                `Origem: ${sourceLocation}`,
                runtimeSource?.githubRef ? `Ref: ${runtimeSource.githubRef}` : null,
                runtimeSource?.githubPath ? `Subpasta: ${runtimeSource.githubPath}` : null,
                runtimeSource?.githubRepo ? `Repo privado: ${runtimeSource.githubToken ? "sim" : "nao"}` : null,
                Array.isArray(runtimeSource?.excludePaths) && runtimeSource.excludePaths.length > 0
                    ? `Excluir: ${runtimeSource.excludePaths.join(", ")}`
                    : null,
                artifactResolution?.warning ? `Aviso: ${artifactResolution.warning}` : null,
                artifactResolution?.error ? `Erro: ${artifactResolution.error}` : null,
            ].filter(Boolean).join("\n").slice(0, 1024),
            inline: false,
        }, {
            name: "Planos",
            value: product.plans
                .map((plan) => `- ${plan.name}: ${this.formatCurrency(plan.priceCents, plan.currency)}`)
                .join("\n")
                .slice(0, 1024) || "Nenhum plano configurado",
            inline: false,
        }, {
            name: "Visual do Painel",
            value: [
                `Titulo: ${panelConfig.title ?? "padrao do produto"}`,
                `Resumo: ${panelConfig.summary ? "configurado" : "padrao"}`,
                `Detalhes: ${panelConfig.details ? "configurados" : "padrao"}`,
                `Imagem: ${panelConfig.imageUrl ? "configurada" : "nao definida"}`,
                `Cor: ${panelConfig.embedColor ?? "padrao do manager"}`,
                `Preview: ${panelConfig.previewUrl ? "configurado" : "nao definido"}`,
                `Mensagem publicada: ${panelConfig.publishedMessageId ? "sincronizada" : "nao publicada"}`,
                `Texto do preco: ${panelConfig.pricePrefix ?? "Planos a partir de"}`,
                `Botao: ${panelConfig.buttonLabel ?? "Adicionar ao Carrinho"}`,
                `Embed aprovada: ${panelConfig.approvedTitle || panelConfig.approvedDescription || panelConfig.approvedImageUrl || panelConfig.approvedEmbedColor ? "personalizada" : "padrao"}`,
                `Imagem aprovada: ${panelConfig.approvedImageUrl ? "configurada" : "nao definida"}`,
            ].join("\n").slice(0, 1024),
            inline: false,
        });
    }
    buildProductVisualModal(productSlug) {
        const product = this.getResolvedProductBySlug(productSlug);
        if (!product) {
            throw new Error("Produto nao encontrado.");
        }
        const panelConfig = product.panelConfig ?? {};
        const titleInput = new discord_js_1.TextInputBuilder()
            .setCustomId("panel_title")
            .setLabel("Titulo do painel")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setValue(String(panelConfig.title ?? product.name ?? "").slice(0, 100));
        const summaryInput = new discord_js_1.TextInputBuilder()
            .setCustomId("panel_summary")
            .setLabel("Resumo principal")
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(false)
            .setValue(String(panelConfig.summary ?? product.description ?? "").slice(0, 4000));
        const detailsInput = new discord_js_1.TextInputBuilder()
            .setCustomId("panel_details")
            .setLabel("Detalhes e destaques")
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder("Use varias linhas para descrever vantagens, detalhes e avisos.")
            .setValue(String(panelConfig.details ?? "").slice(0, 4000));
        const colorInput = new discord_js_1.TextInputBuilder()
            .setCustomId("panel_embed_color")
            .setLabel("Cor da embed/painel")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("Ex: #5865F2")
            .setValue(String(panelConfig.embedColor ?? "").slice(0, 16));
        const priceInput = new discord_js_1.TextInputBuilder()
            .setCustomId("panel_price_prefix")
            .setLabel("Texto acima do preco")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setValue(String(panelConfig.pricePrefix ?? "Planos a partir de").slice(0, 100));
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.productVisualPrefix}${productSlug}`)
            .setTitle(`Visual | ${product.name}`.slice(0, 45))
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(titleInput), new discord_js_1.ActionRowBuilder().addComponents(summaryInput), new discord_js_1.ActionRowBuilder().addComponents(detailsInput), new discord_js_1.ActionRowBuilder().addComponents(colorInput), new discord_js_1.ActionRowBuilder().addComponents(priceInput));
    }
    buildProductApprovedModal(productSlug) {
        const product = this.getResolvedProductBySlug(productSlug);
        if (!product) {
            throw new Error("Produto nao encontrado.");
        }
        const panelConfig = product.panelConfig ?? {};
        const titleInput = new discord_js_1.TextInputBuilder()
            .setCustomId("approved_title")
            .setLabel("Titulo da embed aprovada")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("Ex: Pagamento aprovado")
            .setValue(String(panelConfig.approvedTitle ?? "").slice(0, 100));
        const descriptionInput = new discord_js_1.TextInputBuilder()
            .setCustomId("approved_description")
            .setLabel("Descricao da embed aprovada")
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder("Use {mention}, {product_name}, {plan_name}, {amount}, {config_channel}, {setup_hint}")
            .setValue(String(panelConfig.approvedDescription ?? "").slice(0, 4000));
        const imageInput = new discord_js_1.TextInputBuilder()
            .setCustomId("approved_image_url")
            .setLabel("Imagem da embed aprovada (URL)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("https://...")
            .setMaxLength(1000)
            .setValue(String(panelConfig.approvedImageUrl ?? "").slice(0, 1000));
        const colorInput = new discord_js_1.TextInputBuilder()
            .setCustomId("approved_embed_color")
            .setLabel("Cor da embed aprovada")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("Ex: #22C55E")
            .setValue(String(panelConfig.approvedEmbedColor ?? "").slice(0, 16));
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.productApprovedPrefix}${productSlug}`)
            .setTitle(`Aprovado | ${product.name}`.slice(0, 45))
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(titleInput), new discord_js_1.ActionRowBuilder().addComponents(descriptionInput), new discord_js_1.ActionRowBuilder().addComponents(imageInput), new discord_js_1.ActionRowBuilder().addComponents(colorInput));
    }
    buildPermissionsEmbed(access) {
        const resolved = access ?? this.dependencies.managerRuntimeConfigService.getResolvedAccessControl();
        const runtimeAdminUserIds = resolved.sources?.runtimeAdminUserIds ?? [];
        const ownerUserIds = this.applicationOwnerUserIds ?? [];
        return new discord_js_1.EmbedBuilder()
            .setColor(0x0891b2)
            .setTitle("Permissoes Internas do Manager")
            .setDescription("O dono da aplicacao do bot sempre possui acesso total. Os usuarios adicionados aqui tambem passam a ter controle total do manager.")
            .addFields({
            name: "Dono(s) da aplicacao",
            value: ownerUserIds.length > 0 ? ownerUserIds.map((id) => `<@${id}>`).join(", ").slice(0, 1024) : "Nao identificado ainda",
            inline: false,
        }, {
            name: "Usuarios com permissao",
            value: runtimeAdminUserIds.length > 0 ? runtimeAdminUserIds.map((id) => `<@${id}>`).join(", ").slice(0, 1024) : "nenhum",
            inline: false,
        });
    }
    buildEfipayConfigModal() {
        const snapshot = this.dependencies.managerRuntimeConfigService.getAdminSnapshot();
        const efipay = snapshot.billing.efipay;
        const clientIdInput = new discord_js_1.TextInputBuilder()
            .setCustomId("efi_client_id")
            .setLabel("Client ID")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder(String(efipay.previews.clientId ?? "Deixe vazio para manter o atual").slice(0, 100));
        const clientSecretInput = new discord_js_1.TextInputBuilder()
            .setCustomId("efi_client_secret")
            .setLabel("Client Secret")
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder("Deixe vazio para manter o atual");
        const pixKeyInput = new discord_js_1.TextInputBuilder()
            .setCustomId("efi_pix_key")
            .setLabel("Chave Pix")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder(String(efipay.previews.pixKey ?? "Deixe vazio para manter a atual").slice(0, 100));
        const appBaseUrlInput = new discord_js_1.TextInputBuilder()
            .setCustomId("efi_app_base_url")
            .setLabel("APP_BASE_URL publica")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setValue(String(snapshot.appBaseUrl ?? "").slice(0, 100));
        const webhookPathInput = new discord_js_1.TextInputBuilder()
            .setCustomId("efi_webhook_path")
            .setLabel("Webhook path")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setValue(String(efipay.values.webhookPath ?? "/webhooks/efipay").slice(0, 100));
        return new discord_js_1.ModalBuilder()
            .setCustomId(MODAL_IDS.efipayConfig)
            .setTitle("Configurar Efi do Manager")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(clientIdInput), new discord_js_1.ActionRowBuilder().addComponents(clientSecretInput), new discord_js_1.ActionRowBuilder().addComponents(pixKeyInput), new discord_js_1.ActionRowBuilder().addComponents(appBaseUrlInput), new discord_js_1.ActionRowBuilder().addComponents(webhookPathInput));
    }
    buildEfipayUploadModal() {
        const certP12PassphraseInput = new discord_js_1.TextInputBuilder()
            .setCustomId("efi_cert_p12_passphrase")
            .setLabel("Senha do .p12 (opcional)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(200)
            .setPlaceholder("Preencha apenas se o certificado exigir senha");
        const certP12UploadLabel = new discord_js_1.LabelBuilder()
            .setLabel("Certificado .p12")
            .setDescription("Envie o .p12 da conta Efi (ate 10MB)")
            .setFileUploadComponent((builder) => builder
            .setCustomId("efi_cert_p12_upload")
            .setRequired(true)
            .setMaxValues(1));
        return new discord_js_1.ModalBuilder()
            .setCustomId(MODAL_IDS.efipayUpload)
            .setTitle("Efi - Certificado")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(certP12PassphraseInput), certP12UploadLabel);
    }
    buildSalesTemplateModal() {
        const sales = this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings();
        const templateInput = new discord_js_1.TextInputBuilder()
            .setCustomId("sales_cart_channel_template")
            .setLabel("Template do canal do carrinho")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Ex: 🛒・{guild}")
            .setValue(String(sales.cartChannelNameTemplate ?? "🛒・{guild}").slice(0, 100));
        return new discord_js_1.ModalBuilder()
            .setCustomId(MODAL_IDS.salesTemplate)
            .setTitle("Nome do Canal do Carrinho")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(templateInput));
    }
    buildSalesInactivityModal() {
        const sales = this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings();
        const inactivityInput = new discord_js_1.TextInputBuilder()
            .setCustomId("sales_cart_inactivity_minutes")
            .setLabel("Minutos sem atividade")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Maximo: 5")
            .setValue(String(Math.min(5, Math.max(1, Number(sales.cartInactivityMinutes ?? 5)))).slice(0, 10));
        return new discord_js_1.ModalBuilder()
            .setCustomId(MODAL_IDS.salesInactivity)
            .setTitle("Expiracao do Carrinho")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(inactivityInput));
    }
    buildCreateProductModal() {
        const slugInput = new discord_js_1.TextInputBuilder()
            .setCustomId("product_slug")
            .setLabel("Slug do produto")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Ex: bot-ticket-hype");
        const nameInput = new discord_js_1.TextInputBuilder()
            .setCustomId("product_name")
            .setLabel("Nome do produto")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Ex: Bot Ticket Hype");
        const descriptionInput = new discord_js_1.TextInputBuilder()
            .setCustomId("product_description")
            .setLabel("Descricao curta")
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder("Resumo que aparecera no painel de vendas");
        return new discord_js_1.ModalBuilder()
            .setCustomId(MODAL_IDS.productCreate)
            .setTitle("Criar Produto")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(slugInput), new discord_js_1.ActionRowBuilder().addComponents(nameInput), new discord_js_1.ActionRowBuilder().addComponents(descriptionInput));
    }
    buildProductBasicsModal(productSlug) {
        const product = this.dependencies.catalogService.getProductBySlug(productSlug);
        if (!product) {
            throw new Error("Produto nao encontrado.");
        }
        const panelConfig = product.panelConfig ?? {};
        const nameInput = new discord_js_1.TextInputBuilder()
            .setCustomId("product_name")
            .setLabel("Nome do produto")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setValue(String(product.name ?? "").slice(0, 100));
        const descriptionInput = new discord_js_1.TextInputBuilder()
            .setCustomId("product_description")
            .setLabel("Descricao")
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(false)
            .setValue(String(product.description ?? "").slice(0, 4000));
        const tutorialInput = new discord_js_1.TextInputBuilder()
            .setCustomId("product_tutorial_url")
            .setLabel("Tutorial URL")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(1000)
            .setValue(String(product.tutorialUrl ?? "").slice(0, 1000));
        const previewInput = new discord_js_1.TextInputBuilder()
            .setCustomId("panel_preview_url")
            .setLabel("Preview URL")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("https://youtu.be/...")
            .setMaxLength(1000)
            .setValue(String(panelConfig.previewUrl ?? "").slice(0, 1000));
        const imageInput = new discord_js_1.TextInputBuilder()
            .setCustomId("panel_image_url")
            .setLabel("Imagem do painel (URL)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("https://...")
            .setMaxLength(1000)
            .setValue(String(panelConfig.imageUrl ?? "").slice(0, 1000));
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.productBasicPrefix}${productSlug}`)
            .setTitle(`Configurar | ${product.name}`.slice(0, 45))
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(nameInput), new discord_js_1.ActionRowBuilder().addComponents(descriptionInput), new discord_js_1.ActionRowBuilder().addComponents(tutorialInput), new discord_js_1.ActionRowBuilder().addComponents(previewInput), new discord_js_1.ActionRowBuilder().addComponents(imageInput));
    }
    buildProductSourceModal(productSlug) {
        const product = this.dependencies.catalogService.getProductBySlug(productSlug);
        if (!product) {
            throw new Error("Produto nao encontrado.");
        }
        const runtimeSource = this.dependencies.managerRuntimeConfigService.getRuntimeSourceConfig(product.sourceSlug) ?? {};
        const sourceSlugInput = new discord_js_1.TextInputBuilder()
            .setCustomId("source_slug")
            .setLabel("Source slug")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setValue(String(product.sourceSlug ?? product.slug).slice(0, 100));
        const sourceRepoInput = new discord_js_1.TextInputBuilder()
            .setCustomId("source_repo")
            .setLabel("Repo GitHub")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("owner/repo ou URL")
            .setValue(String(runtimeSource.githubRepo ?? "").slice(0, 100));
        const sourceRefInput = new discord_js_1.TextInputBuilder()
            .setCustomId("source_ref")
            .setLabel("Branch ou ref")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setValue(String(runtimeSource.githubRef ?? "main").slice(0, 100));
        const sourcePathInput = new discord_js_1.TextInputBuilder()
            .setCustomId("source_path")
            .setLabel("Subpasta (opcional)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setValue(String(runtimeSource.githubPath ?? "").slice(0, 100));
        const sourceExcludeInput = new discord_js_1.TextInputBuilder()
            .setCustomId("source_exclude")
            .setLabel("Excluir do zip")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("data, logs, transcripts")
            .setValue(String(Array.isArray(runtimeSource.excludePaths) ? runtimeSource.excludePaths.join(", ") : "").slice(0, 100));
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.productSourcePrefix}${productSlug}`)
            .setTitle(`Source | ${product.name}`.slice(0, 45))
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(sourceSlugInput), new discord_js_1.ActionRowBuilder().addComponents(sourceRepoInput), new discord_js_1.ActionRowBuilder().addComponents(sourceRefInput), new discord_js_1.ActionRowBuilder().addComponents(sourcePathInput), new discord_js_1.ActionRowBuilder().addComponents(sourceExcludeInput));
    }
    buildProductPlansModal(productSlug) {
        const product = this.dependencies.catalogService.listProducts().find((item) => item.slug === productSlug);
        if (!product) {
            throw new Error("Produto nao encontrado.");
        }
        const getPlanValue = (code) => this.formatCurrencyInput(product.plans.find((plan) => plan.code === code)?.priceCents ?? "");
        const weeklyInput = new discord_js_1.TextInputBuilder()
            .setCustomId("plan_weekly")
            .setLabel("Semanal (R$)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("Ex: 5,10")
            .setValue(getPlanValue("weekly").slice(0, 100));
        const monthlyInput = new discord_js_1.TextInputBuilder()
            .setCustomId("plan_monthly")
            .setLabel("Mensal (R$)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("Ex: 10,15")
            .setValue(getPlanValue("monthly").slice(0, 100));
        const quarterlyInput = new discord_js_1.TextInputBuilder()
            .setCustomId("plan_quarterly")
            .setLabel("Trimestral (R$)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("Ex: 29,84")
            .setValue(getPlanValue("quarterly").slice(0, 100));
        const semiannualInput = new discord_js_1.TextInputBuilder()
            .setCustomId("plan_semiannual")
            .setLabel("Semestral (R$)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("Ex: 59,07")
            .setValue(getPlanValue("semiannual").slice(0, 100));
        const annualInput = new discord_js_1.TextInputBuilder()
            .setCustomId("plan_annual")
            .setLabel("Anual (R$)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setPlaceholder("Ex: 115,71")
            .setValue(getPlanValue("annual").slice(0, 100));
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.productPlansPrefix}${productSlug}`)
            .setTitle(`Planos | ${product.name}`.slice(0, 45))
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(weeklyInput), new discord_js_1.ActionRowBuilder().addComponents(monthlyInput), new discord_js_1.ActionRowBuilder().addComponents(quarterlyInput), new discord_js_1.ActionRowBuilder().addComponents(semiannualInput), new discord_js_1.ActionRowBuilder().addComponents(annualInput));
    }
    buildBotSetupModal(paymentId, bundle, payment = null) {
        const addonCodes = Array.isArray(payment?.metadata?.addonCodes)
            ? payment.metadata.addonCodes.map((code) => String(code ?? "").trim()).filter(Boolean)
            : [];
        const hasCustomBioAddon = addonCodes.includes("custom-bio");
        const applicationNameInput = new discord_js_1.TextInputBuilder()
            .setCustomId("setup_application_name")
            .setLabel("Nome do bot/aplicação")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("Digite o nome final do bot/aplicação");
        const botTokenInput = new discord_js_1.TextInputBuilder()
            .setCustomId("setup_bot_token")
            .setLabel("Token do bot do cliente")
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setRequired(true);
        const ownerDiscordUserIdInput = new discord_js_1.TextInputBuilder()
            .setCustomId("setup_owner_discord_user_id")
            .setLabel("Owner Discord User ID (opcional)")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(false)
            .setValue(String(bundle.subscription.commercialOwnerDiscordUserId ?? "").slice(0, 32));
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.botSetupPrefix}${paymentId}`)
            .setTitle("Configurar Bot Comprado")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(applicationNameInput), new discord_js_1.ActionRowBuilder().addComponents(botTokenInput), new discord_js_1.ActionRowBuilder().addComponents(ownerDiscordUserIdInput));
        if (hasCustomBioAddon) {
            const customBioInput = new discord_js_1.TextInputBuilder()
                .setCustomId("setup_custom_bio_text")
                .setLabel("Bio personalizada do bot")
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setRequired(true)
                .setPlaceholder("Ex: Tickets automáticos, loja integrada, suporte 24/7...");
            modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(customBioInput));
        }
        return modal;
    }
    buildPixCheckoutResponse(input) {
        const { checkout, payment } = input.checkout;
        const checkoutOwnerId = String(input.user?.id ?? payment?.metadata?.customerDiscordUserId ?? this.getPaymentOwnerDiscordUserId(input.checkout) ?? "").trim() || null;
        const addons = Array.isArray(input.addons)
            ? input.addons.filter((addon) => addon && typeof addon === "object")
            : (Array.isArray(checkout?.metadata?.addons)
                ? checkout.metadata.addons.filter((addon) => addon && typeof addon === "object")
                : []);
        const addonLines = addons.length > 0
            ? [
                "```diff",
                ...addons.map((addon) => `+ ${addon.name}${Number(addon.priceCents ?? 0) > 0 ? `  +${this.formatCurrency(addon.priceCents, addon.currency ?? "BRL").replace(/\s+/gu, "")}` : ""}`),
                "```",
            ].join("\n").slice(0, 1024)
            : null;
        const pixCode = String(checkout.pixCode ?? "").trim();
        const hasQrCode = Boolean(String(checkout.qrCodeImage ?? "").trim() || pixCode);
        const planDurationDays = Math.max(0, Number(input.durationDays ?? 0) || 0);
        const productSummary = [
            String(input.productName ?? "").trim(),
            String(input.planName ?? "").trim(),
        ].filter(Boolean).join(" ").trim() || "Produto";
        const productLine = planDurationDays > 0
            ? `${productSummary} - (${planDurationDays} Dias)`
            : productSummary;
        const expiresAt = checkout.expiresAt
            ? `${this.formatDiscordFullTimestamp(checkout.expiresAt)}\n(${this.formatRelativeTimestamp(checkout.expiresAt)})`
            : "Não informado";
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle("MANAGER | Sistema de pagamento")
            .setDescription(this.limitMessageSize([
            "```css",
            "Pague com pix para receber o bot.",
            "```",
        ].join("\n")))
            .addFields({
            name: "🌍 | Produto:",
            value: productLine,
            inline: false,
        }, {
            name: "💵 | Valor:",
            value: this.formatCurrency(checkout.totalAmountCents).replace(/\s+/gu, ""),
            inline: false,
        }, {
            name: "🕒 | Pagamento expira em:",
            value: expiresAt,
            inline: false,
        }, {
            name: "🤖 | Entrega:",
            value: "Após efetuar o pagamento, o tempo de entrega é de no máximo 1 minuto!",
            inline: false,
        });
        this.applyUserEmbedIdentity(embed, input.user ?? checkoutOwnerId);
        if (addonLines) {
            embed.addFields({
                name: "✨ | Adicionais:",
                value: addonLines,
                inline: false,
            });
        }
        const components = [];
        const actionButtons = [];
        if (pixCode) {
            actionButtons.push(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.pixCopyPrefix}${payment.id}`)
                .setLabel("Pix Copia e Cola")
                .setEmoji("\uD83D\uDC8E")
                .setStyle(discord_js_1.ButtonStyle.Primary));
        }
        if (hasQrCode) {
            actionButtons.push(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.pixQrPrefix}${payment.id}`)
                .setLabel("Qr Code")
                .setEmoji("\uD83D\uDCCE")
                .setStyle(discord_js_1.ButtonStyle.Primary));
        }
        if (String(payment.status ?? "").toLowerCase() === "pending") {
            actionButtons.push(new discord_js_1.ButtonBuilder()
                .setCustomId(`${CUSTOM_IDS.pixCancelPrefix}${payment.id}`)
                .setEmoji("\u274C")
                .setStyle(discord_js_1.ButtonStyle.Danger));
        }
        if (actionButtons.length > 0) {
            components.push(new discord_js_1.ActionRowBuilder().addComponents(...actionButtons));
        }
        return {
            content: this.buildUserMention(input.user ?? checkoutOwnerId),
            allowedMentions: this.buildSilentAllowedMentions(input.user ?? checkoutOwnerId),
            embeds: [embed],
            components,
            files: [],
        };
    }
    buildPixQrCodeImageUrl(pixCopyPaste) {
        const pixCode = String(pixCopyPaste ?? "").trim();
        if (!pixCode) {
            return "";
        }
        const params = new URLSearchParams({
            text: pixCode,
            size: "620",
            format: "png",
            ecLevel: "H",
            margin: "2",
            dark: "2563eb",
            light: "f8fbff",
        });
        return `https://quickchart.io/qr?${params.toString()}`;
    }
    getPaymentOwnerDiscordUserId(bundle) {
        const subscriptionOwnerId = String(bundle?.subscription?.subscription?.commercialOwnerDiscordUserId ?? "").trim();
        if (subscriptionOwnerId) {
            return subscriptionOwnerId;
        }
        const customerId = String(bundle?.subscription?.customer?.discordUserId ?? bundle?.payment?.metadata?.customerDiscordUserId ?? "").trim();
        return customerId || null;
    }
    canManagePaymentBundle(userId, bundle) {
        const normalizedUserId = String(userId ?? "").trim();
        if (!normalizedUserId || !bundle?.payment) {
            return false;
        }
        if (this.hasAdminAccess({ user: { id: normalizedUserId } })) {
            return true;
        }
        if (bundle?.subscription?.subscription) {
            return this.canManageSubscription(normalizedUserId, bundle.subscription.subscription);
        }
        return this.getPaymentOwnerDiscordUserId(bundle) === normalizedUserId;
    }
    buildConfigChannelUrl(guildId) {
        const normalizedGuildId = String(guildId ?? "").trim();
        if (!normalizedGuildId || !PURCHASE_CONFIG_CHANNEL_ID) {
            return "";
        }
        return `https://discord.com/channels/${normalizedGuildId}/${PURCHASE_CONFIG_CHANNEL_ID}`;
    }
    getPurchaseConfigChannelMention() {
        return PURCHASE_CONFIG_CHANNEL_ID ? `<#${PURCHASE_CONFIG_CHANNEL_ID}>` : "`/apps`";
    }
    buildApprovedPaymentSetupHint(bundle) {
        const hasCustomBioAddon = Array.isArray(bundle?.payment?.metadata?.addonCodes) &&
            bundle.payment.metadata.addonCodes.includes("custom-bio");
        const configTarget = this.getPurchaseConfigChannelMention();
        return hasCustomBioAddon
            ? `Va para ${configTarget} e use \`/apps\` > configurar bot. A opcao de bio personalizada foi liberada para voce informar o texto do bot.`
            : `Va para ${configTarget} e use \`/apps\` > configurar bot para gerenciar sua aplicacao.`;
    }
    buildApprovedPaymentTemplateContext(bundle) {
        const productName = bundle?.subscription?.product?.name || String(bundle?.payment?.metadata?.productSlug ?? "").trim() || "Produto";
        const planName = bundle?.subscription?.plan?.name || String(bundle?.payment?.metadata?.planCode ?? "").trim() || "Plano";
        const ownerUserId = this.getPaymentOwnerDiscordUserId(bundle);
        return {
            ownerUserId,
            productName,
            planName,
            amount: this.formatCurrency(bundle?.payment?.amountCents ?? 0),
            configChannel: this.getPurchaseConfigChannelMention(),
            setupHint: this.buildApprovedPaymentSetupHint(bundle),
        };
    }
    resolveApprovedPaymentTemplate(template, context, fallback) {
        const rawTemplate = String(template ?? "").trim() || String(fallback ?? "").trim();
        return rawTemplate
            .replace(/\{(?:mention|mencao)\}/giu, context.ownerUserId ? `<@${context.ownerUserId}>` : "")
            .replace(/\{(?:product|product_name|produto|nome_produto)\}/giu, context.productName)
            .replace(/\{(?:plan|plan_name|plano|nome_plano)\}/giu, context.planName)
            .replace(/\{(?:amount|valor)\}/giu, context.amount)
            .replace(/\{(?:config_channel|canal_config)\}/giu, context.configChannel)
            .replace(/\{(?:setup_hint|dica_setup)\}/giu, context.setupHint)
            .replace(/\{(?:apps_command|comando_apps)\}/giu, "`/apps`")
            .replace(/\n{3,}/gu, "\n\n")
            .trim();
    }
    buildApprovedPixCheckoutPayload(bundle, guildId = null) {
        const templateContext = this.buildApprovedPaymentTemplateContext(bundle);
        const { productName, planName, ownerUserId } = templateContext;
        const panelConfig = bundle?.product?.panelConfig ?? bundle?.subscription?.product?.panelConfig ?? {};
        const configChannelMention = this.getPurchaseConfigChannelMention();
        const addons = Array.isArray(bundle?.payment?.metadata?.addons) ? bundle.payment.metadata.addons : [];
        const addonLines = addons.length > 0
            ? addons.map((addon) => `- ${addon.name}${Number(addon.priceCents ?? 0) > 0 ? ` (${this.formatCurrency(addon.priceCents)})` : ""}`).join("\n").slice(0, 1024)
            : null;
        const defaultDescription = [
            "Seu pagamento foi aprovado com sucesso.",
            `Va agora para ${configChannelMention} e use \`/apps\` para gerenciar a aplicacao comprada.`,
            "Todas as configuracoes do aplicativo comprado sao feitas por esse comando.",
            templateContext.setupHint,
        ].filter(Boolean).join("\n");
        const approvedTitle = this.resolveApprovedPaymentTemplate(panelConfig.approvedTitle, templateContext, "Pagamento aprovado");
        const approvedDescription = this.resolveApprovedPaymentTemplate(panelConfig.approvedDescription, templateContext, defaultDescription);
        const approvedImageUrl = String(panelConfig.approvedImageUrl ?? "").trim();
        const approvedEmbedColor = normalizeHexColor(panelConfig.approvedEmbedColor ?? panelConfig.embedColor);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(approvedEmbedColor ? Number.parseInt(approvedEmbedColor.slice(1), 16) : 0x22c55e)
            .setTitle(String(approvedTitle || "Pagamento aprovado").slice(0, 256))
            .setDescription(this.limitMessageSize(approvedDescription))
            .addFields({
            name: "Produto",
            value: `**${productName}**`,
            inline: true,
        }, {
            name: "Plano",
            value: `**${planName}**`,
            inline: true,
        }, {
            name: "Valor aprovado",
            value: `**${this.formatCurrency(bundle?.payment?.amountCents ?? 0)}**`,
            inline: true,
        }, {
            name: "Onde configurar",
            value: PURCHASE_CONFIG_CHANNEL_ID ? `${configChannelMention} com \`/apps\`` : "`/apps`",
            inline: false,
        });
        if (addonLines) {
            embed.addFields({
                name: "Adicionais liberados",
                value: addonLines,
                inline: false,
            });
        }
        this.applyUserEmbedIdentity(embed, ownerUserId);
        if (isLikelyHttpUrl(approvedImageUrl)) {
            embed.setImage(approvedImageUrl);
        }
        const configChannelUrl = this.buildConfigChannelUrl(guildId);
        const components = configChannelUrl
            ? [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setStyle(discord_js_1.ButtonStyle.Link)
                    .setLabel("Ir para configuracao")
                    .setEmoji("\u2699\uFE0F")
                    .setURL(configChannelUrl)),
            ]
            : [];
        return {
            content: this.buildUserMention(ownerUserId),
            allowedMentions: this.buildSilentAllowedMentions(ownerUserId),
            embeds: [embed],
            components,
            attachments: [],
            files: [],
        };
    }
    buildCancelledPixCheckoutPayload(bundle) {
        const productName = bundle?.subscription?.product?.name || String(bundle?.payment?.metadata?.productSlug ?? "").trim() || "Produto";
        const planName = bundle?.subscription?.plan?.name || String(bundle?.payment?.metadata?.planCode ?? "").trim() || "Plano";
        const ownerUserId = this.getPaymentOwnerDiscordUserId(bundle);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xef4444)
            .setTitle("Compra cancelada")
            .setDescription(this.limitMessageSize([
            "Esse Pix foi cancelado antes da aprovação.",
            "Se quiser comprar novamente, abra o painel do produto e gere um novo checkout.",
        ].join("\n")))
            .addFields({
            name: "Produto",
            value: `**${productName}**`,
            inline: true,
        }, {
            name: "Plano",
            value: `**${planName}**`,
            inline: true,
        }, {
            name: "Valor",
            value: `**${this.formatCurrency(bundle?.payment?.amountCents ?? 0)}**`,
            inline: true,
        });
        this.applyUserEmbedIdentity(embed, ownerUserId);
        return {
            content: this.buildUserMention(ownerUserId),
            allowedMentions: this.buildSilentAllowedMentions(ownerUserId),
            embeds: [embed],
            components: [],
            attachments: [],
            files: [],
        };
    }
    buildPixQrMessagePayload(bundle) {
        const ownerUserId = this.getPaymentOwnerDiscordUserId(bundle);
        const pixCode = String(bundle?.checkout?.pixCode ?? "").trim();
        const rawQrImageValue = String(bundle?.checkout?.qrCodeImage ?? "").trim();
        const qrImageAttachment = buildImageAttachmentFromDataUri(rawQrImageValue, `pix-${bundle?.payment?.id ?? "checkout"}`);
        const qrImageUrl = qrImageAttachment
            ? ""
            : rawQrImageValue || this.buildPixQrCodeImageUrl(pixCode);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle("QR CODE GERADO COM SUCESSO:");
        this.applyUserEmbedIdentity(embed, ownerUserId);
        if (qrImageAttachment) {
            embed.setImage(`attachment://${qrImageAttachment.name}`);
        }
        else if (isLikelyHttpUrl(qrImageUrl)) {
            embed.setImage(qrImageUrl);
        }
        return {
            content: this.buildUserMention(ownerUserId),
            allowedMentions: this.buildSilentAllowedMentions(ownerUserId),
            embeds: [embed],
            files: qrImageAttachment ? [qrImageAttachment] : [],
        };
    }
    async handlePixCopyButton(interaction) {
        const paymentId = String(interaction.customId.slice(CUSTOM_IDS.pixCopyPrefix.length) ?? "").trim();
        const bundle = this.dependencies.billingService.getPaymentById(paymentId);
        if (!bundle?.payment || !bundle?.checkout) {
            await this.replyEphemeral(interaction, "Esse checkout Pix nao esta mais disponivel.");
            return;
        }
        if (!this.canManagePaymentBundle(interaction.user.id, bundle)) {
            await this.replyEphemeral(interaction, "Apenas o dono da compra pode copiar esse codigo Pix.");
            return;
        }
        if (String(bundle.payment.status ?? "").toLowerCase() !== "pending") {
            await this.replyEphemeral(interaction, "Esse Pix nao esta mais pendente. Gere um novo pagamento se necessario.");
            return;
        }
        const pixCode = String(bundle.checkout.pixCode ?? "").trim();
        if (!pixCode) {
            await this.replyEphemeral(interaction, "A Efi nao retornou o codigo Pix copia e cola para esse checkout.");
            return;
        }
        await this.replyEphemeral(interaction, this.limitMessageSize([
            "Pix Copia e Cola:",
            "```txt",
            pixCode,
            "```",
        ].join("\n")));
    }
    async handlePixQrButton(interaction) {
        const paymentId = String(interaction.customId.slice(CUSTOM_IDS.pixQrPrefix.length) ?? "").trim();
        const bundle = this.dependencies.billingService.getPaymentById(paymentId);
        if (!bundle?.payment || !bundle?.checkout) {
            await this.replyEphemeral(interaction, "Esse checkout Pix nao esta mais disponivel.");
            return;
        }
        if (!this.canManagePaymentBundle(interaction.user.id, bundle)) {
            await this.replyEphemeral(interaction, "Apenas o dono da compra pode abrir esse QR Code.");
            return;
        }
        if (String(bundle.payment.status ?? "").toLowerCase() !== "pending") {
            await this.replyEphemeral(interaction, "Esse Pix nao esta mais pendente. Gere um novo pagamento se necessario.");
            return;
        }
        const hasQrCode = Boolean(String(bundle.checkout.qrCodeImage ?? "").trim() || String(bundle.checkout.pixCode ?? "").trim());
        if (!hasQrCode) {
            await this.replyEphemeral(interaction, "A Efi nao retornou um QR Code para esse checkout.");
            return;
        }
        await interaction.deferUpdate().catch(() => null);
        const channel = interaction.channel;
        if (!channel || typeof channel.send !== "function") {
            await this.safeReply(interaction, "Nao consegui enviar o QR Code nesse canal.");
            return;
        }
        await channel.send(this.buildPixQrMessagePayload(bundle)).catch(async () => {
            await this.safeReply(interaction, "Nao consegui enviar o QR Code agora.");
        });
    }
    async handlePixCancelButton(interaction) {
        const paymentId = String(interaction.customId.slice(CUSTOM_IDS.pixCancelPrefix.length) ?? "").trim();
        const bundle = this.dependencies.billingService.getPaymentById(paymentId);
        if (!bundle?.payment) {
            await this.replyEphemeral(interaction, "Esse checkout Pix nao foi encontrado.");
            return;
        }
        if (!this.canManagePaymentBundle(interaction.user.id, bundle)) {
            await this.replyEphemeral(interaction, "Apenas o dono da compra pode cancelar esse pagamento.");
            return;
        }
        if (String(bundle.payment.status ?? "").toLowerCase() === "approved") {
            await this.replyEphemeral(interaction, "Esse pagamento ja foi aprovado.");
            return;
        }
        if (String(bundle.payment.status ?? "").toLowerCase() !== "pending") {
            await this.replyEphemeral(interaction, "Esse pagamento nao esta mais pendente.");
            return;
        }
        await interaction.deferUpdate().catch(() => null);
        const result = await this.dependencies.billingService.cancelPendingPayment(paymentId, {
            reason: "cancelled_by_customer",
            providerStatus: "cancelled_by_customer",
            cancelledByUserId: interaction.user.id,
        });
        await this.persistStoreIfNeeded();
        const channelId = String(result?.payment?.metadata?.cartChannelId ?? result?.checkout?.metadata?.cartChannelId ?? interaction.channel?.id ?? "").trim() || null;
        if (channelId) {
            this.clearCartRuntimeState(channelId);
        }
        await this.logSalesEvent({
            type: "cart_closed_manual",
            userId: this.getPaymentOwnerDiscordUserId(bundle) ?? interaction.user.id,
            channelId,
            productName: bundle?.subscription?.product?.name || String(bundle?.payment?.metadata?.productSlug ?? "").trim() || "Produto",
            planName: bundle?.subscription?.plan?.name || String(bundle?.payment?.metadata?.planCode ?? "").trim() || "Plano",
            amountCents: Number(bundle?.payment?.amountCents ?? 0),
            currency: bundle?.subscription?.plan?.currency ?? "BRL",
            addons: Array.isArray(bundle?.payment?.metadata?.addons) ? bundle.payment.metadata.addons : [],
            note: "Checkout Pix cancelado pelo cliente antes da aprovacao.",
        });
        const payload = this.buildCancelledPixCheckoutPayload({
            ...bundle,
            payment: result.payment,
            checkout: result.checkout,
            subscription: result.subscription,
        });
        await this.updateCartInteractionMessage(interaction, payload).catch(() => null);
    }
    async handlePaymentApprovedNotification(bundle) {
        if (!this.client || !bundle?.payment) {
            return false;
        }
        const approvedAt = Math.max(1, Date.parse(String(bundle.payment.paidAt ?? "")) || Date.now());
        const ownerUserId = this.getPaymentOwnerDiscordUserId(bundle);
        const tracking = await this.resolveCartTrackingForBundle(bundle);
        const channelId = String(tracking.channelId ?? "").trim() || null;
        const messageId = String(tracking.messageId ?? "").trim() || null;
        if (channelId) {
            this.clearCartRuntimeState(channelId);
        }
        if (!channelId) {
            return false;
        }
        const channel = tracking.channel ?? this.client.channels.cache.get(channelId) ?? (await this.client.channels.fetch(channelId).catch(() => null));
        if (!channel?.isTextBased?.()) {
            return false;
        }
        await this.persistRecoveredCartTracking(bundle, tracking).catch(() => null);
        const payload = this.buildApprovedPixCheckoutPayload(bundle, channel.guildId ?? null);
        if (messageId && channel.messages?.fetch) {
            const message = tracking.message ?? await channel.messages.fetch(messageId).catch(() => null);
            if (message?.editable) {
                await message.edit(payload).catch(() => null);
                await this.cleanupRecentCartQrMessages(channel, ownerUserId).catch(() => null);
                await this.markCartChannelApproved(channel, approvedAt);
                this.scheduleCartApprovedClosure(channel, approvedAt);
                return true;
            }
        }
        await channel.send(payload).catch(() => null);
        await this.cleanupRecentCartQrMessages(channel, ownerUserId).catch(() => null);
        await this.markCartChannelApproved(channel, approvedAt);
        this.scheduleCartApprovedClosure(channel, approvedAt);
        return true;
    }
    async syncApprovedPaymentToCart(paymentId) {
        const bundle = this.dependencies.billingService.getPaymentById(paymentId);
        if (!bundle?.payment || String(bundle.payment.status ?? "").toLowerCase() !== "approved") {
            return false;
        }
        return this.handlePaymentApprovedNotification(bundle);
    }
    async recoverApprovedCartNotifications() {
        const recentApprovedPayments = this.dependencies.store.payments
            .filter((payment) => String(payment?.status ?? "").toLowerCase() === "approved")
            .sort((left, right) => Date.parse(right.paidAt ?? right.createdAt ?? 0) - Date.parse(left.paidAt ?? left.createdAt ?? 0))
            .slice(0, 30);
        let recovered = 0;
        for (const payment of recentApprovedPayments) {
            const synced = await this.syncApprovedPaymentToCart(payment.id).catch(() => false);
            if (synced) {
                recovered += 1;
            }
        }
        if (recovered > 0) {
            this.logger.info({ recovered }, "Carrinhos aprovados recuperados na inicializacao.");
        }
        return recovered;
    }
    extractApplicationOwnerUserIds(application) {
        const ownerIds = new Set();
        const directOwnerId = application?.owner?.id;
        if (directOwnerId) {
            ownerIds.add(String(directOwnerId));
        }
        const teamMembers = application?.team?.members;
        if (teamMembers?.values) {
            for (const member of teamMembers.values()) {
                if (member?.id) {
                    ownerIds.add(String(member.id));
                }
                else if (member?.user?.id) {
                    ownerIds.add(String(member.user.id));
                }
            }
        }
        return [...ownerIds];
    }
    normalizeConfigStringInput(value) {
        if (value === undefined || value === null) {
            return undefined;
        }
        const trimmed = String(value).trim();
        if (!trimmed) {
            return null;
        }
        if (["-", "null", "none", "nenhum", "limpar", "clear"].includes(trimmed.toLowerCase())) {
            return null;
        }
        return trimmed;
    }
    parseCsvConfigList(value) {
        const normalized = this.normalizeConfigStringInput(value);
        if (normalized === undefined) {
            return undefined;
        }
        if (normalized === null) {
            return [];
        }
        return normalized
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }
    normalizeGitHubRepoInput(value) {
        const normalized = this.normalizeConfigStringInput(value);
        if (!normalized) {
            throw new Error("Repositorio GitHub invalido.");
        }
        if (/^https?:\/\//iu.test(normalized)) {
            try {
                const parsed = new URL(normalized);
                const parts = parsed.pathname
                    .replace(/\.git$/iu, "")
                    .split("/")
                    .map((item) => item.trim())
                    .filter(Boolean);
                if (parts.length >= 2) {
                    return `${parts[0]}/${parts[1]}`;
                }
            }
            catch {
            }
        }
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(normalized)) {
            throw new Error("Use o formato `owner/repo` ou a URL do repositorio no GitHub.");
        }
        return normalized;
    }
    findProductBySearch(search) {
        const products = this.dependencies.catalogService.listProducts();
        if (!search) {
            return products[0] ?? null;
        }
        const normalizedSearch = normalizeTextForMatch(search);
        const exact = products.find((product) => normalizeTextForMatch(product.slug) === normalizedSearch ||
            normalizeTextForMatch(product.name) === normalizedSearch);
        if (exact) {
            return exact;
        }
        return (products.find((product) => normalizeTextForMatch(product.slug).includes(normalizedSearch) ||
            normalizeTextForMatch(product.name).includes(normalizedSearch)) ?? null);
    }
    buildProductAutocompleteChoices(search) {
        const normalizedSearch = normalizeTextForMatch(search);
        return this.dependencies.catalogService
            .listProducts()
            .filter((product) => {
            if (!normalizedSearch) {
                return true;
            }
            return normalizeTextForMatch(product.slug).includes(normalizedSearch) ||
                normalizeTextForMatch(product.name).includes(normalizedSearch);
        })
            .slice(0, 25)
            .map((product) => ({
            name: clampText(`${product.name || product.slug} (${product.slug})`, 100, product.slug || "Produto"),
            value: String(product.slug ?? "").trim(),
        }))
            .filter((choice) => choice.value);
    }
    parseCurrencyInputToCents(value) {
        const normalized = String(value ?? "").trim();
        if (!normalized) {
            return undefined;
        }
        const sanitized = normalized
            .replace(/R\$/giu, "")
            .replace(/\s+/gu, "")
            .trim();
        if (!sanitized) {
            return undefined;
        }
        if (/^\d+$/u.test(sanitized)) {
            if (sanitized.length >= 3) {
                return Math.round(Number(sanitized));
            }
            return Math.round(Number(sanitized) * 100);
        }
        const decimalNormalized = sanitized.includes(",") && sanitized.includes(".")
            ? sanitized.replace(/\./gu, "").replace(",", ".")
            : sanitized.replace(",", ".");
        const parsed = Number(decimalNormalized);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error("Use valores como `5,10`, `10,15`, `29,84` ou, se preferir o formato antigo, `510`.");
        }
        return Math.round(parsed * 100);
    }
    formatCurrencyInput(amountCents) {
        const cents = Number(amountCents);
        if (!Number.isFinite(cents)) {
            return "";
        }
        return new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(cents / 100);
    }
    normalizePanelEmbedColorInput(value) {
        const normalized = String(value ?? "").trim();
        if (!normalized) {
            return null;
        }
        const resolved = normalizeHexColor(normalized);
        if (!resolved) {
            throw new Error("Use uma cor hexadecimal valida, como `#5865F2`, `5865F2` ou `#586`.");
        }
        return resolved;
    }
    resolveProductPanelColor(product, fallback = 0x2563eb) {
        const normalized = normalizeHexColor(product?.panelConfig?.embedColor);
        if (!normalized) {
            return fallback;
        }
        return Number.parseInt(normalized.slice(1), 16);
    }
    getResolvedProductBySlug(slug) {
        const normalizedSlug = String(slug ?? "").trim();
        if (!normalizedSlug) {
            return null;
        }
        return this.dependencies.catalogService.listProducts().find((item) => item.slug === normalizedSlug) ?? null;
    }
    getDefaultPlan(product) {
        if (!product?.plans?.length) {
            return null;
        }
        return product.plans.find((plan) => plan.code === "monthly") ?? product.plans[0] ?? null;
    }
    normalizeCartState(rawState, product) {
        const catalogAddons = product?.id ? this.dependencies.catalogService.listAddons(product.id) : [];
        const availableAddons = catalogAddons.length > 0 ? catalogAddons : (product?.addons ?? []);
        const availableAddonCodes = new Set(availableAddons.map((addon) => addon.code));
        const defaultPlan = this.getDefaultPlan(product);
        const planCode = String(rawState?.planCode ?? "").trim();
        const validPlanCode = product?.plans?.some((plan) => plan.code === planCode) ? planCode : defaultPlan?.code ?? "";
        const addonCodes = Array.isArray(rawState?.addonCodes)
            ? rawState.addonCodes
                .map((code) => String(code ?? "").trim())
                .filter((code) => code && availableAddonCodes.has(code))
            : [];
        const step = String(rawState?.step ?? "plan").trim().toLowerCase();
        return {
            planCode: validPlanCode,
            addonCodes: [...new Set(addonCodes)],
            step: step === "addons" ? "addons" : "plan",
        };
    }
    getCartInactivityDelayMs() {
        const sales = this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings();
        return Math.min(5, Math.max(1, Number(sales.cartInactivityMinutes ?? 5))) * 60 * 1000;
    }
    getCartApprovedCloseDelayMs() {
        return 5 * 60 * 1000;
    }
    getCartStateFromChannel(channel, product, message = null) {
        const cachedState = this.getCachedCartState(channel, product);
        if (cachedState) {
            return cachedState;
        }
        const parsedAddons = String(parseDelimitedTopicValue(channel?.topic, "addons") ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        const selectedAddonCodesFromMessage = this.getSelectedAddonCodesFromCartMessage(message, product);
        const state = this.normalizeCartState({
            planCode: parseDelimitedTopicValue(channel?.topic, "plan"),
            addonCodes: selectedAddonCodesFromMessage.length > 0 ? selectedAddonCodesFromMessage : parsedAddons,
            step: parseDelimitedTopicValue(channel?.topic, "step"),
        }, product);
        const parsedActivityAt = Number(parseDelimitedTopicValue(channel?.topic, "activity") ?? 0) || Date.now();
        this.cacheCartState(channel, null, product, state, parsedActivityAt);
        return state;
    }
    buildCartTopic(user, product, state, activityAt = Date.now()) {
        const safeUsername = String(user?.username ?? user?.globalName ?? user?.id ?? "cliente").replace(/[|]/gu, "").trim() || "cliente";
        const addonSegment = Array.isArray(state?.addonCodes) && state.addonCodes.length > 0 ? state.addonCodes.join(",") : "none";
        return [
            `Carrinho de Compras do ${safeUsername}`,
            `user:${user?.id ?? ""}`,
            `product:${product?.slug ?? ""}`,
            `plan:${state?.planCode ?? ""}`,
            `addons:${addonSegment}`,
            `step:${state?.step ?? "plan"}`,
            `activity:${Math.max(1, Number(activityAt) || Date.now())}`,
        ].join(" | ").slice(0, 1024);
    }
    async persistCartState(channel, user, product, rawState) {
        const state = this.normalizeCartState(rawState, product);
        const activityAt = Date.now();
        this.cacheCartState(channel, user, product, state, activityAt);
        this.scheduleCartTopicSync(channel, user, product, state, activityAt);
        this.scheduleCartInactivityTimeout(channel, user, product, state, activityAt);
        return state;
    }
    getCachedCartState(channel, product) {
        const channelId = String(channel?.id ?? "").trim();
        if (!channelId) {
            return null;
        }
        const cached = this.cartStateCache.get(channelId);
        if (!cached) {
            return null;
        }
        const cachedProductSlug = String(cached.productSlug ?? "").trim();
        if (product?.slug && cachedProductSlug && cachedProductSlug !== String(product.slug).trim()) {
            return null;
        }
        return this.normalizeCartState(cached.state, product);
    }
    cacheCartState(channel, user, product, state, updatedAt = Date.now()) {
        const channelId = String(channel?.id ?? "").trim();
        if (!channelId) {
            return;
        }
        this.cartStateCache.set(channelId, {
            userId: String(user?.id ?? "").trim() || null,
            productSlug: String(product?.slug ?? "").trim() || null,
            state: this.normalizeCartState(state, product),
            updatedAt,
        });
    }
    clearCartRuntimeState(channelId) {
        const normalizedChannelId = String(channelId ?? "").trim();
        if (!normalizedChannelId) {
            return;
        }
        const existingTopicTimer = this.cartTopicSyncTimers.get(normalizedChannelId);
        if (existingTopicTimer) {
            clearTimeout(existingTopicTimer);
            this.cartTopicSyncTimers.delete(normalizedChannelId);
        }
        const existingInactivityTimer = this.cartInactivityTimers.get(normalizedChannelId);
        if (existingInactivityTimer) {
            clearTimeout(existingInactivityTimer);
            this.cartInactivityTimers.delete(normalizedChannelId);
        }
        const existingApprovedTimer = this.cartApprovedTimers.get(normalizedChannelId);
        if (existingApprovedTimer) {
            clearTimeout(existingApprovedTimer);
            this.cartApprovedTimers.delete(normalizedChannelId);
        }
        this.cartStateCache.delete(normalizedChannelId);
    }
    scheduleCartTopicSync(channel, user, product, state, activityAt = null) {
        const channelId = String(channel?.id ?? "").trim();
        if (!channelId || typeof channel?.setTopic !== "function") {
            return;
        }
        const existingTimer = this.cartTopicSyncTimers.get(channelId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const timer = setTimeout(() => {
            this.cartTopicSyncTimers.delete(channelId);
            void this.syncCartTopic(channel, user, product, state, activityAt);
        }, 1500);
        timer.unref?.();
        this.cartTopicSyncTimers.set(channelId, timer);
    }
    scheduleCartInactivityTimeout(channel, user, product, state, activityAt = Date.now()) {
        const channelId = String(channel?.id ?? "").trim();
        if (!channelId) {
            return;
        }
        const existingTimer = this.cartInactivityTimers.get(channelId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const delayMs = this.getCartInactivityDelayMs();
        const elapsedMs = Math.max(0, Date.now() - Math.max(1, Number(activityAt) || Date.now()));
        const remainingMs = Math.max(1000, delayMs - elapsedMs);
        const timer = setTimeout(() => {
            this.cartInactivityTimers.delete(channelId);
            void this.handleCartInactivityTimeout(channelId, Math.max(1, Number(activityAt) || Date.now()));
        }, remainingMs);
        timer.unref?.();
        this.cartInactivityTimers.set(channelId, timer);
    }
    async markCartChannelApproved(channel, approvedAt = Date.now()) {
        if (!channel || typeof channel.setTopic !== "function") {
            return;
        }
        const normalizedApprovedAt = Math.max(1, Number(approvedAt) || Date.now());
        const nextTopic = upsertDelimitedTopicValue(String(channel.topic ?? "").trim(), "approved", String(normalizedApprovedAt));
        if (String(channel.topic ?? "") === nextTopic) {
            return;
        }
        try {
            await channel.setTopic(nextTopic);
            channel.topic = nextTopic;
        }
        catch (error) {
            if (!this.shouldIgnoreCartChannelLogError(error)) {
                this.logger.warn({
                    channelId: String(channel?.id ?? "").trim() || null,
                    error: error?.message ?? String(error),
                }, "Falha ao marcar o carrinho como aprovado no topic.");
            }
        }
    }
    scheduleCartApprovedClosure(channel, approvedAt = Date.now()) {
        const channelId = String(channel?.id ?? "").trim();
        if (!channelId) {
            return;
        }
        const existingTopicTimer = this.cartTopicSyncTimers.get(channelId);
        if (existingTopicTimer) {
            clearTimeout(existingTopicTimer);
            this.cartTopicSyncTimers.delete(channelId);
        }
        const existingInactivityTimer = this.cartInactivityTimers.get(channelId);
        if (existingInactivityTimer) {
            clearTimeout(existingInactivityTimer);
            this.cartInactivityTimers.delete(channelId);
        }
        const existingTimer = this.cartApprovedTimers.get(channelId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const delayMs = this.getCartApprovedCloseDelayMs();
        const elapsedMs = Math.max(0, Date.now() - Math.max(1, Number(approvedAt) || Date.now()));
        const remainingMs = Math.max(1000, delayMs - elapsedMs);
        const timer = setTimeout(() => {
            this.cartApprovedTimers.delete(channelId);
            void this.handleCartApprovedClosureTimeout(channelId, Math.max(1, Number(approvedAt) || Date.now()));
        }, remainingMs);
        timer.unref?.();
        this.cartApprovedTimers.set(channelId, timer);
    }
    async handleCartApprovedClosureTimeout(channelId, scheduledAt) {
        const fetchedChannel = this.client?.channels?.cache?.get(channelId) ??
            (channelId ? await this.client?.channels.fetch(channelId).catch(() => null) : null);
        if (!fetchedChannel || fetchedChannel.type !== discord_js_1.ChannelType.GuildText) {
            this.clearCartRuntimeState(channelId);
            return;
        }
        const approvedAt = Number(parseDelimitedTopicValue(fetchedChannel.topic, "approved") ?? 0);
        if (approvedAt > scheduledAt) {
            this.scheduleCartApprovedClosure(fetchedChannel, approvedAt);
            return;
        }
        this.clearCartRuntimeState(channelId);
        let deleted = false;
        if (fetchedChannel.deletable) {
            deleted = await fetchedChannel.delete("Carrinho fechado 5 minutos apos o pagamento aprovado.").then(() => true).catch(() => false);
        }
        if (deleted) {
            return;
        }
        const latestMessages = await fetchedChannel.messages.fetch({ limit: 5 }).catch(() => null);
        const ownerUserId = String(parseDelimitedTopicValue(fetchedChannel.topic, "user") ?? "").trim();
        const productSlug = String(parseDelimitedTopicValue(fetchedChannel.topic, "product") ?? "").trim();
        await this.cleanupRecentCartQrMessages(fetchedChannel, ownerUserId).catch(() => null);
        const cartMessage = productSlug ? this.findCartMessage(latestMessages, ownerUserId, productSlug) : null;
        const closePayload = {
            content: "Carrinho encerrado automaticamente 5 minuto(s) apos o pagamento aprovado.",
            embeds: [],
            components: [],
            attachments: [],
            files: [],
        };
        const edited = await cartMessage?.edit(closePayload).then(() => true).catch(() => false);
        if (!edited && typeof fetchedChannel.send === "function") {
            await fetchedChannel.send(closePayload.content).catch(() => null);
        }
    }
    async handleCartInactivityTimeout(channelId, scheduledAt) {
        const cached = this.cartStateCache.get(channelId);
        if (cached && Number(cached.updatedAt ?? 0) > scheduledAt) {
            this.scheduleCartInactivityTimeout({ id: channelId }, { id: cached.userId ?? "" }, { slug: cached.productSlug ?? "" }, cached.state, Number(cached.updatedAt));
            return;
        }
        const fetchedChannel = this.client?.channels?.cache?.get(channelId) ??
            (channelId ? await this.client?.channels.fetch(channelId).catch(() => null) : null);
        if (!fetchedChannel || fetchedChannel.type !== discord_js_1.ChannelType.GuildText) {
            this.clearCartRuntimeState(channelId);
            return;
        }
        const ownerUserId = String(cached?.userId ?? parseDelimitedTopicValue(fetchedChannel.topic, "user") ?? "").trim();
        const productSlug = String(cached?.productSlug ?? parseDelimitedTopicValue(fetchedChannel.topic, "product") ?? "").trim();
        const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
        if (product) {
            const state = this.getCartStateFromChannel(fetchedChannel, product);
            await this.logSalesEvent({
                type: "cart_closed_inactive",
                userId: ownerUserId || null,
                channelId,
                productName: product.name,
                planName: this.getCartSelectedPlan(product, state)?.name ?? null,
                amountCents: this.calculateCartTotalCents(product, state),
                currency: this.getCartSelectedPlan(product, state)?.currency ?? "BRL",
                addons: this.getSelectedAddonLogEntries(product, state),
                note: `Carrinho fechado automaticamente apos ${Math.max(1, Number(this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings().cartInactivityMinutes ?? 5))} minuto(s) sem atividade.`,
            });
        }
        this.clearCartRuntimeState(channelId);
        let deleted = false;
        if (fetchedChannel.deletable) {
            deleted = await fetchedChannel.delete("Carrinho fechado por inatividade.").then(() => true).catch(() => false);
        }
        if (deleted) {
            return;
        }
        const latestMessages = await fetchedChannel.messages.fetch({ limit: 5 }).catch(() => null);
        await this.cleanupRecentCartQrMessages(fetchedChannel, ownerUserId).catch(() => null);
        const cartMessage = product ? this.findCartMessage(latestMessages, ownerUserId, product.slug) : null;
        const closePayload = {
            content: `Carrinho fechado automaticamente por inatividade apos ${Math.max(1, Number(this.dependencies.managerRuntimeConfigService.getResolvedSalesSettings().cartInactivityMinutes ?? 5))} minuto(s).`,
            embeds: [],
            components: [],
        };
        const edited = await cartMessage?.edit(closePayload).then(() => true).catch(() => false);
        if (!edited && typeof fetchedChannel.send === "function") {
            await fetchedChannel.send(closePayload.content).catch(() => null);
        }
    }
    async rehydrateExistingCartTimers() {
        if (!this.client) {
            return;
        }
        for (const timer of this.cartInactivityTimers.values()) {
            clearTimeout(timer);
        }
        this.cartInactivityTimers.clear();
        for (const timer of this.cartApprovedTimers.values()) {
            clearTimeout(timer);
        }
        this.cartApprovedTimers.clear();
        for (const guild of this.client.guilds.cache.values()) {
            const channels = await guild.channels.fetch().catch(() => null);
            for (const channel of channels?.values() ?? []) {
                if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                    continue;
                }
                if (!String(channel.topic ?? "").includes("user:")) {
                    continue;
                }
                const approvedAt = Number(parseDelimitedTopicValue(channel.topic, "approved") ?? 0);
                if (approvedAt > 0) {
                    this.scheduleCartApprovedClosure(channel, approvedAt);
                    continue;
                }
                const productSlug = String(parseDelimitedTopicValue(channel.topic, "product") ?? "").trim();
                const userId = String(parseDelimitedTopicValue(channel.topic, "user") ?? "").trim();
                const product = this.getResolvedProductBySlug(productSlug) ?? this.getPrimaryProduct();
                if (!product || !userId) {
                    continue;
                }
                const state = this.getCartStateFromChannel(channel, product);
                const activityAt = Number(parseDelimitedTopicValue(channel.topic, "activity") ?? channel.createdTimestamp ?? Date.now()) || Date.now();
                this.cacheCartState(channel, { id: userId }, product, state, activityAt);
                this.scheduleCartInactivityTimeout(channel, { id: userId }, product, state, activityAt);
            }
        }
    }
    async syncCartTopic(channel, user, product, state, activityAt = null) {
        const resolvedActivityAt = Math.max(1, Number(activityAt ?? this.cartStateCache.get(String(channel?.id ?? "").trim())?.updatedAt ?? Date.now()) || Date.now());
        const currentTopic = String(channel?.topic ?? "");
        const approvedAt = Number(parseDelimitedTopicValue(currentTopic, "approved") ?? 0);
        let nextTopic = this.buildCartTopic(user, product, state, resolvedActivityAt);
        if (approvedAt > 0) {
            nextTopic = upsertDelimitedTopicValue(nextTopic, "approved", String(approvedAt));
        }
        if (String(channel?.topic ?? "") === nextTopic) {
            return;
        }
        try {
            await channel.setTopic(nextTopic);
            channel.topic = nextTopic;
        }
        catch (error) {
            const message = String(error?.message ?? error ?? "").toLowerCase();
            if (!message.includes("rate limit") &&
                !message.includes("too many requests") &&
                !message.includes("429") &&
                !this.shouldIgnoreCartChannelLogError(error)) {
                this.logger.warn({
                    channelId: String(channel?.id ?? "").trim() || null,
                    error: error?.message ?? String(error),
                }, "Falha ao sincronizar o topic do carrinho.");
            }
        }
    }
    getSelectedAddonLogEntries(product, state) {
        return this.getCartSelectedAddons(product, state).map((addon) => ({
            code: addon.code,
            name: addon.name,
            priceCents: addon.priceCents,
            currency: addon.currency ?? "BRL",
        }));
    }
    async logSalesEvent(event) {
        if (typeof this.dependencies.salesLogService?.log !== "function") {
            return false;
        }
        try {
            return await this.dependencies.salesLogService.log(event);
        }
        catch (error) {
            this.logger.warn({
                error: error?.message ?? String(error),
                type: event?.type ?? "unknown",
            }, "Falha ao registrar log privado de vendas.");
            return false;
        }
    }
    getSelectedAddonCodesFromCartMessage(message, product) {
        const productSlug = String(product?.slug ?? "").trim();
        if (!message?.components?.length || !productSlug) {
            return [];
        }
        const selected = new Set();
        for (const row of message.components) {
            for (const component of row?.components ?? []) {
                const customId = String(component?.customId ?? component?.custom_id ?? "").trim();
                const style = Number(component?.style ?? 0);
                if (customId.startsWith(CUSTOM_IDS.cartAddonBioPrefix) && customId.endsWith(`:${productSlug}`) && style === discord_js_1.ButtonStyle.Success) {
                    selected.add("custom-bio");
                }
            }
        }
        return [...selected];
    }
    getCartSelectedPlan(product, state) {
        return product?.plans?.find((plan) => plan.code === state?.planCode) ?? this.getDefaultPlan(product);
    }
    getCartSelectedAddons(product, state) {
        const selectedCodes = new Set(Array.isArray(state?.addonCodes) ? state.addonCodes : []);
        const catalogAddons = product?.id ? this.dependencies.catalogService.listAddons(product.id) : [];
        const availableAddons = catalogAddons.length > 0 ? catalogAddons : (product?.addons ?? []);
        return availableAddons.filter((addon) => selectedCodes.has(addon.code));
    }
    calculateCartTotalCents(product, state) {
        const plan = this.getCartSelectedPlan(product, state);
        const addons = this.getCartSelectedAddons(product, state);
        const baseAmount = Number(plan?.priceCents ?? 0);
        return baseAmount + addons.reduce((total, addon) => total + Number(addon?.priceCents ?? 0), 0);
    }
    findCartMessage(existingMessages, ownerUserId, productSlug) {
        const expectedFragments = [
            `${CUSTOM_IDS.buyPlanSelectCartPrefix}${ownerUserId}:${productSlug}`,
            `${CUSTOM_IDS.cartContinuePrefix}${ownerUserId}:${productSlug}`,
            `${CUSTOM_IDS.cartPaymentPrefix}${ownerUserId}:${productSlug}`,
        ];
        return existingMessages?.find((message) => message.author?.id === this.client?.user?.id &&
            message.components?.some((row) => row.components?.some((component) => expectedFragments.some((fragment) => String(component.customId ?? "").startsWith(fragment))))) ?? null;
    }
    isCartQrCodeMessage(message, ownerUserId = null) {
        if (!message || message.author?.id !== this.client?.user?.id) {
            return false;
        }
        const title = String(message.embeds?.[0]?.title ?? "").trim().toUpperCase();
        if (title !== "QR CODE GERADO COM SUCESSO:") {
            return false;
        }
        if (!ownerUserId) {
            return true;
        }
        const normalizedOwnerUserId = String(ownerUserId ?? "").trim();
        const content = String(message.content ?? "").trim();
        return !normalizedOwnerUserId || !content || content.includes(`<@${normalizedOwnerUserId}>`) || content.includes(normalizedOwnerUserId);
    }
    async cleanupRecentCartQrMessages(channel, ownerUserId = null) {
        if (!channel?.messages?.fetch) {
            return 0;
        }
        const recentMessages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
        if (!recentMessages) {
            return 0;
        }
        let cleaned = 0;
        for (const message of recentMessages.values()) {
            if (!this.isCartQrCodeMessage(message, ownerUserId)) {
                continue;
            }
            const deleted = await message.delete().then(() => true).catch(() => false);
            if (deleted) {
                cleaned += 1;
                continue;
            }
            if (!message.editable) {
                continue;
            }
            const updated = await message.edit({
                content: "QR Code removido automaticamente apos a confirmacao do pagamento.",
                embeds: [],
                components: [],
                attachments: [],
                files: [],
            }).then(() => true).catch(() => false);
            if (updated) {
                cleaned += 1;
            }
        }
        return cleaned;
    }
    getPrimaryProduct() {
        return this.dependencies.catalogService.listProducts()[0] ?? null;
    }
    findLatestPayment(subscriptionId, purpose = null) {
        const payments = this.dependencies.store.payments
            .filter((payment) => payment.subscriptionId === subscriptionId && (!purpose || payment.purpose === purpose))
            .sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0));
        return payments[0] ?? null;
    }
    findApprovedActivationPayment(subscriptionId) {
        return this.dependencies.store.payments
            .filter((payment) => payment.subscriptionId === subscriptionId &&
            payment.purpose === "activation" &&
            payment.status === "approved")
            .sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0))[0] ?? null;
    }
    findLatestPendingPaymentIdBySubscription(subscriptionId) {
        return this.dependencies.store.payments
            .filter((payment) => payment.subscriptionId === subscriptionId && payment.status === "pending")
            .sort((left, right) => Date.parse(right.createdAt ?? 0) - Date.parse(left.createdAt ?? 0))[0]?.id ?? null;
    }
    ensureStaffAccess(interaction, actionText) {
        if (this.hasAdminAccess(interaction)) {
            return true;
        }
        void this.safeReply(interaction, `Voce nao tem permissao do manager para ${actionText}.`);
        return false;
    }
    ensureAdminAccess(interaction, actionText) {
        if (this.hasAdminAccess(interaction)) {
            return true;
        }
        void this.safeReply(interaction, `Voce nao tem permissao de admin para ${actionText}.`);
        return false;
    }
    hasStaffAccess(target) {
        return this.hasAdminAccess(target);
    }
    canUpdateInstance(userId, instance) {
        if (!userId || !instance) {
            return false;
        }
        if (this.hasAdminAccess({ user: { id: userId } })) {
            return true;
        }
        const subscription = this.dependencies.store.subscriptions.find((entry) => entry.id === instance.subscriptionId);
        if (!subscription) {
            const ownerDiscordUserId = String(instance?.config?.ownerDiscordUserId ?? "").trim();
            return Boolean(ownerDiscordUserId) && ownerDiscordUserId === String(userId).trim();
        }
        if (String(subscription.commercialOwnerDiscordUserId ?? "").trim() === userId) {
            return true;
        }
        const bundle = this.dependencies.subscriptionService.getById(subscription.id);
        if (!bundle) {
            const ownerDiscordUserId = String(instance?.config?.ownerDiscordUserId ?? "").trim();
            return Boolean(ownerDiscordUserId) && ownerDiscordUserId === String(userId).trim();
        }
        const entry = this.buildAppEntryFromBundle(bundle);
        return this.canAccessAppEntry(userId, entry);
    }
    hasAdminAccess(target) {
        const access = this.dependencies.managerRuntimeConfigService.getResolvedAccessControl();
        const userId = target.user?.id ?? target.author?.id ?? null;
        if (!userId) {
            return false;
        }
        if (this.applicationOwnerUserIds.includes(userId)) {
            return true;
        }
        if (access.adminUserIds.includes(userId)) {
            return true;
        }
        return false;
    }
    async tryAutoValidateEfipay() {
        const snapshot = this.dependencies.managerRuntimeConfigService.getAdminSnapshot();
        const configuredFields = snapshot.billing.efipay.configuredFields;
        if (!configuredFields.clientId || !configuredFields.clientSecret || !configuredFields.pixKey || !configuredFields.certificate) {
            return {
                ok: false,
                skipped: true,
                message: "Ainda faltam credenciais, chave Pix ou certificado `.p12` para validar a Efi automaticamente.",
            };
        }
        if (!snapshot.appBaseUrl) {
            return {
                ok: false,
                skipped: true,
                message: "Defina a APP_BASE_URL publica antes da validacao automatica.",
            };
        }
        try {
            await this.dependencies.managerRuntimeConfigService.validateEfipayConfiguration({ syncWebhook: true });
            return {
                ok: true,
                skipped: false,
                message: "Validado com sucesso.",
            };
        }
        catch (error) {
            return {
                ok: false,
                skipped: false,
                message: error?.message ?? "Falha desconhecida ao validar a Efi.",
            };
        }
    }
    async downloadAttachmentBase64(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Falha ao baixar o anexo: HTTP ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        return {
            base64: buffer.toString("base64"),
            size: buffer.length,
        };
    }
    async persistStoreIfNeeded() {
        if (typeof this.dependencies.store?.flush !== "function") {
            return;
        }
        await this.dependencies.store.flush().catch((error) => {
            this.logger.warn({ error: error?.message ?? String(error) }, "Falha ao persistir alteracoes disparadas pelo Discord.");
        });
    }
    cleanupPendingUploads() {
        const now = Date.now();
        for (const [userId, pending] of this.pendingUploads.entries()) {
            if ((pending?.expiresAt ?? 0) <= now) {
                this.pendingUploads.delete(userId);
            }
        }
    }
    cleanupTrackedAdminPanels() {
        const now = Date.now();
        for (const [userId, tracked] of this.trackedAdminPanels.entries()) {
            if ((tracked?.createdAt ?? 0) + ADMIN_PANEL_TRACK_TTL_MS <= now) {
                this.trackedAdminPanels.delete(userId);
            }
        }
    }
    cleanupTrackedAppsPanels() {
        const now = Date.now();
        for (const [userId, tracked] of this.trackedAppsPanels.entries()) {
            if ((tracked?.createdAt ?? 0) + APPS_PANEL_TRACK_TTL_MS <= now) {
                const existingTimer = this.trackedAppsPanelRefreshTimers.get(userId);
                if (existingTimer) {
                    clearTimeout(existingTimer);
                    this.trackedAppsPanelRefreshTimers.delete(userId);
                }
                this.trackedAppsPanels.delete(userId);
            }
        }
    }
    rememberAdminPanelInteraction(interaction) {
        const userId = String(interaction?.user?.id ?? "").trim();
        if (!userId) {
            return;
        }
        this.cleanupTrackedAdminPanels();
        this.trackedAdminPanels.set(userId, {
            createdAt: Date.now(),
            sourceInteraction: interaction,
            channelId: interaction?.channelId ?? null,
            messageId: interaction?.message?.id ?? null,
        });
    }
    clearTrackedAppsPanelRefreshTimer(userId) {
        const normalizedUserId = String(userId ?? "").trim();
        if (!normalizedUserId) {
            return;
        }
        const existingTimer = this.trackedAppsPanelRefreshTimers.get(normalizedUserId);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.trackedAppsPanelRefreshTimers.delete(normalizedUserId);
        }
    }
    scheduleTrackedAppsPanelRefresh(userId) {
        const normalizedUserId = String(userId ?? "").trim();
        if (!normalizedUserId) {
            return;
        }
        this.clearTrackedAppsPanelRefreshTimer(normalizedUserId);
        const timer = setTimeout(() => {
            this.trackedAppsPanelRefreshTimers.delete(normalizedUserId);
            void this.refreshTrackedAppsPanel(normalizedUserId);
        }, APPS_PANEL_REFRESH_INTERVAL_MS);
        timer.unref?.();
        this.trackedAppsPanelRefreshTimers.set(normalizedUserId, timer);
    }
    async refreshTrackedAppsPanel(userId) {
        const normalizedUserId = String(userId ?? "").trim();
        if (!normalizedUserId) {
            return false;
        }
        this.cleanupTrackedAppsPanels();
        const tracked = this.trackedAppsPanels.get(normalizedUserId);
        if (!tracked) {
            this.clearTrackedAppsPanelRefreshTimer(normalizedUserId);
            return false;
        }
        if (tracked.refreshing) {
            this.scheduleTrackedAppsPanelRefresh(normalizedUserId);
            return false;
        }
        tracked.refreshing = true;
        try {
            const payload = await this.buildAppsPanelPayload(normalizedUserId, tracked.page ?? 0, tracked.selectedKey ?? null, tracked.view === "settings" ? "settings" : "overview");
            const updated = await this.tryUpdateTrackedAppsPanel(normalizedUserId, payload);
            if (!updated) {
                this.trackedAppsPanels.delete(normalizedUserId);
                this.clearTrackedAppsPanelRefreshTimer(normalizedUserId);
                return false;
            }
            return true;
        }
        catch {
            return false;
        }
        finally {
            const latestTracked = this.trackedAppsPanels.get(normalizedUserId);
            if (latestTracked) {
                latestTracked.refreshing = false;
                this.scheduleTrackedAppsPanelRefresh(normalizedUserId);
            }
        }
    }
    rememberAppsPanelInteraction(interaction, state = {}) {
        const userId = String(state?.panelOwnerUserId ?? interaction?.user?.id ?? "").trim();
        if (!userId) {
            return;
        }
        this.cleanupTrackedAppsPanels();
        const previousTracked = this.trackedAppsPanels.get(userId);
        const normalizedPage = Number.isFinite(Number(state?.page)) ? Math.max(0, Number(state.page) || 0) : Math.max(0, Number(previousTracked?.page ?? 0) || 0);
        const normalizedSelectedKey = state && Object.prototype.hasOwnProperty.call(state, "selectedKey")
            ? (state.selectedKey ? String(state.selectedKey).trim() : null)
            : previousTracked?.selectedKey ?? null;
        const normalizedView = state?.view === "settings" ? "settings" : state?.view === "overview" ? "overview" : previousTracked?.view === "settings" ? "settings" : "overview";
        this.trackedAppsPanels.set(userId, {
            createdAt: Date.now(),
            sourceInteraction: interaction,
            channelId: state?.channelId ?? interaction?.channelId ?? previousTracked?.channelId ?? null,
            messageId: state?.messageId ?? interaction?.message?.id ?? previousTracked?.messageId ?? null,
            page: normalizedPage,
            selectedKey: normalizedSelectedKey,
            view: normalizedView,
            refreshing: false,
        });
        this.scheduleTrackedAppsPanelRefresh(userId);
    }
    async tryUpdateTrackedAdminPanel(userId, payload) {
        const normalizedUserId = String(userId ?? "").trim();
        if (!normalizedUserId) {
            return false;
        }
        this.cleanupTrackedAdminPanels();
        const tracked = this.trackedAdminPanels.get(normalizedUserId);
        if (!tracked) {
            return false;
        }
        try {
            if (tracked.sourceInteraction && typeof tracked.sourceInteraction.editReply === "function") {
                await tracked.sourceInteraction.editReply(payload);
                return true;
            }
        }
        catch {
        }
        try {
            if (tracked.sourceInteraction?.webhook && typeof tracked.sourceInteraction.webhook.editMessage === "function") {
                await tracked.sourceInteraction.webhook.editMessage("@original", payload);
                return true;
            }
        }
        catch {
        }
        return false;
    }
    async tryUpdateTrackedAppsPanel(userId, payload) {
        const normalizedUserId = String(userId ?? "").trim();
        if (!normalizedUserId) {
            return false;
        }
        this.cleanupTrackedAppsPanels();
        const tracked = this.trackedAppsPanels.get(normalizedUserId);
        if (!tracked) {
            return false;
        }
        try {
            if (tracked.sourceInteraction && typeof tracked.sourceInteraction.editReply === "function") {
                await tracked.sourceInteraction.editReply(payload);
                return true;
            }
        }
        catch {
        }
        try {
            if (tracked.sourceInteraction?.webhook && typeof tracked.sourceInteraction.webhook.editMessage === "function") {
                await tracked.sourceInteraction.webhook.editMessage("@original", payload);
                return true;
            }
        }
        catch {
        }
        try {
            const channelId = String(tracked?.channelId ?? "").trim();
            const messageId = String(tracked?.messageId ?? "").trim();
            if (channelId && messageId) {
                const channel = this.client.channels.cache.get(channelId) ?? (await this.client.channels.fetch(channelId).catch(() => null));
                if (channel?.isTextBased?.() && typeof channel.messages?.fetch === "function") {
                    const message = await channel.messages.fetch(messageId).catch(() => null);
                    if (message && typeof message.edit === "function") {
                        await message.edit(payload);
                        return true;
                    }
                }
            }
        }
        catch {
        }
        return false;
    }
    async updateTrackedAppsPanelReply(userId, payload) {
        const updated = await this.tryUpdateTrackedAppsPanel(userId, payload);
        if (updated) {
            return true;
        }
        return false;
    }
    async updateAppsModalReply(interaction, payload, panelOwnerUserId = null) {
        const updated = await this.tryUpdateTrackedAppsPanel(panelOwnerUserId ?? interaction.user.id, payload);
        if (updated) {
            await interaction.deleteReply().catch(() => null);
            return;
        }
        await interaction.editReply(payload).catch(() => null);
    }
    countByStatus(statuses) {
        return statuses.reduce((accumulator, status) => {
            const key = String(status ?? "unknown");
            accumulator[key] = (accumulator[key] ?? 0) + 1;
            return accumulator;
        }, {});
    }
    canManageSubscription(userId, subscription) {
        const normalizedUserId = String(userId ?? "").trim();
        if (!normalizedUserId || !subscription) {
            return false;
        }
        if (this.hasAdminAccess({ user: { id: normalizedUserId } })) {
            return true;
        }
        const commercialOwnerDiscordUserId = String(subscription.commercialOwnerDiscordUserId ?? "").trim();
        if (commercialOwnerDiscordUserId) {
            return commercialOwnerDiscordUserId === normalizedUserId;
        }
        const customer = this.dependencies.store.customers.find((entry) => entry.id === subscription.customerId);
        return String(customer?.discordUserId ?? "").trim() === normalizedUserId;
    }
    getStatusLabel(status) {
        return STATUS_LABELS[String(status ?? "").toLowerCase()] ?? status ?? "desconhecido";
    }
    formatCurrency(amountCents, currency = "BRL") {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency,
        }).format((Number(amountCents) || 0) / 100);
    }
    formatIsoDate(isoDate) {
        if (!isoDate) {
            return "nao definido";
        }
        const parsed = new Date(isoDate);
        if (Number.isNaN(parsed.getTime())) {
            return "nao definido";
        }
        return new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: "America/Sao_Paulo",
        }).format(parsed);
    }
    formatRelativeTimestamp(isoDate) {
        if (!isoDate) {
            return "nao definido";
        }
        const timestamp = Math.floor(Date.parse(isoDate) / 1000);
        if (!Number.isFinite(timestamp)) {
            return this.formatIsoDate(isoDate);
        }
        return `<t:${timestamp}:R>`;
    }
    formatDiscordFullTimestamp(isoDate) {
        if (!isoDate) {
            return "Não informado";
        }
        const timestamp = Math.floor(Date.parse(isoDate) / 1000);
        if (!Number.isFinite(timestamp)) {
            return this.formatIsoDate(isoDate);
        }
        return `<t:${timestamp}:F>`;
    }
    resolveDiscordUser(target) {
        if (target && typeof target === "object" && (target.id || target.username || typeof target.displayAvatarURL === "function")) {
            return target;
        }
        const userId = String(target ?? "").trim();
        if (!userId) {
            return null;
        }
        return this.client?.users?.cache?.get(userId) ?? null;
    }
    buildUserMention(target) {
        const userId = String(typeof target === "object" ? target?.id ?? "" : target ?? "").trim();
        return userId ? `<@${userId}>` : null;
    }
    buildSilentAllowedMentions(target) {
        const userId = String(typeof target === "object" ? target?.id ?? "" : target ?? "").trim();
        return userId ? { parse: [] } : undefined;
    }
    getUserDisplayLabel(target) {
        const user = this.resolveDiscordUser(target) ?? (target && typeof target === "object" ? target : null);
        const fallbackName = typeof target === "string" && !/^\d{15,}$/u.test(target) ? target : "cliente";
        const rawName = String(user?.globalName ?? user?.displayName ?? user?.username ?? user?.tag ?? fallbackName).trim();
        const sanitized = rawName.replace(/^@+/u, "").trim() || "cliente";
        return `@${sanitized}`;
    }
    getUserAvatarUrl(target) {
        const user = this.resolveDiscordUser(target) ?? (target && typeof target === "object" ? target : null);
        if (user && typeof user.displayAvatarURL === "function") {
            return user.displayAvatarURL({ size: 256, extension: "png" });
        }
        if (user && typeof user.avatarURL === "function") {
            return user.avatarURL({ size: 256, extension: "png" });
        }
        return null;
    }
    applyUserEmbedIdentity(embed, target) {
        if (!embed) {
            return embed;
        }
        const name = this.getUserDisplayLabel(target);
        const iconURL = this.getUserAvatarUrl(target);
        if (iconURL) {
            embed.setAuthor({ name, iconURL });
            return embed;
        }
        embed.setAuthor({ name });
        return embed;
    }
    buildPaymentLoadingPayload(target) {
        return {
            content: this.limitMessageSize([
                this.buildUserMention(target),
                "🔄 | Gerando o pagamento...",
            ].filter(Boolean).join("\n")),
            allowedMentions: this.buildSilentAllowedMentions(target),
            embeds: [],
            components: [],
            attachments: [],
            files: [],
        };
    }
    buildAppsLoadingPayload() {
        return {
            content: "\uD83D\uDD04 | Carregando informa\u00E7\u00F5es da sua aplica\u00E7\u00E3o...",
            embeds: [],
            components: [],
            attachments: [],
            files: [],
        };
    }
    buildCartOpenedPayload(guild, user, channel, created) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle("MANAGER | Sistema de Vendas")
            .setDescription(this.limitMessageSize([
            created
                ? `✅ | ${this.buildUserMention(user)} Seu carrinho foi aberto com sucesso em: ${channel.toString()}`
                : `♻️ | ${this.buildUserMention(user)} Seu carrinho já estava aberto em: ${channel.toString()}`,
        ].join("\n")));
        this.applyUserEmbedIdentity(embed, user);
        return {
            content: this.buildUserMention(user),
            allowedMentions: this.buildSilentAllowedMentions(user),
            embeds: [embed],
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setLabel("Ir para o Carrinho")
                    .setEmoji("\uD83D\uDED2")
                    .setStyle(discord_js_1.ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${guild.id}/${channel.id}`)),
            ],
        };
    }
    shouldIgnoreCartChannelLogError(error) {
        const message = String(error?.message ?? error ?? "").toLowerCase();
        return message.includes("unknown channel") ||
            message.includes("missing access") ||
            message.includes("unknown message") ||
            message.includes("cannot send messages") ||
            message.includes("missing permissions") ||
            message.includes("10003");
    }
    getNestedValue(source, path) {
        const segments = String(path ?? "")
            .split(".")
            .map((segment) => segment.trim())
            .filter(Boolean);
        let current = source;
        for (const segment of segments) {
            if (!current || typeof current !== "object" || !(segment in current)) {
                return undefined;
            }
            current = current[segment];
        }
        return current;
    }
    pickNestedValue(source, candidates) {
        for (const candidate of candidates) {
            const value = this.getNestedValue(source, candidate);
            if (value !== undefined && value !== null && value !== "") {
                return value;
            }
        }
        return undefined;
    }
    formatHumanBytes(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
            return "--";
        }
        if (numericValue === 0) {
            return "0 B";
        }
        const units = ["B", "KB", "MB", "GB", "TB"];
        const exponent = Math.min(Math.floor(Math.log(numericValue) / Math.log(1024)), units.length - 1);
        const scaled = numericValue / Math.pow(1024, exponent);
        return `${new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(scaled)} ${units[exponent]}`;
    }
    parseAppsNumericValue(value) {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }
        if (typeof value !== "string") {
            return null;
        }
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            return null;
        }
        const match = trimmedValue.match(/-?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?/);
        if (!match) {
            return null;
        }
        const numericChunk = match[0];
        const lastComma = numericChunk.lastIndexOf(",");
        const lastDot = numericChunk.lastIndexOf(".");
        let normalized = numericChunk;
        if (lastComma >= 0 && lastDot >= 0) {
            normalized = lastComma > lastDot
                ? numericChunk.replace(/\./g, "").replace(",", ".")
                : numericChunk.replace(/,/g, "");
        }
        else if (lastComma >= 0) {
            normalized = numericChunk.replace(",", ".");
        }
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    convertAppsUnitToBytes(unit = "B") {
        const normalizedUnit = String(unit ?? "B").trim().toUpperCase();
        const multiplierMap = {
            B: 1,
            KB: 1024,
            KIB: 1024,
            MB: 1024 * 1024,
            MIB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
            GIB: 1024 * 1024 * 1024,
            TB: 1024 * 1024 * 1024 * 1024,
            TIB: 1024 * 1024 * 1024 * 1024,
        };
        return multiplierMap[normalizedUnit] ?? 1;
    }
    parseAppsByteValue(value, fallbackUnit = "B") {
        if (value === undefined || value === null || value === "") {
            return null;
        }
        if (typeof value === "number") {
            return Number.isFinite(value) && value >= 0 ? value * this.convertAppsUnitToBytes(fallbackUnit) : null;
        }
        if (typeof value !== "string") {
            return null;
        }
        const trimmedValue = value.trim();
        if (!trimmedValue || /[\u2191\u2193/]/.test(trimmedValue)) {
            return null;
        }
        const match = trimmedValue.match(/(-?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?)\s*([kmgt]?i?b)?/i);
        if (!match) {
            return null;
        }
        const numericValue = this.parseAppsNumericValue(match[1]);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
            return null;
        }
        return numericValue * this.convertAppsUnitToBytes(match[2] || fallbackUnit);
    }
    formatAppsPercent(value) {
        if (typeof value === "string" && value.trim()) {
            const numericValue = this.parseAppsNumericValue(value);
            if (numericValue !== null) {
                return `${new Intl.NumberFormat("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(numericValue)}%`;
            }
            return value.includes("%") ? value.trim() : `${value.trim()}%`;
        }
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
            return "0,00%";
        }
        return `${new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(numericValue)}%`;
    }
    formatAppsUsage(rawValue, usedValue, limitValue, options = {}) {
        const { defaultUnit = "B", totalFallback = null } = options;
        if (rawValue && typeof rawValue === "object") {
            const nestedUsed = this.pickNestedValue(rawValue, ["used", "usage", "current"]);
            const nestedLimit = this.pickNestedValue(rawValue, ["limit", "total", "max"]);
            if (nestedUsed !== undefined || nestedLimit !== undefined) {
                usedValue = usedValue ?? nestedUsed;
                limitValue = limitValue ?? nestedLimit;
            }
        }
        if (typeof rawValue === "string" && rawValue.trim()) {
            const trimmedRaw = rawValue.trim().replace(/\s+/g, " ");
            if (/[\u2191\u2193/]/.test(trimmedRaw)) {
                return trimmedRaw;
            }
        }
        let usedBytes = this.parseAppsByteValue(usedValue, defaultUnit);
        let limitBytes = this.parseAppsByteValue(limitValue, defaultUnit);
        const rawBytes = this.parseAppsByteValue(rawValue, defaultUnit);
        if (usedBytes === null && rawBytes !== null) {
            usedBytes = rawBytes;
        }
        if ((limitBytes === null || limitBytes <= 0) && totalFallback !== undefined && totalFallback !== null) {
            const parsedFallback = typeof totalFallback === "number"
                ? (defaultUnit !== "B" && totalFallback < this.convertAppsUnitToBytes(defaultUnit) * 1024
                    ? totalFallback * this.convertAppsUnitToBytes(defaultUnit)
                    : totalFallback)
                : this.parseAppsByteValue(totalFallback, defaultUnit);
            if (parsedFallback !== null && Number.isFinite(parsedFallback) && parsedFallback > 0) {
                limitBytes = parsedFallback;
            }
        }
        if (usedBytes !== null && limitBytes !== null && limitBytes > 0) {
            return `${this.formatHumanBytes(usedBytes)}/${this.formatHumanBytes(limitBytes)}`;
        }
        if (usedBytes !== null) {
            return this.formatHumanBytes(usedBytes);
        }
        if (typeof rawValue === "string" && rawValue.trim()) {
            return rawValue.trim().replace(/\s+/g, " ");
        }
        return "--";
    }
    formatAppsUptime(value) {
        if (typeof value === "string" && value.trim()) {
            const trimmedValue = value.trim();
            if (/^<t:\d+:R>$/u.test(trimmedValue)) {
                return trimmedValue;
            }
            const parsedDate = Date.parse(trimmedValue);
            if (!Number.isNaN(parsedDate)) {
                return this.formatAppsUptime(parsedDate);
            }
            if (/^-?(?:\d+(?:[.,]\d+)?)$/u.test(trimmedValue)) {
                const parsedNumeric = this.parseAppsNumericValue(trimmedValue);
                if (parsedNumeric !== null) {
                    return this.formatAppsUptime(parsedNumeric);
                }
            }
            return trimmedValue;
        }
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
            return "--";
        }
        const nowMilliseconds = Date.now();
        const nowSeconds = Math.floor(nowMilliseconds / 1000);
        let startedAtMilliseconds;
        if (numericValue > nowMilliseconds * 0.5) {
            startedAtMilliseconds = numericValue;
        }
        else if (numericValue > nowSeconds * 0.5) {
            startedAtMilliseconds = numericValue * 1000;
        }
        else if (numericValue > 1_000_000_000) {
            startedAtMilliseconds = nowMilliseconds - numericValue;
        }
        else {
            startedAtMilliseconds = nowMilliseconds - numericValue * 1000;
        }
        const startedAtSeconds = Math.floor(startedAtMilliseconds / 1000);
        if (!Number.isFinite(startedAtSeconds) || startedAtSeconds <= 0) {
            return "--";
        }
        return `<t:${startedAtSeconds}:R>`;
    }
    extractAppsOverviewMetrics(instance, overview) {
        const info = overview?.info ?? {};
        const status = overview?.status ?? {};
        const powerState = this.getAppsPowerState({ instance }, overview);
        const rawStatus = powerState.rawStatus;
        let statusLabel = instance ? this.getStatusLabel(instance.status) : "nao disponivel";
        let tone = instance?.status === "running" ? "success" : instance?.status === "suspended" || instance?.status === "failed" ? "danger" : "neutral";
        if (powerState.state !== "unknown" || rawStatus !== undefined && rawStatus !== null && rawStatus !== "") {
            statusLabel = this.formatAppsPowerStateLabel(powerState);
            if (powerState.state === "running") {
                tone = "success";
            }
            else if (powerState.state === "stopped") {
                tone = "danger";
            }
            else {
                tone = "neutral";
            }
        }
        return {
            status: statusLabel,
            tone,
            cpu: this.formatAppsPercent(this.pickNestedValue(status, ["cpu", "cpuUsage", "usage.cpu", "usage.cpuUsage", "stats.cpu"])),
            ram: this.formatAppsUsage(this.pickNestedValue(status, ["ram", "memory", "stats.ram", "stats.memory"]), this.pickNestedValue(status, ["ram.used", "memory.used", "usage.ram.used", "usage.memory.used", "stats.ram.used", "stats.memory.used"]), this.pickNestedValue(status, ["ram.total", "ram.limit", "memory.total", "memory.limit", "usage.ram.total", "usage.memory.total", "stats.ram.total", "stats.memory.total", "memory.max"]), {
                defaultUnit: "MB",
                totalFallback: this.pickNestedValue(info, ["ram", "memory", "memory.total", "memory.limit", "stats.memory.total", "stats.ram.total"]),
            }),
            ssd: this.formatAppsUsage(this.pickNestedValue(status, ["storage", "ssd", "disk", "stats.storage", "stats.ssd"]), this.pickNestedValue(status, ["storage.used", "ssd.used", "disk.used", "stats.storage.used", "stats.ssd.used"]), this.pickNestedValue(status, ["storage.total", "storage.limit", "ssd.total", "ssd.limit", "disk.total", "disk.limit", "stats.storage.total", "stats.ssd.total"]), {
                defaultUnit: "MB",
                totalFallback: this.pickNestedValue(info, ["storage.total", "storage.limit", "ssd.total", "ssd.limit", "disk.total", "disk.limit", "stats.storage.total", "stats.ssd.total"]) ?? SQUARECLOUD_DEFAULT_STORAGE_BYTES,
            }),
            networkTotal: this.formatAppsUsage(this.pickNestedValue(status, ["network.total", "networkTotal", "usage.network.total", "stats.network.total"])),
            networkNow: this.formatAppsUsage(this.pickNestedValue(status, ["network.now", "networkNow", "usage.network.now", "stats.network.now"])),
            uptime: this.formatAppsUptime(this.pickNestedValue(status, ["uptime", "uptimeSeconds", "stats.uptime", "runningFor"]) ??
                this.pickNestedValue(info, ["uptime", "uptimeSeconds", "stats.uptime", "runningFor"])),
            error: String(overview?.error ?? "").trim() || null,
        };
    }
    async syncManagedInstanceRuntime(instance, discordApp) {
        if (!instance || !discordApp) {
            return false;
        }
        if (!this.dependencies.squareCloudProvisioningService ||
            !this.dependencies.squareCloudClient?.isConfigured?.() ||
            !instance.hostingAppId ||
            String(instance.hostingAppId).startsWith("pending-")) {
            return false;
        }
        const runtimeOptions = this.dependencies.sourceArtifactService.getRuntimeOptions(instance.sourceSlug, {
            displayName: discordApp.appName,
        });
        const envs = this.dependencies.squareCloudProvisioningService.buildRuntimeEnv({
            appId: instance.hostingAppId,
            discordApp,
            instance,
            runtimeOptions,
        });
        await this.dependencies.squareCloudClient.setAppEnvVars(instance.hostingAppId, envs);
        instance.status = "provisioning";
        instance.updatedAt = new Date().toISOString();
        if (typeof this.dependencies.squareCloudProvisioningService?.bootProvisionedApp === "function") {
            const boot = await this.dependencies.squareCloudProvisioningService.bootProvisionedApp(instance.hostingAppId);
            if (!boot?.running) {
                instance.status = "failed";
                instance.updatedAt = new Date().toISOString();
                throw new Error(this.buildSquareCloudBootFailureMessage(boot, "A SquareCloud atualizou o app, mas ele nao ficou em execucao."));
            }
        }
        else {
            await this.dependencies.squareCloudClient.restartApp(instance.hostingAppId);
            await this.dependencies.squareCloudClient.startApp(instance.hostingAppId).catch(() => null);
        }
        instance.updatedAt = new Date().toISOString();
        return true;
    }
    limitMessageSize(content, maxLength = 1900) {
        const normalized = String(content ?? "");
        return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
    }
    async replyEphemeral(interaction, payload) {
        const normalizedPayload = typeof payload === "string"
            ? {
                content: this.limitMessageSize(payload),
                flags: discord_js_1.MessageFlags.Ephemeral,
            }
            : {
                ...payload,
                content: payload?.content ? this.limitMessageSize(payload.content) : payload?.content,
                flags: discord_js_1.MessageFlags.Ephemeral,
            };
        if (interaction.deferred) {
            await interaction.editReply(normalizedPayload);
            return;
        }
        if (interaction.replied) {
            await interaction.followUp(normalizedPayload);
            return;
        }
        if (typeof payload === "string") {
            await interaction.reply({
                content: this.limitMessageSize(payload),
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.reply(normalizedPayload);
    }
    async safeReply(interaction, content) {
        const payload = {
            content: this.limitMessageSize(content),
            flags: discord_js_1.MessageFlags.Ephemeral,
        };
        if (interaction.replied || interaction.deferred) {
            if ("followUp" in interaction && typeof interaction.followUp === "function") {
                await interaction.followUp(payload).catch(() => null);
            }
            else if ("editReply" in interaction && typeof interaction.editReply === "function") {
                await interaction.editReply(payload).catch(() => null);
            }
            return;
        }
        if ("reply" in interaction && typeof interaction.reply === "function") {
            await interaction.reply(payload).catch(() => null);
        }
    }
}
exports.ManagerBotService = ManagerBotService;
