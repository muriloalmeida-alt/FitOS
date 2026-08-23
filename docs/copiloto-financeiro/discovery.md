# Discovery — Entende. Copiloto Financeiro Pessoal

> Documento de início de discovery, produzido a partir de dois anexos fornecidos pelo time:
> `Briefing de Produto — Copiloto Financeiro Pessoal com Open Finance` e `UI Kit & Design System — Copiloto Financeiro Pessoal` (Agosto/2026).
> Este documento sintetiza os anexos, preenche as lacunas necessárias para dar início ao discovery (personas, JTBD, épicos, modelo de dados, arquitetura de informação) e propõe o plano de próximos passos.

**Nome do produto:** Entende. — *"Seu copiloto financeiro."*
**Plataformas:** App (mobile) e Web
**Status:** Discovery iniciado — Agosto/2026
**Nota de contexto do repositório:** este repositório (`FitOS`) hoje contém um produto não relacionado (simulador do Brasileirão). Os artefatos deste discovery foram organizados em `docs/copiloto-financeiro/` como ponto de partida isolado, sem tocar no código existente, até que se defina onde o produto Entende será efetivamente implementado (novo repositório dedicado é o mais provável — ver seção 18).

---

## 1. Contexto e fontes

| Fonte | Conteúdo | Uso neste discovery |
|---|---|---|
| Briefing de Produto | Visão, problema, objetivos, público-alvo, conceito central, escopo do MVP, motor de conciliação, categorização, dashboard, IA/alertas, princípios de UX, métricas, visão de longo prazo | Base da síntese de produto (seções 2–11, 16–17) |
| UI Kit & Design System | Paleta, tipografia, grid/espaçamento, radius, componentes, botões, cards, transação, timeline, planejado×realizado, dashboard, navegação, ícones, IA/insights, acessibilidade | Base da referência de design (seção 14) e da arquitetura de navegação (seção 12) |

---

## 2. Visão e proposta de valor

Plataforma de controle financeiro pessoal integrada ao Open Finance, que centraliza contas e cartões, automatiza a organização das transações e transforma planejamento financeiro em algo simples e acionável.

> **Proposta central:** conectar as contas uma vez e deixar o sistema organizar, acompanhar, conciliar e projetar a vida financeira automaticamente.

O sistema deve trabalhar **para** o usuário — não o contrário. Isso inverte a lógica dos apps financeiros tradicionais (lançamento manual, categorização manual, conferência manual).

---

## 3. Problema

Informações financeiras estão espalhadas entre bancos, cartões e aplicativos. Mesmo usuários organizados hoje precisam:
- cadastrar despesas manualmente;
- categorizar lançamentos um a um;
- conferir extratos contra o que planejaram;
- controlar faturas de múltiplos cartões;
- projetar saldo futuro "na cabeça" ou em planilha.

O produto deve automatizar essa cadeia inteira, deixando para o usuário apenas a decisão, não a operação.

---

## 4. Público-alvo e personas

**Público-alvo (briefing):** pessoas com mais de uma conta bancária e/ou cartão, despesas recorrentes, que quer organizar o orçamento sem depender de planilhas ou lançamentos manuais — incluindo usuários já organizados que buscam automação.

Duas personas de trabalho para orientar o discovery (a validar em entrevistas — ver seção 18):

### Persona A — "Camila, a Organizada Cansada"
- 32 anos, CLT + freela, 2 contas bancárias, 3 cartões.
- Hoje usa planilha, mas atualiza de forma inconsistente e perde o hábito depois de 2–3 semanas.
- Dor central: não sabe **quanto pode gastar agora** sem revisar tudo manualmente.
- Sucesso para ela: abrir o app e confiar no número sem precisar conferir.

### Persona B — "Rafael, o Automatizador"
- 41 anos, já é financeiramente organizado, usa app do banco + planilha própria.
- Quer eliminar o trabalho manual, não aprender a se organizar.
- Dor central: reconciliar previsto × realizado toma tempo toda semana.
- Sucesso para ele: confirmar sugestões do sistema em vez de fazer o matching manualmente.

### Persona C (secundária) — "Beatriz, a Iniciante Ansiosa"
- 24 anos, primeiro emprego CLT, uma conta e um cartão, nunca planejou antes.
- Dor central: ansiedade financeira por falta de visibilidade, não por excesso de dados.
- Sucesso para ela: entender de forma simples "posso gastar isso ou não".

> Observação: o briefing menciona ambos os perfis (quem nunca se organizou e quem já é organizado). Persona C amplia o espectro para o extremo "iniciante" — importante validar se está dentro do escopo do MVP ou é fase 2 (ver riscos, seção 17).

