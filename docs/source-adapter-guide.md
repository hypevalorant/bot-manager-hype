# Como adaptar sua source ao manager

## O objetivo

Sua source do bot nao deve cuidar de:

- cobranca
- renovacao
- validade da assinatura
- ownership comercial

Ela deve cuidar apenas de:

- iniciar o bot
- carregar config
- executar comandos
- mandar heartbeat
- obedecer bloqueio remoto

## Fluxo ideal dentro da source

1. O container ou processo sobe com `INSTANCE_ID` e `INSTANCE_SECRET`.
2. A source chama `POST /internal/instances/bootstrap`.
3. O manager responde:
   - status da licenca
   - data de expiracao
   - config do cliente
4. O bot inicia normalmente.
5. A cada intervalo, a source manda heartbeat.
6. Se o manager responder `desiredState = suspended`, a source bloqueia operacao e encerra.

## Arquivo de exemplo

Voce ja tem um cliente de exemplo em:

- `src/examples/source-runtime-client.ts`

Esse arquivo serve como base para encaixar qualquer source sua no manager.

## O que mudar em cada source sua

### Source de tickets

- trocar config local por config vinda do manager
- salvar transcripts e logs em storage central, se quiser
- bloquear criacao de tickets se a instancia estiver suspensa

### Source de loja

- carregar catalogo e integracoes por config do manager
- travar checkout se a licenca expirar
- manter webhooks externos desacoplados do billing da assinatura

## O modelo certo para pensar

Cada source sua vira um "motor".

O manager vira:

- o painel
- o billing
- a licenca
- o provisionamento
- o controle de expiracao

Isso te deixa com um negocio bem mais escalavel.
