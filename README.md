# Bot Manager SaaS Blueprint

Este workspace agora contem uma base de projeto para voce vender bots como servico no Discord sem expor a source ao cliente.

## Ideia central

Em vez de entregar a source ou transferir a aplicacao do Discord para o comprador, voce opera os bots como SaaS:

- o cliente compra um plano semanal ou mensal
- o pagamento aprovado ativa uma assinatura
- o manager provisiona uma instancia do bot
- o cliente recebe um link para adicionar o bot ao servidor dele
- o cliente vira o "dono comercial" da instancia no seu sistema
- quando expira, a instancia entra em graca, pode ser suspensa e depois removida

## O que esta nesta pasta

- `docs/discord-saas-blueprint.md`: arquitetura recomendada e fluxo completo
- `docs/discord-limitations.md`: limites reais do Discord para esse modelo
- `docs/how-the-image-system-probably-works.md`: leitura tecnica do sistema das imagens
- `docs/source-adapter-guide.md`: como encaixar suas outras sources no manager
- `docs/github-source-hosting.md`: como manter a source vendida em repositorio privado no GitHub
- `docs/squarecloud-mapping.md`: o que do card vem da Square Cloud, Discord e billing
- `docs/squarecloud-provisioning.md`: como provisionar a app hospedada por cliente
- `database/schema.sql`: schema inicial em PostgreSQL
- `contracts/bot-runtime-contract.md`: contrato para plugar suas outras sources
- `contracts/bot-manifest.example.json`: exemplo de manifesto por bot/produto
- `runtime-artifacts/`: zips padrao enviados para a SquareCloud no provisionamento automatico
- `runtime-templates/`: fonte desses artefatos padrao
- `dist/`: runtime atual da API manager pronto para deploy
- `scripts/verify-runtime.js`: validacao do runtime empacotavel
- `scripts/prepare-production-artifacts.js`: gera artefatos de producao a partir das sources locais/GitHub quando possivel

## Recomendacao pratica

Para esse tipo de negocio, o melhor caminho e:

1. manter as aplicacoes do Discord na sua team
2. usar um pool de apps pre-criadas por produto
3. provisionar uma instancia isolada por cliente
4. controlar licenca, expiracao e renovacao pelo seu backend
5. nunca expor token ou source ao comprador

## Stack sugerida

- Backend/API: Node.js + TypeScript + NestJS ou Fastify
- Banco: PostgreSQL
- Fila: Redis + BullMQ
- Runtime: Docker + VPS/Pterodactyl/Kubernetes
- Pagamento BR: Mercado Pago, PushinPay, Asaas, Efibank ou Stripe
- Painel admin: Next.js
- Bot manager: discord.js

## MVP recomendado

Se quiser validar rapido, comece com:

- 1 bot manager
- 1 API de billing/provisionamento
- 1 pool pequeno de apps do Discord
- 1 source integrada por contrato
- renovacao automatica por webhook
- suspensao e exclusao logica apos expiracao

Depois voce evolui para painel web, metricas, cupons, afiliados e upgrades de plano.

## API inicial criada

Esta base agora ja inclui um scaffold em Node.js + TypeScript com:

- `GET /products`
- `GET /admin/runtime-config`
- `GET /admin/runtime-config/state`
- `POST /admin/runtime-config`
- `POST /admin/runtime-config/efipay/validate`
- `POST /admin/runtime-config/efipay/webhook/sync`
- `POST /checkout/mock`
- `POST /checkout/efipay/pix`
- `POST /webhooks/payments/mock`
- `POST /webhooks/efipay`
- `POST /webhooks/efipay/pix`
- `GET /payments/:paymentId/setup`
- `POST /payments/:paymentId/setup/reset`
- `POST /payments/:paymentId/setup/progress`
- `POST /payments/:paymentId/setup/submit-bot`
- `GET /subscriptions/:subscriptionId`
- `POST /subscriptions/:subscriptionId/renew`
- `POST /subscriptions/:subscriptionId/renew/efipay/pix`
- `GET /payments/:paymentId`
- `POST /payments/:paymentId/reconcile`
- `GET /billing/efipay/webhook`
- `POST /billing/efipay/webhook/sync`
- `GET /setup/status`
- `GET /instances/:instanceId/install`
- `GET /instances/:instanceId/overview`
- `POST /maintenance/expire`
- `POST /internal/instances/bootstrap`
- `POST /internal/instances/heartbeat`
- `POST /hosting/squarecloud/apps`
- `GET /hosting/squarecloud/apps/:appId/info`
- `GET /hosting/squarecloud/apps/:appId/logs`
- `GET /hosting/squarecloud/apps/:appId/status`
- `POST /hosting/squarecloud/apps/:appId/commit`
- `POST /hosting/squarecloud/apps/:appId/start`
- `POST /hosting/squarecloud/apps/:appId/stop`
- `POST /hosting/squarecloud/apps/:appId/restart`
- `DELETE /hosting/squarecloud/apps/:appId`

