# Plano de Testes de Usabilidade — CatChat

Este documento descreve todos os cenários de teste para validar o funcionamento da aplicação de ponta a ponta. Os testes são organizados por fluxo e executados manualmente com celulares reais conectados ao bot.

---

## Preparação do ambiente

### Pré-requisitos
- Servidor rodando (`npm run start:dev`)
- Bot WhatsApp autenticado (`GET /qr-controller`)
- MongoDB acessível
- 2 celulares disponíveis: um como **remetente**, outro como **destinatário**
- Ferramenta para chamadas HTTP (Postman, Insomnia ou cURL)

### Dados de teste sugeridos

```
Remetente:
  nome: "João Teste"
  celular: "5511999990001"
  email: "joao@teste.com"
  taxId: "12345678901"

Destinatário:
  nome: "Maria Teste"
  celular: "5511999990002"
```

### Como simular o pagamento (sem pagar o PIX)

Após chamar `POST /api/messages/qrcode`, anote o `id_compra` retornado no `Payment` do MongoDB e dispare o webhook manualmente:

```http
POST /api/webhook
Content-Type: application/json

{
  "data": {
    "id": "<id_compra>",
    "status": "paid"
  }
}
```

---

## Módulo 1 — Guard de mensagens

Testa o `MessageGuardHook`: o bot só deve processar mensagens de chats diretos em texto.

---

### TC-01 — Mensagem de grupo ignorada

**Pré-condição:** bot adicionado a um grupo no WhatsApp  
**Ação:** enviar qualquer mensagem nesse grupo  
**Resultado esperado:** bot não responde nada  

---

### TC-02 — Status/story ignorado

**Pré-condição:** celular do destinatário publica um status  
**Ação:** bot recebe o evento de status  
**Resultado esperado:** bot não responde nada  

---

### TC-03 — Mensagem de mídia recebe aviso

**Pré-condição:** bot está ativo  
**Ação:** enviar uma foto, áudio, vídeo ou sticker para o bot  
**Resultado esperado:** bot responde citando a mensagem original com o texto:
> "Só consigo ler mensagens de texto 💬  
> Me manda uma mensagem escrita!"

---

### TC-04 — Mensagem de texto normal é processada

**Pré-condição:** bot está ativo  
**Ação:** enviar "oi" para o bot  
**Resultado esperado:** bot responde (qualquer resposta válida — não é ignorado silenciosamente)

---

### TC-05 — Mensagem enviada pelo próprio bot é ignorada

**Pré-condição:** bot ativo  
**Ação:** observar se o bot responde às suas próprias mensagens  
**Resultado esperado:** bot não entra em loop — não responde a si mesmo

---

### TC-06 — Mensagens antigas ignoradas na inicialização

**Pré-condição:** enviar mensagens para o bot enquanto o servidor está desligado  
**Ação:** ligar o servidor e aguardar o evento `ready`  
**Resultado esperado:** as mensagens enviadas antes do bot ficar pronto não são processadas (observar logs: "Mensagem antiga descartada")

---

## Módulo 2 — Produto 1: Mensagem Única

Fluxo completo do produto `MESSAGE_ONLY`.

---

### TC-07 — Remetente envia mensagem com produto 1

**Ação:**
```http
POST /api/messages/qrcode
{
  "userData": { "nome": "João Teste", "celular": "5511999990001", "email": "joao@teste.com", "taxId": "12345678901" },
  "formData": { "nomeDestinario": "Maria", "numeroDestinario": "5511999990002", "mensagem": "Você é incrível!", "productType": "MESSAGE_ONLY" }
}
```
**Resultado esperado:** retorna `{ id_mensagem, brCode, brCodeBase64 }`. `Payment` salvo no banco com `productType: MESSAGE_ONLY`.

---

### TC-08 — Webhook confirma pagamento do produto 1

**Pré-condição:** TC-07 executado. Anotar `id_compra` do `Payment` no banco.  
**Ação:** disparar webhook manualmente com `status: "paid"`  
**Resultado esperado:**
- `Message` atualizada para `SENT`
- `User.rate_limit` incrementado
- Remetente recebe no WhatsApp: *"Olá João Teste, sua mensagem foi encaminhada!!"*
- Destinatário recebe boas-vindas: *"Ooi Maria 💌 Parece que você tem um admirador secreto..."*

---

### TC-09 — Destinatário lê a carta (produto 1)

**Pré-condição:** TC-08 executado. Destinatário recebeu boas-vindas.  
**Ação:** destinatário responde "quero ler" (ou variação similar)  
**Resultado esperado:**
- Bot entrega a carta: *"_Admirer_: Você é incrível!"*
- Bot envia mensagem de encerramento: *"💌 Esperamos que tenha gostado da mensagem!..."*
- `SendMessage.recipientState` atualizado para `DONE` no banco
- **Bot NÃO pergunta sobre o túnel**

