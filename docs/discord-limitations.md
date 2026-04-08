# Limites reais do Discord para esse projeto

Consulta feita com base na documentacao oficial do Discord acessada em 2026-04-07.

## O que da para fazer

- manter apps e bots na sua team
- gerar link OAuth2 para o cliente adicionar o bot ao servidor dele
- usar instalacao por guild
- compartilhar acesso administrativo da app com membros da sua team

## O que exige cuidado

### 1. A app tem owner e pode pertencer a uma team

Na documentacao do objeto Application, o Discord mostra que a app possui campos `owner` e `team`.

Link:
- https://docs.discord.com/developers/resources/application

Implicacao pratica:

- ownership da app e conceito do proprio Discord
- isso e diferente do seu "dono comercial" da assinatura

### 2. Compartilhar app e feito via Developer Team

O artigo oficial sobre Developer Team explica que a team e a base para compartilhar propriedade e acesso de apps entre colaboradores.

Link:
- https://support-dev.discord.com/hc/pt-br/articles/34905563063703-Criando-e-gerenciando-uma-equipe-de-desenvolvimento

Implicacao pratica:

- o modelo suportado oficialmente e manter a app em uma team sua
- nao baseie o produto em transferir ownership da app para cada comprador

### 3. O cliente pode instalar o bot com OAuth2

O fluxo oficial para adicionar o bot a um servidor e OAuth2 / Guild Install.

Link:
- https://docs.discord.com/developers/platform/oauth2-and-permissions

Implicacao pratica:

- isso atende bem o botao "Adicionar ao servidor"
- o cliente nao precisa receber token nem acesso ao portal da app

### 4. Nao encontrei endpoint publico documentado para criar ou deletar apps

Na referencia publica de Application Resource ha endpoints documentados para leitura/edicao da app atual, mas nao aparece endpoint publico documentado para:

- criar uma nova application
- deletar uma application
- transferir ownership automaticamente por API publica

Link:
- https://docs.discord.com/developers/resources/application

Implicacao pratica:

- trate isso como limitacao de produto
- se quiser muitas apps, use pool pre-criado
- nao prometa "criar app do zero e passar posse automaticamente" como fluxo principal

## Conclusao recomendada

O desenho mais seguro e:

- sua team continua dona das apps
- o comprador vira dono da assinatura no seu sistema
- a instalacao no servidor dele e feita por invite OAuth2
- expiracao e delete sao do servico/instancia, nao da ownership Discord

## Traducao disso para o seu negocio

Use estes termos no sistema:

- `discord_app_owner`: sua team
- `commercial_owner`: o cliente que assinou
- `instance_status`: active, grace, suspended, deleted

Assim voce fica alinhado com a realidade tecnica e comercial.
