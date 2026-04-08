"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRuntimeConfigAdminPage = buildRuntimeConfigAdminPage;
function buildRuntimeConfigAdminPage() {
    return String.raw `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bot Manager Hype | Runtime Config</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #08111f;
        --panel: #101b2f;
        --panel-2: #14233d;
        --line: #243555;
        --text: #f2f6ff;
        --muted: #93a4c2;
        --accent: #58c4ff;
        --accent-2: #00e0b8;
        --danger: #ff7a93;
        --warn: #ffd166;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Consolas, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(88, 196, 255, 0.18), transparent 32%),
          radial-gradient(circle at top right, rgba(0, 224, 184, 0.12), transparent 28%),
          linear-gradient(180deg, #07101d 0%, #091526 100%);
        color: var(--text);
      }
      .shell {
        width: min(1100px, calc(100% - 32px));
        margin: 24px auto 48px;
      }
      .hero, .card {
        background: rgba(16, 27, 47, 0.92);
        border: 1px solid rgba(88, 196, 255, 0.18);
        border-radius: 20px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
      }
      .hero {
        padding: 24px;
        margin-bottom: 20px;
      }
      .hero h1 {
        margin: 0 0 8px;
        font-size: clamp(28px, 4vw, 40px);
      }
      .hero p, .hint {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      .grid {
        display: grid;
        gap: 18px;
      }
      .card {
        padding: 20px;
      }
      .card h2 {
        margin: 0 0 12px;
        font-size: 18px;
      }
      .card h3 {
        margin: 18px 0 10px;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      .row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }
      label {
        display: grid;
        gap: 8px;
        font-size: 13px;
        color: var(--muted);
      }
      input, select, textarea, button {
        font: inherit;
      }
      input, select, textarea {
        width: 100%;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: rgba(8, 17, 31, 0.72);
        color: var(--text);
        padding: 12px 14px;
      }
      textarea {
        min-height: 90px;
        resize: vertical;
      }
      input[type="checkbox"] {
        width: 18px;
        height: 18px;
        padding: 0;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
        color: var(--text);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        background: linear-gradient(135deg, var(--accent), #7bf7ff);
        color: #04111d;
        font-weight: 700;
        cursor: pointer;
      }
      button.secondary {
        background: rgba(19, 35, 61, 0.9);
        color: var(--text);
        border: 1px solid var(--line);
      }
      button.warn {
        background: linear-gradient(135deg, var(--warn), #ffb347);
        color: #17110a;
      }
      button.danger {
        background: linear-gradient(135deg, var(--danger), #ff9a62);
        color: #1e0811;
      }
      .meta {
        display: grid;
        gap: 10px;
        margin-top: 14px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(20, 35, 61, 0.75);
        border: 1px solid rgba(88, 196, 255, 0.2);
        color: var(--text);
      }
      .status {
        border-radius: 16px;
        padding: 14px;
        background: rgba(8, 17, 31, 0.78);
        border: 1px solid var(--line);
        white-space: pre-wrap;
        line-height: 1.5;
        color: #dbe8ff;
        max-height: 420px;
        overflow: auto;
      }
      .feedback {
        margin-top: 12px;
        min-height: 24px;
        color: var(--accent-2);
      }
      .feedback.error {
        color: var(--danger);
      }
      .mini {
        font-size: 12px;
        color: var(--muted);
      }
      .split {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      }
      @media (max-width: 900px) {
        .split {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <h1>Runtime Config do Bot Manager</h1>
        <p>Configure EfiPay e URL publica do manager depois do deploy, sem depender de reabrir o painel de env da SquareCloud toda vez.</p>
      </section>

      <section class="split">
        <div class="grid">
          <section class="card">
            <h2>Acesso</h2>
            <div class="row">
              <label>
                Token admin
                <input id="adminToken" type="password" placeholder="Bearer token do ADMIN_API_TOKEN" />
              </label>
              <label>
                Origem atual do navegador
                <input id="currentOrigin" type="text" readonly />
              </label>
            </div>
            <div class="actions">
              <button class="secondary" id="loadStateBtn" type="button">Carregar config</button>
              <button class="secondary" id="useOriginBtn" type="button">Usar dominio atual</button>
            </div>
            <p class="feedback" id="feedback"></p>
          </section>

          <section class="card">
            <h2>URL Publica</h2>
            <div class="row">
              <label>
                APP_BASE_URL runtime
                <input id="appBaseUrl" type="url" placeholder="https://botmanagerhypeapplications.squareweb.app" />
              </label>
            </div>
            <p class="hint">Esse valor vira a base publica do manager e tambem a base usada para derivar o webhook da Efipay quando voce nao informar override manual.</p>
          </section>

          <section class="card">
            <h2>EfiPay</h2>
            <div class="row">
              <label>
                EFI_CLIENT_ID
                <input id="efiClientId" type="text" />
              </label>
              <label>
                EFI_CLIENT_SECRET
                <input id="efiClientSecret" type="password" />
              </label>
              <label>
                EFI_PIX_KEY
                <input id="efiPixKey" type="text" />
              </label>
              <label>
                EFI_CERT_P12_PASSPHRASE
                <input id="efiCertPassphrase" type="password" />
              </label>
              <label>
                EFI_BASE_URL opcional
                <input id="efiBaseUrl" type="url" placeholder="https://pix.api.efipay.com.br" />
              </label>
              <label>
                EFI_PIX_EXPIRATION_SECONDS
                <input id="efiPixExpirationSeconds" type="number" min="60" step="1" />
              </label>
              <label>
                EFI_WEBHOOK_PUBLIC_URL override
                <input id="efiWebhookPublicUrl" type="url" placeholder="Deixe vazio para usar a APP_BASE_URL" />
              </label>
              <label>
                EFI_WEBHOOK_PATH
                <input id="efiWebhookPath" type="text" placeholder="/webhooks/efipay" />
              </label>
              <label>
                EFI_WEBHOOK_SECRET opcional
                <input id="efiWebhookSecret" type="password" placeholder="Deixe vazio para segredo interno automatico" />
              </label>
            </div>

            <div class="row">
              <label>
                Certificado .p12
                <input id="efiCertFile" type="file" accept=".p12,.pfx,application/x-pkcs12" />
              </label>
              <label>
                CA opcional
                <input id="efiCaFile" type="file" />
              </label>
            </div>

            <div class="row">
              <label class="check">
                <input id="efiSandbox" type="checkbox" />
                <span>EFI_SANDBOX</span>
              </label>
              <label class="check">
                <input id="efiWebhookSkipMtls" type="checkbox" />
                <span>EFI_WEBHOOK_SKIP_MTLS</span>
              </label>
              <label class="check">
                <input id="efiAutoSyncWebhook" type="checkbox" />
                <span>EFI_AUTO_SYNC_WEBHOOK</span>
              </label>
            </div>

            <div class="actions">
              <button id="saveBtn" type="button">Salvar runtime</button>
              <button class="secondary" id="validateBtn" type="button">Salvar e validar</button>
              <button class="warn" id="validateSyncBtn" type="button">Salvar, validar e sync webhook</button>
              <button class="secondary" id="syncWebhookBtn" type="button">Sync webhook agora</button>
              <button class="danger" id="clearCertBtn" type="button">Limpar cert runtime</button>
            </div>
            <div class="meta">
              <span class="badge" id="certInfo">Nenhum certificado runtime carregado</span>
              <span class="badge" id="caInfo">Nenhum CA runtime carregado</span>
            </div>
          </section>
        </div>

        <aside class="card">
          <h2>Status atual</h2>
          <p class="mini">Esse painel mostra o estado resolvido pelo manager depois de combinar .env, config runtime e dominio atual.</p>
          <div class="status" id="statusOutput">Aguardando carregamento...</div>
        </aside>
      </section>
    </main>

    <script>
      const els = {
        adminToken: document.getElementById("adminToken"),
        currentOrigin: document.getElementById("currentOrigin"),
        appBaseUrl: document.getElementById("appBaseUrl"),
        efiClientId: document.getElementById("efiClientId"),
        efiClientSecret: document.getElementById("efiClientSecret"),
        efiPixKey: document.getElementById("efiPixKey"),
        efiCertPassphrase: document.getElementById("efiCertPassphrase"),
        efiBaseUrl: document.getElementById("efiBaseUrl"),
        efiPixExpirationSeconds: document.getElementById("efiPixExpirationSeconds"),
        efiWebhookPublicUrl: document.getElementById("efiWebhookPublicUrl"),
        efiWebhookPath: document.getElementById("efiWebhookPath"),
        efiWebhookSecret: document.getElementById("efiWebhookSecret"),
        efiSandbox: document.getElementById("efiSandbox"),
        efiWebhookSkipMtls: document.getElementById("efiWebhookSkipMtls"),
        efiAutoSyncWebhook: document.getElementById("efiAutoSyncWebhook"),
        efiCertFile: document.getElementById("efiCertFile"),
        efiCaFile: document.getElementById("efiCaFile"),
        feedback: document.getElementById("feedback"),
        statusOutput: document.getElementById("statusOutput"),
        certInfo: document.getElementById("certInfo"),
        caInfo: document.getElementById("caInfo"),
      };

      const state = {
        pendingCertBase64: null,
        pendingCertFileName: null,
        pendingCaBase64: null,
        pendingCaFileName: null,
        clearStoredCert: false,
        clearStoredCa: false,
        lastSnapshot: null,
      };

      function setFeedback(message, isError = false) {
        els.feedback.textContent = message || "";
        els.feedback.className = isError ? "feedback error" : "feedback";
      }

      function setStatus(payload) {
        state.lastSnapshot = payload || null;
        els.statusOutput.textContent = JSON.stringify(payload, null, 2);
        const certLabel = payload?.billing?.efipay?.previews?.certFileName
          ? "Cert runtime: " + payload.billing.efipay.previews.certFileName
          : state.pendingCertFileName
            ? "Cert selecionado: " + state.pendingCertFileName
            : "Nenhum certificado runtime carregado";
        const caLabel = payload?.billing?.efipay?.previews?.caFileName
          ? "CA runtime: " + payload.billing.efipay.previews.caFileName
          : state.pendingCaFileName
            ? "CA selecionado: " + state.pendingCaFileName
            : "Nenhum CA runtime carregado";
        els.certInfo.textContent = certLabel;
        els.caInfo.textContent = caLabel;
      }

      function getToken() {
        return String(els.adminToken.value || "").trim();
      }

      function persistToken() {
        const token = getToken();
        if (token) {
          localStorage.setItem("managerAdminToken", token);
        }
      }

      async function api(path, options = {}) {
        persistToken();
        const token = getToken();
        const response = await fetch(path, {
          method: options.method || "GET",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: "Bearer " + token } : {}),
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
        const text = await response.text();
        let parsed = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = { raw: text };
        }
        if (!response.ok) {
          throw new Error(parsed?.error || parsed?.message || text || ("Falha HTTP " + response.status));
        }
        return parsed;
      }

      function fillForm(snapshot) {
        const efipay = snapshot?.billing?.efipay;
        const values = efipay?.values || {};
        els.appBaseUrl.value = snapshot?.appBaseUrl || "";
        els.efiClientId.value = "";
        els.efiClientSecret.value = "";
        els.efiPixKey.value = "";
        els.efiCertPassphrase.value = "";
        els.efiBaseUrl.value = values.baseUrl || "";
        els.efiPixExpirationSeconds.value = values.pixExpirationSeconds || 1800;
        els.efiWebhookPublicUrl.value = values.webhookPublicUrl || "";
        els.efiWebhookPath.value = values.webhookPath || "/webhooks/efipay";
        els.efiWebhookSecret.value = "";
        els.efiSandbox.checked = Boolean(values.sandbox);
        els.efiWebhookSkipMtls.checked = values.webhookSkipMtls !== false;
        els.efiAutoSyncWebhook.checked = values.autoSyncWebhook !== false;
      }

      function buildPayload() {
        const payload = {
          appBaseUrl: String(els.appBaseUrl.value || "").trim() || null,
          useCurrentRequestOrigin: false,
          clientId: String(els.efiClientId.value || "").trim() || undefined,
          clientSecret: String(els.efiClientSecret.value || "").trim() || undefined,
          pixKey: String(els.efiPixKey.value || "").trim() || undefined,
          certP12Passphrase: String(els.efiCertPassphrase.value || "").trim() || undefined,
          baseUrl: String(els.efiBaseUrl.value || "").trim() || undefined,
          pixExpirationSeconds: els.efiPixExpirationSeconds.value ? Number(els.efiPixExpirationSeconds.value) : undefined,
          webhookPublicUrl: String(els.efiWebhookPublicUrl.value || "").trim() || undefined,
          webhookPath: String(els.efiWebhookPath.value || "").trim() || undefined,
          webhookSecret: String(els.efiWebhookSecret.value || "").trim() || undefined,
          sandbox: els.efiSandbox.checked,
          webhookSkipMtls: els.efiWebhookSkipMtls.checked,
          autoSyncWebhook: els.efiAutoSyncWebhook.checked,
        };

        if (state.pendingCertBase64) {
          payload.certP12Base64 = state.pendingCertBase64;
          payload.certFileName = state.pendingCertFileName;
        }
        if (state.pendingCaBase64) {
          payload.caBase64 = state.pendingCaBase64;
          payload.caFileName = state.pendingCaFileName;
        }
        if (state.clearStoredCert) {
          payload.clearStoredCert = true;
        }
        if (state.clearStoredCa) {
          payload.clearStoredCa = true;
        }
        return payload;
      }

      async function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const raw = String(reader.result || "");
            resolve(raw.replace(/^data:[^;]+;base64,/, ""));
          };
          reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo."));
          reader.readAsDataURL(file);
        });
      }

      async function loadState() {
        setFeedback("Carregando config runtime...");
        const snapshot = await api("/admin/runtime-config/state");
        fillForm(snapshot);
        setStatus(snapshot);
        setFeedback("Config runtime carregada.");
      }

      async function saveConfig() {
        setFeedback("Salvando config runtime...");
        const snapshot = await api("/admin/runtime-config", {
          method: "POST",
          body: buildPayload(),
        });
        state.pendingCertBase64 = null;
        state.pendingCertFileName = null;
        state.pendingCaBase64 = null;
        state.pendingCaFileName = null;
        state.clearStoredCert = false;
        state.clearStoredCa = false;
        els.efiCertFile.value = "";
        els.efiCaFile.value = "";
        fillForm(snapshot);
        setStatus(snapshot);
        setFeedback("Config runtime salva.");
        return snapshot;
      }

      async function validateConfig(syncWebhook) {
        setFeedback(syncWebhook ? "Validando EfiPay e sincronizando webhook..." : "Validando EfiPay...");
        const result = await api("/admin/runtime-config/efipay/validate", {
          method: "POST",
          body: { syncWebhook: syncWebhook === true },
        });
        setStatus(result.config);
        setFeedback(syncWebhook ? "Validacao e sync do webhook concluidos." : "Validacao concluida.");
      }

      async function syncWebhookOnly() {
        setFeedback("Sincronizando webhook da EfiPay...");
        const result = await api("/admin/runtime-config/efipay/webhook/sync", {
          method: "POST",
        });
        setStatus(result.config);
        setFeedback("Webhook sincronizado com sucesso.");
      }

      document.getElementById("loadStateBtn").addEventListener("click", () => {
        loadState().catch((error) => setFeedback(error.message || String(error), true));
      });
      document.getElementById("useOriginBtn").addEventListener("click", () => {
        els.appBaseUrl.value = window.location.origin;
        setFeedback("APP_BASE_URL preenchida com o dominio atual.");
      });
      document.getElementById("saveBtn").addEventListener("click", () => {
        saveConfig().catch((error) => setFeedback(error.message || String(error), true));
      });
      document.getElementById("validateBtn").addEventListener("click", async () => {
        try {
          await saveConfig();
          await validateConfig(false);
        } catch (error) {
          setFeedback(error.message || String(error), true);
        }
      });
      document.getElementById("validateSyncBtn").addEventListener("click", async () => {
        try {
          await saveConfig();
          await validateConfig(true);
        } catch (error) {
          setFeedback(error.message || String(error), true);
        }
      });
      document.getElementById("syncWebhookBtn").addEventListener("click", () => {
        syncWebhookOnly().catch((error) => setFeedback(error.message || String(error), true));
      });
      document.getElementById("clearCertBtn").addEventListener("click", () => {
        state.pendingCertBase64 = null;
        state.pendingCertFileName = null;
        state.clearStoredCert = true;
        els.efiCertFile.value = "";
        setFeedback("O certificado runtime atual sera removido no proximo salvar.");
      });

      els.efiCertFile.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }
        try {
          state.pendingCertBase64 = await readFileAsBase64(file);
          state.pendingCertFileName = file.name;
          state.clearStoredCert = false;
          setFeedback("Certificado carregado em memoria. Clique em Salvar runtime para persistir.");
          setStatus(state.lastSnapshot);
        } catch (error) {
          setFeedback(error.message || String(error), true);
        }
      });

      els.efiCaFile.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          return;
        }
        try {
          state.pendingCaBase64 = await readFileAsBase64(file);
          state.pendingCaFileName = file.name;
          state.clearStoredCa = false;
          setFeedback("Arquivo CA carregado em memoria. Clique em Salvar runtime para persistir.");
          setStatus(state.lastSnapshot);
        } catch (error) {
          setFeedback(error.message || String(error), true);
        }
      });

      (function bootstrap() {
        const tokenFromQuery = new URLSearchParams(window.location.search).get("token");
        const storedToken = localStorage.getItem("managerAdminToken");
        els.adminToken.value = tokenFromQuery || storedToken || "";
        els.currentOrigin.value = window.location.origin;
        loadState().catch((error) => {
          setFeedback("Informe o token admin e clique em Carregar config. " + (error.message || String(error)), true);
        });
      })();
    </script>
  </body>
</html>`;
}