## Como testar localmente

1. Instale dependencias com `npm install`
2. Preencha `.env` com `ADMIN_API_TOKEN`, `SQUARECLOUD_ACCOUNT_ID`, `SQUARECLOUD_API_KEY` e `DISCORD_APP_POOL_FILE`
2.1. Em producao, preencha tambem `DATABASE_URL` para persistencia duravel
2.2. `APP_BASE_URL` e a configuracao da Efipay agora podem ser ajustadas depois do deploy; o fluxo principal recomendado e pelo Discord com `/painel-manager`
2.3. Se quiser ligar o bot manager no Discord, preencha `MANAGER_BOT_TOKEN` e opcionalmente `MANAGER_BOT_GUILD_ID`
3. Se for usar sua source externa como runtime principal, defina `SOURCE_PROJECT_DIR_BOT_TICKET_HYPE` apontando para a pasta da source
3.1. Para empacotar a source limpa, sem historico local, defina `SOURCE_EXCLUDE_PATHS_BOT_TICKET_HYPE=data,transcripts`
4. Valide o runtime com `npm run build`
5. Rode em dev com `npm run dev`
6. Veja o checklist operacional em `GET /setup/status` usando `Authorization: Bearer <ADMIN_API_TOKEN>`
7. Liste produtos em `GET /products`
8. Crie checkout mock em `POST /checkout/mock` ou real em `POST /checkout/efipay/pix`
9. Guarde o `payment.accessToken` retornado no checkout; ele protege as rotas de setup daquele pagamento
10. No fluxo mock, aprove em `POST /webhooks/payments/mock` com `Authorization: Bearer <ADMIN_API_TOKEN>`
11. No fluxo Efipay, use webhook ou `POST /payments/:paymentId/reconcile` com token admin
12. Se o produto estiver em `customer_token`, consulte `GET /payments/:paymentId/setup` enviando `x-payment-token: <payment.accessToken>`
13. Envie `applicationName`, `botToken`, `ownerDiscordUserId` e opcionalmente `customBioText` em `POST /payments/:paymentId/setup/submit-bot`
14. Pegue o `installUrl` da instancia criada

## Observacoes

- O provisionamento real usa os zips em `runtime-artifacts/` por `sourceSlug`, ou baixa a source direto do GitHub se `SOURCE_GITHUB_REPO_<SOURCE_SLUG>` estiver configurado
- Se quiser subir sua source real, troque o zip correspondente ou defina `SOURCE_ARTIFACT_<SOURCE_SLUG>`
- Se quiser empacotar direto de uma pasta do seu outro projeto, defina `SOURCE_PROJECT_DIR_<SOURCE_SLUG>` e o manager gera o zip sozinho com um wrapper de bootstrap/heartbeat
- `npm run package:squarecloud` agora tenta gerar os artefatos de producao antes de montar o zip final
- Se `EFI_CERT_P12_PATH` estiver preenchido no `.env` local, `npm run package:squarecloud` inclui esse `.p12` no pacote final para a SquareCloud
- Se preferir hospedar a source em repo privado no GitHub, use `SOURCE_GITHUB_REPO_<SOURCE_SLUG>`, `SOURCE_GITHUB_REF_<SOURCE_SLUG>` e opcionalmente `SOURCE_GITHUB_TOKEN_<SOURCE_SLUG>` ou `GITHUB_TOKEN`
- Pelo Discord, `/configpainel` tambem aceita `source_tipo:github_repo`, `source_valor:owner/repo`, `source_ref`, `source_path`, `source_token` e `source_excluir`
- Em producao hospedada, prefira zipar a source e usar `runtime-artifacts/` ou `SOURCE_ARTIFACT_<SOURCE_SLUG>`; nao deixe `SOURCE_PROJECT_DIR_<SOURCE_SLUG>` apontando para um caminho local do seu PC
- O catalogo seedado agora usa apenas `bot-ticket-hype`
- `GET /products` agora informa `readiness.saleReady`; produto sem source pronta nao deve ser vendido
- Para o fluxo igual ao das imagens, o produto fica em `customer_token`: o cliente paga, envia nome/token do proprio bot, o manager valida intents e sobe uma app dedicada na sua conta da SquareCloud
- `ownerDiscordUserId` pode ser enviado no setup para definir quem sera tratado como dono do bot dentro da runtime provisionada
- O pool em `data/discord-app-pool.json` so e necessario para produtos configurados como `app_pool`
- Para o runtime na SquareCloud conseguir falar com o manager, `APP_BASE_URL` precisa ser publico
- Depois do deploy, voce pode abrir `GET /admin/runtime-config`, mas o fluxo principal agora tambem existe dentro do Discord via `/painel-manager`
- Para webhook da Efipay, `APP_BASE_URL` ja e usado para derivar a URL publica do webhook por padrao; `EFI_WEBHOOK_PUBLIC_URL` vira apenas override opcional
- `EFI_WEBHOOK_SECRET` agora e opcional; se voce nao informar, o manager gera um segredo deterministico interno
- `EFI_AUTO_SYNC_WEBHOOK=true` faz o manager sincronizar o webhook automaticamente quando for gerar cobrancas Pix
- A cobranca Pix da Efipay exige `EFI_PIX_KEY`; sem ela o codigo compila, mas o checkout real nao abre cobranca
- O manager agora tem configuracao runtime propria para a Efipay em `GET /admin/runtime-config` e tambem por Discord em `/painel-manager`, com upload do `.p12`, validacao e sync do webhook sem restart
- As permissoes internas do manager tambem podem ser gerenciadas pelo Discord com `/perm adicionar`, `/perm remover` e `/perm lista`
- Quando a source e gerada a partir de `SOURCE_PROJECT_DIR_BOT_TICKET_HYPE`, o manager pode excluir `data` e `transcripts` pelo `SOURCE_EXCLUDE_PATHS_BOT_TICKET_HYPE` para o zip sair limpo para cada cliente
- Rotas administrativas agora exigem `Authorization: Bearer <ADMIN_API_TOKEN>` ou `x-admin-token`
- Rotas publicas de setup do pagamento exigem `x-payment-token` ou `Authorization: Bearer <payment.accessToken>`
- O manager faz scheduler automatico de expiracao com `EXPIRATION_CHECK_INTERVAL_SECONDS`
- Quando `DATABASE_URL` esta configurada, o manager persiste o estado em PostgreSQL; sem isso ele continua apenas em memoria

