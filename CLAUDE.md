# CLAUDE.md — Play Love (CatChat)

Guia para o Claude Code entender e colaborar neste projeto.

---

## O que e este projeto

Backend NestJS de uma plataforma de mensagens anonimas via WhatsApp. O remetente escolhe um produto, paga via PIX (Pagar.me), e apos a confirmacao do pagamento a mensagem e entregue ao destinatario pelo bot **CatChat** — um assistente de IA (GPT-4o-mini via LangChain) que roda sobre whatsapp-web.js.

---

## Produtos

| Produto | `productType` | Descricao |
|---|---|---|
| Mensagem Unica | `MESSAGE_ONLY` | 1 mensagem, sem tunel |
| Mensagem + Tunel | `MESSAGE_TUNNEL` | 1 mensagem + tunel anonimo (ate 15 trocas) |
| Ilimitado Anual | `UNLIMITED` | Mensagens ilimitadas por 1 ano, tunel com cada destinatario |

`productType` e obrigatorio em todos os endpoints de envio e fica gravado em `Payment`, `Message` e `SendMessage`.

---

## Stack

- **NestJS 11** + **TypeScript 5.7**
- **MongoDB** (Mongoose) — dados + GridFS para sessao WhatsApp
- **whatsapp-web.js** + Puppeteer — automacao WhatsApp headless
- **LangChain** (@langchain/core + @langchain/openai) — chains de IA
- **OpenAI GPT-4o-mini** — modelo de linguagem
- **Pagar.me** — cobranca PIX
- **@nestjs/schedule** — cron jobs (expiracao de tuneis)

---

## Estrutura de pastas

```
src/
├── main.ts                        # Bootstrap NestJS, porta 3000
├── app.module.ts                  # Modulo raiz, imports globais
│
├── assistent/                     # Tudo relacionado ao bot (IA + WhatsApp)
│   ├── ai/
│   │   ├── ai.service.ts          # Orquestra chains; processa mensagens do remetente
│   │   ├── chains/
│   │   │   ├── baseChain.ts       # Classe abstrata — todas as chains estendem esta
│   │   │   ├── routerChain.ts     # Detecta intencao: "GENERAL" | "alerta de envio"
│   │   │   ├── generalChain.ts    # Conversa generica com o bot
│   │   │   └── alertOfSendChain.ts# Confirmacao de envio para o remetente
│   │   └── prompt/
│   │       └── prompt-cupido.ts   # Templates de prompt (personagem CatChat/Cupido)
│   │
│   ├── pre-hooks/                 # Pipeline de pre-processamento de mensagens recebidas
│   │   ├── interfaces/
│   │   │   └── message-hook.interface.ts  # IMessageHook, MessageContext, MessageIntent
│   │   ├── message-pipeline.service.ts    # Executa hooks em cadeia (Chain of Responsibility)
│   │   ├── rate-limit.hook.ts             # Bloqueia envios acima do limite por janela de tempo
│   │   ├── debounce.hook.ts               # Agrupa mensagens recebidas em janela configuravel
│   │   ├── tunnel.hook.ts                 # Roteia mensagens #tag para tuneis ativos
│   │   └── classification.hook.ts         # Classifica intencao do destinatario com IA (GPT-4o-mini)
│   │
│   ├── services/
│   │   ├── message-delivery.service.ts    # Entrega carta; decide se pergunta tunel (por productType)
│   │   └── tunnel.service.ts              # Abre/roteia/expira tuneis; gera tags; cron de expiracao
│   │
│   ├── whatsapp/
│   │   ├── whatsapp.service.ts    # Cliente whatsapp-web.js; implementa IMessageSender
│   │   ├── whatsappSessionStore.ts# Persiste sessao no MongoDB GridFS (RemoteAuth)
│   │   ├── whatsappFormater.service.ts  # Normaliza numeros BR para formato WhatsApp
│   │   └── qr-controller.controller.ts  # GET /qr-controller — PNG do QR Code de autenticacao
│   │
│   └── conversation/
│       ├── conversation.service.ts# Cache em memoria (10 msgs) + persistencia MongoDB; limpeza 3h
│       └── conversation.schema.ts # Schema Mongoose: userId, messages[], lastActivity
│
├── common/
│   ├── messaging/
│   │   └── messaging.interface.ts # IMessageSender + token MESSAGE_SENDER (evita circular dep.)
│   └── utils/
│       ├── debouncer.ts           # Utilitario puro de debounce (sem NestJS)
│       └── tag-generator.ts       # Normaliza nomes e gera tags unicas para tuneis
│
├── controller/
│   ├── health-check.controller.ts # GET /health
│   ├── process-data.controller.ts # POST /api/messages/qrcode e POST /api/messages
│   └── webhook.controller.ts      # POST /api/webhook (Pagar.me)
│
├── service/
│   ├── process-data.service.ts    # Coordena: User -> Payment (PIX) -> Message (PENDING)
│   ├── pagarme.service.ts         # Cria cobranca PIX; valor selecionado por productType
│   ├── process-webhook.service.ts # Confirma pag.; cria Subscription (produto 3) ou rate_limit++
│   └── send-message.service.ts    # Salva SendMessage (normaliza telefone), dispara boas-vindas
│
├── schema/
│   ├── schemas.ts                 # Mongoose: User, Payment (+ productType), Message (+ productType)
│   ├── send-message.schema.ts     # Mongoose: SendMessage (+ productType, recipientState)
│   ├── tunnel-session.schema.ts   # Mongoose: TunnelSession (+ tag, TTL 24h)
│   └── subscription.schema.ts     # Mongoose: Subscription (produto 3; TTL 1 ano)
│
├── dto/
│   ├── dto.ts                     # DTOs principais; FormDataDto inclui productType
│   └── send-message.dto.ts        # DTO SendMessage; inclui productType
│
└── exception/
    └── GlobalExceptionFilter.ts   # Filtro global (atualmente desabilitado no bootstrap)
```

