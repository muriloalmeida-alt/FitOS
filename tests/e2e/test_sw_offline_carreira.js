// Pedido do usuário (item 9 da lista de melhorias, "Vamos implementar
// todos na ordem abaixo"): "o service worker (sw.js) só pré-carrega os
// arquivos do site principal (index.html, app.js…); carreira.html/
// carreira.js só entram em cache depois do 1º acesso online. Ajuste
// pequeno pra funcionar offline com mais confiança."
// Valida: o service worker pré-carrega carreira.html/carreira.js/
// manifest-treinador.json na INSTALAÇÃO (sem precisar de nenhuma visita
// online antes), e a tela abre de verdade offline logo na 1ª visita.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, serviceWorkers: "allow" });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";

  // 1) 1ª visita (só ao SITE PRINCIPAL, nunca abriu carreira.html) —
  // instala o service worker e espera ele ativar.
  await page.goto(base + "/", { waitUntil: "load" });
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  await page.waitForTimeout(500); // dá tempo do "install" (cache.addAll) terminar de verdade

  // 2) Confirma que carreira.html/carreira.js/manifest-treinador.json já
  // estão em cache MESMO sem nunca ter visitado /carreira.html antes.
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shellKey = keys.find((k) => k.startsWith("brdata-shell-"));
    if (!shellKey) return { error: "cache shell não encontrado", keys };
    const cache = await caches.open(shellKey);
    const paths = ["/carreira.html", "/js/carreira.js", "/manifest-treinador.json", "/img/brand-icon.png"];
    const results = {};
    for (const p of paths) results[p] = !!(await cache.match(p));
    return results;
  });
  console.log("1) carreira.html/carreira.js/manifest-treinador.json/brand-icon já em cache sem nunca ter visitado /carreira.html:",
    cached["/carreira.html"] && cached["/js/carreira.js"] && cached["/manifest-treinador.json"] && cached["/img/brand-icon.png"],
    JSON.stringify(cached));

  // 3) Fica OFFLINE de verdade e abre /carreira.html direto (1ª vez) —
  // tem que carregar do cache, não só dar erro de rede.
  await context.setOffline(true);
  const resp = await page.goto(base + "/carreira.html", { waitUntil: "load" }).catch((e) => ({ error: e.message }));
  const offlineLoaded = await page.evaluate(() => ({
    hasTitle: document.title.length > 0,
    hasLoginScreen: !!document.getElementById("screenLoginRequired"),
    carreiraJsLoaded: typeof window.boot === "function" || typeof window.CAREER !== "undefined" || document.querySelector('script[src="js/carreira.js"]') !== null,
  })).catch((e) => ({ error: e.message }));
  console.log("2) /carreira.html abre OFFLINE (1ª vez, sem visita online prévia à própria tela):", !resp?.error && offlineLoaded.hasLoginScreen, JSON.stringify({ respOk: !resp?.error, offlineLoaded }));

  await context.setOffline(false);
  await browser.close();
  console.log("OK");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
