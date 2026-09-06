// Verifica a correção do bug "Time #ope": uma carreira criada em Modo
// Exemplo (liveMode: false) precisa continuar SEMPRE recarregando com
// os mesmos ids de time, mesmo que o dado real fique disponível
// depois (env vars configuradas) -- não pode trocar de fonte de dado
// silenciosamente e quebrar os ids já gravados no calendário/elenco.
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `pindata${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Pin Data", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="serie_b"]');
  await page.waitForTimeout(400);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(600);

  // 1) Carreira nasceu em Modo Exemplo (sem chave real configurada
  // neste ambiente de teste) -- liveMode gravado como false, e o
  // calendário tem os ids fictícios de sempre (ex.: "ope").
  const initial = await page.evaluate(() => ({
    liveMode: CAREER.liveMode,
    hasOpeInSchedule: Object.values(CAREER.schedule).some((round) => round.some((m) => m.home === "ope" || m.away === "ope")),
  }));
  console.log("1) Carreira criada em Modo Exemplo (liveMode=false):", initial.liveMode === false, "| calendário usa ids fictícios (ex.: 'ope'):", initial.hasOpeInSchedule);

  // 2) Simula o cenário do bug: o fornecedor real "fica disponível"
  // (troca fetch pra devolver um catálogo de times com ids
  // TOTALMENTE diferentes dos fictícios) e chama loadLeague() do jeito
  // ANTIGO (sem forceDemo) -- reproduz o "Time #ope" quebrando.
  const withoutFix = await page.evaluate(async () => {
    const realFetch = window.fetch;
    // AJUSTE (pedido do usuário: "o mercado deve trazer jogadores das
    // 3 ligas") — carreira agora nasce "multi" por padrão, e
    // ALL_TEAMS_FLAT (o registro das 3 competições pro mercado de 60
    // times) já teria "ope" cadastrado desde a criação, mascarando
    // esta demonstração via um caminho DIFERENTE (fallback de
    // teamById pra ALL_TEAMS_FLAT) — não é o mesmo bug sendo
    // reproduzido. Zera ALL_TEAMS_FLAT aqui pra simular fielmente o
    // estado de uma carreira "single" (marketScope legado, de antes
    // desta mudança, que nunca tem esse registro populado) — é
    // exatamente esse cenário que o forceDemo de loadLeague precisa
    // cobrir sozinho, sem ajuda de nenhum registro extra.
    ALL_TEAMS_FLAT = [];
    window.fetch = async (url, opts) => {
      if (String(url).includes("/api/health")) {
        return new Response(JSON.stringify({ hasKey: true, season: 2026 }), { status: 200 });
      }
      if (String(url).includes("/api/career/teams")) {
        return new Response(JSON.stringify({ teams: [{ id: "9001", name: "Operário Ferroviário", short: "OPE" }, { id: "9002", name: "Goiás", short: "GOI" }] }), { status: 200 });
      }
      if (String(url).includes("/api/career/standings")) {
        return new Response(JSON.stringify({ standings: [] }), { status: 200 });
      }
      return realFetch(url, opts);
    };
    await loadLeague("serie_b"); // comportamento ANTIGO, sem forceDemo
    const opeName = teamById("ope").name;
    window.fetch = realFetch;
    return { liveMode: LIVE_MODE, opeName };
  });
  console.log("2) SEM a correção (loadLeague sem forceDemo), o bug reproduz -- 'Time #ope' aparece:", withoutFix.opeName === "Time #ope", JSON.stringify(withoutFix));

  // 3) Com a correção de verdade (forceDemo baseado em CAREER.liveMode
  // === false, do jeito que enterAfterAuth agora faz), o mesmo cenário
  // NÃO quebra -- os ids continuam batendo com o calendário já salvo.
  const withFix = await page.evaluate(async () => {
    const realFetch = window.fetch;
    window.fetch = async (url, opts) => {
      if (String(url).includes("/api/health")) {
        return new Response(JSON.stringify({ hasKey: true, season: 2026 }), { status: 200 });
      }
      if (String(url).includes("/api/career/teams")) {
        return new Response(JSON.stringify({ teams: [{ id: "9001", name: "Operário Ferroviário", short: "OPE" }, { id: "9002", name: "Goiás", short: "GOI" }] }), { status: 200 });
      }
      if (String(url).includes("/api/career/standings")) {
        return new Response(JSON.stringify({ standings: [] }), { status: 200 });
      }
      return realFetch(url, opts);
    };
    await loadLeague("serie_b", { forceDemo: CAREER.liveMode === false });
    const opeName = teamById("ope").name;
    window.fetch = realFetch;
    return { liveMode: LIVE_MODE, opeName };
  });
  console.log("3) COM a correção, 'Operário-PR' continua resolvendo certo (sem quebrar):", withFix.opeName === "Operário-PR", "| continua em Modo Exemplo:", withFix.liveMode === false, JSON.stringify(withFix));

  // 4) Fluxo real de verdade: recarregar a página (enterAfterAuth) não
  // quebra nada -- clube/central continuam mostrando nomes certos.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const afterReload = await page.evaluate(() => {
    const nextMatch = document.querySelector(".mt-nextmatch");
    return { text: nextMatch ? nextMatch.textContent : null, hasQuebrado: nextMatch ? nextMatch.textContent.includes("Time #") : null };
  });
  console.log("4) Depois de recarregar de verdade (enterAfterAuth), Central não mostra 'Time #' quebrado:", afterReload.hasQuebrado === false, JSON.stringify(afterReload.text));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