---

## Fluxo principal

### 1. Remetente envia mensagem

```
POST /api/messages/qrcode  (com productType no body)
        |
        v
ProcessDataService
  ├── upsert User (por celular + taxId)
  ├── chama PagarmeService.createPixQrCode(userData, productType) → valor varia por produto
  ├── salva Payment { status: "pending", productType }
  └── salva Message { status_message: "PENDING", productType }
        |
        v
Retorna { id_mensagem, brCode, brCodeBase64 }
        |
   [usuario paga]
        |
        v
POST /api/webhook  (Pagar.me chama automaticamente)
        |
        v
ProcessWebHookService (fire-and-forget)
  ├── atualiza Payment { status: "paid" }
  ├── busca Message mais antiga com status "PENDING" do usuario
  ├── chama SendMessageService.sendMessage(dto com productType)
  ├── atualiza Message { status_message: "SENT" }
  └── se UNLIMITED → createOrRenewSubscription(senderPhone)
      senao       → User.rate_limit += START_RATE_LIMIT
```

### 2. Mensagem entregue ao destinatario

```
SendMessageService
  ├── normaliza senderPhone e recipientPhone via WhatsappFormatter
  ├── salva SendMessage { recipientState: "WAITING_READ", productType }
  └── chama MessageDeliveryService.sendWelcome(recipientPhone, recipientName)
        |
        v
[WhatsApp: bot envia boas-vindas ao destinatario]
```

### 3. Destinatario interage com o bot

