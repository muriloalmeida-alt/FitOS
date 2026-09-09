// Testa a tela Login/Entrada (S4-B2-002, issue #13). Diferente das
// demandas anteriores, a inspeção não encontrou trabalho de migração
// pendente: #screenLoginRequired (Modo Técnico) já estava 100% nos
// tokens --m3-* (refatoração anterior, ver comentário "REFATORAÇÃO
// COMPLETA" em carreira.html) e é uma estrutura própria (.mt-*),
// completamente separada de .auth-gate (usado só por index.html) —
// achado da demanda, registrado no relatório. Este teste existe pra
// travar essa evidência (tokens computados + os 4 estados) contra
// regressão futura, já que não havia teste dedicado a isso antes —
// só test_carreira_login_form.js (2 checks funcionais básicos,
// continua existindo, sem sobreposição).
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => { if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text()); });
  const base = "http://localhost:8787";
  const email = `s4b2002${Date.now()}@teste.com`;

  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "S4B2002 Teste", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "load" });
  await page.waitForTimeout(500);

  // 1) Estado "default": tela visível, com os tokens --m3-* corretos
  // (painel/campo/botão) — não .auth-gate (confirma que são telas
  // realmente separadas, não a mesma reestilizada).
  const defaultState = await page.evaluate(() => {
    const scr = document.getElementById("screenLoginRequired");
    const panel = scr.querySelector(".mt-panel");
    const input = scr.querySelector("#ctLoginEmail");
    const btn = scr.querySelector(".mt-btn-enter");
    return {
      visible: !scr.classList.contains("hidden"),
      usesAuthGate: !!scr.querySelector(".auth-gate, .auth-gate-card"),
      panelBg: getComputedStyle(panel).backgroundColor,
      inputBg: getComputedStyle(input).backgroundColor,
      btnBg: getComputedStyle(btn).backgroundColor,
      btnColor: getComputedStyle(btn).color,
    };
  });
  // --m3-surface-container é #211F1D = rgb(33,31,29); --m3-surface-
  // container-high é #2C2A27 = rgb(44,42,39); --m3-primary é #6DDB94 =
  // rgb(109,219,148); --m3-on-primary é #00391A = rgb(0,57,26).
  console.log("1) Default: tela própria do Modo Técnico (não .auth-gate), tokens --m3-* aplicados:",
    defaultState.visible && !defaultState.usesAuthGate &&
    defaultState.panelBg === "rgb(33, 31, 29)" && defaultState.inputBg === "rgb(44, 42, 39)" &&
    defaultState.btnBg === "rgb(109, 219, 148)" && defaultState.btnColor === "rgb(0, 57, 26)",
    JSON.stringify(defaultState));

  // 2) Estado "erro": campos vazios mostram mensagem inline com o
  // token --m3-error correto.
  await page.click("#screenLoginRequired button[type=submit]");
  await page.waitForTimeout(150);
  const emptyErrorState = await page.evaluate(() => {
    const err = document.getElementById("ctLoginError");
    return { visible: err.style.display !== "none", text: err.textContent, color: getComputedStyle(err).color };
  });
  console.log("2) Erro (campos vazios) com token --m3-error correto:",
    emptyErrorState.visible && emptyErrorState.color === "rgb(255, 84, 73)", JSON.stringify(emptyErrorState));

  // 3) Estado "erro" (credenciais erradas) — mesma mensagem inline,
  // sem travar o formulário.
  await page.fill("#ctLoginEmail", email);
  await page.fill("#ctLoginPassword", "senhaerrada");
  await page.click("#screenLoginRequired button[type=submit]");
  await page.waitForTimeout(600);
  const wrongPassState = await page.evaluate(() => {
    const err = document.getElementById("ctLoginError");
    const btn = document.querySelector("#screenLoginRequired button[type=submit]");
    return { errorVisible: err.style.display !== "none", errorText: err.textContent, btnReenabled: !btn.disabled, btnLabel: btn.textContent };
  });
  console.log("3) Erro (senha errada): mensagem aparece, botão reabilitado pra tentar de novo:",
    wrongPassState.errorVisible && wrongPassState.btnReenabled && wrongPassState.btnLabel === "Entrar",
    JSON.stringify(wrongPassState));

  await page.screenshot({ path: "s4_b2_002_error_state.png" }).catch(() => {});

  // 4) Estado "carregamento": botão desabilitado + texto "Entrando..."
  // durante o fetch (checado via interceptação de rede pra dar tempo
  // de capturar o estado intermediário, que normalmente passa rápido
  // demais pro teste pegar).
  await page.route("**/api/auth/login", async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.fill("#ctLoginPassword", "senha123");
  const submitPromise = page.click("#screenLoginRequired button[type=submit]");
  await page.waitForTimeout(150);
  const loadingState = await page.evaluate(() => {
    const btn = document.querySelector("#screenLoginRequired button[type=submit]");
    return { disabled: btn.disabled, label: btn.textContent };
  });
  console.log("4) Carregamento: botão desabilitado com texto 'Entrando...' durante o login:",
    loadingState.disabled && loadingState.label === "Entrando...", JSON.stringify(loadingState));
  await submitPromise;

  // 5) Estado "sucesso"/conclusão: login válido faz a tela de login
  // sumir e o boot seguir pro resto do app (mesmo padrão de transição
  // de S4-B2-001 — sem estado de sucesso próprio nesta tela, só
  // desaparece).
  await page.waitForTimeout(600);
  const loggedIn = await page.evaluate(() => document.getElementById("screenLoginRequired").classList.contains("hidden"));
  console.log("5) Sucesso: login válido faz a tela de login sumir (fluxo funcional intacto):", loggedIn);

  await browser.close();
})();