---

## 5. Jobs To Be Done (as 5 perguntas do produto)

| Job (pergunta) | Resposta que o produto entrega | Módulo(s) principal(is) |
|---|---|---|
| Passado | Para onde meu dinheiro foi? | Transações, Timeline, Categorização |
| Presente | Quanto eu realmente tenho disponível? | Dashboard, Open Finance |
| Futuro | Quanto terei depois dos compromissos previstos? | Projeção |
| Planejamento | Estou gastando mais ou menos do que planejei? | Planejamento, Conciliação |
| Inteligência | Existe algo acontecendo que eu deveria saber? | IA, Alertas |

Esses 5 jobs são o critério de priorização de todo o roadmap: qualquer feature deve mapear claramente para pelo menos um deles.

---

## 6. Conceito central: Planejado → Realizado → Projetado

| Etapa | Exemplo |
|---|---|
| Planejado | Netflix — R$ 39,90 — recorrente — dia 10 |
| Realizado | NETFLIX.COM — R$ 39,90 — 10/08 |
| Conciliação | Sistema identifica a correspondência e sugere/realiza a baixa |
| Projetado | Saldo futuro recalculado considerando receitas e despesas |

Este é o loop central do produto e a fonte de todo o valor percebido: **o que eu disse que ia acontecer, o que de fato aconteceu, e o que vai acontecer a seguir**, sempre reconciliado automaticamente.

---

## 7. Escopo do MVP — módulos, épicos e histórias

Cada módulo do briefing foi quebrado em épicos com histórias de usuário de alto nível, para servir de ponto de partida ao backlog.

### 7.1 Conta
- Cadastro, login, recuperação de senha, preferências (moeda, notificações, biometria).
- *Como usuário, quero recuperar o acesso à minha conta com segurança para não perder meus dados financeiros.*

### 7.2 Open Finance
- Conexão de contas/cartões via provedor/agregador Open Finance.
- Reautenticação/renovação de consentimento, múltiplas instituições, status de sincronização por conta.
- *Como usuário, quero conectar todas as minhas contas e cartões de uma vez para nunca mais lançar nada manualmente.*
- *Como usuário, quero saber quando uma conexão expira ou falha, para reconectar antes de perder dados.*

### 7.3 Transações
- Timeline unificada, categorização (automática + manual), edição, filtros (conta, cartão, categoria, período, status).
- *Como usuário, quero ver todas as transações de todas as contas em um único lugar, ordenadas por data.*
- *Como usuário, quero corrigir uma categoria e ter essa correção lembrada nas próximas vezes.*

### 7.4 Planejamento
- Despesas recorrentes, despesas pontuais futuras, receitas futuras.
- *Como usuário, quero cadastrar minhas contas recorrentes uma vez para não precisar lembrar delas todo mês.*
- *Como usuário, quero planejar uma despesa pontual futura (ex.: viagem) para ver o impacto dela no meu saldo projetado.*

### 7.5 Conciliação (ver detalhe na seção 8)
- Matching automático entre transações reais e itens planejados, com confidence score.
- *Como usuário, quero que o sistema baixe automaticamente meus planejamentos quando a cobrança correspondente chegar.*
- *Como usuário, quero revisar e confirmar/rejeitar sugestões de conciliação com baixa confiança.*

### 7.6 Dashboard (ver detalhe na seção 11)
- Saldo, receitas, despesas, planejado × realizado.

### 7.7 Projeção
- Fluxo de caixa futuro e saldo projetado, considerando planejamento + recorrências + histórico.
- *Como usuário, quero saber se vou fechar o mês no positivo antes que isso aconteça, não depois.*

### 7.8 Alertas
- Desvios de planejamento, novas recorrências detectadas, despesas inesperadas/fora do padrão.
- *Como usuário, quero ser avisado quando uma cobrança nova e recorrente aparecer, para decidir se quero mantê-la.*

### 7.9 IA
- Consultas e insights baseados nos dados do usuário (camada de inteligência sobre os dados, não um chatbot genérico).
- *Como usuário, quero perguntar "quanto gastei com alimentação esse mês" e receber uma resposta direta, com contexto.*
- *Como usuário, quero receber proativamente um insight quando meu padrão de gastos mudar significativamente.*

> **Gap identificado:** o UI Kit lista "Metas" como item de navegação (seção 12), mas o briefing não descreve esse módulo. Marcar como pergunta em aberto (seção 17) — provável extensão natural do Planejamento, mas precisa de escopo próprio (meta de economia, meta de gasto por categoria, prazo, progresso).

---

## 8. Motor de conciliação — especificação inicial