```
[WhatsApp recebe mensagem do destinatario]
        |
        v
WhatsappService → MessagePipelineService.run()
        |
        v
[Pipeline de hooks — ordem:]
  1. RateLimitHook      → bloqueia se acima do limite
  2. DebounceHook       → agrupa mensagens na janela configurada
  3. TunnelHook         → se mensagem comeca com #tag → roteia para tunel; para
                          se sem # e tem tunel ativo → instrui sobre tag; para
                          se sem tunel → next()
  4. ClassificationHook → verifica se e remetente (next()) ou destinatario
                          classifica por recipientState com IA:
                          WAITING_READ    → READ_MESSAGE ou GENERAL
                          WAITING_TUNNEL  → TUNNEL_ACCEPT ou GENERAL
                          outros          → GENERAL → next() para AiService
        |
   ┌────┴──────────────────┐
   v                       v
READ_MESSAGE          TUNNEL_ACCEPT
   v                       v
MessageDeliveryService.sendSecretMessage()
  ├── entrega carta        MessageDeliveryService.openTunnel()
  ├── MESSAGE_ONLY → DONE    ├── atualiza recipientState: TUNNEL_ACTIVE
  └── outros → askTunnel()   └── TunnelService.open(sender, recipient, recipientName)
                                    ├── gera tag unica
                                    ├── notifica remetente com instrucao #tag
                                    └── notifica destinatario com instrucao #admirador
```

### 4. Tunel ativo — troca de mensagens

```
[Remetente envia: #joao_silva Oi!]
        |
        v
TunnelHook.extractTag("joao_silva")
        |
        v
TunnelService.findSessionByTag(senderPhone, "joao_silva")
        |
        v
TunnelService.relay(session, senderPhone, "Oi!")
  └── relaySenderMessage → decrementa messagesRemaining
                        → se remaining > 0: envia para destinatario + confirma ao remetente
                        → se remaining = 0: envia ultima msg + closeTunnel()

[Destinatario envia: #admirador Que surpresa!]
        |
        v
TunnelHook → findSessionByTag(recipientPhone, "admirador")
        |
        v
TunnelService.relay → relayRecipientMessage → encaminha para remetente
```

---

## Modelos de dados

### User
| Campo | Tipo | Descricao |
|---|---|---|
| `nome` | string | Nome do remetente |
| `celular` | string | Telefone (chave de busca) |
| `email` | string | Email |
| `taxId` | string | CPF |
| `rate_limit` | number | Saldo de mensagens (produtos 1 e 2) |
| `user_id` | string (UUID) | Identificador unico |

### Payment
| Campo | Tipo | Descricao |
|---|---|---|
| `user_id` | string | Referencia ao User |
| `id_compra` | string | ID do pedido no Pagar.me |
| `amount` | number | Valor em centavos |
| `expiresAt` | string | Expiracao do QR Code |
| `qrCode` | string | Codigo PIX copia-e-cola |
| `qrCodeUrl` | string | URL da imagem QR |
| `status` | string | `"pending"` ou `"paid"` |
| `productType` | string | `"MESSAGE_ONLY"` \| `"MESSAGE_TUNNEL"` \| `"UNLIMITED"` |

### Message
| Campo | Tipo | Descricao |
|---|---|---|
| `id_mensagem` | string (UUID) | ID unico |
| `id_user` | string | ID do remetente |
| `userName` | string | Nome do remetente |
| `numeroRemetente` | string | Telefone do remetente |
| `nomeDestinario` | string | Nome do destinatario |
| `numeroDestinario` | string | Telefone do destinatario |
| `mensagem` | string | Conteudo secreto |
| `status_message` | string | `"PENDING"` ou `"SENT"` |
| `productType` | string | `"MESSAGE_ONLY"` \| `"MESSAGE_TUNNEL"` \| `"UNLIMITED"` |

### SendMessage
| Campo | Tipo | Descricao |
|---|---|---|
| `senderPhone` | string | Telefone normalizado |
| `recipientPhone` | string | Telefone normalizado |
| `status` | boolean | `false` = nao lida, `true` = lida |
| `recipientState` | string | `"WAITING_READ"` \| `"WAITING_TUNNEL"` \| `"TUNNEL_ACTIVE"` \| `"DONE"` |
| `productType` | string | `"MESSAGE_ONLY"` \| `"MESSAGE_TUNNEL"` \| `"UNLIMITED"` |

