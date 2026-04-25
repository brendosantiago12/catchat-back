# Play Love - CatChat

> Plataforma de envio de mensagens anonimas via WhatsApp com pagamento PIX, assistente de IA e tunel de conversa anonima.

---

## Sumario

- [Visao Geral](#visao-geral)
- [Produtos](#produtos)
- [Tecnologias](#tecnologias)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Variaveis de Ambiente](#variaveis-de-ambiente)
- [Como Startar o Projeto](#como-startar-o-projeto)
- [Endpoints da API](#endpoints-da-api)
- [Modelos de Dados](#modelos-de-dados)
- [Fluxo Principal](#fluxo-principal)
- [Fluxo do Destinatario](#fluxo-do-destinatario)
- [Tunel de Mensagens](#tunel-de-mensagens)
- [Diagrama de Estados](#diagrama-de-estados)
- [Integracoes Externas](#integracoes-externas)
- [Observacoes Importantes](#observacoes-importantes)
- [Endpoints de Desenvolvimento](#endpoints-de-desenvolvimento)

---

## Visao Geral

O **Play Love** e um backend que permite que usuarios enviem mensagens anonimas para outras pessoas via WhatsApp. O fluxo funciona da seguinte forma:

1. O remetente escolhe um produto, preenche os dados do destinatario e a mensagem secreta
2. O sistema gera um QR Code PIX para pagamento via Pagar.me
3. Apos a confirmacao do pagamento (webhook), a mensagem e entregue ao destinatario via WhatsApp
4. O destinatario interage com o bot **CatChat** para ler a mensagem e, dependendo do produto, entrar em um tunel de conversa anonima com o remetente

---

## Produtos

| Produto | Descricao | Tunel |
|---|---|---|
| **Mensagem Unica** (`MESSAGE_ONLY`) | Envia 1 mensagem anonima para 1 destinatario | Nao |
| **Mensagem + Tunel** (`MESSAGE_TUNNEL`) | Envia 1 mensagem e oferece tunel de conversa anonima (ate 15 trocas) | Sim |
| **Ilimitado Anual** (`UNLIMITED`) | Envia mensagens para quantos destinatarios quiser durante 1 ano; cria tunel com cada um | Sim |

O produto e definido no momento do envio e fica registrado na mensagem e no pagamento.

---

## Tecnologias

| Tecnologia | Versao | Finalidade |
|---|---|---|
| **NestJS** | 11 | Framework principal |
| **TypeScript** | 5.7 | Linguagem |
| **MongoDB + Mongoose** | 8.15 | Banco de dados |
| **whatsapp-web.js** | 1.33 | Automacao WhatsApp |
| **LangChain** | 0.3.43 | Chains de IA |
| **OpenAI (GPT-4o-mini)** | - | Modelo de linguagem |
| **Pagar.me** | - | Pagamento PIX |
| **Puppeteer** | - | Navegador headless para WhatsApp |
| **Jest** | - | Testes |

---

## Estrutura de Pastas

```
play-love/
├── src/
│   ├── main.ts                          # Ponto de entrada da aplicacao
│   ├── app.module.ts                    # Modulo raiz
│   │
│   ├── assistent/                       # Modulo do assistente (IA + WhatsApp)
│   │   ├── assistent.module.ts
│   │   ├── ai/
│   │   │   ├── ai.service.ts            # Orquestra as chains de IA (remetente)
│   │   │   ├── chains/
│   │   │   │   ├── baseChain.ts         # Classe abstrata base para todas as chains
│   │   │   │   ├── routerChain.ts       # Detecta a intencao do remetente
│   │   │   │   ├── generalChain.ts      # Conversa geral com o bot
│   │   │   │   └── alertOfSendChain.ts  # Confirmacao de envio para o remetente
│   │   │   └── prompt/
│   │   │       └── prompt-cupido.ts     # Templates de prompt do Cupido
│   │   │
│   │   ├── pre-hooks/                   # Pipeline de pre-processamento de mensagens
│   │   │   ├── interfaces/
│   │   │   │   └── message-hook.interface.ts  # IMessageHook, MessageContext, MessageIntent
│   │   │   ├── message-pipeline.service.ts    # Orquestra a cadeia de hooks
│   │   │   ├── rate-limit.hook.ts             # Bloqueia envios excessivos
│   │   │   ├── debounce.hook.ts               # Agrupa mensagens (janela configuravel)
│   │   │   ├── tunnel.hook.ts                 # Roteia mensagens #tag para tuneis ativos
│   │   │   └── classification.hook.ts         # Classifica intencao do destinatario com IA
│   │   │
│   │   ├── services/
│   │   │   ├── message-delivery.service.ts    # Entrega carta, pergunta tunel, encerra sem tunel
│   │   │   └── tunnel.service.ts              # Abre, roteia e expira tuneis de conversa
│   │   │
│   │   ├── whatsapp/
│   │   │   ├── whatsapp.service.ts      # Cliente WhatsApp (whatsapp-web.js); implementa IMessageSender
│   │   │   ├── whatsappSessionStore.ts  # Persistencia de sessao no MongoDB GridFS
│   │   │   ├── whatsappFormater.service.ts  # Formatacao de numeros de telefone BR
│   │   │   └── qr-controller.controller.ts  # GET /qr-controller — QR Code de autenticacao
│   │   │
│   │   └── conversation/
│   │       ├── conversation.service.ts  # Gerencia historico de conversas do remetente
│   │       └── conversation.schema.ts   # Schema MongoDB de conversas
│   │
│   ├── common/
│   │   ├── messaging/
│   │   │   └── messaging.interface.ts   # IMessageSender + token MESSAGE_SENDER
│   │   └── utils/
│   │       ├── debouncer.ts             # Utilitario de debounce de mensagens
│   │       └── tag-generator.ts         # Gera tags unicas para tuneis (#joao_silva)
│   │
│   ├── controller/
│   │   ├── health-check.controller.ts   # GET /health
│   │   ├── process-data.controller.ts   # POST /api/messages/qrcode e POST /api/messages
│   │   └── webhook.controller.ts        # POST /api/webhook (confirmacao Pagar.me)
│   │
│   ├── service/
│   │   ├── process-data.service.ts      # Coordena criacao de usuario, pagamento e mensagem
│   │   ├── pagarme.service.ts           # Integracao Pagar.me; valor varia por produto
│   │   ├── process-webhook.service.ts   # Confirma pagamento; cria Subscription no produto 3
│   │   └── send-message.service.ts      # Salva SendMessage normalizado e dispara boas-vindas
│   │
│   ├── schema/
│   │   ├── schemas.ts                   # Schemas: User, Payment, Message
│   │   ├── send-message.schema.ts       # Schema: SendMessage (com productType e recipientState)
│   │   ├── tunnel-session.schema.ts     # Schema: TunnelSession (com tag e TTL)
│   │   └── subscription.schema.ts       # Schema: Subscription (produto ilimitado anual)
│   │
│   ├── dto/
│   │   ├── dto.ts                       # DTOs principais (inclui productType em FormDataDto)
│   │   └── send-message.dto.ts          # DTO de SendMessage (inclui productType)
│   │
│   └── exception/
│       └── GlobalExceptionFilter.ts     # Filtro global de excecoes
│
├── .env                                 # Variaveis de ambiente (nao versionar)
├── .env.example                         # Template de variaveis de ambiente
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## Variaveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores:

```bash
cp .env.example .env
```

| Variavel | Descricao | Exemplo |
|---|---|---|
| `MONGODB_URI` | URI de conexao com o MongoDB | `mongodb://127.0.0.1:27017/message-app` |
| `OPENAI_API_KEY` | Chave de API da OpenAI | `sk-proj-...` |
| `JWT_SECRET` | Segredo para assinar tokens JWT | `meu_jwt_secret` |
| `JWT_REFRESH_SECRET` | Segredo para refresh tokens | `meu_refresh_secret` |
| `WHATSAPP_CLIENT_ID` | ID da sessao do WhatsApp | `cupido-session` |
| `PAGARME_URL` | URL base da API do Pagar.me | `https://api.pagar.me/core/v5` |
| `PAGARME_API_KEY` | Chave de API do Pagar.me | `ak_...` |
| `AMOUNT_PIX_MESSAGE_ONLY` | Valor do produto 1 em centavos | `500` (= R$ 5,00) |
| `AMOUNT_PIX_MESSAGE_TUNNEL` | Valor do produto 2 em centavos | `900` (= R$ 9,00) |
| `AMOUNT_PIX_UNLIMITED` | Valor do produto 3 em centavos | `4900` (= R$ 49,00) |
| `START_RATE_LIMIT` | Mensagens liberadas por pagamento (produtos 1 e 2) | `1` |
| `RATE_LIMIT_MAX_MESSAGES` | Maximo de msgs por janela de tempo | `10` |
| `RATE_LIMIT_WINDOW_MS` | Duracao da janela de rate limit (ms) | `60000` |
| `DEBOUNCE_DELAY_MS` | Janela de agrupamento de mensagens (ms) | `5000` |

---

## Como Startar o Projeto

### Pre-requisitos

- **Node.js** >= 18
- **MongoDB** rodando localmente ou URI remota
- **Google Chrome** instalado (necessario para whatsapp-web.js / Puppeteer)
- Conta na **OpenAI** com chave de API
- Conta no **Pagar.me** com chave de API

### Instalacao

```bash
npm install
cp .env.example .env
# Edite o .env com suas credenciais
```

### Desenvolvimento

```bash
npm run start:dev
```

O servidor sobe na porta `3000`. Na primeira execucao, acesse `GET /qr-controller` no navegador para autenticar o WhatsApp.

### Producao

```bash
npm run build
npm run start:prod
```

### Testes

```bash
npm run test
npm run test:e2e
npm run test:cov
```

### Autenticacao do WhatsApp

1. Inicie o servidor
2. Acesse `http://localhost:3000/qr-controller`
3. Escaneie o QR Code com o celular que sera usado como bot
4. A sessao e salva automaticamente no MongoDB (GridFS) — nao precisa repetir

---

## Endpoints da API

### `GET /health`
Verifica se o servidor esta no ar.

**Resposta:**
```json
{ "status": "ok" }
```

---

### `GET /qr-controller`
Retorna a imagem PNG com o QR Code para autenticacao do WhatsApp.

---

### `POST /api/messages/qrcode`
Registra o usuario e a mensagem, e gera o QR Code PIX para pagamento.

**Body:**
```json
{
  "userData": {
    "nome": "Joao Silva",
    "celular": "11999999999",
    "email": "joao@email.com",
    "taxId": "12345678901"
  },
  "formData": {
    "nomeDestinario": "Maria",
    "numeroDestinario": "11988888888",
    "mensagem": "Voce e incrivel!",
    "productType": "MESSAGE_TUNNEL"
  }
}
```

`productType` aceita: `"MESSAGE_ONLY"` | `"MESSAGE_TUNNEL"` | `"UNLIMITED"`

**Resposta:**
```json
{
  "id_mensagem": "uuid-da-mensagem",
  "brCode": "00020126...",
  "brCodeBase64": "data:image/png;base64,..."
}
```

---

### `POST /api/messages`
Envia a mensagem diretamente usando saldo existente (`rate_limit > 0` ou `Subscription` ativa).

**Body:** mesmo formato do endpoint acima.

**Resposta:**
```json
{
  "rate_limit": 2,
  "hasSubscription": false
}
```

---

### `POST /api/webhook`
Recebe a confirmacao de pagamento do Pagar.me. Uso interno — chamado automaticamente pelo Pagar.me.

---

## Modelos de Dados

### User
```typescript
{
  nome: string;
  celular: string;
  email: string;
  taxId: string;       // CPF
  rate_limit: number;  // Saldo de mensagens (produtos 1 e 2)
  user_id: string;     // UUID unico
}
```

### Payment
```typescript
{
  user_id: string;
  id_compra: string;   // ID do pedido no Pagar.me
  amount: number;      // Valor em centavos
  expiresAt: string;   // Expiracao do QR Code
  qrCode: string;      // Codigo PIX (copia e cola)
  qrCodeUrl: string;   // URL da imagem do QR Code
  status: string;      // "pending" | "paid"
  productType: string; // "MESSAGE_ONLY" | "MESSAGE_TUNNEL" | "UNLIMITED"
}
```

### Message
```typescript
{
  id_mensagem: string;      // UUID
  id_user: string;          // ID do remetente
  userName: string;
  numeroRemetente: string;
  nomeDestinario: string;
  numeroDestinario: string;
  mensagem: string;
  status_message: string;   // "PENDING" | "SENT"
  productType: string;      // "MESSAGE_ONLY" | "MESSAGE_TUNNEL" | "UNLIMITED"
}
```

### SendMessage
```typescript
{
  senderName: string;
  senderPhone: string;      // Normalizado via WhatsappFormatter
  senderMessage: string;
  recipientName: string;
  recipientPhone: string;   // Normalizado via WhatsappFormatter
  status: boolean;          // false = nao lida, true = lida
  recipientState: string;   // "WAITING_READ" | "WAITING_TUNNEL" | "TUNNEL_ACTIVE" | "DONE"
  productType: string;      // "MESSAGE_ONLY" | "MESSAGE_TUNNEL" | "UNLIMITED"
}
```

### TunnelSession
```typescript
{
  senderPhone: string;
  recipientPhone: string;
  status: string;           // "ACTIVE" | "DONE"
  messagesRemaining: number;// Maximo 15; decrementado a cada mensagem do remetente
  expiresAt: Date;          // TTL de 24h; MongoDB expira automaticamente
  tag: string;              // Ex: "joao_silva" — usada para rotear com #tag
}
```

### Subscription
```typescript
{
  userPhone: string;        // Telefone normalizado do remetente
  status: string;           // "ACTIVE" | "EXPIRED"
  expiresAt: Date;          // TTL de 1 ano; MongoDB expira automaticamente
}
```

### UserConversation
```typescript
{
  userId: string;           // ID do contato no WhatsApp
  messages: [
    { role: "user" | "assistant"; content: string; timestamp: Date; }
  ];
  lastActivity: Date;
}
```

---

## Fluxo Principal

```
                     REMETENTE
                         |
                         v
              [Preenche formulario + escolhe produto]
                         |
                         v
              [POST /api/messages/qrcode]
                         |
                         v
           [ProcessDataService]
           ┌──────────────────────────────┐
           │ 1. Cria/atualiza User        │
           │ 2. Gera PIX (valor por prod.)│
           │ 3. Salva Payment+productType │
           │ 4. Salva Message (PENDING)   │
           └──────────────────────────────┘
                         |
                         v
              [Retorna QR Code PIX]
                         |
              [Remetente paga o PIX]
                         |
                         v
          [Pagar.me chama POST /api/webhook]
                         |
                         v
           [ProcessWebHookService]
           ┌──────────────────────────────┐
           │ 1. Confirma pagamento        │
           │ 2. Busca msg PENDING         │
           │ 3. Envia via WhatsApp        │
           │ 4. Atualiza msg para SENT    │
           │ 5a. Produto 1/2: rate_limit++│
           │ 5b. Produto 3: cria/renova   │
           │     Subscription (1 ano)     │
           └──────────────────────────────┘
                         |
                         v
           [SendMessageService salva SendMessage]
           [MessageDeliveryService.sendWelcome()]
                         |
                         v
        [WHATSAPP: Bot envia boas-vindas ao DESTINATARIO]
```

---

## Fluxo do Destinatario

```
[Destinatario recebe boas-vindas do bot]
"Ooi Maria! Parece que voce tem um admirador secreto..."
                         |
                         v
         [Destinatario responde ao bot]
                         |
                         v
         [WhatsappService recebe mensagem]
                         |
                         v
         [MessagePipelineService — cadeia de hooks]
         ┌───────────────────────────────────┐
         │ 1. RateLimitHook                  │
         │ 2. DebounceHook (agrupa msgs)     │
         │ 3. TunnelHook (#tag? → roteia)   │
         │ 4. ClassificationHook (IA)        │
         └───────────────────────────────────┘
                         |
         ┌───────────────┼───────────────┐
         v               v               v
   READ_MESSAGE    TUNNEL_ACCEPT      GENERAL
         |               |               |
         v               v               v
  [Entrega carta]  [Abre tunel]    [AiService]
         |               |           (conversa livre)
         v               |
   [Produto sem tunel?]  |
     SIM: encerra        |
     NAO: pergunta tunel-┘
```

**Classificacao por estado (`recipientState`):**

| Estado | Prompt usado | Intencao detectada |
|---|---|---|
| `WAITING_READ` | readMessagePrompt | `READ_MESSAGE` ou `GENERAL` |
| `WAITING_TUNNEL` | tunnelAcceptPrompt | `TUNNEL_ACCEPT` ou `GENERAL` |
| `TUNNEL_ACTIVE` | — | Roteado pelo TunnelHook via #tag |
| `DONE` | — | Passa para AiService (conversa livre) |

---

## Tunel de Mensagens

O tunel permite uma conversa anonima bidirecional entre remetente e destinatario.

### Abertura
1. Destinatario aceita entrar no tunel
2. `TunnelService.open()` cria `TunnelSession` com tag gerada automaticamente
3. Remetente recebe: *"Para falar com joao_silva, comece com #joao_silva"*
4. Destinatario recebe: *"Para responder, comece com #admirador"*

### Roteamento por #tag
- Mensagem comeca com `#joao_silva` → roteada para o tunel correspondente
- Mensagem comeca com `#admirador` → roteada de volta para o remetente
- Mensagem sem `#` com tunel ativo → bot instrui o usuario a usar a tag
- Tag invalida → bot avisa que nao encontrou tunel

### Tags e colisao
Tags sao geradas a partir do nome do destinatario: `"Joao da Silva"` → `#joao_da_silva`. Se o remetente ja tem um tunel com alguem chamado Joao, a proxima tag sera `#joao_da_silva_2`.

### Limites
- Ate **15 mensagens** do remetente por tunel
- Expira em **24 horas** (TTL automatico no MongoDB)
- Multiplos tuneis simultaneos sao permitidos (um por destinatario)
- Remetente com produto 3 pode ter tuneis com varios destinatarios ao mesmo tempo

---

## Diagrama de Estados

### Estado do Destinatario (`recipientState`)

```
              [SendMessage criado]
                      |
                      v
               +-------------+
               | WAITING_READ |  Bot pergunta se quer ler a carta
               +-------------+
                      |
              Destinatario confirma
                      |
                      v
           ┌──────────────────────┐
           │  productType?        │
           │  MESSAGE_ONLY → DONE │
           │  outros → continua   │
           └──────────────────────┘
                      |
                      v
              +--------------+
              |WAITING_TUNNEL|  Bot pergunta sobre o tunel
              +--------------+
                      |
              Destinatario aceita
                      |
                      v
              +--------------+
              |TUNNEL_ACTIVE |  Tunel em andamento
              +--------------+
                      |
          Tunel encerrado (15 msgs ou 24h)
                      |
                      v
               +------+
               |  DONE |
               +------+
```

### Estado do TunnelSession

```
             [Destinatario aceita tunel]
                        |
                        v
                  +--------+
                  | ACTIVE |  Mensagens em andamento
                  +--------+
                        |
        ┌───────────────┼──────────────────┐
        v               v                  v
  15 msgs enviadas   24h sem uso       Encerrado
        |               |              manualmente
        v               v
     +------+        +------+
     |  DONE |        |  DONE |
     +------+        +------+
  (MongoDB TTL expira o documento automaticamente)
```

---

## Integracoes Externas

### Pagar.me (Pagamento PIX)
- Cria cobranças PIX com expiracao de 1 hora
- Valor configuravel por produto via variaveis de ambiente
- Recebe confirmacao via webhook em `POST /api/webhook`

### OpenAI (GPT-4o-mini)
- Modelo: `gpt-4o-mini-2024-07-18`, temperature `0`
- Usado para classificacao de intencao do destinatario (READ_MESSAGE, TUNNEL_ACCEPT, GENERAL)
- Usado para respostas livres do remetente via GeneralChain (temperature `0.7`)

### WhatsApp Web (whatsapp-web.js)
- Automacao via Puppeteer (Chrome headless)
- Sessao persistida no MongoDB via GridFS
- Envio via interface `IMessageSender` (token `MESSAGE_SENDER`) — nao chamar o client diretamente

### MongoDB
- Usuarios, pagamentos, mensagens, conversas, tuneis e subscriptions
- TTL automatico em `TunnelSession.expiresAt` e `Subscription.expiresAt`
- GridFS para arquivos de sessao do WhatsApp

---

## Observacoes Importantes

- **Produtos e valores:** cada produto tem seu proprio valor PIX configurado no `.env`. O campo `productType` e obrigatorio em todos os endpoints de envio.
- **Subscription (produto 3):** enquanto ativa, o usuario pode enviar sem decrementar `rate_limit`. Renovar uma subscription ativa estende a data a partir de hoje.
- **Rate Limiting:** cada pagamento dos produtos 1 e 2 libera `START_RATE_LIMIT` envios. Usuarios com saldo positivo podem enviar sem novo pagamento via `POST /api/messages`.
- **Normalizacao de telefone:** todos os telefones sao normalizados via `WhatsappFormatter` antes de salvar no banco. Nunca salvar numero sem normalizar.
- **Tunel e roteamento:** mensagens sem `#tag` com tunel ativo nao sao processadas pela IA — o bot instrui o usuario a usar a tag correta.
- **Debounce:** multiplas mensagens enviadas em menos de `DEBOUNCE_DELAY_MS` ms sao agrupadas e processadas como uma unica entrada.
- **CORS:** atualmente aberto para todas as origens — restringir em producao.
- **Sessao WhatsApp:** se a sessao expirar, e necessario escanear o QR Code novamente via `GET /qr-controller`.
- **Webhook assincrono:** o processamento do webhook nao bloqueia a resposta HTTP (fire-and-forget).
- **TTL MongoDB:** documentos `TunnelSession` e `Subscription` expirados sao removidos automaticamente pelo MongoDB. O `@Cron` no `TunnelService` notifica os usuarios antes da remocao silenciosa.

---

## Endpoints de Desenvolvimento

Disponiveis **apenas** quando `NODE_ENV=development` (definido no `.env`). Em producao, as rotas retornam `404`.

### `POST /dev/seed`

Insere um conjunto de dados fake no banco (User + Payment + Message) prontos para simular um pagamento confirmado, sem precisar passar pelo Pagar.me.

**Body (opcional):**
```json
{ "productType": "MESSAGE_ONLY" }
```

`productType` aceita: `"MESSAGE_ONLY"` | `"MESSAGE_TUNNEL"` | `"UNLIMITED"`. Padrao: `"MESSAGE_ONLY"`.

**Resposta:**
```json
{
  "id_compra": "compra-teste-1744900000000",
  "curl": "curl -X POST http://localhost:3000/api/webhook -H \"Content-Type: application/json\" -d \"{\\\"data\\\":{\\\"id\\\":\\\"compra-teste-1744900000000\\\",\\\"status\\\":\\\"paid\\\"}}\""
}
```

O campo `curl` ja traz o comando pronto para disparar o webhook e simular a confirmacao do pagamento.

---

### `DELETE /dev/seed`

Remove todos os documentos inseridos pelo seed (User, Payment e Message com `user_id = "user-teste-001"`).

**Resposta:** `204 No Content`

---

### Fluxo de teste completo

```bash
# 1. Inserir dados fake
curl -X POST http://localhost:3000/dev/seed \
  -H "Content-Type: application/json" \
  -d '{"productType": "MESSAGE_ONLY"}'

# 2. Copiar o curl retornado e executar para simular o webhook
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"data": {"id": "compra-teste-<timestamp>", "status": "paid"}}'

# 3. Limpar os dados apos o teste
curl -X DELETE http://localhost:3000/dev/seed
```
