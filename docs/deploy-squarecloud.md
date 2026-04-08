# Deploy do Bot Manager na SquareCloud

Este projeto ficou preparado para subir como aplicacao web na SquareCloud.

## O que foi configurado

- `squarecloud.app` na raiz com `MAIN=dist/server.js`
- memoria inicial de `512MB`, que e o minimo recomendado para site/API
- `AUTORESTART=true`
- validacao do runtime distribuido via `npm run build`
- script `npm run package:squarecloud` para gerar o zip limpo de upload
- exemplo de variaveis em `.env.squarecloud.example`
- webhook da Efipay derivado automaticamente de `APP_BASE_URL`
- suporte para buscar a source vendida direto de repositorio GitHub privado ou publico
- persistencia duravel opcional via `DATABASE_URL`
- protecao das rotas administrativas via `ADMIN_API_TOKEN`

## Antes de subir

1. Edite `squarecloud.app` e troque o `SUBDOMAIN` para um nome livre.
2. Rode `npm run build` para validar o runtime distribuido.
3. Preencha as variaveis reais no painel da SquareCloud usando `.env.squarecloud.example` como referencia.
4. Ajuste `APP_BASE_URL` para o dominio final publicado.
5. Defina `ADMIN_API_TOKEN` e, de preferencia, `DATABASE_URL`.
6. Escolha como o manager vai obter a source vendida:
   - `runtime-artifacts/generated/bot-ticket-hype.zip`
   - `runtime-artifacts/bot-ticket-hype.zip`
   - ou configure `SOURCE_GITHUB_REPO_BOT_TICKET_HYPE` para baixar do GitHub

## Gerar o zip

```powershell
npm run package:squarecloud
```

O arquivo de upload sera salvo em `deploy/bot-manager-squarecloud.zip`.

Durante o empacotamento, o projeto tenta gerar artefatos em `runtime-artifacts/generated/` a partir de `SOURCE_PROJECT_DIR_<SOURCE_SLUG>` quando esses caminhos existirem no ambiente local.
Se `EFI_CERT_P12_PATH` estiver configurado no `.env` local, o script tambem inclui o certificado da Efipay no zip final como `efi-cert.p12`.
Depois do deploy, abra `https://<SUBDOMAIN>.squareweb.app/admin/runtime-config`, informe o token admin e finalize a configuracao runtime da Efipay por ali, inclusive validacao e sync do webhook.

## O que entra no zip

- `dist/`
- `data/`
- `runtime-artifacts/`
- `package.json`
- `package-lock.json`
- `squarecloud.app`
- `.env.squarecloud.example`

`node_modules` e `.env` ficam de fora.

## Checklist rapido depois do deploy

1. Confirme que a aplicacao subiu em `PORT=80` e `HOST=0.0.0.0`.
2. Abra `GET /health`.
3. Abra `GET /setup/status` com `Authorization: Bearer <ADMIN_API_TOKEN>`.
4. Verifique se `APP_BASE_URL` esta publico.
5. Se usar GitHub, confira `SOURCE_GITHUB_REPO_<SOURCE_SLUG>` e um token com permissao de leitura no repo privado.
6. Se usar zips locais, verifique se os arquivos em `runtime-artifacts/` ou `runtime-artifacts/generated/` foram enviados junto.
7. Se `DATABASE_URL` estiver configurada, confirme que a tabela de snapshot foi criada no PostgreSQL.
8. Se estiver gerando a source a partir do seu projeto local, mantenha `SOURCE_EXCLUDE_PATHS_BOT_TICKET_HYPE=data,transcripts` para nao empacotar configuracao ou historico do seu bot original.