### TunnelSession
| Campo | Tipo | Descricao |
|---|---|---|
| `senderPhone` | string | Telefone do remetente |
| `recipientPhone` | string | Telefone do destinatario |
| `status` | string | `"ACTIVE"` ou `"DONE"` |
| `messagesRemaining` | number | Maximo 15; decrementado a cada msg do remetente |
| `expiresAt` | Date | TTL 24h — MongoDB expira automaticamente |
| `tag` | string | Ex: `"joao_silva"` — sem `#`, lowercase |

### Subscription
| Campo | Tipo | Descricao |
|---|---|---|
| `userPhone` | string | Telefone normalizado do remetente |
| `status` | string | `"ACTIVE"` ou `"EXPIRED"` |
| `expiresAt` | Date | TTL 1 ano — MongoDB expira automaticamente |

### UserConversation
| Campo | Tipo | Descricao |
|---|---|---|
| `userId` | string | ID do contato no WhatsApp (index) |
| `messages` | array | `{ role, content, timestamp }[]` |
| `lastActivity` | Date | Timestamp da ultima mensagem |

---

## Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
|---|---|---|
| `MONGODB_URI` | sim | URI MongoDB |
| `OPENAI_API_KEY` | sim | Chave OpenAI |
| `JWT_SECRET` | sim | Segredo JWT |
| `JWT_REFRESH_SECRET` | sim | Segredo refresh JWT |
| `WHATSAPP_CLIENT_ID` | sim | ID da sessao WhatsApp |
| `PAGARME_URL` | sim | URL base da API Pagar.me |
| `PAGARME_API_KEY` | sim | Chave Pagar.me |
| `AMOUNT_PIX_MESSAGE_ONLY` | sim | Valor produto 1 em centavos |
| `AMOUNT_PIX_MESSAGE_TUNNEL` | sim | Valor produto 2 em centavos |
| `AMOUNT_PIX_UNLIMITED` | sim | Valor produto 3 em centavos |
| `START_RATE_LIMIT` | sim | Mensagens liberadas por pagamento (produtos 1 e 2) |
| `RATE_LIMIT_MAX_MESSAGES` | sim | Maximo de msgs por janela de tempo no pipeline |
| `RATE_LIMIT_WINDOW_MS` | sim | Duracao da janela de rate limit (ms) |
| `DEBOUNCE_DELAY_MS` | sim | Janela de agrupamento de mensagens (ms) |

---

## Como rodar

```bash
npm install
cp .env.example .env
npm run start:dev       # desenvolvimento (hot reload)
npm run build && npm run start:prod  # producao
npm run test
```

Na **primeira execucao**, autenticar o WhatsApp:
1. Acessar `http://localhost:3000/qr-controller`
2. Escanear o QR Code com o celular do bot
3. Sessao salva no MongoDB (GridFS) — nao precisa repetir

---

## Convencoes de codigo

- **Modulos NestJS**: cada dominio tem seu proprio module (`AssistentModule`, etc.)
- **Injecao de dependencia**: sempre via construtor, nunca instanciar servicos manualmente
- **Envio de mensagem WhatsApp**: sempre via `IMessageSender` (token `MESSAGE_SENDER`) — nunca importar `WhatsappService` diretamente em outros modulos
- **Formatacao de telefone**: sempre usar `WhatsappFormatter.cleanPhoneNumber(formatPhoneNumber(phone))` antes de salvar no banco — nunca formatar manualmente
- **Novas chains de IA**: estender `BaseChain` e registrar no `AiService` (apenas para fluxo do remetente)
- **Novos hooks**: implementar `IMessageHook` e registrar na ordem correta em `MessagePipelineService`
- **Schemas Mongoose**: definidos em `src/schema/` (dominio global) e `src/assistent/conversation/` (dominio do assistente)
- **Tags de tunel**: geradas por `generateTag()` em `src/common/utils/tag-generator.ts` — nunca criar tags manualmente