---

### TC-10 — Destinatário recusa ler a carta

**Pré-condição:** destinatário recebeu boas-vindas.  
**Ação:** destinatário responde "não quero" ou "sai"  
**Resultado esperado:** bot não entrega a carta, permanece aguardando (state continua `WAITING_READ`)

---

## Módulo 3 — Produto 2: Mensagem + Túnel

Fluxo completo do produto `MESSAGE_TUNNEL`.

---

### TC-11 — Remetente envia mensagem com produto 2

**Ação:** mesmo que TC-07 mas com `"productType": "MESSAGE_TUNNEL"`  
**Resultado esperado:** mesmo que TC-07. `Payment` com `productType: MESSAGE_TUNNEL`.

---

### TC-12 — Destinatário lê a carta e recebe pergunta do túnel

**Pré-condição:** TC-11 + webhook disparado. Destinatário recebeu boas-vindas.  
**Ação:** destinatário responde "sim" ou "quero ler"  
**Resultado esperado:**
- Bot entrega a carta
- Bot pergunta sobre o túnel: *"💬 Gostaria de entrar no túnel com seu admirador secreto?..."*
- `SendMessage.recipientState` atualizado para `WAITING_TUNNEL`

---

### TC-13 — Destinatário recusa o túnel

**Pré-condição:** TC-12 executado.  
**Ação:** destinatário responde "não" ou "não quero"  
**Resultado esperado:** bot não abre o túnel. Fluxo encerrado. `recipientState` permanece `WAITING_TUNNEL` (sem túnel criado).

---

### TC-14 — Destinatário aceita o túnel

**Pré-condição:** TC-12 executado.  
**Ação:** destinatário responde "sim" ou "quero entrar"  
**Resultado esperado:**
- `TunnelSession` criada no banco com `status: ACTIVE`, `messagesRemaining: 15`, `tag` gerada
- Remetente recebe: *"💌 Seu admirado aceitou entrar no túnel! Para falar com ele(a), comece com #maria_teste"*
- Destinatário recebe: *"✨ Túnel aberto! Para responder, comece com #admirador"*
- `SendMessage.recipientState` atualizado para `TUNNEL_ACTIVE`

---

## Módulo 4 — Túnel de mensagens

Testa o roteamento bidirecional dentro do túnel.

---

### TC-15 — Remetente envia mensagem com tag correta

**Pré-condição:** TC-14 executado. Remetente sabe sua tag (ex: `#maria_teste`).  
**Ação:** remetente envia `#maria_teste Oi, sou eu! 😊`  
**Resultado esperado:**
- Destinatário recebe: *"_Admirador_: Oi, sou eu! 😊  Restam 14 mensagens..."*
- Remetente recebe: *"✓ Mensagem enviada! Aguarde a resposta."*
- `TunnelSession.messagesRemaining` decrementado para 14

---

### TC-16 — Destinatário responde com tag correta

**Pré-condição:** TC-15 executado.  
**Ação:** destinatário envia `#admirador Que surpresa!`  
**Resultado esperado:**
- Remetente recebe: *"_Admirado_: Que surpresa!"*
- Destinatário recebe: *"✓ Mensagem enviada!"*

---

### TC-17 — Remetente envia sem usar #tag

**Pré-condição:** túnel ativo.  
**Ação:** remetente envia "oi" sem o prefixo `#`  
**Resultado esperado:** bot instrui o remetente a usar a tag:
> "💬 Você tem túnel(is) ativo(s)! Para enviar uma mensagem, comece com a tag: *#maria_teste*"

---

### TC-18 — Remetente usa tag inexistente

**Pré-condição:** túnel ativo.  
**Ação:** remetente envia `#tag_errada oi`  
**Resultado esperado:** bot avisa:
> "❌ Nenhum túnel ativo encontrado para *#tag_errada*. Verifique a tag e tente novamente."

---

### TC-19 — Remetente esgota as 15 mensagens

**Pré-condição:** túnel ativo com `messagesRemaining: 1`.  
**Ação:** remetente envia a última mensagem com a tag  
**Resultado esperado:**
- Destinatário recebe a última mensagem
- Remetente e destinatário recebem: *"💫 O túnel chegou ao fim!..."*
- `TunnelSession.status` atualizado para `DONE`

---

### TC-20 — Tag case-insensitive

**Pré-condição:** túnel ativo com tag `maria_teste`.  
**Ação:** remetente envia `#MARIA_TESTE oi`  
**Resultado esperado:** mensagem roteada normalmente (tag normalizada para lowercase)

---

