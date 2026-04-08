# Mapeamento do card com Square Cloud

## De onde vem cada informacao do card

Se o seu bot vai rodar na Square Cloud, o card da imagem normalmente mistura 3 fontes:

### 1. Dados da Square Cloud

Vem da API da hospedagem:

- `status`
- `cpu`
- `ram em uso`
- `storage ou ssd`
- `network total`
- `network now`
- `uptime`
- `nome da app`
- `id da app`

### 2. Dados do Discord

Vem da app do Discord:

- `client_id` para gerar o OAuth
- nome visual do bot, quando voce quiser usar o nome da aplicacao do Discord

### 3. Dados do seu manager

Vem do seu sistema:

- `expira em`
- plano semanal ou mensal
- dono comercial
- dias restantes
- bloqueio por falta de pagamento
- delete agendado

## Leitura do card da sua imagem

### `Aplicacao: BOT HYPE (Bot Store)`

Muito provavelmente:

- nome da app na Square Cloud
- ou nome do produto salvo no seu banco

### `Status: Em execucao`

Quase certamente vem da Square Cloud.

### `Cpu`

Vem da Square Cloud.

### `Memoria Ram 110.4MB/200MB`

O uso atual tende a vir da Square Cloud.

O limite `200MB` normalmente vem de:

- plano da propria Square Cloud
- ou config salva no manager

### `SSD 1.172GB`

Vem da Square Cloud.

### `Network(Total)` e `Network(Now)`

Vem da Square Cloud.

### `UpTime`

Vem da Square Cloud.

### `Expira em: 23 de abril de 2026`

Isso nao e da Square Cloud.

Isso vem do seu banco de assinaturas.

### `ID 5cca15b...`

Provavelmente e o `app_id` da Square Cloud ou um id interno espelhando esse app.

## O que os botoes fazem

### `Ligar`

Chama start da hospedagem.

### `Desligar`

Chama stop da hospedagem.

### `Reiniciar`

Chama restart da hospedagem.

### `Configuracoes`

Abre funcoes do seu proprio manager:

- alterar nome
- trocar token
- transferir posse comercial
- deletar instancia
- mostrar OAuth

## Como pensar a arquitetura

Square Cloud e a camada de runtime.

Seu manager e a camada de negocio.

Discord e a camada de instalacao do bot no servidor do cliente.

Resumo:

- Square Cloud = hospeda e entrega metricas
- Discord = instala o bot
- seu manager = vende, renova, expira e controla acesso