## O que precisa para operar de verdade

- URL publica do manager em `APP_BASE_URL`
- Token administrativo forte em `ADMIN_API_TOKEN`
- PostgreSQL em `DATABASE_URL`
- Se o PostgreSQL exigir mTLS, configure tambem `DATABASE_SSL_CA_PATH`, `DATABASE_SSL_CERT_PATH` e `DATABASE_SSL_KEY_PATH` ou as variantes `*_BASE64`
- Se quiser interface Discord para o manager, token em `MANAGER_BOT_TOKEN`
- No primeiro acesso, o dono da aplicacao do bot ja entra como administrador do manager automaticamente
- `APP_BASE_URL` costuma ser a URL publica da app depois do deploy na SquareCloud, por exemplo `https://<SUBDOMAIN>.squareweb.app`
- Credenciais da SquareCloud e da Efipay validas
- Depois do deploy, abra `/painel-manager` no Discord para concluir `APP_BASE_URL` + Efipay; `GET /admin/runtime-config` fica como fallback tecnico
- Um artefato pronto por source em `runtime-artifacts/`, `runtime-artifacts/generated/`, `SOURCE_ARTIFACT_<SOURCE_SLUG>` ou GitHub
- O cliente precisa criar a aplicacao no portal do Discord, ligar as privileged intents e informar o token no passo de setup
- Se quiser mostrar o mesmo botao de tutorial das imagens, configure `BOT_SETUP_TUTORIAL_URL`

Quando o pagamento aprova, o fluxo fica assim:

- a assinatura e vinculada ao cliente comprador
- se o produto for `customer_token`, o pagamento fica aguardando o setup manual do bot
- o cliente envia nome, token e opcionalmente `ownerDiscordUserId`
- o manager valida o token, confere as intents, aplica cooldown de 1 minuto em erro e expira a etapa em 1 minuto sem acao
- uma nova app e criada na sua conta da SquareCloud com `hostingAppId` proprio
- o manager injeta o token/client ID do bot enviado pelo cliente naquela app
- o `hostingAppId` fica consultavel em `GET /instances/:id/install`, `GET /instances/:id/overview` e `GET /customers/:discordUserId/apps`

## Bot manager x bots vendidos

- `MANAGER_BOT_TOKEN` e so para o bot principal do painel/controle
- Comandos publicos do manager: `/apps` e `/renovar`
- `/atualizar` fica publico para qualquer cliente, mas so atualiza apps que pertencem a ele; admins continuam podendo atualizar qualquer instancia
- Comandos de equipe/admin do manager: `/setpainel`, `/criarpainel`, `/configpainel`, `/painel-manager`, `/ver-assinantes`, `/aprovar`, `/perm`
- Permissoes internas podem ser adicionadas/removidas em runtime com `/perm adicionar`, `/perm remover` e listadas com `/perm lista`
- os bots vendidos usam tokens separados por instancia
- o manager nao deve rodar a source vendida dentro do mesmo processo
- o manager empacota a source e sobe uma app dedicada na sua SquareCloud para cada cliente