Principal diferencial do produto, conforme o briefing. Proposta de critérios de matching (a validar tecnicamente):

**Sinais de matching**, por ordem de peso sugerido:
1. Valor exato ou dentro de uma faixa configurável (ex.: recorrências com variação, como contas de consumo).
2. Data prevista × data real, com tolerância (ex.: ±3 dias corridos).
3. Descrição/estabelecimento (fuzzy match contra nome cadastrado ou histórico de aliases already resolvidos).
4. Recorrência (se o planejamento é recorrente, dá preferência à próxima ocorrência em aberto).
5. Instituição/cartão de origem.
6. Categoria já associada ao estabelecimento.
7. Histórico do usuário (aprendizado: correspondências confirmadas manualmente antes).

**Confidence score:** combinação ponderada dos sinais acima, normalizada em uma escala (ex.: 0–100).
- **Alta confiança** → baixa automática, com opção de desfazer.
- **Média confiança** → sugestão para confirmação do usuário (1 toque).
- **Baixa confiança** → não sugere; transação some no fluxo padrão de categorização.

**Aprendizado incremental:** cada confirmação/rejeição do usuário deve realimentar os pesos por usuário (personalização) e, potencialmente, por padrão global de estabelecimento (ex.: "NETFLIX.COM" tende a bater com "Netflix" em qualquer conta).

**Pergunta em aberto:** onde esse motor roda (client, servidor, job assíncrono) e qual a janela de latência aceitável entre a chegada da transação via Open Finance e a sugestão aparecer para o usuário — ver seção 17.

---

## 9. Categorização inteligente

- Sugestão automática de categoria por estabelecimento (ex.: NETFLIX.COM → Entretenimento; IFOOD → Alimentação; UBER → Transporte).
- Aprendizado com correções do usuário (mesma lógica de personalização do motor de conciliação).
- Deve reutilizar, sempre que possível, o mesmo mapeamento estabelecimento→categoria entre módulos (transação, planejamento, projeção, insights).

---

## 10. IA e alertas

A IA é uma **camada de inteligência sobre os dados**, não um chatbot decorativo. Exemplos do briefing:
- Gastos acima da média (por categoria, por período).
- Novas cobranças recorrentes detectadas.
- Comprometimento de renda (% da receita já alocado a despesas fixas/planejadas).
- Projeções de saldo (positivo/negativo, com antecedência).

Identidade visual da IA (do UI Kit): marcador `✦` discreto, sem estética de chatbot genérico, sem gradientes chamativos — aplicado em cards de insight dentro do fluxo normal do produto (dashboard, transações), não isolado em uma tela de chat separada.

---

## 11. Dashboard — hierarquia de informação

Princípio de UX do briefing: **mostrar primeiro o que exige atenção, depois o que ajuda na decisão, por último o detalhe.**

Ordem definida no UI Kit:

| Ordem | Conteúdo |
|---|---|
| 1 | Saudação + contexto do período |
| 2 | Saldo / receitas / despesas |
| 3 | Alertas e insights prioritários |
| 4 | Planejado × realizado |
| 5 | Fluxo de caixa / projeção |
| 6 | Timeline de próximas movimentações |

As 4 perguntas centrais do dashboard: **quanto tenho, quanto entra, quanto sai, quanto devo ter no futuro.**

---

## 12. Arquitetura de informação e navegação

**Desktop — sidebar fixa:** Visão geral, Transações, Planejamento, Contas, Cartões, Metas, Insights, Configurações.

**Mobile — bottom navigation:** Início, Transações, Planejamento, + ação rápida (provavelmente adicionar transação/planejamento manual, ou abrir IA).

**Grid:**

| Contexto | Grid | Padding/Margem | Gap |
|---|---|---|---|
| Desktop | 12 colunas | 32–48 px | 16–24 px |
| Mobile | 4 colunas | 16 px | 12–16 px |

