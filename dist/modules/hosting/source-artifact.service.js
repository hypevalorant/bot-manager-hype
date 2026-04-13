"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceArtifactService = void 0;
const node_events_1 = require("node:events");
const node_path_1 = require("node:path");
const node_fs_1 = require("node:fs");
const adm_zip_1 = require("adm-zip");
const yazl_1 = require("yazl");
const utils_js_1 = require("../../core/utils.js");
const managed_runtime_wrapper_js_1 = require("./managed-runtime-wrapper.js");
const AdmZip = typeof adm_zip_1 === "function" ? adm_zip_1 : adm_zip_1.default;
const SOURCE_DEFAULT_MEMORY_BY_SLUG = Object.freeze({
    "bot-ticket-hype": "256",
});
const EXCLUDED_DIR_NAMES = new Set([
    ".git",
    ".github",
    ".vscode",
    "node_modules",
    "secrets",
    "efibank",
    "backup",
]);
const EXCLUDED_FILE_NAMES = new Set([
    "squarecloud.app",
    "manager-runtime.js",
]);
class SourceArtifactService {
    artifactsDir;
    options;
    constructor(artifactsDir = process.env.SOURCE_ARTIFACTS_DIR ?? "runtime-artifacts", options = {}) {
        this.artifactsDir = artifactsDir;
        this.options = options;
    }
    getRuntimeSourceConfig(sourceSlug) {
        if (typeof this.options?.getRuntimeSourceConfig !== "function") {
            return null;
        }
        const config = this.options.getRuntimeSourceConfig(sourceSlug);
        return config && typeof config === "object" ? config : null;
    }
    getRuntimeOptions(sourceSlug, overrides = {}) {
        const envKeyPart = (0, utils_js_1.normalizeEnvKeyPart)(sourceSlug);
        const runtimeSourceConfig = this.getRuntimeSourceConfig(sourceSlug) ?? {};
        const defaultMemory = this.getDefaultMemoryForSource(sourceSlug, envKeyPart);
        return {
            entrypoint: runtimeSourceConfig.entrypoint ?? this.readEnvValue(`SOURCE_ENTRYPOINT_${envKeyPart}`),
            displayName: overrides.displayName ??
                runtimeSourceConfig.displayName ??
                this.readEnvValue(`SOURCE_DISPLAY_NAME_${envKeyPart}`) ??
                `${sourceSlug} Runtime`,
            description: overrides.description ??
                runtimeSourceConfig.description ??
                this.readEnvValue(`SOURCE_DESCRIPTION_${envKeyPart}`) ??
                `Runtime gerenciado para ${sourceSlug}`,
            memory: this.resolveRuntimeMemory(sourceSlug, runtimeSourceConfig.memory, defaultMemory),
            appPublicUrl: runtimeSourceConfig.appPublicUrl ??
                this.readEnvValue(`SOURCE_APP_PUBLIC_URL_${envKeyPart}`) ??
                this.readEnvValue("APP_BASE_URL"),
            transcriptPublicUrl: runtimeSourceConfig.transcriptPublicUrl ??
                this.readEnvValue(`SOURCE_TRANSCRIPT_PUBLIC_URL_${envKeyPart}`) ??
                this.readEnvValue(`SOURCE_APP_PUBLIC_URL_${envKeyPart}`) ??
                this.readEnvValue("APP_BASE_URL"),
        };
    }
    resolveArtifact(sourceSlug) {
        const envKeyPart = (0, utils_js_1.normalizeEnvKeyPart)(sourceSlug);
        const explicitZipKey = `SOURCE_ARTIFACT_${envKeyPart}`;
        const projectDirKey = `SOURCE_PROJECT_DIR_${envKeyPart}`;
        const runtimeSourceConfig = this.getRuntimeSourceConfig(sourceSlug) ?? {};
        const explicitPath = this.resolveConfiguredPath(runtimeSourceConfig.artifactPath ?? this.readEnvValue(explicitZipKey));
        const bundledZip = this.getBundledArtifactPath(sourceSlug);
        const bundledZipExists = (0, node_fs_1.existsSync)(bundledZip);
        const generatedZip = this.getGeneratedArtifactPath(sourceSlug);
        const generatedZipExists = (0, node_fs_1.existsSync)(generatedZip);
        if (explicitPath) {
            if ((0, node_fs_1.existsSync)(explicitPath)) {
                return {
                    mode: "zip",
                    sourcePath: explicitPath,
                    artifactPath: explicitPath,
                    envKey: explicitZipKey,
                };
            }
            if (bundledZipExists) {
                return {
                    mode: "zip",
                    sourcePath: bundledZip,
                    artifactPath: bundledZip,
                    envKey: explicitZipKey,
                    warning: `Arquivo configurado em ${explicitZipKey} nao foi encontrado em ${explicitPath}. Usando o zip padrao ${bundledZip}.`,
                };
            }
            if (generatedZipExists) {
                return {
                    mode: "zip",
                    sourcePath: generatedZip,
                    artifactPath: generatedZip,
                    envKey: explicitZipKey,
                    warning: `Arquivo configurado em ${explicitZipKey} nao foi encontrado em ${explicitPath}. Usando o artefato gerado ${generatedZip}.`,
                };
            }
            return {
                mode: "missing",
                sourcePath: explicitPath,
                envKey: explicitZipKey,
                error: `Arquivo nao encontrado em ${explicitPath}.`,
            };
        }
        const projectDir = this.resolveConfiguredPath(runtimeSourceConfig.projectDir ?? this.readEnvValue(projectDirKey));
        if (projectDir && (0, node_fs_1.existsSync)(projectDir)) {
            return {
                mode: "project_directory",
                sourcePath: projectDir,
                artifactPath: this.getGeneratedArtifactPath(sourceSlug),
                envKey: projectDirKey,
            };
        }
        const githubSource = this.getGitHubSourceConfig(sourceSlug, runtimeSourceConfig);
        if (githubSource) {
            return {
                mode: "github_archive",
                sourcePath: githubSource.sourceLabel,
                artifactPath: this.getGeneratedArtifactPath(sourceSlug),
                envKey: githubSource.envKey,
                github: githubSource,
                warning: projectDir
                    ? `Pasta configurada em ${projectDirKey} nao foi encontrada em ${projectDir}. Usando a origem do GitHub configurada.`
                    : undefined,
            };
        }
        if (projectDir) {
            if (bundledZipExists) {
                return {
                    mode: "zip",
                sourcePath: bundledZip,
                    artifactPath: bundledZip,
                    envKey: projectDirKey,
                    warning: `Pasta configurada em ${projectDirKey} nao foi encontrada em ${projectDir}. Usando o zip padrao ${bundledZip}.`,
                };
            }
            if (generatedZipExists) {
                return {
                    mode: "zip",
                    sourcePath: generatedZip,
                    artifactPath: generatedZip,
                    envKey: projectDirKey,
                    warning: `Pasta configurada em ${projectDirKey} nao foi encontrada em ${projectDir}. Usando o artefato gerado ${generatedZip}.`,
                };
            }
            return {
                mode: "missing",
                sourcePath: projectDir,
                envKey: projectDirKey,
                error: `Pasta da source nao encontrada em ${projectDir}.`,
            };
        }
        if (bundledZipExists) {
            return {
                mode: "zip",
                sourcePath: bundledZip,
                artifactPath: bundledZip,
            };
        }
        if (generatedZipExists) {
            return {
                mode: "zip",
                sourcePath: generatedZip,
                artifactPath: generatedZip,
            };
        }
        return {
            mode: "missing",
            artifactPath: bundledZip,
            error: `Artefato ${sourceSlug}.zip nao encontrado em ${this.artifactsDir}. Configure um zip local, SOURCE_PROJECT_DIR_${envKeyPart} ou uma origem do GitHub.`,
        };
    }
    async getArtifact(sourceSlug, overrides = {}) {
        const resolution = this.resolveArtifact(sourceSlug);
        if (resolution.mode === "zip" && resolution.artifactPath) {
            return this.readArtifactFile(resolution.artifactPath);
        }
        if (resolution.mode === "project_directory" && resolution.sourcePath) {
            const artifactPath = await this.buildArtifactFromProjectDirectory(sourceSlug, resolution.sourcePath, overrides);
            return this.readArtifactFile(artifactPath);
        }
        if (resolution.mode === "github_archive" && resolution.github) {
            const artifactPath = await this.buildArtifactFromGitHubArchive(sourceSlug, resolution.github, overrides);
            return this.readArtifactFile(artifactPath);
        }
        throw new Error(resolution.error ??
            `Artefato da source ${sourceSlug} nao encontrado. Configure um zip em ${this.artifactsDir}, defina SOURCE_PROJECT_DIR_${(0, utils_js_1.normalizeEnvKeyPart)(sourceSlug)} ou uma origem do GitHub.`);
    }
    readArtifactFile(artifactPath) {
        const resolvedArtifactPath = (0, node_path_1.resolve)(artifactPath);
        return {
            path: resolvedArtifactPath,
            fileName: (0, node_path_1.basename)(resolvedArtifactPath),
            fileBuffer: new Uint8Array((0, node_fs_1.readFileSync)(resolvedArtifactPath)),
        };
    }
    async buildArtifactFromProjectDirectory(sourceSlug, projectDir, overrides) {
        const resolvedProjectDir = (0, node_path_1.resolve)(projectDir);
        const excludedPaths = this.getConfiguredExcludedPaths(sourceSlug);
        const sourceFiles = this.collectSourceFiles(resolvedProjectDir, excludedPaths);
        const artifactPath = this.getGeneratedArtifactPath(sourceSlug, overrides);
        const runtimeOptions = this.getRuntimeOptions(sourceSlug, overrides);
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(artifactPath), { recursive: true });
        const zipFile = new yazl_1.ZipFile();
        for (const filePath of sourceFiles) {
            const relativePath = (0, node_path_1.relative)(resolvedProjectDir, filePath).replaceAll("\\", "/");
            const transformedBuffer = this.transformPackagedFile(sourceSlug, relativePath, (0, node_fs_1.readFileSync)(filePath));
            if (transformedBuffer) {
                zipFile.addBuffer(transformedBuffer, relativePath);
                continue;
            }
            zipFile.addFile(filePath, relativePath);
        }
        zipFile.addBuffer(Buffer.from((0, managed_runtime_wrapper_js_1.buildManagedRuntimeWrapperSource)(), "utf8"), "manager-runtime.js");
        zipFile.addBuffer(Buffer.from(this.buildSquareCloudConfig(sourceSlug, runtimeOptions), "utf8"), "squarecloud.app");
        const writeStream = (0, node_fs_1.createWriteStream)(artifactPath);
        zipFile.outputStream.pipe(writeStream);
        zipFile.end();
        await (0, node_events_1.once)(writeStream, "close");
        return artifactPath;
    }
    async buildArtifactFromGitHubArchive(sourceSlug, githubSource, overrides) {
        const artifactPath = this.getGeneratedArtifactPath(sourceSlug, overrides);
        const runtimeOptions = this.getRuntimeOptions(sourceSlug, overrides);
        const archiveBuffer = await this.downloadGitHubArchive(githubSource);
        const sourceFiles = this.extractSourceFilesFromArchive(archiveBuffer, githubSource.path, this.getConfiguredExcludedPaths(sourceSlug));
        if (sourceFiles.length === 0) {
            throw new Error(`Nenhum arquivo utilizavel foi encontrado no arquivo do GitHub para ${sourceSlug}. Verifique SOURCE_GITHUB_PATH_${(0, utils_js_1.normalizeEnvKeyPart)(sourceSlug)}.`);
        }
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(artifactPath), { recursive: true });
        const zipFile = new yazl_1.ZipFile();
        for (const file of sourceFiles) {
            zipFile.addBuffer(this.transformPackagedFile(sourceSlug, file.relativePath, file.buffer) ?? file.buffer, file.relativePath);
        }
        zipFile.addBuffer(Buffer.from((0, managed_runtime_wrapper_js_1.buildManagedRuntimeWrapperSource)(), "utf8"), "manager-runtime.js");
        zipFile.addBuffer(Buffer.from(this.buildSquareCloudConfig(sourceSlug, runtimeOptions), "utf8"), "squarecloud.app");
        const writeStream = (0, node_fs_1.createWriteStream)(artifactPath);
        zipFile.outputStream.pipe(writeStream);
        zipFile.end();
        await (0, node_events_1.once)(writeStream, "close");
        return artifactPath;
    }
    extractSourceFilesFromArchive(archiveBuffer, sourcePath = null, configuredExcludedPaths = []) {
        const archive = new AdmZip(Buffer.from(archiveBuffer));
        const normalizedSourcePath = String(sourcePath ?? "")
            .trim()
            .replaceAll("\\", "/")
            .replace(/^\/+|\/+$/g, "");
        const entries = [];
        for (const entry of archive.getEntries()) {
            if (entry.isDirectory) {
                continue;
            }
            const normalizedEntryPath = String(entry.entryName ?? "").replaceAll("\\", "/").replace(/^\/+/g, "");
            const pathWithoutRoot = normalizedEntryPath.split("/").slice(1).join("/");
            if (!pathWithoutRoot) {
                continue;
            }
            const scopedPath = normalizedSourcePath
                ? pathWithoutRoot.startsWith(`${normalizedSourcePath}/`)
                    ? pathWithoutRoot.slice(normalizedSourcePath.length + 1)
                    : pathWithoutRoot === normalizedSourcePath
                        ? ""
                        : null
                : pathWithoutRoot;
            if (!scopedPath) {
                continue;
            }
            const normalizedScopedPath = scopedPath.replace(/^\/+|\/+$/g, "");
            const entryName = (0, node_path_1.basename)(normalizedScopedPath);
            if (!normalizedScopedPath || this.isExcludedPath(normalizedScopedPath, entryName, false, configuredExcludedPaths)) {
                continue;
            }
            entries.push({
                relativePath: normalizedScopedPath,
                buffer: entry.getData(),
            });
        }
        entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
        return entries;
    }
    async downloadGitHubArchive(githubSource) {
        const requestUrl = githubSource.archiveUrl ??
            `https://api.github.com/repos/${githubSource.repo}/zipball/${encodeURIComponent(githubSource.ref ?? "main")}`;
        let currentUrl = requestUrl;
        let headers = {
            Accept: "application/vnd.github+json",
            "User-Agent": "bot-manager-saas",
        };
        if (githubSource.token) {
            headers.Authorization = `Bearer ${githubSource.token}`;
        }
        for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
            const response = await fetch(currentUrl, {
                method: "GET",
                headers,
                redirect: "manual",
            });
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get("location");
                if (!location) {
                    throw new Error(`GitHub respondeu ${response.status} sem cabecalho location ao baixar ${githubSource.sourceLabel}.`);
                }
                currentUrl = new URL(location, currentUrl).toString();
                headers = {
                    "User-Agent": "bot-manager-saas",
                };
                continue;
            }
            if (!response.ok) {
                const errorBody = await response.text().catch(() => "");
                throw new Error(`Falha ao baixar ${githubSource.sourceLabel} do GitHub: HTTP ${response.status}${errorBody ? ` - ${errorBody}` : ""}`);
            }
            return Buffer.from(await response.arrayBuffer());
        }
        throw new Error(`Muitos redirecionamentos ao baixar ${githubSource.sourceLabel} do GitHub.`);
    }
    collectSourceFiles(projectDir, configuredExcludedPaths = []) {
        const entries = [];
        const stack = [projectDir];
        while (stack.length > 0) {
            const currentDir = stack.pop();
            if (!currentDir) {
                continue;
            }
            for (const entry of (0, node_fs_1.readdirSync)(currentDir, { withFileTypes: true })) {
                const absolutePath = (0, node_path_1.resolve)(currentDir, entry.name);
                const normalizedRelativePath = (0, node_path_1.relative)(projectDir, absolutePath).replaceAll("\\", "/");
                if (this.isExcludedPath(normalizedRelativePath, entry.name, entry.isDirectory(), configuredExcludedPaths)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    stack.push(absolutePath);
                    continue;
                }
                entries.push(absolutePath);
            }
        }
        entries.sort((left, right) => left.localeCompare(right));
        return entries;
    }
    isExcludedPath(relativePath, entryName, isDirectory, configuredExcludedPaths = []) {
        if (!relativePath) {
            return false;
        }
        const normalizedRelativePath = relativePath.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
        if (entryName.startsWith(".env")) {
            return true;
        }
        if (entryName.startsWith("tmp_")) {
            return true;
        }
        if (entryName.endsWith(".log") || entryName.endsWith(".bak") || entryName.endsWith(".fixbak")) {
            return true;
        }
        if (isDirectory && EXCLUDED_DIR_NAMES.has(entryName)) {
            return true;
        }
        if (!isDirectory && EXCLUDED_FILE_NAMES.has(entryName)) {
            return true;
        }
        if (normalizedRelativePath.split("/").some((part) => EXCLUDED_DIR_NAMES.has(part))) {
            return true;
        }
        return configuredExcludedPaths.some((configuredPath) => normalizedRelativePath === configuredPath || normalizedRelativePath.startsWith(`${configuredPath}/`));
    }
    buildSquareCloudConfig(sourceSlug, runtimeOptions) {
        return [
            `DISPLAY_NAME=${runtimeOptions.displayName}`,
            "MAIN=manager-runtime.js",
            `MEMORY=${runtimeOptions.memory}`,
            "VERSION=recommended",
            "AUTORESTART=true",
            `DESCRIPTION=${String(runtimeOptions.description ?? `Runtime gerenciado para ${sourceSlug}`).trim() || `Runtime gerenciado para ${sourceSlug}`}`,
        ].join("\n");
    }
    getGeneratedArtifactPath(sourceSlug, overrides = {}) {
        const suffixSource = overrides.artifactTag ?? overrides.displayName;
        const suffix = suffixSource
            ? `-${(0, utils_js_1.normalizeEnvKeyPart)(suffixSource).slice(0, 48).toLowerCase()}`
            : "";
        return (0, node_path_1.resolve)(process.cwd(), this.artifactsDir, "generated", `${sourceSlug}${suffix}.zip`);
    }
    getBundledArtifactPath(sourceSlug) {
        return (0, node_path_1.resolve)(process.cwd(), this.artifactsDir, `${sourceSlug}.zip`);
    }
    getConfiguredExcludedPaths(sourceSlug) {
        const envKeyPart = (0, utils_js_1.normalizeEnvKeyPart)(sourceSlug);
        const rawValue = this.readEnvValue(`SOURCE_EXCLUDE_PATHS_${envKeyPart}`);
        const envPaths = rawValue
            ? rawValue
            .split(/[,\r\n;]+/u)
            .map((entry) => this.normalizeConfiguredRelativePath(entry))
            .filter(Boolean)
            : [];
        const runtimePaths = Array.isArray(this.getRuntimeSourceConfig(sourceSlug)?.excludePaths)
            ? this.getRuntimeSourceConfig(sourceSlug).excludePaths.map((entry) => this.normalizeConfiguredRelativePath(entry)).filter(Boolean)
            : [];
        return [...new Set([...envPaths, ...runtimePaths])];
    }
    getGitHubSourceConfig(sourceSlug, runtimeSourceConfig = {}) {
        const envKeyPart = (0, utils_js_1.normalizeEnvKeyPart)(sourceSlug);
        const archiveUrl = runtimeSourceConfig.githubArchiveUrl ?? this.readEnvValue(`SOURCE_GITHUB_ARCHIVE_URL_${envKeyPart}`);
        const repo = runtimeSourceConfig.githubRepo ?? this.readEnvValue(`SOURCE_GITHUB_REPO_${envKeyPart}`);
        if (!archiveUrl && !repo) {
            return null;
        }
        const ref = runtimeSourceConfig.githubRef ?? this.readEnvValue(`SOURCE_GITHUB_REF_${envKeyPart}`) ?? "main";
        const path = runtimeSourceConfig.githubPath ?? this.readEnvValue(`SOURCE_GITHUB_PATH_${envKeyPart}`);
        const token = runtimeSourceConfig.githubToken ?? this.readEnvValue(`SOURCE_GITHUB_TOKEN_${envKeyPart}`) ?? this.readEnvValue("GITHUB_TOKEN");
        if (archiveUrl) {
            return {
                envKey: `SOURCE_GITHUB_ARCHIVE_URL_${envKeyPart}`,
                archiveUrl,
                ref,
                path,
                token,
                sourceLabel: archiveUrl,
            };
        }
        return {
            envKey: `SOURCE_GITHUB_REPO_${envKeyPart}`,
            repo,
            ref,
            path,
            token,
            sourceLabel: `${repo}@${ref}`,
        };
    }
    getDefaultMemoryForSource(sourceSlug, envKeyPart = (0, utils_js_1.normalizeEnvKeyPart)(sourceSlug)) {
        return this.normalizeMemoryValue(this.readEnvValue(`SOURCE_MEMORY_${envKeyPart}`) ?? SOURCE_DEFAULT_MEMORY_BY_SLUG[sourceSlug] ?? "256") ?? "256";
    }
    normalizeMemoryValue(value) {
        const normalizedValue = String(value ?? "").trim();
        if (!/^\d+$/u.test(normalizedValue)) {
            return null;
        }
        const parsedValue = Number.parseInt(normalizedValue, 10);
        if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
            return null;
        }
        return String(parsedValue);
    }
    resolveRuntimeMemory(sourceSlug, configuredValue, defaultMemory) {
        const normalizedDefault = this.normalizeMemoryValue(defaultMemory) ?? "256";
        const normalizedConfigured = this.normalizeMemoryValue(configuredValue);
        if (!normalizedConfigured) {
            return normalizedDefault;
        }
        if (sourceSlug === "bot-ticket-hype" && Number.parseInt(normalizedConfigured, 10) > Number.parseInt(normalizedDefault, 10)) {
            return normalizedDefault;
        }
        return normalizedConfigured;
    }
    readEnvValue(envKey) {
        const value = String(process.env[envKey] ?? "").trim();
        return value || null;
    }
    transformPackagedFile(sourceSlug, relativePath, fileBuffer) {
        const normalizedRelativePath = relativePath.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
        if (sourceSlug !== "bot-ticket-hype") {
            return null;
        }
        if (normalizedRelativePath === "src/index.js") {
            const sourceText = Buffer.from(fileBuffer).toString("utf8");
            const transformedText = sourceText
                .replace('const TRANSCRIPT_VIEWER_FALLBACK_PUBLIC_URL = "https://hypecommunity.squareweb.app";', 'const TRANSCRIPT_VIEWER_FALLBACK_PUBLIC_URL = "";')
                .replace('const TRANSCRIPT_VIEWER_FALLBACK_REDIRECT_URL = "https://hypecommunity.squareweb.app/view/transcript";', 'const TRANSCRIPT_VIEWER_FALLBACK_REDIRECT_URL = "";')
                .replace('"https://transcripts.hypecommunity.com.br",', '"https://seu-dominio-publico.com",')
                .replace('          .setPlaceholder("Ex: https://hypecommunity.squareweb.app")', '          .setPlaceholder("Ex: https://seu-dominio-publico.com")');
            return transformedText === sourceText ? null : Buffer.from(transformedText, "utf8");
        }
        if (normalizedRelativePath === "config.json") {
            try {
                const parsed = JSON.parse(Buffer.from(fileBuffer).toString("utf8"));
                if (parsed?.efi && typeof parsed.efi === "object" && !Array.isArray(parsed.efi)) {
                    parsed.efi.clientId = "";
                    parsed.efi.clientSecret = "";
                    parsed.efi.pixKey = "";
                    parsed.efi.webhookSecret = "";
                    parsed.efi.webhookPublicUrl = "";
                    parsed.efi.certP12Path = "";
                    parsed.efi.certP12Passphrase = "";
                    parsed.efi.certPath = "";
                    parsed.efi.certKeyPath = "";
                    parsed.efi.caPath = "";
                    parsed.efi.lastValidationOk = false;
                    parsed.efi.lastValidationAt = "";
                    parsed.efi.lastValidationMessage = "";
                    parsed.efi.webhookLastConfigOk = false;
                    parsed.efi.webhookLastConfigAt = "";
                    parsed.efi.webhookLastConfigMessage = "";
                    parsed.efi.webhookLastPayerConfigOk = false;
                    parsed.efi.webhookLastRegisteredOk = false;
                    parsed.efi.medLastPollAt = "";
                    parsed.efi.medAlertedIds = [];
                    parsed.efi.paymentIdentityByE2eId = {};
                    parsed.efi.paymentIdentityByTxid = {};
                    parsed.efi.accounts = {};
                    parsed.efi.selectedAccountId = "";
                }
                return Buffer.from(JSON.stringify(parsed, null, 2), "utf8");
            }
            catch {
                return null;
            }
        }
        return null;
    }
    normalizeConfiguredRelativePath(pathValue) {
        return String(pathValue ?? "")
            .trim()
            .replaceAll("\\", "/")
            .replace(/^[./]+/u, "")
            .replace(/^\/+|\/+$/g, "");
    }
    resolveConfiguredPath(pathValue) {
        return pathValue ? (0, node_path_1.resolve)(pathValue) : null;
    }
}
exports.SourceArtifactService = SourceArtifactService;