---

## Areas sensiveis — cuidado ao modificar

- **`process-webhook.service.ts`**: logica critica de pagamento. Qualquer mudanca pode causar mensagens nao enviadas, duplicadas ou subscription nao criada.
- **`classification.hook.ts`**: a logica de identificar remetente antes de classificar e critica. Se removida, mensagens do remetente serao tratadas como destinatario.
- **`tunnel.hook.ts`**: o roteamento por `#tag` e o ponto central do tunel. A ordem de verificacao (tag → sessoes ativas → next) deve ser mantida.
- **`message-delivery.service.ts`**: a decisao de perguntar ou nao sobre o tunel depende de `productType`. Alterar sem considerar todos os produtos pode abrir tunel em produto sem direito.
- **`whatsappSessionStore.ts`**: persistencia de sessao. Erros aqui desconectam o bot e exigem novo QR Code.
- **`debouncer.ts`**: a janela de agrupamento e intencional. Nao remover sem entender o impacto na experiencia do usuario.
- **`conversation.service.ts`**: cache em memoria sincronizado com MongoDB. O limpador automatico roda as 3h — nao alterar sem considerar vazamentos de memoria.

---

## Comportamentos nao obvios

- **Webhook e fire-and-forget**: o controller retorna 200 imediatamente; o processamento ocorre em background. Nao adicionar `await` no controller.
- **Subscription vs rate_limit**: produto 3 cria `Subscription`; produtos 1 e 2 incrementam `rate_limit`. Sao mecanismos separados. `ProcessDataService.sendMessage()` verifica subscription antes de checar rate_limit.
- **Renovacao de subscription**: comprar produto 3 com subscription ativa estende `expiresAt` a partir de hoje, nao soma 1 ano ao prazo atual.
- **Tags e colisao**: se o remetente ja tem tunel ativo com `#joao_silva`, a proxima tag sera `#joao_silva_2`. A geracao considera apenas tuneis `ACTIVE` do mesmo remetente.
- **Tag do destinatario e sempre `#admirador`**: o destinatario nunca sabe o nome do remetente. A tag `#admirador` e fixa para todos os tuneis do lado do destinatario. Isso significa que se ele tiver dois tuneis ativos simultaneos, a tag `#admirador` sempre pega o primeiro encontrado — limitacao conhecida.
- **TTL e notificacao**: o MongoDB TTL remove documentos `TunnelSession` silenciosamente. O `@Cron('0 * * * *')` em `TunnelService` roda de hora em hora para notificar os usuarios antes da remocao.
- **Normalizacao de telefone**: `WhatsappFormatter` remove o 9 extra de numeros com DDD+9 digitos e adiciona DDI 55. Todos os telefones em `SendMessage` ja chegam normalizados — nunca comparar com numero bruto do formulario.
- **Sessao WhatsApp no GridFS**: os arquivos de sessao sao binarios armazenados no MongoDB. Nao apagar `fs.files` / `fs.chunks` sem desconectar o bot antes.
- **CORS aberto**: `app.enableCors()` sem restricoes esta no `main.ts`. Em producao, configurar origens especificas.
- **GlobalExceptionFilter**: definido mas desabilitado no bootstrap. Habilitar com cuidado — pode ocultar stack traces em desenvolvimento.
- **Produto 1 e recipientState DONE**: quando `productType === "MESSAGE_ONLY"`, apos entregar a carta o estado vai direto para `DONE` sem passar por `WAITING_TUNNEL`. O `ClassificationHook` nao tem prompt para `DONE` e retorna `GENERAL`, encaminhando para o `AiService` normalmente.
