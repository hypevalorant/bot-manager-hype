# Provisionamento com Square Cloud

## O que muda no seu projeto

Com Square Cloud, o fluxo ideal fica assim:

1. cliente paga
2. seu billing aprova a assinatura
3. seu backend cria ou atualiza uma app na Square Cloud
4. seu backend salva o `squarecloud_app_id`
5. seu backend pode salvar tambem o `squarecloud_account_id` para rastrear qual conta hospedou a instancia
6. seu backend vincula uma app do Discord ao cliente
7. seu backend gera o OAuth
8. cliente adiciona o bot ao servidor

## Diferenca entre Discord e Square Cloud

### Discord

Serve para:

- criar o bot
- gerar o OAuth
- instalar no servidor do cliente

### Square Cloud

Serve para:

- hospedar a source
- iniciar e parar o processo
- reiniciar
- entregar metricas
- mostrar logs

## Modelo que eu recomendo

### Pool para Discord

Como o Discord nao tem fluxo publico simples para criar apps em massa por API documentada, o melhor e manter:

- pool de apps do Discord
- 1 app reservada por cliente

### Criacao automatica na Square Cloud

Na Square Cloud, o mais natural e:

- fazer upload de uma app por cliente
- guardar o `app_id` retornado
- usar esse `app_id` para status, start, stop e restart

## Como isso conversa com a imagem

O card mostrado no Discord fica assim:

- nome, cpu, ram, storage, network e uptime: Square Cloud
- expira em: seu banco
- adicionar ao servidor: OAuth do Discord

## Quando o cliente renova

Normalmente voce nao precisa recriar a app da Square Cloud.

Basta:

- atualizar `expires_at` no banco
- religar se estiver suspensa
- manter o mesmo OAuth se a app do Discord for a mesma

## Quando voce atualiza a source

Voce pode:

- fazer `commit` na app da Square Cloud
- reiniciar a app
- manter a mesma assinatura, a mesma app do Discord e o mesmo cliente

## Quando expira de vez

Voce pode seguir um destes caminhos:

### Caminho 1: suspender e reciclar depois

- parar a app na Square Cloud
- manter por alguns dias
- se nao renovar, deletar ou reciclar

### Caminho 2: deletar logo

- parar
- apagar dados da instancia
- deletar a app hospedada

Eu recomendo o caminho 1 porque reduz risco de arrependimento e facilita reativacao.
