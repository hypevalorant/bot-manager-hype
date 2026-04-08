# Hospedar a Source Vendida no GitHub

Use este fluxo quando voce quiser manter a source em um repositorio privado e deixar o bot manager puxar dela no provisionamento.

## 1. Criar o repositorio

No GitHub, crie um repositorio privado para cada source vendida ou um repo por produto.

Sugestao para o seu caso:

- `hypevalorant/bot-ticket-hype`

Se a source estiver dentro de uma subpasta de um monorepo, tudo bem: depois voce usa `SOURCE_GITHUB_PATH_<SOURCE_SLUG>`.

## 2. Subir a source

A raiz da source deve conter os arquivos reais do bot que sera replicado para cada cliente.

Evite deixar no repo:

- `.env`
- `node_modules`
- logs
- backups
- segredos

O manager ja exclui `.env`, `.git`, `.github`, `node_modules` e alguns arquivos temporarios quando remonta o zip final.

## 3. Criar um token de leitura

Se o repo for privado, crie um Fine-grained Personal Access Token no GitHub com permissao minima de leitura no repositorio.

Escopo minimo recomendado:

- `Contents: Read-only`

No manager, voce pode usar:

- `GITHUB_TOKEN` para um token global
- ou `SOURCE_GITHUB_TOKEN_<SOURCE_SLUG>` para um token por source

## 4. Configurar no bot manager

Voce pode fazer isso por variavel de ambiente ou direto pelo Discord com `/configpainel`.

Exemplo por comando:

```text
/configpainel produto_slug:bot-ticket-hype source_tipo:github_repo source_valor:hypevalorant/bot-ticket-hype source_ref:main source_token:ghp_xxx
```

Se a source estiver em subpasta:

```text
/configpainel produto_slug:bot-ticket-hype source_tipo:github_repo source_valor:hypevalorant/bots-monorepo source_ref:main source_path:apps/bot-ticket-hype source_token:ghp_xxx
```

Se quiser excluir pastas do zip gerado:

```text
/configpainel produto_slug:bot-ticket-hype source_excluir:data,transcripts,logs
```

Exemplo para o produto `bot-ticket-hype`:

```env
SOURCE_GITHUB_REPO_BOT_TICKET_HYPE=hypevalorant/bot-ticket-hype
SOURCE_GITHUB_REF_BOT_TICKET_HYPE=main
SOURCE_GITHUB_TOKEN_BOT_TICKET_HYPE=seu_token_aqui
SOURCE_EXCLUDE_PATHS_BOT_TICKET_HYPE=data,transcripts
```

Se a source estiver em subpasta:

```env
SOURCE_GITHUB_REPO_BOT_TICKET_HYPE=hypevalorant/bots-monorepo
SOURCE_GITHUB_REF_BOT_TICKET_HYPE=main
SOURCE_GITHUB_PATH_BOT_TICKET_HYPE=apps/bot-ticket-hype
SOURCE_GITHUB_TOKEN_BOT_TICKET_HYPE=seu_token_aqui
SOURCE_EXCLUDE_PATHS_BOT_TICKET_HYPE=data,transcripts
```

## 5. O que o manager faz depois

Quando uma venda aprovar e a instancia for provisionada, o manager:

1. baixa o zip do repo no GitHub
2. extrai so a pasta da source, se `SOURCE_GITHUB_PATH_<SOURCE_SLUG>` existir
3. injeta `manager-runtime.js` e `squarecloud.app`
4. envia o pacote final para a SquareCloud
5. injeta o token do bot do cliente e inicia a app

## 6. Atualizar a source

Para novas vendas, basta dar push no repo e, se quiser travar uma versao especifica, trocar `SOURCE_GITHUB_REF_<SOURCE_SLUG>` para:

- branch
- tag
- commit

Se quiser previsibilidade total em producao, prefira usar tags como:

- `v1.0.0`
- `v1.0.1`

Assim cada rodada de vendas pode apontar para uma release especifica.
