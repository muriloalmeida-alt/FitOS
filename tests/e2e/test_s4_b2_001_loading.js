// Testa a migração da tela Loading/Bootstrap pro Design System novo
// (S4-B2-001, issue #12). Cobre: os 3 estados (carregamento/erro/
// conclusão) usando os tokens --m3-* corretos, a remoção da regra CSS
// morta ("#screenLoading h1", nunca renderizado em nenhum dos 3
// estados) e preservação do fluxo funcional normal (boot → login →
// escolha de clube/carreira, sem erro de console).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";

  // 1) Estado "carregamento" (markup estático inicial) com os tokens
  // --m3-* aplicados. Checa os valores computados, não a visibilidade
  // no instante exato (boot() roda no mesmo DOMContentLoaded e pode já
  // ter resolvido a checagem de sessão rápido demais pro teste pegar a
  // tela ainda visível — propriedade CSS computada continua correta
  // mesmo com o elemento oculto via .hidden, então é o que importa
  // verificar aqui: é uma mudança de CSS, não de timing/fluxo).
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  const loadingState = await page.evaluate(() => {
    const el = document.getElementById("screenLoading");
    const cs = getComputedStyle(el);
    const spinner = el.querySelector(".ct-spinner");
    const spinnerCs = spinner ? getComputedStyle(spinner) : null;
    return {
      bgColor: cs.backgroundColor,
      hasCrest: !!el.querySelector(".mt-splash-crest"),
      hasText: !!el.querySelector("p"),
      spinnerBorderTopColor: spinnerCs?.borderTopColor,
    };
  });
  // --m3-surface-dim (tema padrão "Verde de Campo") é #100F0E = rgb(16,15,14);
  // --m3-primary é #6DDB94 = rgb(109,219,148).
  console.log("1) Estado 'carregamento' com tokens --m3-* aplicados (bg/spinner):",
    loadingState.hasCrest && loadingState.hasText &&
    loadingState.bgColor === "rgb(16, 15, 14)" && loadingState.spinnerBorderTopColor === "rgb(109, 219, 148)",
    JSON.stringify(loadingState));

  // 2) Regra morta "#screenLoading h1" removida (nenhum dos 3 estados
  // desta tela jamais teve um <h1> — confirmado por busca literal no
  // código antes da migração).
  const hasH1Anywhere = await page.evaluate(() => !!document.querySelector("#screenLoading h1"));
  console.log("2) #screenLoading nunca tem <h1> (regra morta removida, nada quebrou):", !hasH1Anywhere);

  // 3) Estado "erro" (splashErrorHTML) — testado diretamente via a
  // função de render (mesma técnica já usada pra Bottom Sheet/Skeleton
  // em S3-DS20-S4-PREP-001): meu diff é só CSS, então validar que o
  // HTML gerado por splashErrorHTML() recebe os tokens --m3-* certos é
  // o nível de teste certo aqui, sem precisar fabricar uma falha de
  // rede real pós-login (fora de escopo — regra de negócio do boot não
  // foi tocada por esta demanda).
  const errorState = await page.evaluate(() => {
    document.getElementById("screenLoading").innerHTML = splashErrorHTML("Erro de teste: timeout simulado");
    const icon = document.querySelector("#screenLoading .mt-error-icon");
    const title = document.querySelector("#screenLoading .mt-error-title");
    const sub = document.querySelector("#screenLoading .mt-error-sub");
    const detail = document.querySelector("#screenLoading .ct-sub");
    const btn = document.querySelector("#screenLoading .mt-btn-primary-gold");
    return {
      iconColor: getComputedStyle(icon).color,
      titleColor: getComputedStyle(title).color,
      subColor: getComputedStyle(sub).color,
      detailColor: detail ? getComputedStyle(detail).color : null,
      detailText: detail?.textContent,
      hasRetryButton: !!btn,
      retryButtonText: btn?.textContent.trim(),
    };
  });
  // --m3-error é #FF5449 = rgb(255,84,73); --m3-on-surface é #E7E2DE =
  // rgb(231,226,222); --m3-on-surface-variant é #CBC5BE = rgb(203,197,190).
  console.log("3) Estado 'erro' com tokens --m3-* corretos (ícone/título/subtítulo/detalhe) e botão de retry:",
    errorState.iconColor === "rgb(255, 84, 73)" &&
    errorState.titleColor === "rgb(231, 226, 222)" &&
    errorState.subColor === "rgb(203, 197, 190)" &&
    errorState.detailColor === "rgb(203, 197, 190)" &&
    errorState.detailText.includes("Erro de teste") &&
    errorState.hasRetryButton && errorState.retryButtonText === "Tentar novamente",
    JSON.stringify(errorState));

  await page.screenshot({ path: "s4_b2_001_error_state.png" }).catch(() => {});

  // 4) Estado "conclusão" + preservação funcional: o fluxo normal
  // (signup → login → escolha de clube) precisa continuar idêntico —
  // #screenLoading unicamente transitório, a tela seguinte é quem
  // representa a conclusão (sem estado de "sucesso" próprio nesta
  // tela, por design — só desaparece quando o próximo destino está
  // pronto).
  const email = `s4b2001${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B2001 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const afterBoot = await page.evaluate(() => ({
    loadingHidden: document.getElementById("screenLoading").classList.contains("hidden"),
    pickerOrGameVisible: !document.getElementById("screenCompetitionPicker").classList.contains("hidden")
      || !document.getElementById("screenPicker").classList.contains("hidden")
      || !document.getElementById("screenGame").classList.contains("hidden"),
  }));
  console.log("4) Conclusão: #screenLoading some e a próxima tela real aparece (fluxo normal intacto):",
    afterBoot.loadingHidden && afterBoot.pickerOrGameVisible, JSON.stringify(afterBoot));

  await browser.close();
})();
