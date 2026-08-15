# Configurando o WhatsApp Cloud API

O InterviewLab usa a **WhatsApp Cloud API** oficial da Meta (não uma
biblioteca não-oficial tipo Baileys) — mais estável, suportada, e sem
risco do número ser banido.

## 1. Criar o app na Meta

1. Acesse [developers.facebook.com](https://developers.facebook.com/) e
   crie um app do tipo **Business**.
2. Adicione o produto **WhatsApp** ao app.
3. No painel do WhatsApp → **API Setup**, você vai encontrar:
   - Um **número de teste** já pronto pra usar (grátis, mas só envia pra
     números que você cadastrar como destinatário de teste)
   - O **Phone Number ID** (`WHATSAPP_PHONE_NUMBER_ID`)
   - O **WhatsApp Business Account ID** (`WHATSAPP_BUSINESS_ACCOUNT_ID`)
   - Um **token de acesso temporário** (24h) — pra produção, gere um
     token permanente via **System User** (Business Settings → Users →
     System Users), que é o valor de `WHATSAPP_ACCESS_TOKEN`.

## 2. Configurar o webhook

1. No painel do app, vá em **WhatsApp → Configuration**.
2. Em **Webhook**, informe:
   - **Callback URL**: `https://SEU_DOMINIO/webhook`
   - **Verify token**: qualquer string secreta que você escolher — copie
     esse mesmo valor pra `WHATSAPP_VERIFY_TOKEN` no `.env`
3. Clique em **Verify and save** — a Meta faz um `GET /webhook` que o
   InterviewLab responde automaticamente (ver `src/server.js`).
4. Em **Webhook fields**, inscreva-se no campo **messages**.

### Testando local antes de ter domínio público

Use [ngrok](https://ngrok.com/) (ou similar) pra expor sua porta local:

```bash
npm start          # sobe em localhost:8787
ngrok http 8787     # gera uma URL pública temporária
```

Use a URL do ngrok (`https://xxxx.ngrok.app/webhook`) como Callback URL
no passo 2. Toda vez que o ngrok reiniciar, a URL muda e você precisa
reconfigurar o webhook.

## 3. App Secret (recomendado em produção)

Em **App Settings → Basic**, copie o **App Secret** para
`WHATSAPP_APP_SECRET` no `.env`. Isso ativa a validação da assinatura
`X-Hub-Signature-256` em `src/services/whatsapp.js`, garantindo que só a
Meta consegue mandar eventos pro seu webhook.

## 4. Sair do modo de teste

No modo de teste, você só consegue mandar mensagem pra números
cadastrados manualmente (**API Setup → To**). Para atender qualquer
candidato:

1. Verifique seu **Business Portfolio** (documentos da empresa).
2. Registre um número de telefone de produção (não pode ser um número já
   usado no WhatsApp normal/Business App).
3. Envie o app para **App Review** solicitando a permissão
   `whatsapp_business_messaging`.

Mais detalhes: [documentação oficial da Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started).

## 5. Janela de 24h e mensagens de template

A Cloud API só permite mandar mensagens de texto livre dentro de uma
janela de 24h depois da última mensagem do usuário. Fora dessa janela
(ex: lembrete do dia da entrevista, se o candidato não escreveu nada há
mais de 24h), é preciso usar um **template de mensagem** pré-aprovado
pela Meta.

O MVP atual (`src/services/scheduler.js`) assume que o candidato
interagiu recentemente o suficiente pra manter a janela aberta. Se isso
não se confirmar na prática, o próximo passo é cadastrar um template
(ex: `lembrete_entrevista`) em **WhatsApp Manager → Message Templates** e
trocar o envio do lembrete pra usar `type: "template"` em vez de
`type: "text"`.
