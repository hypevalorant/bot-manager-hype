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
    renewSelect: "mgr:renew:select",
    appsSetupSelect: "mgr:apps:setup",
    adminRefresh: "mgr:admin:refresh",
    adminSubscribers: "mgr:admin:subs",
    adminPermissions: "mgr:admin:perms",
    adminEfipayModal: "mgr:admin:efi:modal",
    adminEfipayUpload: "mgr:admin:efi:upload",
    adminEfipayValidate: "mgr:admin:efi:validate",
    adminEfipayWebhook: "mgr:admin:efi:webhook",
};
const MODAL_IDS = {
    efipayConfig: "mgr:modal:efi",
    botSetupPrefix: "mgr:modal:setup:",
};
const PENDING_UPLOAD_TTL_MS = 3 * 60 * 1000;
class ManagerBotService {
    dependencies;
    config;
    client = null;
    logger = FALLBACK_LOGGER;
    pendingUploads = new Map();
    applicationOwnerUserIds = [];
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
            intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.DirectMessages],
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
                const application = await readyClient.application.fetch();
                this.applicationOwnerUserIds = this.extractApplicationOwnerUserIds(application);
                const rest = new discord_js_1.REST({ version: "10" }).setToken(this.config.token);
                const commandPayload = this.buildCommands().map((command) => command.toJSON());
                if (this.config.guildId) {
                    await rest.put(discord_js_1.Routes.applicationGuildCommands(application.id, this.config.guildId), { body: commandPayload });
                }
                else {
                    await rest.put(discord_js_1.Routes.applicationCommands(application.id), {
                        body: commandPayload,
                    });
                }
                this.logger.info({
                    scope: this.config.guildId ? "guild" : "global",
                    commands: commandPayload.map((command) => command.name),
                    applicationOwnerUserIds: this.applicationOwnerUserIds,
                }, "Slash commands do manager bot registrados.");
            }
            catch (error) {
                this.logger.error({ error: error instanceof Error ? error.message : String(error) }, "Falha ao registrar slash commands do manager bot.");
            }
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
    async stop() {
        if (!this.client) {
            return;
        }
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
                .setName("setpainel")
                .setDescription("Publica o painel de vendas do produto escolhido.")
                .addStringOption((option) => option
                .setName("produto_slug")
                .setDescription("Slug do produto que sera publicado")
                .setRequired(true))
                .addChannelOption((option) => option
                .setName("canal")
                .setDescription("Canal onde o painel sera publicado")
                .setRequired(false)),
            new discord_js_1.SlashCommandBuilder()
                .setName("criarpainel")
                .setDescription("Cria um novo produto/painel no manager.")
                .addStringOption((option) => option
                .setName("slug")
                .setDescription("Slug unico do produto")
                .setRequired(true))
                .addStringOption((option) => option
                .setName("nome")
                .setDescription("Nome publico do produto")
                .setRequired(true))
                .addStringOption((option) => option
                .setName("descricao")
                .setDescription("Descricao publica do produto")
                .setRequired(false)),
            new discord_js_1.SlashCommandBuilder()
                .setName("configpainel")
                .setDescription("Configura source, nome, planos e detalhes do produto.")
                .addStringOption((option) => option
                .setName("produto_slug")
                .setDescription("Slug do produto")
                .setRequired(true))
                .addStringOption((option) => option
                .setName("nome")
                .setDescription("Novo nome do produto")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("descricao")
                .setDescription("Nova descricao do produto")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("source_slug")
                .setDescription("Slug interno da source")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("source_tipo")
                .setDescription("Como a source sera localizada pelo manager")
                .setRequired(false)
                .addChoices({ name: "artifact_path", value: "artifact_path" }, { name: "github_repo", value: "github_repo" }, { name: "project_dir", value: "project_dir" }))
                .addStringOption((option) => option
                .setName("source_valor")
                .setDescription("Caminho do zip, repo GitHub (owner/repo) ou pasta local")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("source_ref")
                .setDescription("Branch/ref do GitHub")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("source_path")
                .setDescription("Subpasta da source dentro do repo GitHub")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("source_token")
                .setDescription("Token de leitura para repo privado no GitHub")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("source_excluir")
                .setDescription("Pastas/arquivos para excluir do zip, separados por virgula")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("tutorial_url")
                .setDescription("Link tutorial de setup")
                .setRequired(false))
                .addIntegerOption((option) => option.setName("semanal").setDescription("Preco semanal em centavos").setRequired(false).setMinValue(1))
                .addIntegerOption((option) => option.setName("mensal").setDescription("Preco mensal em centavos").setRequired(false).setMinValue(1))
                .addIntegerOption((option) => option.setName("trimestral").setDescription("Preco trimestral em centavos").setRequired(false).setMinValue(1))
                .addIntegerOption((option) => option.setName("semestral").setDescription("Preco semestral em centavos").setRequired(false).setMinValue(1))
                .addIntegerOption((option) => option.setName("anual").setDescription("Preco anual em centavos").setRequired(false).setMinValue(1)),
            new discord_js_1.SlashCommandBuilder()
                .setName("painel-manager")
                .setDescription("Abre o painel administrativo privado do bot manager."),
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
            if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
            }
        }
        catch (error) {
            this.logger.error({ error: error instanceof Error ? error.message : String(error) }, "Falha ao responder interacao do manager bot.");
            const content = "Nao consegui concluir essa acao agora. Confira a configuracao do manager e tente novamente.";
            await this.safeReply(interaction, content);
        }
    }
    async handleMessageCreate(message) {
        if (message.author?.bot) {
            return;
        }
        this.cleanupPendingUploads();
        const pending = this.pendingUploads.get(message.author.id);
        if (!pending || pending.type !== "efipay_cert") {
            return;
        }
        if (message.inGuild()) {
            await message.reply("Por seguranca, envie o arquivo `.p12` por DM para este bot.");
            return;
        }
        if (message.attachments.size === 0) {
            if (!message.inGuild()) {
                await message.reply("Envie o arquivo `.p12` da Efi aqui na DM para eu salvar no manager.");
            }
            return;
        }
        const attachment = [...message.attachments.values()].find((item) => String(item.name ?? "").toLowerCase().endsWith(".p12"));
        if (!attachment) {
            await message.reply("Recebi sua mensagem, mas preciso especificamente de um arquivo `.p12` da Efi.");
            return;
        }
        const payload = await this.downloadAttachmentBase64(attachment.url);
        this.dependencies.managerRuntimeConfigService.updateRuntimeConfig({
            certP12Base64: payload.base64,
            certFileName: attachment.name ?? "efipay-cert.p12",
        });
        this.pendingUploads.delete(message.author.id);
        const validation = await this.tryAutoValidateEfipay();
        await this.persistStoreIfNeeded();
        const snapshot = this.dependencies.managerRuntimeConfigService.getAdminSnapshot();
        const suffix = validation.ok
            ? "Credenciais validadas e webhook sincronizado automaticamente."
            : validation.skipped
                ? validation.message
                : `Certificado salvo, mas a validacao automatica falhou: ${validation.message}`;
        await message.reply([
            "Certificado `.p12` salvo no bot manager.",
            `Pix key configurada: ${snapshot.billing.efipay.configuredFields.pixKey ? "sim" : "nao"}.`,
            `URL publica: ${snapshot.appBaseUrl ?? "nao definida"}.`,
            suffix,
        ].join("\n"));
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
        switch (interaction.customId) {
            case CUSTOM_IDS.adminRefresh:
                if (!this.ensureAdminAccess(interaction, "atualizar o painel administrativo")) {
                    return;
                }
                await interaction.update({
                    embeds: [this.buildAdminPanelEmbed()],
                    components: this.buildAdminPanelComponents(),
                });
                return;
            case CUSTOM_IDS.adminSubscribers:
                if (!this.ensureStaffAccess(interaction, "ver assinantes")) {
                    return;
                }
                await this.replyEphemeral(interaction, { embeds: [this.buildSubscribersEmbed("all")] });
                return;
            case CUSTOM_IDS.adminPermissions:
                if (!this.ensureAdminAccess(interaction, "ver permissoes internas")) {
                    return;
                }
                await this.replyEphemeral(interaction, {
                    embeds: [this.buildPermissionsEmbed(this.dependencies.managerRuntimeConfigService.getResolvedAccessControl())],
                });
                return;
            case CUSTOM_IDS.adminEfipayModal:
                if (!this.ensureAdminAccess(interaction, "configurar a Efi do manager")) {
                    return;
                }
                await interaction.showModal(this.buildEfipayConfigModal());
                return;
            case CUSTOM_IDS.adminEfipayUpload:
                if (!this.ensureAdminAccess(interaction, "enviar o certificado da Efi")) {
                    return;
                }
                this.pendingUploads.set(interaction.user.id, {
                    type: "efipay_cert",
                    expiresAt: Date.now() + PENDING_UPLOAD_TTL_MS,
                });
                await this.replyEphemeral(interaction, [
                    "Envie o arquivo `.p12` da Efi por DM para este bot nos proximos 3 minutos.",
                    "Assim que o arquivo chegar, eu salvo no manager e tento validar/sincronizar automaticamente.",
                ].join("\n"));
                return;
            case CUSTOM_IDS.adminEfipayValidate:
                if (!this.ensureAdminAccess(interaction, "validar a Efi do manager")) {
                    return;
                }
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                try {
                    const result = await this.dependencies.managerRuntimeConfigService.validateEfipayConfiguration({ syncWebhook: true });
                    await this.persistStoreIfNeeded();
                    await interaction.editReply({
                        embeds: [this.buildAdminPanelEmbed(`Validacao concluida. Webhook: ${result.remoteWebhook ? "sincronizado" : "sem retorno remoto"}.`)],
                        components: this.buildAdminPanelComponents(),
                    });
                }
                catch (error) {
                    await this.persistStoreIfNeeded();
                    await interaction.editReply({
                        embeds: [this.buildAdminPanelEmbed(`Falha na validacao da Efi: ${error.message}`)],
                        components: this.buildAdminPanelComponents(),
                    });
                }
                return;
            case CUSTOM_IDS.adminEfipayWebhook:
                if (!this.ensureAdminAccess(interaction, "sincronizar o webhook da Efi")) {
                    return;
                }
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                try {
                    await this.dependencies.managerRuntimeConfigService.syncEfipayWebhook();
                    await this.persistStoreIfNeeded();
                    await interaction.editReply({
                        embeds: [this.buildAdminPanelEmbed("Webhook da Efi sincronizado com sucesso.")],
                        components: this.buildAdminPanelComponents(),
                    });
                }
                catch (error) {
                    await this.persistStoreIfNeeded();
                    await interaction.editReply({
                        embeds: [this.buildAdminPanelEmbed(`Falha ao sincronizar webhook: ${error.message}`)],
                        components: this.buildAdminPanelComponents(),
                    });
                }
                return;
            default:
                await this.replyEphemeral(interaction, "Botao ainda nao tratado pelo manager bot.");
        }
    }
    async handleSelectMenuInteraction(interaction) {
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
        if (interaction.customId.startsWith(MODAL_IDS.botSetupPrefix)) {
            await this.handleBotSetupModal(interaction);
            return;
        }
        await this.replyEphemeral(interaction, "Modal ainda nao tratado pelo manager bot.");
    }
    async handleAppsCommand(interaction) {
        const bundles = this.dependencies.subscriptionService.listByDiscordUserId(interaction.user.id);
        if (bundles.length === 0) {
            await this.replyEphemeral(interaction, "Voce ainda nao tem apps comprados no manager. Quando fizer a primeira compra, tudo aparece aqui.");
            return;
        }
        await this.replyEphemeral(interaction, {
            embeds: [this.buildAppsEmbed(bundles, interaction.user.id)],
            components: this.buildAppsComponents(bundles),
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
                    title: "Renovacao criada",
                    intro: "Seu novo Pix de renovacao foi gerado com sucesso.",
                    checkout,
                    productName: bundles[0].product?.name ?? "Produto",
                    planName: bundles[0].plan?.name ?? "Plano",
                    setupHint: "Depois do pagamento, seu tempo e reativado automaticamente.",
                }));
            }
            catch (error) {
                await interaction.editReply(`Nao consegui gerar a renovacao agora: ${error.message}`);
            }
            return;
        }
        const options = bundles.slice(0, 25).map((bundle) => ({
            label: `${bundle.product?.name ?? "Produto"} - ${bundle.plan?.name ?? "Plano"}`.slice(0, 100),
            description: `Status ${this.getStatusLabel(bundle.subscription.status)} - vence ${this.formatIsoDate(bundle.subscription.currentPeriodEnd)}`.slice(0, 100),
            value: `${bundle.subscription.id}|${quantity}`,
        }));
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
        const product = this.dependencies.catalogService.getProductBySlug(productSlug);
        if (!product) {
            await this.replyEphemeral(interaction, "Produto nao encontrado. Use `/criarpainel` ou confira o slug.");
            return;
        }
        const targetChannel = interaction.options.getChannel("canal") ?? interaction.channel;
        if (!targetChannel || !targetChannel.isTextBased?.()) {
            await this.replyEphemeral(interaction, "Escolha um canal de texto valido para publicar o painel.");
            return;
        }
        await targetChannel.send(this.buildSalesPanelMessage(product));
        await this.replyEphemeral(interaction, `Painel de vendas de **${product.name}** publicado em ${targetChannel.toString()}.`);
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
    async handleManagerPanelCommand(interaction) {
        if (!this.ensureAdminAccess(interaction, "abrir o painel do manager")) {
            return;
        }
        await this.replyEphemeral(interaction, {
            embeds: [this.buildAdminPanelEmbed()],
            components: this.buildAdminPanelComponents(),
        });
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
        const product = this.dependencies.catalogService.getProductBySlug(productSlug) ?? this.getPrimaryProduct();
        if (!product) {
            await this.replyEphemeral(interaction, "Nenhum produto foi cadastrado no catalogo do manager.");
            return;
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
        const product = this.dependencies.catalogService.getProductBySlug(productSlug) ?? this.getPrimaryProduct();
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
                title: "Pix da assinatura criado",
                intro: "Seu checkout foi gerado. Quando o Pix compensar, use `/apps` para acompanhar a liberacao.",
                checkout,
                productName: product.name,
                planName: plan?.name ?? planCode,
                setupHint: "Como esse produto usa `customer_token`, depois da aprovacao voce vai finalizar tudo em `/apps` > configurar bot.",
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
            if (bundle.customer?.discordUserId !== interaction.user.id) {
                await interaction.editReply("Essa assinatura nao pertence a voce.");
                return;
            }
            const checkout = await this.dependencies.billingService.createEfipayPixRenewal(subscriptionId, quantity);
            await this.persistStoreIfNeeded();
            await interaction.editReply(this.buildPixCheckoutResponse({
                title: "Pix de renovacao criado",
                intro: "Sua renovacao foi gerada com sucesso.",
                checkout,
                productName: bundle.product?.name ?? "Produto",
                planName: bundle.plan?.name ?? "Plano",
                setupHint: "Assim que o pagamento cair, a assinatura sera renovada automaticamente.",
            }));
        }
        catch (error) {
            await interaction.editReply(`Nao consegui gerar a renovacao agora: ${error.message}`);
        }
    }
    async handleSetupSelection(interaction) {
        const subscriptionId = interaction.values[0];
        const bundle = this.dependencies.subscriptionService.getRequiredBundle(subscriptionId);
        if (bundle.customer?.discordUserId !== interaction.user.id) {
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
            await interaction.showModal(this.buildBotSetupModal(payment.id, bundle));
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
        await interaction.editReply({
            content: lines.join("\n"),
            embeds: [this.buildAdminPanelEmbed()],
            components: this.buildAdminPanelComponents(),
        });
    }
    async handleBotSetupModal(interaction) {
        const paymentId = interaction.customId.slice(MODAL_IDS.botSetupPrefix.length);
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        try {
            const result = await this.dependencies.purchaseSetupService.submitBotForProvisioning(paymentId, {
                applicationName: interaction.fields.getTextInputValue("setup_application_name"),
                botToken: interaction.fields.getTextInputValue("setup_bot_token"),
                ownerDiscordUserId: interaction.fields.getTextInputValue("setup_owner_discord_user_id"),
            });
            await this.persistStoreIfNeeded();
            const lines = [
                "Bot enviado para provisionamento com sucesso.",
                `Aplicacao: ${result.application?.name ?? "nao informada"}`,
                result.application?.id ? `Application ID: ${result.application.id}` : null,
                result.instance?.hostingAppId ? `SquareCloud App: ${result.instance.hostingAppId}` : null,
                result.application?.inviteUrl ? `Install URL: ${result.application.inviteUrl}` : null,
            ].filter(Boolean);
            await interaction.editReply(lines.join("\n"));
        }
        catch (error) {
            await interaction.editReply(`Nao consegui provisionar seu bot agora: ${error.message}`);
        }
    }
    buildSalesPanelMessage(product = null) {
        const resolvedProduct = product ?? this.getPrimaryProduct();
        return {
            embeds: [this.buildSalesPanelEmbed(resolvedProduct)],
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`${CUSTOM_IDS.salesBuy}:${resolvedProduct?.slug ?? "default"}`)
                    .setLabel("Comprar assinatura")
                    .setStyle(discord_js_1.ButtonStyle.Success)),
            ],
        };
    }
    buildSalesPanelEmbed(product = null) {
        const resolvedProduct = product ?? this.getPrimaryProduct();
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x1f8b4c)
            .setTitle("Bot Manager Hype | Assinaturas")
            .setDescription(resolvedProduct
            ? this.limitMessageSize([
                `Produto atual: **${resolvedProduct.name}**`,
                "",
                "Fluxo:",
                "1. Clique em comprar assinatura",
                "2. Escolha o plano",
                "3. Pague o Pix",
                "4. Depois acompanhe tudo em `/apps`",
                "5. Para renovacao futura, use `/renovar`",
            ].join("\n"))
            : "Nenhum produto ativo no catalogo.");
        if (resolvedProduct?.plans?.length) {
            embed.addFields({
                name: "Planos",
                value: resolvedProduct.plans
                    .map((plan) => `- ${plan.name}: ${this.formatCurrency(plan.priceCents, plan.currency)}`)
                    .join("\n")
                    .slice(0, 1024),
            });
        }
        return embed;
    }
    buildAdminPanelEmbed(message) {
        const snapshot = this.dependencies.managerRuntimeConfigService.getAdminSnapshot();
        const access = snapshot.access;
        const subscriptions = this.dependencies.store.subscriptions;
        const instances = this.dependencies.store.instances;
        const statusCounts = this.countByStatus(subscriptions.map((item) => item.status));
        const instanceCounts = this.countByStatus(instances.map((item) => item.status));
        const efipay = snapshot.billing.efipay;
        const descriptionLines = [
            message ? `**Atualizacao**\n${message}\n` : null,
            `App Base URL: ${snapshot.appBaseUrl ?? "nao definida"}`,
            `Efi pronta para Pix: ${efipay.status.canCreatePixCharges ? "sim" : "nao"}`,
            `Webhook pronto: ${efipay.status.canRegisterWebhook && efipay.status.webhookPublicUrlReady ? "sim" : "nao"}`,
            efipay.status.lastValidationError ? `Ultimo erro Efi: ${efipay.status.lastValidationError}` : null,
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
            name: "Efi",
            value: [
                `Client ID: ${efipay.configuredFields.clientId ? "ok" : "faltando"}`,
                `Secret: ${efipay.configuredFields.clientSecret ? "ok" : "faltando"}`,
                `Pix key: ${efipay.configuredFields.pixKey ? "ok" : "faltando"}`,
                `Certificado: ${efipay.configuredFields.certificate ? "ok" : "faltando"}`,
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
    buildAdminPanelComponents() {
        return [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminRefresh)
                .setLabel("Atualizar")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminSubscribers)
                .setLabel("Ver Assinantes")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminPermissions)
                .setLabel("Permissoes")
                .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminEfipayValidate)
                .setLabel("Validar Efi")
                .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminEfipayWebhook)
                .setLabel("Sincronizar Webhook")
                .setStyle(discord_js_1.ButtonStyle.Primary)),
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminEfipayModal)
                .setLabel("Configurar Efi")
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId(CUSTOM_IDS.adminEfipayUpload)
                .setLabel("Enviar .p12")
                .setStyle(discord_js_1.ButtonStyle.Secondary)),
        ];
    }
    buildAppsEmbed(bundles, _discordUserId) {
        const lines = bundles.slice(0, 10).flatMap((bundle, index) => {
            const latestPayment = this.findLatestPayment(bundle.subscription.id);
            const waitingSetup = !bundle.instance &&
                bundle.product?.botProvisioningMode === "customer_token" &&
                bundle.subscription.status === "active";
            return [
                `${index + 1}. ${STATUS_EMOJIS[bundle.subscription.status] ?? "-"} **${bundle.product?.name ?? "Produto"}**`,
                `Assinatura: \`${bundle.subscription.id}\``,
                `Status: ${this.getStatusLabel(bundle.subscription.status)}${bundle.instance ? ` - App ${this.getStatusLabel(bundle.instance.status)}` : ""}`,
                bundle.plan ? `Plano: ${bundle.plan.name}` : null,
                bundle.subscription.currentPeriodEnd
                    ? `Vence: ${this.formatRelativeTimestamp(bundle.subscription.currentPeriodEnd)}`
                    : "Vencimento: aguardando ativacao",
                latestPayment ? `Pagamento mais recente: ${this.getStatusLabel(latestPayment.status)}` : null,
                waitingSetup ? "Proximo passo: clique no seletor abaixo para configurar o bot com token proprio." : null,
                bundle.instance?.id ? `Instancia: \`${bundle.instance.id}\`` : null,
                bundle.instance?.installUrl ? `Install URL: ${bundle.instance.installUrl}` : null,
                bundle.instance?.hostingAppId ? `SquareCloud App: ${bundle.instance.hostingAppId}` : null,
                bundle.instance ? `Atualizar: \`/atualizar id:${bundle.instance.id}\`` : null,
                "",
            ].filter(Boolean);
        });
        return new discord_js_1.EmbedBuilder()
            .setColor(0x2563eb)
            .setTitle("Suas apps e assinaturas")
            .setDescription(this.limitMessageSize(lines.join("\n").trim() || "Sem registros para mostrar."));
    }
    buildAppsComponents(bundles) {
        const needsSetup = bundles
            .filter((bundle) => bundle.subscription.status === "active" &&
            !bundle.instance &&
            bundle.product?.botProvisioningMode === "customer_token" &&
            this.findApprovedActivationPayment(bundle.subscription.id))
            .slice(0, 25);
        if (needsSetup.length === 0) {
            return [];
        }
        return [
            new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(CUSTOM_IDS.appsSetupSelect)
                .setPlaceholder("Escolha qual assinatura voce quer configurar")
                .addOptions(needsSetup.map((bundle) => ({
                label: `${bundle.product?.name ?? "Produto"} - ${bundle.plan?.name ?? "Plano"}`.slice(0, 100),
                description: `Assinatura ${bundle.subscription.id.slice(0, 8)} - cliente envia o token do proprio bot`.slice(0, 100),
                value: bundle.subscription.id,
            })))),
        ];
    }
    buildSubscribersEmbed(statusFilter = "all") {
        const bundles = this.dependencies.store.subscriptions
            .map((subscription) => this.dependencies.subscriptionService.getById(subscription.id))
            .filter(Boolean)
            .filter((bundle) => statusFilter === "all" || bundle.subscription.status === statusFilter);
        const lines = bundles.slice(0, 12).flatMap((bundle, index) => {
            return [
                `${index + 1}. ${STATUS_EMOJIS[bundle.subscription.status] ?? "-"} <@${bundle.customer?.discordUserId ?? bundle.subscription.commercialOwnerDiscordUserId}>`,
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
                `${index + 1}. ${bundle?.customer?.discordUserId ? `<@${bundle.customer.discordUserId}>` : "Cliente"} - ${bundle?.product?.name ?? "Produto"}`,
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
        return new discord_js_1.EmbedBuilder()
            .setColor(0x2563eb)
            .setTitle(`Produto | ${product.name}`)
            .setDescription(this.limitMessageSize([
            `Slug: \`${product.slug}\``,
            `Source slug: \`${product.sourceSlug}\``,
            `Provisionamento: ${product.botProvisioningMode}`,
            `Tutorial: ${product.tutorialUrl ?? "nao definido"}`,
            `Tipo da source: ${sourceMode}`,
            `Source atual: ${sourceLocation}`,
            runtimeSource?.githubRef ? `GitHub ref: ${runtimeSource.githubRef}` : null,
            runtimeSource?.githubPath ? `GitHub path: ${runtimeSource.githubPath}` : null,
            runtimeSource?.githubRepo ? `Repo privado: ${runtimeSource.githubToken ? "sim" : "nao"}` : null,
            Array.isArray(runtimeSource?.excludePaths) && runtimeSource.excludePaths.length > 0
                ? `Excluir do zip: ${runtimeSource.excludePaths.join(", ")}`
                : null,
            artifactResolution?.warning ? `Aviso: ${artifactResolution.warning}` : null,
            artifactResolution?.error ? `Erro: ${artifactResolution.error}` : null,
        ].filter(Boolean).join("\n")))
            .addFields({
            name: "Planos",
            value: product.plans
                .map((plan) => `- ${plan.name}: ${this.formatCurrency(plan.priceCents, plan.currency)}`)
                .join("\n")
                .slice(0, 1024) || "Nenhum plano configurado",
            inline: false,
        });
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
    buildBotSetupModal(paymentId, bundle) {
        const applicationNameInput = new discord_js_1.TextInputBuilder()
            .setCustomId("setup_application_name")
            .setLabel("Nome do bot/aplicacao")
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setRequired(true)
            .setValue(String(bundle.product?.name ?? "Bot Ticket Hype").slice(0, 80));
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
        return new discord_js_1.ModalBuilder()
            .setCustomId(`${MODAL_IDS.botSetupPrefix}${paymentId}`)
            .setTitle("Configurar Bot Comprado")
            .addComponents(new discord_js_1.ActionRowBuilder().addComponents(applicationNameInput), new discord_js_1.ActionRowBuilder().addComponents(botTokenInput), new discord_js_1.ActionRowBuilder().addComponents(ownerDiscordUserIdInput));
    }
    buildPixCheckoutResponse(input) {
        const { checkout, payment } = input.checkout;
        const descriptionLines = [
            input.intro,
            `Produto: **${input.productName}**`,
            `Plano: **${input.planName}**`,
            `Valor: **${this.formatCurrency(checkout.totalAmountCents)}**`,
            checkout.expiresAt ? `Expira: ${this.formatRelativeTimestamp(checkout.expiresAt)}` : null,
            `Payment ID: \`${payment.id}\``,
            input.setupHint,
            checkout.paymentUrl ? `Link visualizacao: ${checkout.paymentUrl}` : null,
        ].filter(Boolean);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x16a34a)
            .setTitle(input.title)
            .setDescription(this.limitMessageSize(descriptionLines.join("\n")));
        const content = checkout.pixCode
            ? `Pix copia e cola:\n\`\`\`\n${this.limitMessageSize(checkout.pixCode, 1700)}\n\`\`\``
            : "A Efipay nao retornou o Pix copia e cola para este checkout.";
        return {
            content,
            embeds: [embed],
        };
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
            return false;
        }
        if (String(subscription.commercialOwnerDiscordUserId ?? "").trim() === userId) {
            return true;
        }
        const customer = this.dependencies.store.customers.find((entry) => entry.id === subscription.customerId);
        if (String(customer?.discordUserId ?? "").trim() === userId) {
            return true;
        }
        return String(instance.config?.ownerDiscordUserId ?? "").trim() === userId;
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
    countByStatus(statuses) {
        return statuses.reduce((accumulator, status) => {
            const key = String(status ?? "unknown");
            accumulator[key] = (accumulator[key] ?? 0) + 1;
            return accumulator;
        }, {});
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
    limitMessageSize(content, maxLength = 1900) {
        const normalized = String(content ?? "");
        return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
    }
    async replyEphemeral(interaction, payload) {
        if (typeof payload === "string") {
            await interaction.reply({
                content: this.limitMessageSize(payload),
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.reply({
            ...payload,
            content: payload?.content ? this.limitMessageSize(payload.content) : payload?.content,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
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
