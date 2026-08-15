# Case do produto — InterviewLab

Resumo do racional de produto por trás do MVP (baseado no case original,
"Case AI - Alessandra"). Serve de referência pra qualquer decisão de
escopo futura.

## Problema

Existe um número significativo de vagas, mas a competição por elas é
alta. Em cenários com centenas de candidatos disputando a mesma
oportunidade, comunicar experiências, estruturar respostas e demonstrar
impacto se torna um diferencial decisivo.

Ciclo do candidato hoje: encontra a vaga → adapta currículo → é chamado
pra entrevista → **não sabe como se preparar** → recebe feedback limitado
ou nenhum → repete o ciclo.

### Dados de mercado
- 80% dos profissionais de Produto buscam ativamente uma nova
  oportunidade ou estão abertos a propostas
- +290 vagas de Product Manager abertas no país
- 7% dos Product Managers desempregados, por conta dos impactos de
  layoffs no setor de tecnologia

## Pesquisa com candidatos

Principais dores levantadas em entrevistas:
- Qual case apresentar na entrevista
- Se o currículo é aderente à vaga
- Qual pretensão salarial colocar
- Dificuldade de achar mentoria na área de tecnologia/produto

Alternativas atuais: conversar com amigos da área, pesquisar no ChatGPT,
buscar perguntas/pretensão salarial no Glassdoor, mentoria com coaching
genérico (que não entende do mercado de produto).

**Gap identificado:** as ferramentas atuais ajudam a *construir*
respostas, mas não ajudam o candidato a *praticá-las* num ambiente
próximo da realidade.

## Solução

IA plugada no WhatsApp, com preparação para entrevistas, que cria
simulações personalizadas de acordo com currículo e vaga, identificando
gaps e dando feedback acionável ao candidato. A simulação não é genérica:
considera experiência, senioridade, contexto da vaga, competências
exigidas, e é retroalimentada com perguntas reais de outros usuários e de
sites como o Glassdoor.

Por que WhatsApp: zero fricção — o candidato já está no app que mais usa
no dia a dia, sem cadastro, sem baixar outro app.

## Diferencial

O produto não vende "IA para responder perguntas". Vende:
*treinamento personalizado*, *simulação realista*, *feedback
estruturado*, *preparação específica pra uma vaga*, e um parceiro pro dia
a dia difícil e solitário de quem busca recolocação.

## Escopo do MVP

- Upload de currículo
- Upload da descrição da vaga
- Simulação de entrevista por voz
- Feedback estruturado por resposta
- Follow-up pós-entrevista pedindo feedback das perguntas reais (loop de
  aprendizado)

**Nicho inicial:** candidatos a vagas de Product Manager — alta
competitividade, processos complexos, storytelling/métricas frequentes,
público acostumado a investir em desenvolvimento profissional.

**Métrica de sucesso do MVP:** 30% dos usuários voltam para uma segunda
simulação de entrevista.

**North Star Metric:** usuários que finalizam uma simulação de entrevista
e retornam para uma nova simulação em até 5 dias.

## Roadmap (pós-MVP)

- Diagnóstico de compatibilidade com a vaga + plano de estudo
- Resumo de faixa salarial pra ajudar na negociação
- Expandir pra outras áreas de tecnologia
- Mensagem de boa sorte no dia + reforço dos pontos-chave
- Banco de perguntas por empresa (alimentado por scraping + usuários)
- Coaching de carreira / RH incrementando o banco de perguntas
- Mapeamento de tom de voz do candidato pra identificar nervosismo/gaps
- Mentoria de carreira personalizada pós-contratação (retenção do usuário
  mesmo depois de recolocado)
- Indicação de vagas semelhantes pra gerar recorrência de uso

## Monetização

Candidatos já pagam entre R$ 100 e R$ 700 por serviços de currículo,
LinkedIn e preparação para entrevistas — valida a disposição de pagamento.
Risco: a busca por emprego é uma necessidade temporária (o usuário pode
assinar por 2 meses e cancelar assim que atinge o objetivo) — por isso o
roadmap de longo prazo inclui expandir o produto para quem já foi
recolocado (mentoria de carreira, promoção, liderança, networking).

Visão de fases (lançamento gratuito → cobrança progressiva) e o valor do
plano mensal ficam para validar com pesquisa de usuários, concorrentes e
testes A/B de precificação — não estão fixados neste MVP.

## O que este repositório implementa hoje

Implementado: os 5 itens do escopo do MVP acima, mais o lembrete do dia
da entrevista (que já estava desenhado na jornada completa do produto,
página 13 do case original) porque é o gancho natural pro follow-up de
24h que alimenta o banco de perguntas.

Fora do escopo (roadmap futuro, não implementado): plano de estudo
gerado a partir do diagnóstico, expansão pra outras áreas além de PM,
mapeamento de tom de voz, mentoria pós-contratação, indicação de vagas,
cobrança/planos pagos.
