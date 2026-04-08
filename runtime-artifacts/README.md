# Runtime Artifacts

Coloque nesta pasta os zips das sources que o manager vai provisionar na SquareCloud.

Arquivo esperado pelo catalogo atual:

- `runtime-artifacts/bot-ticket-hype.zip`

Se preferir, voce tambem pode apontar caminhos explicitos pelas variaveis:

- `SOURCE_ARTIFACT_BOT_TICKET_HYPE`

Ou puxar direto do GitHub:

- `SOURCE_GITHUB_REPO_BOT_TICKET_HYPE=owner/repo`
- `SOURCE_GITHUB_REF_BOT_TICKET_HYPE=main`
- `SOURCE_GITHUB_PATH_BOT_TICKET_HYPE=` para monorepo, se precisar
- `SOURCE_GITHUB_TOKEN_BOT_TICKET_HYPE=` ou `GITHUB_TOKEN` para repo privado

Se estiver montando o zip a partir de `SOURCE_PROJECT_DIR_BOT_TICKET_HYPE`, use `SOURCE_EXCLUDE_PATHS_BOT_TICKET_HYPE=data,transcripts` para nao enviar `config.runtime.json`, tickets ou transcripts do seu ambiente atual.

Sem esses artefatos, a API do manager sobe normalmente, mas o provisionamento real de novas instancias falha no passo de upload da source.

Os artefatos gerados automaticamente em `runtime-artifacts/generated/` tambem sao aceitos em producao.

Rotas de checkout agora bloqueiam a venda de produtos cuja source nao esteja pronta para provisionamento.
