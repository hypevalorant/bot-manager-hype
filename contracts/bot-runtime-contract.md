# Contrato para integrar qualquer source ao manager

Toda source que voce quer vender deve obedecer ao mesmo contrato de runtime.

## Objetivo

Separar a regra de negocio da assinatura da regra do bot.

Assim:

- o manager controla billing, expiracao e provisionamento
- cada source so executa o servico do bot
- voce pode conectar novas sources sem reescrever o manager

## Env vars padrao

Cada instancia deve subir com estas env vars:

- `MANAGER_API_URL`
- `INSTANCE_ID`
- `INSTANCE_SECRET`
- `SOURCE_SLUG`
- `SOURCE_VERSION`
- `BOT_TOKEN`
- `NODE_ENV`

Opcional:

- `LOG_LEVEL`
- `HEARTBEAT_INTERVAL_MS`
- `TENANT_TIMEZONE`

## Fluxo de bootstrap

Ao iniciar, a source deve chamar:

`POST /internal/instances/bootstrap`

Payload:

```json
{
  "instanceId": "uuid-da-instancia",
  "instanceSecret": "segredo-assinado-pelo-manager",
  "sourceSlug": "bot-ticket-hype",
  "sourceVersion": "1.4.0"
}
```

Resposta esperada:

```json
{
  "ok": true,
  "instance": {
    "id": "uuid-da-instancia",
    "status": "running",
    "expiresAt": "2026-04-30T23:59:59.000Z"
  },
  "tenant": {
    "customerDiscordUserId": "1234567890",
    "assignedGuildId": null
  },
  "config": {
    "prefix": "!",
    "language": "pt-BR",
    "features": {
      "tickets": true,
      "transcript": true
    }
  }
}
```

## Heartbeat

A source deve enviar heartbeat periodico:

`POST /internal/instances/heartbeat`

Payload:

```json
{
  "instanceId": "uuid-da-instancia",
  "instanceSecret": "segredo",
  "metrics": {
    "guildCount": 1,
    "memoryMb": 118,
    "cpuPercent": 1.8,
    "uptimeSeconds": 86400
  }
}
```

Resposta:

```json
{
  "ok": true,
  "desiredState": "running",
  "nextConfigVersion": 2,
  "expiresAt": "2026-04-30T23:59:59.000Z"
}
```

## Config refresh

Se `nextConfigVersion` mudar, a source deve buscar:

`GET /internal/instances/:instanceId/config`

## Eventos

A source deve publicar eventos importantes:

`POST /internal/instances/events`

Exemplos:

- `bot_ready`
- `guild_joined`
- `guild_left`
- `command_error`
- `license_blocked`
- `shutdown_started`

## Regras obrigatorias na source

### 1. Nunca decidir licenca sozinha

A source nao deve guardar a "verdade" da assinatura localmente.

Quem decide:

- ativa
- grace
- suspensa
- expirada

e sempre o manager.

### 2. Bloqueio remoto

Se o manager responder `desiredState = suspended`:

- desativar comandos
- enviar evento
- encerrar processo de forma controlada

### 3. Sem token exposto ao cliente

O token fica somente no runtime gerenciado por voce.

### 4. Config multitenant opcional

Mesmo com uma app dedicada por cliente, a source deve suportar config externa para facilitar upgrades.

## Endpoints internos recomendados no manager

- `POST /internal/instances/bootstrap`
- `POST /internal/instances/heartbeat`
- `GET /internal/instances/:id/config`
- `POST /internal/instances/:id/events`
- `POST /internal/instances/:id/ack-shutdown`

## Comandos remotos recomendados

O orchestrator deve conseguir:

- start
- stop
- restart
- rotate-token
- refresh-config
- quarantine

## Checklist para adaptar uma source sua

1. Remover billing da source.
2. Mover configuracao para env vars + API central.
3. Criar bootstrap inicial.
4. Implementar heartbeat.
5. Implementar bloqueio remoto por licenca.
6. Publicar eventos no manager.
7. Padronizar logs.
