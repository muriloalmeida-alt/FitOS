# InterviewLab

> "Conquiste a vaga dos seus sonhos."

IA de preparação para entrevistas de emprego, direto no WhatsApp. O
candidato manda o link da vaga e o currículo em PDF; o InterviewLab faz um
diagnóstico de compatibilidade, simula a entrevista pergunta por pergunta
(texto ou áudio) com feedback estruturado em cada resposta, entrega um
feedback final com pontos fortes/fracos e sugestão de faixa salarial, e
manda um lembrete no dia da entrevista real.

MVP focado em vagas de **Product Manager** (ver `docs/CASE.md` pro
racional completo do produto).

## Jornada do usuário

1. Candidato manda o link (ou cola a descrição) da vaga
2. Candidato manda o currículo em PDF
3. IA gera um diagnóstico de compatibilidade (forças, gaps, o que destacar)
4. Candidato manda `"começar"` e a simulação de entrevista começa —
   perguntas uma de cada vez, respondidas em texto ou áudio
5. Cada resposta recebe feedback imediato (nota, o que funcionou, o que
   ajustar, uma dica)
6. Ao final: feedback estruturado (top 3 forças, top 3 melhorias, 3
   perguntas pra fazer à empresa) + estimativa de faixa salarial
7. Candidato informa a data da entrevista real → recebe um lembrete no dia
8. 24h depois, o InterviewLab pergunta como foi e quais perguntas caíram —
   isso realimenta o banco de perguntas pra deixar as próximas simulações
   mais próximas da realidade

## Estrutura

```
src/
  server.js              → entrypoint HTTP (Express) + webhook do WhatsApp
  config.js               → carrega/valida variáveis de ambiente
  db/store.js              → persistência (arquivo JSON — ver docs/ARCHITECTURE.md)
  services/
    whatsapp.js            → WhatsApp Cloud API (enviar/receber, mídia)
    claude.js               → cliente da Claude API (Anthropic)
    transcription.js        → transcrição de áudio (Whisper) das respostas faladas
    tts.js                  → text-to-speech opcional pras perguntas em áudio
    resumeParser.js         → extração de texto do currículo (PDF)
    jobScraper.js           → extração de texto da vaga a partir do link
    scheduler.js            → lembrete do dia da entrevista + follow-up 24h
  ai/interviewAI.js         → prompts/lógica de IA de cada etapa da jornada
  conversation/
    engine.js                → máquina de estados da conversa
    format.js                → formatação das mensagens de WhatsApp
    dates.js                 → parsing de data (dd/mm) pro lembrete
docs/
  CASE.md                   → racional do produto (problema, pesquisa, diferencial, roadmap)
  ARCHITECTURE.md           → decisões técnicas e próximos passos de escala
  WHATSAPP-SETUP.md         → como configurar o WhatsApp Business/Cloud API
  CLAUDE-SETUP.md           → como configurar a Claude API
  DEPLOY.md                 → deploy via Docker/Railway
```

## Rodando local

Requisitos: **Node.js 18+**, uma conta Meta Developer com WhatsApp Cloud
API configurada (`docs/WHATSAPP-SETUP.md`) e uma chave da Claude API
(`docs/CLAUDE-SETUP.md`).

```bash
npm install
cp .env.example .env
# edite o .env com suas chaves (WhatsApp + Anthropic; OpenAI é opcional, usada
# só pra transcrever respostas em áudio e, se ligado, pra gerar as perguntas em áudio)
npm start
```

O servidor sobe em `http://localhost:8787`. Para o WhatsApp conseguir
chamar seu webhook local, exponha a porta com uma ferramenta como `ngrok`
durante o desenvolvimento — detalhes em `docs/WHATSAPP-SETUP.md`.

## Deploy

Ver `docs/DEPLOY.md` — inclui Docker/`docker-compose` prontos e passo a
passo para Railway (ou qualquer PaaS que suporte containers + volume
persistente).
