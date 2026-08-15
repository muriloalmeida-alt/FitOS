# Configurando a Claude API

O InterviewLab usa a [Claude API da Anthropic](https://console.anthropic.com/)
para todas as etapas de IA: diagnóstico de compatibilidade, geração das
perguntas da entrevista, feedback por resposta, feedback final e a
estimativa de faixa salarial (ver `src/ai/interviewAI.js`).

## 1. Gerar a API key

1. Acesse [console.anthropic.com](https://console.anthropic.com/) e
   crie/entre numa organização.
2. Vá em **API Keys → Create Key**.
3. Copie a chave para `ANTHROPIC_API_KEY` no `.env`.

## 2. Escolher o modelo

`ANTHROPIC_MODEL` no `.env` controla qual modelo é usado em todas as
chamadas (`src/services/claude.js`). O padrão é um modelo Claude Sonnet
— bom equilíbrio entre qualidade de raciocínio (importante pra avaliar
respostas de entrevista) e custo/latência, dado que cada simulação faz
várias chamadas (diagnóstico + N perguntas + N feedbacks + feedback
final + faixa salarial).

## 3. Sobre áudio

A Claude API atualmente não recebe áudio como entrada diretamente. Por
isso, respostas em áudio do candidato são **transcritas primeiro** (via
Whisper da OpenAI, `src/services/transcription.js`) e só o texto
transcrito vai pra Claude. Se um dia a Claude API passar a suportar áudio
nativamente, dá pra remover essa etapa intermediária.

## 4. Custos e limites

Cada simulação completa faz aproximadamente:
- 1 chamada de extração de metadata da vaga
- 1 chamada de diagnóstico
- 1 chamada de geração de perguntas
- N chamadas de feedback (uma por resposta, N = `QUESTIONS_PER_SIMULATION`
  em `src/conversation/engine.js`, padrão 5)
- 1 chamada de feedback final
- 1 chamada de faixa salarial

Monitore uso e limite de gasto em **Console → Settings → Limits**.