Escala base de espaçamento: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px`.

**Pergunta em aberto:** "Cartões" e "Contas" aparecem como itens de navegação separados de "Transações" — sugere telas de gestão de instituições conectadas (status de sincronização, limites de cartão, fatura) distintas da timeline de transações. Escopo dessas telas não está detalhado no briefing — precisa entrar no backlog de discovery de UX.

---

## 13. Modelo de dados conceitual (ponto de partida)

Entidades sugeridas a partir dos módulos do MVP (para validação técnica, não é modelagem final):

- **User** — conta, preferências, autenticação.
- **Institution** — banco/instituição financeira conectada via Open Finance.
- **Consent** — consentimento Open Finance (escopo, validade, status).
- **Account** — conta corrente/poupança vinculada a uma Institution.
- **Card** — cartão de crédito/débito vinculado a uma Institution ou Account.
- **Transaction** — lançamento realizado (conta ou cartão), com estabelecimento, valor, data, categoria, status de conciliação.
- **Category** — taxonomia de categorias (sistema + customizadas pelo usuário).
- **PlannedItem** — item planejado (recorrente ou pontual), com regra de recorrência, valor esperado (ou faixa), data esperada, categoria.
- **RecurrenceRule** — periodicidade, dia de vencimento, data de início/fim.
- **ReconciliationMatch** — vínculo entre Transaction e PlannedItem, com confidence score, status (sugerido/confirmado/rejeitado), origem (automático/manual).
- **Goal** *(a validar — ver seção 7.9/17)* — meta financeira (economia, limite de gasto por categoria), prazo, progresso.
- **Alert** — evento gerado pelo sistema (desvio, nova recorrência, despesa fora do padrão), com status de leitura.
- **Insight** — output da camada de IA, vinculado a dados de origem (para transparência — ver princípio "Transparência" na seção 15).
- **ProjectionSnapshot** *(sugerido)* — saldo projetado calculado, para permitir histórico/auditoria da própria projeção ao longo do tempo.

---

## 14. Design system — referência rápida

### Paleta

| Token | Hex | Uso |
|---|---|---|
| Background | `#080B10` | Fundo principal |
| Surface | `#11161F` | Cards e superfícies |
| Surface 2 | `#171D27` | Cards destacados / estados elevados |
| Border | `#252D38` | Divisores e bordas |
| Primary | `#2F6BFF` | Ações principais, seleção e links |
| Primary Light | `#5C8DFF` | Hover e destaque |
| Text Primary | `#F5F7FA` | Texto principal |
| Text Secondary | `#9AA4B2` | Contexto |
| Text Muted | `#667085` | Metadados |
| Success | `#35C98A` | Positivo / conciliado |
| Warning | `#F5B942` | Atenção moderada |
| Danger | `#F05D6C` | Excesso / alerta crítico |

Proporção recomendada: **70% superfícies escuras · 20% branco/cinza · 7% azul · 3% cores semânticas.**
Dark mode é a identidade principal (o produto pode ter variante clara, mas dark é o padrão).

### Tipografia (Inter, ou sans-serif equivalente com boa leitura de números)

| Estilo | Tamanho | Peso | Uso |
|---|---|---|---|
| Display | 48–56 px | 600–700 | Grandes números e destaque |
| Heading 1 | 32 px | 600 | Títulos de tela |
| Heading 2 | 24 px | 600 | Seções |
| Heading 3 | 18 px | 600 | Cards e grupos |
| Body | 15–16 px | 400–500 | Conteúdo |
| Small | 13 px | 400–500 | Metadados |
| Caption | 11–12 px | 400–500 | Auxiliar |

### Radius

| Componente | Radius |
|---|---|
| Cards | 12 px |
| Inputs | 8 px |
| Buttons | 8 px |
| Badges | 6 px |
| Modal / drawer | 12–16 px |

Evitar superfícies excessivamente arredondadas — linguagem sofisticada/profissional, não lúdica.

### Componentes essenciais e estados

Button (Primary/Secondary/Ghost/Disabled/Loading) · Input (Default/Focus/Error/Disabled/Filled) · Select (Default/Open/Selected/Error) · Badge (Success/Warning/Danger/Info/Neutral) · Card (Default/Elevated/Interactive/Alert) · Table (Default/Hover/Selected/Empty) · Modal (Confirmation/Form/Insight) · Toast (Success/Warning/Error/Info) · Tabs (Default/Active/Disabled) · Tooltip.

Ícones: **Lucide Icons** (ou equivalente), estilo outline, 1.5–2 px. Nunca usar emoji como elemento de UI final.

Tokens de código sugeridos (para handoff de engenharia — ver também `design-tokens.json` neste diretório): `color.background`, `color.surface`, `color.surfaceElevated`, `color.border`, `color.primary`, `color.textPrimary`, `color.textSecondary`, `color.success`, `color.warning`, `color.danger`.

---

## 15. Princípios de UX e de produto visual

**Produto (briefing):**

| Princípio | Aplicação |
|---|---|
| Simplicidade | Usuário não precisa dominar conceitos financeiros |
| Automação | O sistema executa tudo que puder sem intervenção |
| Transparência | Origem e lógica das informações devem ser claras |
| Controle | Usuário pode corrigir, desfazer e configurar automações |
| Ação | Insights devem ajudar a decidir, não apenas mostrar dados |