## Módulo 5 — Produto 3: Ilimitado Anual

---

### TC-21 — Remetente envia com produto 3

**Ação:** mesmo que TC-07 mas com `"productType": "UNLIMITED"`  
**Resultado esperado:** mesmo que TC-07. `Payment` com `productType: UNLIMITED`.

---

### TC-22 — Webhook cria Subscription no produto 3

**Pré-condição:** TC-21 + webhook disparado.  
**Ação:** verificar banco de dados  
**Resultado esperado:**
- `Subscription` criada com `status: ACTIVE`, `expiresAt` = hoje + 1 ano
- `User.rate_limit` **não** incrementado
- Fluxo de entrega da carta ocorre normalmente

---

### TC-23 — Remetente com Subscription envia sem pagar

**Pré-condição:** `Subscription` ativa no banco para o remetente.  
**Ação:**
```http
POST /api/messages
{
  "userData": { "nome": "João Teste", "celular": "5511999990001", ... },
  "formData": { "nomeDestinario": "Ana", "numeroDestinario": "5511999990003", "mensagem": "Oi Ana!", "productType": "UNLIMITED" }
}
```
**Resultado esperado:** mensagem enviada. `rate_limit` não decrementado. `hasSubscription: true` na resposta.

---

### TC-24 — Remetente com Subscription tem múltiplos túneis simultâneos

**Pré-condição:** remetente tem `Subscription` ativa e dois túneis abertos (Maria e Ana).  
**Ação:** remetente envia `#maria_teste oi` e depois `#ana oi`  
**Resultado esperado:** cada mensagem chega no destinatário correto, independentemente

---

### TC-25 — Renovação de Subscription ativa

**Pré-condição:** remetente já tem `Subscription` com `expiresAt` em 6 meses.  
**Ação:** disparar webhook de novo pagamento do produto 3 para o mesmo remetente  
**Resultado esperado:** `Subscription.expiresAt` atualizado para hoje + 1 ano (não acumula)

---

## Módulo 6 — Rate limit e debounce

---

### TC-26 — Rate limit bloqueia envios excessivos

**Pré-condição:** `RATE_LIMIT_MAX_MESSAGES=5`, `RATE_LIMIT_WINDOW_MS=60000`.  
**Ação:** enviar 6 mensagens para o bot em menos de 1 minuto  
**Resultado esperado:** na 6ª mensagem, bot responde:
> "Ops! Você enviou muitas mensagens em pouco tempo. Aguarde um momento antes de tentar novamente."

---

### TC-27 — Debounce agrupa mensagens enviadas rápido

**Pré-condição:** `DEBOUNCE_DELAY_MS=5000`.  
**Ação:** enviar 3 mensagens seguidas em menos de 5 segundos  
**Resultado esperado:** o bot processa as 3 como uma só entrada (observar nos logs: "Debounce consolidou 3 mensagem(ns)")

---

### TC-28 — Debounce não agrupa mensagens espaçadas

**Pré-condição:** `DEBOUNCE_DELAY_MS=5000`.  
**Ação:** enviar mensagem, aguardar 6 segundos, enviar outra  
**Resultado esperado:** cada mensagem é processada individualmente

---

## Módulo 7 — Envio com saldo (rate_limit)

---

### TC-29 — Remetente com saldo envia sem pagar

**Pré-condição:** `User.rate_limit >= 1`.  
**Ação:**
```http
POST /api/messages
{ ... "formData": { ..., "productType": "MESSAGE_TUNNEL" } }
```
**Resultado esperado:** mensagem entregue. `rate_limit` decrementado em 1.

---

### TC-30 — Remetente sem saldo é bloqueado

**Pré-condição:** `User.rate_limit = 0` e sem `Subscription`.  
**Ação:** `POST /api/messages` com dados válidos  
**Resultado esperado:** resposta `{ saldo: 0, message: "Saldo insuficiente para enviar mensagem" }`. Nenhuma mensagem enviada.

---

### TC-31 — Usuário não encontrado

**Pré-condição:** nenhum usuário cadastrado com os dados enviados.  
**Ação:** `POST /api/messages` com `celular` e `taxId` inexistentes  
**Resultado esperado:** erro retornado. Nenhuma mensagem enviada.

---

## Módulo 8 — Colisão de tags

---

### TC-32 — Tags com mesmo nome geram sufixo numérico

**Pré-condição:** remetente já tem túnel ativo com tag `maria`.  
**Ação:** remetente abre um segundo túnel com outra destinatária também chamada "Maria"  
**Resultado esperado:**
- Segundo túnel criado com tag `maria_2`
- Remetente é instruído a usar `#maria_2` para o segundo túnel

---

### TC-33 — Tags com nomes acentuados são normalizadas

