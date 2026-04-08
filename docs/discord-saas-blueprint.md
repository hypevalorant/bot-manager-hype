# Blueprint do projeto

## O que as imagens mostram

O fluxo visual das imagens e bom e passa a sensacao certa de produto:

- card de status da aplicacao
- acoes rapidas de ligar, desligar, reiniciar e configuracoes
- seletor de aplicacoes
- DM avisando expiracao e delete agendado
- renovacao por comando
- link pronto para adicionar o bot ao servidor

Essa UX funciona bem para vender "bot pronto para usar" sem entregar codigo.

## O ponto mais importante

Para o seu caso, eu recomendo separar duas ideias:

- `dono Discord da aplicacao`: continua sendo sua team
- `dono comercial da instancia`: e o cliente que assinou no seu sistema

Isso resolve quase tudo:

- voce protege a source
- nao depende de transferencia manual de app a cada venda
- consegue suspender, renovar e excluir a instancia com seguranca

## Arquitetura recomendada

### 1. Catalogo de bots

Cada bot que voce vende vira um produto:

- `bot-ticket-hype`

Cada produto tem:

- planos semanal e mensal
- limites
- versao da source
- manifesto de provisionamento
- pool de apps do Discord associado

### 2. Billing service

Responsavel por:

- criar cobranca
- receber webhook
- marcar pagamento como aprovado
- renovar assinatura
- agendar cobranca futura
- colocar em grace period

### 3. Provisioning service

Quando o pagamento e aprovado:

1. cria ou reativa a assinatura
2. reserva uma app livre do pool
3. injeta token/segredos no runtime
4. sobe a instancia da source
5. gera o invite URL
6. envia ao cliente por DM, painel ou comando

### 4. Runtime orchestrator

Responsavel por operar as instancias:

- start
- stop
- restart
- update config
- rotate secret
- collect logs
- healthcheck

Voce pode rodar isso em:

- Docker em VPS
- Pterodactyl
- Kubernetes

Se ja usa algo parecido com painel/host de app, o manager pode ser a camada de negocio por cima.

### 5. Manager API

Camada central com:

- clientes
- produtos
- planos
- apps do pool
- assinaturas
- instancias
- pagamentos
- eventos
- notificacoes

### 6. Manager Bot

O bot manager no Discord fica responsavel por:

- slash commands
- botoes
- select menus
- embeds de status
- renovacao rapida
- abrir painel/configuracoes
- mostrar link de instalacao

## Fluxo ideal de compra ate entrega

### Compra

1. O membro escolhe o bot e o plano.
2. Seu sistema cria um checkout.
3. O gateway confirma o pagamento via webhook.
4. O manager marca a assinatura como `active`.

### Provisionamento

5. O provisioning service pega uma app livre do pool.
6. Cria uma `bot_instance`.
7. Sobe a source do bot com configs do cliente.
8. Gera o link OAuth2 de instalacao.
9. Envia a mensagem com botao "Adicionar ao servidor".

### Pos-venda

10. O cliente instala o bot no servidor dele.
11. O manager salva quem comprou como `commercial_owner_discord_user_id`.
12. O bot entra em operacao.
13. O cliente gerencia pelo manager bot e/ou painel web.

## Fluxo de expiracao

### Antes de expirar

- DM 3 dias antes
- DM 1 dia antes
- aviso no painel/comando

### No vencimento

- muda para `past_due` ou `grace`
- bloqueia novas instalacoes
- pode manter online por 24h a 72h

### Fim do grace period

- para a instancia
- bloqueia comandos do bot do cliente
- agenda exclusao logica

### Exclusao

- apaga configs operacionais
- arquiva logs minimos
- libera a app para reciclagem ou quarantena

## O que eu recomendo fazer com as apps do Discord

Em vez de tentar criar/transferir apps automaticamente em cada venda:

- crie um pool de apps por produto
- cada venda consome uma app livre
- cada app continua na sua team
- o cliente recebe apenas o invite URL

Exemplo:

- pool `tickets`: 50 apps prontas
- pool `bot-ticket-hype`: 50 apps prontas

Quando o cliente cancela e a retencao acaba:

- a instancia e removida
- a app entra em `recycling`
- voce troca token/limpa configuracoes
- depois ela volta para `available`

## Como interligar com outras sources

Nao acople billing dentro de cada bot.

O certo e criar um contrato unico que toda source obedece:

- boot por `INSTANCE_ID`
- token vindo do manager
- config carregada da API central
- heartbeat periodico
- eventos enviados para o manager
- bloqueio automatico se a licenca estiver suspensa

Cada source fica assim:

1. recebe env vars do manager
2. faz bootstrap na API central
3. recebe config do tenant
4. inicia o bot
5. envia heartbeat
6. responde a comandos remotos

Isso permite vender varias sources com o mesmo manager.

## Modelos de produto

### Modelo 1: multi-tenant em uma unica app

Mais simples e barato.

- 1 app por produto
- muitos clientes no mesmo bot
- separacao por banco/config

Bom para MVP, mas com menos isolamento.

### Modelo 2: uma app dedicada por cliente

Mais proximo das suas imagens e mais premium.

- mais isolamento
- invite individual
- desligamento por cliente
- melhor experiencia comercial

Esse e o modelo que eu recomendo para o seu caso.

## Funcionalidades que valem muito a pena

- renovacao automatica
- cupom
- trial
- grace period configuravel
- suspensao sem delete imediato
- transferencia de "dono comercial"
- limites por plano
- logs de auditoria
- webhooks internos
- painel web para admin

## Sequencia de execucao recomendada

### Fase 1

- manager API
- banco
- webhook de pagamento
- pool de apps
- provisionamento manual assistido
- manager bot com `/apps`, `/status`, `/renovar`

### Fase 2

- provisionamento totalmente automatico
- painel web
- scheduler de expiracao
- notificacoes por DM
- pagina do cliente com install link

### Fase 3

- marketplace interno de bots
- addons por bot
- whitelabel parcial
- analytics
- revenda/subcontas
