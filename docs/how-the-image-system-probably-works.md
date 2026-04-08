# Como o sistema das imagens provavelmente funciona

Isto e uma inferencia tecnica baseada nas imagens que voce enviou.

## O que parece estar acontecendo

O sistema das imagens tem cara de operar assim:

1. existe um `manager bot` central
2. ele consulta uma base de dados com apps ou instancias por cliente
3. cada app mostrada no embed tem:
   - nome da aplicacao
   - status
   - uso de ram e cpu
   - trafego
   - uptime
   - data de expiracao
   - id interno
4. quando o cliente compra, o sistema:
   - cria ou ativa uma assinatura
   - vincula uma app a esse cliente
   - sobe a source desse bot
   - entrega o OAuth da app para ele adicionar ao servidor

## O mais provavel sobre a arquitetura

### Cenario mais provavel: 1 app/token por cliente

Pelas imagens, eu considero este o desenho mais provavel:

- ele tem varias apps do Discord prontas ou cria de forma semi-manual
- cada cliente recebe uma app exclusiva
- a source do bot roda em processo ou container separado por cliente
- o manager so controla tudo de fora

Sinais disso:

- cada cliente parece ter uma "aplicacao" propria
- existe operacao de ligar, desligar e reiniciar por aplicacao
- existe link especifico para adicionar "seu bot"
- existe expiracao e delecao por aplicacao

Isso bate mais com instancia dedicada do que com um bot unico compartilhado.

### Cenario alternativo: 1 source base clonada varias vezes

Outra possibilidade:

- ele tem uma mesma source
- sobe varias instancias dessa mesma source
- cada instancia recebe token e config diferentes

Na pratica, isso ainda e "1 bot por cliente", so que todas as instancias vem da mesma base de codigo.

## O que quase certamente ele nao faz

O que eu considero menos provavel:

- um unico bot compartilhado para todos os clientes com o mesmo invite
- entrega da source para cada comprador
- transferencia real de ownership do app Discord para cada cliente

As imagens passam uma experiencia de "aplicacao dedicada", nao de bot compartilhado.

## Como isso funciona por baixo

O fluxo normalmente seria:

1. Cliente compra no bot de vendas.
2. Gateway confirma pagamento.
3. Manager escolhe uma app livre do pool.
4. Manager sobe a source com o token daquela app.
5. Manager grava `cliente -> app -> instancia -> expiracao`.
6. Manager entrega o OAuth da app ao cliente.
7. Cliente adiciona o bot ao servidor dele.
8. Se expirar:
   - manager suspende a instancia
   - avisa por DM
   - se nao renovar, remove a instancia e recicla a app

## Resposta curta para sua pergunta

A leitura mais provavel e:

- ele separa os bots por cliente
- usa a mesma source-base varias vezes
- cada cliente ganha uma instancia ou app propria
- o OAuth liberado apos pagamento vem da app que foi reservada para aquele cliente

Ou seja: ele nao esta entregando source; ele esta alugando uma instancia pronta do bot.