**Pré-condição:** nenhum túnel ativo.  
**Ação:** abrir túnel com destinatária chamada "João da Sílva"  
**Resultado esperado:** tag gerada é `joao_da_silva` (sem acento, lowercase, espaços viram `_`)

---

## Módulo 9 — Webhook e pagamento

---

### TC-34 — Webhook com status diferente de "paid" é ignorado

**Ação:** disparar webhook com `status: "pending"` ou `status: "refused"`  
**Resultado esperado:** nenhuma mensagem enviada. `Payment.status` não alterado.

---

### TC-35 — Webhook com id_compra inexistente retorna erro

**Ação:** disparar webhook com `data.id` que não existe no banco  
**Resultado esperado:** erro 400 retornado. Nenhum efeito colateral.

---

### TC-36 — Webhook sem mensagem PENDING não envia carta

**Pré-condição:** não há `Message` com `status_message: PENDING` para o usuário.  
**Ação:** disparar webhook com `id_compra` válido  
**Resultado esperado:** erro 404 interno. Nenhuma carta enviada.

---

## Módulo 10 — Casos de borda gerais

---

### TC-37 — Destinatário que ainda não recebeu carta manda mensagem

**Pré-condição:** número sem nenhum `SendMessage` no banco.  
**Ação:** enviar qualquer mensagem para o bot  
**Resultado esperado:** bot trata como conversa geral via `AiService` (resposta do personagem CatChat)

---

### TC-38 — Remetente manda mensagem para o bot após enviar carta

**Pré-condição:** remetente tem `SendMessage` no banco com `senderPhone`.  
**Ação:** remetente envia qualquer mensagem para o bot  
**Resultado esperado:** `ClassificationHook` identifica como remetente e encaminha para `AiService` (não trata como destinatário)

---

### TC-39 — Health check

**Ação:** `GET /health`  
**Resultado esperado:** `{ "status": "ok" }` com HTTP 200

---

### TC-40 — Payload inválido no endpoint de qrcode

**Ação:** `POST /api/messages/qrcode` sem o campo `productType`  
**Resultado esperado:** erro de validação retornado (HTTP 400). Nenhum dado salvo no banco.

---

## Registro de execução

Use a tabela abaixo para registrar os resultados durante os testes:

| TC | Descrição | Status | Observações |
|---|---|---|---|
| TC-01 | Mensagem de grupo ignorada | | |
| TC-02 | Status/story ignorado | | |
| TC-03 | Mídia recebe aviso | | |
| TC-04 | Texto normal processado | | |
| TC-05 | Mensagem do próprio bot ignorada | | |
| TC-06 | Mensagens antigas ignoradas na inicialização | | |
| TC-07 | Remetente envia produto 1 | | |
| TC-08 | Webhook confirma produto 1 | | |
| TC-09 | Destinatário lê carta produto 1 | | |
| TC-10 | Destinatário recusa carta | | |
| TC-11 | Remetente envia produto 2 | | |
| TC-12 | Destinatário lê carta e recebe pergunta do túnel | | |
| TC-13 | Destinatário recusa túnel | | |
| TC-14 | Destinatário aceita túnel | | |
| TC-15 | Remetente envia mensagem no túnel | | |
| TC-16 | Destinatário responde no túnel | | |
| TC-17 | Remetente envia sem #tag | | |
| TC-18 | Remetente usa tag inexistente | | |
| TC-19 | Remetente esgota 15 mensagens | | |
| TC-20 | Tag case-insensitive | | |
| TC-21 | Remetente envia produto 3 | | |
| TC-22 | Webhook cria Subscription produto 3 | | |
| TC-23 | Remetente com Subscription envia sem pagar | | |
| TC-24 | Múltiplos túneis simultâneos | | |
| TC-25 | Renovação de Subscription ativa | | |
| TC-26 | Rate limit bloqueia excessos | | |
| TC-27 | Debounce agrupa mensagens rápidas | | |
| TC-28 | Debounce não agrupa mensagens espaçadas | | |
| TC-29 | Remetente com saldo envia sem pagar | | |
| TC-30 | Remetente sem saldo é bloqueado | | |
| TC-31 | Usuário não encontrado | | |
| TC-32 | Colisão de tags gera sufixo numérico | | |
| TC-33 | Tags com nomes acentuados normalizados | | |
| TC-34 | Webhook com status diferente de paid | | |
| TC-35 | Webhook com id_compra inexistente | | |
| TC-36 | Webhook sem mensagem PENDING | | |
| TC-37 | Destinatário sem carta manda mensagem | | |
| TC-38 | Remetente manda mensagem ao bot | | |
| TC-39 | Health check | | |
| TC-40 | Payload inválido no qrcode | | |