**Visual (UI Kit):**
1. Clareza antes de decoração.
2. O dado importante domina visualmente.
3. Cores têm significado (nunca cor como único indicador de status).
4. Automação deve ser compreensível.
5. O usuário deve saber o que precisa fazer a seguir.

Regras adicionais de leitura/acessibilidade: alto contraste, números sempre alinhados e formatados de forma consistente, densidade de informação baixa no primeiro nível, estados de foco/erro visíveis, áreas de toque confortáveis no mobile.

---

## 16. Métricas de sucesso

| Categoria | Métrica |
|---|---|
| Ativação | Conexão de conta/cartão via Open Finance |
| Engajamento | Transações processadas e planejamentos cadastrados |
| Automação | % de transações categorizadas e conciliadas automaticamente |
| Valor / retenção | Retenção e uso contínuo do planejamento |

> **North Star Metric:** percentual das transações financeiras automaticamente categorizadas e conciliadas com o planejamento.

Essa métrica amarra diretamente o motor de conciliação (seção 8) ao sucesso do produto — reforça que ele é o coração técnico do MVP, não um "nice to have".

---

## 17. Riscos, dependências e perguntas em aberto

| Tema | Pergunta / risco |
|---|---|
| Open Finance | Qual agregador/provedor será usado (ex.: Belvo, Pluggy, Quanto, integração direta via Open Finance Brasil)? Custo por conexão, cobertura de instituições, SLA de sincronização. |
| Compliance/segurança | LGPD, certificação/registro no Open Finance Brasil, criptografia de dados sensíveis, política de retenção, consentimento e revogação. |
| Motor de conciliação | Processamento síncrono (na chegada da transação) ou em batch? Latência aceitável? Onde vive a lógica (backend central vs. edge)? |
| Categorização | Taxonomia de categorias é fixa (curada) ou o usuário pode criar as próprias desde o MVP? |
| IA | Qual modelo/abordagem para insights e consultas em linguagem natural? Roda sobre dados agregados (privacidade) ou acesso a transações individuais? Custo por usuário ativo. |
| Metas | Módulo "Metas" aparece na navegação do UI Kit mas não tem escopo definido no briefing — precisa de discovery próprio. |
| Cartões/Contas | Telas de gestão de instituições/cartões (fatura, limite, status de sync) não têm escopo detalhado — mencionadas só como itens de navegação. |
| Multiplataforma | Web e App nascem juntos ou o MVP prioriza uma plataforma? Isso muda sequenciamento técnico e de design. |
| Modelo de negócio | Briefing não define monetização (assinatura, freemium, etc.) — necessário para dimensionar go-to-market, mas não bloqueia discovery de produto. |
| Onboarding de conexão | O que acontece no primeiro uso antes de qualquer conta estar conectada (estado vazio)? Crítico para ativação. |

---

## 18. Próximos passos do discovery

1. **Validação de personas e JTBD** — 6–8 entrevistas com usuários-alvo (mix dos 3 perfis da seção 4), roteirizadas em torno das 5 perguntas da seção 5.
2. **Benchmark competitivo** — mapear apps de Open Finance/PFM já no mercado brasileiro (pontos fortes/fracos em conciliação, projeção e IA), para calibrar diferenciação.
3. **Spike técnico de Open Finance** — avaliar 2–3 agregadores/providers quanto a cobertura de instituições, custo, latência de sincronização e maturidade de sandbox.
4. **Spike técnico do motor de conciliação** — prototipar os critérios da seção 8 contra uma amostra real (ou sintética) de transações, medir precisão/recall antes de comprometer arquitetura.
5. **Definir escopo de "Metas", "Contas" e "Cartões"** — fechar as lacunas da seção 17 antes de wireframes de alta fidelidade.
6. **Wireframes de baixa fidelidade** dos fluxos críticos: onboarding + primeira conexão Open Finance, dashboard, timeline de transações, criação de planejamento, revisão de conciliação, tela de projeção, insight de IA.
7. **Protótipo clicável** (Web e/ou App) para teste de usabilidade com 5 usuários por rodada, antes de iniciar desenvolvimento do MVP.
8. **Decisão de repositório/arquitetura** — como este produto não tem relação com o código hoje presente em `FitOS`, decidir se o Entende nasce em repositório próprio (recomendado) ou como novo diretório isolado aqui, e formalizar o setup do projeto (stack Web/App, backend, infra) antes da fase de build.
9. **Definir modelo de negócio** — necessário para o discovery de go-to-market em paralelo ao discovery de produto.

---

## Anexos de apoio

- `design-tokens.json` — tokens de cor/tipografia/espaçamento extraídos do UI Kit, prontos para consumo em código.
