"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStore = createStore;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const pg_1 = require("pg");
const store_js_1 = require("./store.js");
const SNAPSHOT_KEY = "default";
class PersistentStore {
    databaseUrl;
    pool;
    schemaName;
    tableName;
    tableRef;
    lastPersistedHash = null;
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
    provisioningJobs = [];
    managerRuntimeConfig = (0, store_js_1.createEmptyManagerRuntimeConfig)();
    constructor(databaseUrl) {
        this.databaseUrl = databaseUrl;
        this.schemaName = this.resolveSchemaName();
        this.tableName = this.resolveTableName();
        this.tableRef = `${this.schemaName}.${this.tableName}`;
        this.pool = new pg_1.Pool({
            connectionString: databaseUrl,
            ssl: this.resolveSslConfig(),
            max: Number(process.env.DATABASE_POOL_MAX ?? 5),
            idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30_000),
        });
    }
    async initialize() {
        await this.ensureStorage();
        const snapshot = await this.loadSnapshot();
        this.applySnapshot(this.reconcileSnapshot(snapshot));
        await this.flush();
        return this;
    }
    resolveSslConfig() {
        const raw = String(process.env.DATABASE_SSL ?? "").trim().toLowerCase();
        const ca = this.resolveSslFileContents("DATABASE_SSL_CA_PATH", "DATABASE_SSL_CA_BASE64", "DATABASE_SSL_CA");
        const cert = this.resolveSslFileContents("DATABASE_SSL_CERT_PATH", "DATABASE_SSL_CERT_BASE64", "DATABASE_SSL_CERT");
        const key = this.resolveSslFileContents("DATABASE_SSL_KEY_PATH", "DATABASE_SSL_KEY_BASE64", "DATABASE_SSL_KEY");
        const hasTlsMaterial = Boolean(ca || cert || key);
        if ((!raw || raw === "false" || raw === "disable") && !hasTlsMaterial) {
            return undefined;
        }
        const rejectUnauthorized = String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? "true").toLowerCase() !== "false";
        const sslConfig = {
            rejectUnauthorized,
        };
        if (ca) {
            sslConfig.ca = ca;
        }
        if (cert) {
            sslConfig.cert = cert;
        }
        if (key) {
            sslConfig.key = key;
        }
        return sslConfig;
    }
    resolveSslFileContents(pathEnvKey, base64EnvKey, inlineEnvKey) {
        const base64Value = String(process.env[base64EnvKey] ?? "").trim();
        if (base64Value) {
            return Buffer.from(base64Value, "base64").toString("utf8");
        }
        const inlineValue = String(process.env[inlineEnvKey] ?? "").trim();
        if (inlineValue) {
            return inlineValue;
        }
        const configuredPath = String(process.env[pathEnvKey] ?? "").trim();
        if (!configuredPath) {
            return null;
        }
        if (process.platform !== "win32" && /^[a-z]:[\\/]/iu.test(configuredPath)) {
            console.warn(`${pathEnvKey} aponta para um caminho Windows local (${configuredPath}) e foi ignorado. Em deploy use /home/container/... ou ${base64EnvKey}.`);
            return null;
        }
        const candidatePaths = [
            (0, node_path_1.resolve)(configuredPath),
            (0, node_path_1.resolve)("/application", configuredPath),
            (0, node_path_1.resolve)((0, node_path_1.dirname)(process.argv[1] ?? ""), "..", configuredPath),
        ];
        const resolvedPath = candidatePaths.find((candidatePath, index) => {
            if (!candidatePath || candidatePath === candidatePaths[index - 1]) {
                return false;
            }
            return (0, node_fs_1.existsSync)(candidatePath);
        }) ?? candidatePaths[0];
        if (!(0, node_fs_1.existsSync)(resolvedPath)) {
            throw new Error(`Arquivo SSL do banco nao encontrado em ${resolvedPath} (${pathEnvKey}).`);
        }
        return (0, node_fs_1.readFileSync)(resolvedPath, "utf8");
    }
    resolveTableName() {
        const raw = String(process.env.DATABASE_STATE_TABLE ?? "manager_state_snapshots").trim();
        return raw.replace(/[^a-zA-Z0-9_]/g, "") || "manager_state_snapshots";
    }
    resolveSchemaName() {
        const raw = String(process.env.DATABASE_SCHEMA ?? "manager_core").trim();
        return raw.replace(/[^a-zA-Z0-9_]/g, "") || "manager_core";
    }
    async ensureStorage() {
        await this.pool.query(`create schema if not exists ${this.schemaName}`);
        await this.pool.query(`
      create table if not exists ${this.tableRef} (
        snapshot_key text primary key,
        state jsonb not null,
        updated_at timestamptz not null default now()
      )
    `);
    }
    async loadSnapshot() {
        const result = await this.pool.query(`select state from ${this.tableRef} where snapshot_key = $1 limit 1`, [SNAPSHOT_KEY]);
        if (result.rows[0]?.state && typeof result.rows[0].state === "object") {
            return result.rows[0].state;
        }
        return null;
    }
    reconcileSnapshot(snapshot) {
        const seed = (0, store_js_1.buildSeedStoreState)();
        const freshStore = new store_js_1.InMemoryStore();
        const existing = snapshot && typeof snapshot === "object" ? snapshot : {};
        const dynamicDiscordApps = Array.isArray(existing.discordApps) ? existing.discordApps : [];
        const configuredPoolApps = freshStore.discordApps.filter((app) => app.source === "app_pool");
        return {
            products: this.mergeStaticById(seed.products, existing.products),
            productAddons: this.mergeStaticById(seed.productAddons, existing.productAddons),
            plans: this.mergeStaticById(seed.plans, existing.plans),
            customers: this.arrayOrEmpty(existing.customers),
            discordApps: this.mergeDiscordApps(dynamicDiscordApps, configuredPoolApps),
            subscriptions: this.arrayOrEmpty(existing.subscriptions),
            instances: this.arrayOrEmpty(existing.instances),
            payments: this.arrayOrEmpty(existing.payments).map((payment) => ({
                accessToken: payment.accessToken ?? null,
                ...payment,
            })),
            checkoutSessions: this.arrayOrEmpty(existing.checkoutSessions),
            purchaseSetupSessions: this.arrayOrEmpty(existing.purchaseSetupSessions),
            provisioningJobs: this.arrayOrEmpty(existing.provisioningJobs),
            managerRuntimeConfig: this.mergeManagerRuntimeConfig(existing.managerRuntimeConfig),
        };
    }
    mergeStaticById(seedItems, existingItems) {
        const existingList = this.arrayOrEmpty(existingItems);
        const existingById = new Map(existingList.map((item) => [item.id, item]));
        const merged = [];
        const seenIds = new Set();
        for (const item of seedItems) {
            const current = existingById.get(item.id);
            seenIds.add(item.id);
            if (!current) {
                merged.push({ ...item });
                continue;
            }
            const nextItem = { ...item, ...current };
            if ((item?.panelConfig && typeof item.panelConfig === "object") ||
                (current?.panelConfig && typeof current.panelConfig === "object")) {
                nextItem.panelConfig = {
                    ...(item?.panelConfig && typeof item.panelConfig === "object" ? item.panelConfig : {}),
                    ...(current?.panelConfig && typeof current.panelConfig === "object" ? current.panelConfig : {}),
                };
            }
            merged.push(nextItem);
        }
        for (const item of existingList) {
            if (seenIds.has(item.id)) {
                continue;
            }
            merged.push({ ...item });
        }
        return merged;
    }
    mergeDiscordApps(existingItems, configuredPoolApps) {
        const result = [];
        const configuredKeys = new Set();
        const existingByKey = new Map(this.arrayOrEmpty(existingItems).map((item) => [this.getDiscordAppKey(item), item]));
        for (const configured of configuredPoolApps) {
            const key = this.getDiscordAppKey(configured);
            configuredKeys.add(key);
            const current = existingByKey.get(key);
            if (current) {
                result.push({
                    ...current,
                    productId: configured.productId,
                    poolKey: configured.poolKey,
                    applicationId: configured.applicationId,
                    clientId: configured.clientId,
                    appName: configured.appName,
                    botToken: configured.botToken,
                    defaultGuildId: configured.defaultGuildId,
                    runtimeEnv: configured.runtimeEnv,
                    source: configured.source,
                });
                continue;
            }
            result.push(configured);
        }
        for (const item of this.arrayOrEmpty(existingItems)) {
            const key = this.getDiscordAppKey(item);
            if (item.source === "app_pool" && configuredKeys.has(key)) {
                continue;
            }
            result.push(item);
        }
        return result;
    }
    getDiscordAppKey(item) {
        return [
            String(item.source ?? "unknown"),
            String(item.applicationId ?? ""),
            String(item.customerId ?? ""),
        ].join(":");
    }
    arrayOrEmpty(value) {
        return Array.isArray(value) ? value : [];
    }
    mergeManagerRuntimeConfig(existingValue) {
        const defaults = (0, store_js_1.createEmptyManagerRuntimeConfig)();
        const current = existingValue && typeof existingValue === "object" ? existingValue : {};
        const existingAccess = current.access && typeof current.access === "object" ? current.access : {};
        const existingSales = current.sales && typeof current.sales === "object" ? current.sales : {};
        const existingSources = current.sources && typeof current.sources === "object" ? current.sources : {};
        const existingBilling = current.billing && typeof current.billing === "object" ? current.billing : {};
        const existingEfipay = existingBilling.efipay && typeof existingBilling.efipay === "object"
            ? existingBilling.efipay
            : {};
        const mergedSources = Object.fromEntries(Object.entries({
            ...(defaults.sources && typeof defaults.sources === "object" ? defaults.sources : {}),
            ...existingSources,
        }).map(([slug, config]) => {
            const defaultSourceConfig = defaults.sources?.[slug] && typeof defaults.sources[slug] === "object"
                ? defaults.sources[slug]
                : {};
            const currentSourceConfig = config && typeof config === "object" ? config : {};
            const mergedSourceConfig = {
                ...defaultSourceConfig,
                ...currentSourceConfig,
            };
            const defaultMemory = String(defaultSourceConfig.memory ?? "").trim();
            const currentMemory = String(currentSourceConfig.memory ?? "").trim();
            if ((!currentMemory || (slug === "bot-ticket-hype" && currentMemory === "512" && defaultMemory === "256")) && defaultMemory) {
                mergedSourceConfig.memory = defaultMemory;
            }
            return [slug, mergedSourceConfig];
        }));
        return {
            ...defaults,
            ...current,
            access: {
                ...defaults.access,
                ...existingAccess,
                adminUserIds: Array.isArray(existingAccess.adminUserIds) ? existingAccess.adminUserIds : [],
                staffUserIds: Array.isArray(existingAccess.staffUserIds) ? existingAccess.staffUserIds : [],
                staffRoleIds: Array.isArray(existingAccess.staffRoleIds) ? existingAccess.staffRoleIds : [],
            },
            sales: {
                ...defaults.sales,
                ...existingSales,
                logChannelIds: {
                    ...(defaults.sales.logChannelIds ?? {}),
                    ...(existingSales.logChannelIds && typeof existingSales.logChannelIds === "object" ? existingSales.logChannelIds : {}),
                },
                coupons: Array.isArray(existingSales.coupons) ? existingSales.coupons : [],
            },
            sources: mergedSources,
            billing: {
                ...defaults.billing,
                ...existingBilling,
                efipay: {
                    ...defaults.billing.efipay,
                    ...existingEfipay,
                },
            },
        };
    }
    applySnapshot(snapshot) {
        this.products = snapshot.products;
        this.productAddons = snapshot.productAddons;
        this.plans = snapshot.plans;
        this.customers = snapshot.customers;
        this.discordApps = snapshot.discordApps;
        this.subscriptions = snapshot.subscriptions;
        this.instances = snapshot.instances;
        this.payments = snapshot.payments;
        this.checkoutSessions = snapshot.checkoutSessions;
        this.purchaseSetupSessions = snapshot.purchaseSetupSessions;
        this.provisioningJobs = snapshot.provisioningJobs;
        this.managerRuntimeConfig = snapshot.managerRuntimeConfig;
    }
    toSnapshot() {
        return {
            products: this.products,
            productAddons: this.productAddons,
            plans: this.plans,
            customers: this.customers,
            discordApps: this.discordApps,
            subscriptions: this.subscriptions,
            instances: this.instances,
            payments: this.payments,
            checkoutSessions: this.checkoutSessions,
            purchaseSetupSessions: this.purchaseSetupSessions,
            provisioningJobs: this.provisioningJobs,
            managerRuntimeConfig: this.managerRuntimeConfig,
        };
    }
    async flush() {
        const snapshot = this.toSnapshot();
        const payload = JSON.stringify(snapshot);
        const hash = (0, node_crypto_1.createHash)("sha256").update(payload).digest("hex");
        if (hash === this.lastPersistedHash) {
            return false;
        }
        await this.pool.query(`
      insert into ${this.tableRef} (snapshot_key, state, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (snapshot_key)
      do update set state = excluded.state, updated_at = excluded.updated_at
    `, [SNAPSHOT_KEY, payload]);
        this.lastPersistedHash = hash;
        return true;
    }
    async close() {
        await this.flush().catch(() => undefined);
        await this.pool.end();
    }
}
async function createStore() {
    const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
    if (!databaseUrl) {
        return new store_js_1.InMemoryStore();
    }
    const fallbackToMemory = String(process.env.DATABASE_FALLBACK_TO_MEMORY ?? "true").trim().toLowerCase() !== "false";
    try {
        const store = new PersistentStore(databaseUrl);
        return await store.initialize();
    }
    catch (error) {
        if (!fallbackToMemory) {
            throw error;
        }
        console.warn("[store] Falha ao iniciar PostgreSQL; usando memoria do processo. Configure DATABASE_URL/SSL corretamente para persistencia.", error);
        return new store_js_1.InMemoryStore();
    }
}
