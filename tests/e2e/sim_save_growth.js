// SAVE-LIMIT-001 — medição REAL de tamanho de save ao longo de várias
// temporadas. Script de medição TEMPORÁRIO (mesmo espírito de
// sim_transfer_ai_*.js — não faz parte da suíte de regressão
// permanente), roda a pipeline REAL (resolveRoundInstant/finishRoundTail/
// advanceSeason, exatamente as mesmas funções que "Simular rodada"/
// "Avançar temporada" chamam) contra uma carreira real "multi" (criada
// pela UI normal, marketScope sempre "multi" hoje — ver startCareer()).
// Não altera nenhum arquivo de produção — só lê JSON.stringify(CAREER)
// e o tamanho de cada campo de topo em memória.
const { chromium } = require("playwright-core");

const SEASONS = 4; // ~4 temporadas = 152 rodadas — suficiente pra ver a tendência de crescimento das estruturas acumulativas (a maioria satura por volta do próprio cap: MAX_SEASON_HISTORY=15 levaria 15 temporadas pra saturar sozinho, então o que importa aqui é a TAXA de crescimento por temporada, não saturação completa)

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, headless: true, args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  const base = "http://localhost:8787";
  const email = `savegrowth${Date.now()}@teste.com`;
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Save Growth", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForSelector(".m3-club-row", { timeout: 15000 });
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnOnboardSkip", { timeout: 2000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnWizardSkip", { timeout: 4000 }).catch(() => {});
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  console.log("Carreira 'multi' real criada. Medindo tamanho inicial e ao longo de", SEASONS, "temporadas simuladas (pipeline real: resolveRoundInstant/finishRoundTail/advanceSeason)...\n");

  const result = await page.evaluate(async ({ SEASONS }) => {
    function sizeOf(obj) { return new TextEncoder().encode(JSON.stringify(obj) || "").length; }
    const snapshots = [];
    snapshots.push({ label: "criação (round 1)", round: CAREER.currentRound, season: CAREER.seasonYear, bytes: sizeOf(CAREER) });

    for (let s = 0; s < SEASONS; s++) {
      while (CAREER.currentRound <= 38) {
        const round = CAREER.currentRound;
        const fixtures = CAREER.schedule[round] || [];
        const standingsBefore = JSON.parse(JSON.stringify(CAREER.standings));
        resolveRoundInstant(round, fixtures, standingsBefore);
      }
      // Fim da temporada: mesma função que o botão "Avançar temporada" chama.
      await advanceSeason();
      snapshots.push({ label: `fim da temporada ${s + 1}`, round: CAREER.currentRound, season: CAREER.seasonYear, bytes: sizeOf(CAREER) });
    }

    // Simula algumas trocas de clube só pra medir o custo POR ENTRADA de
    // clubHistory (gap confirmado, sem cap) — sem passar pelo fluxo de
    // aceitar proposta de verdade, só a mesma função que ele chama.
    const beforeClubHistory = sizeOf(CAREER.clubHistory || []);
    for (let i = 0; i < 20; i++) {
      endCurrentClubStint("dismissed");
      CAREER.clubHistory = TECHNICIAN_CARRY.clubHistory; // acumula de verdade a cada troca, mesmo passo que startCareer() faria
    }
    const afterClubHistory = sizeOf(CAREER.clubHistory);
    const perEntryBytes = Math.round((afterClubHistory - beforeClubHistory) / 20);

    // Breakdown por campo de topo, no estado final (mais avançado).
    const breakdown = Object.keys(CAREER).map((k) => ({ key: k, bytes: sizeOf(CAREER[k]) })).sort((a, b) => b.bytes - a.bytes);

    return { snapshots, breakdown, clubHistoryEntries: CAREER.clubHistory.length, perEntryBytes, finalTotal: sizeOf(CAREER), maxBytes: 768 * 1024 };
  }, { SEASONS });

  console.log("=== Crescimento total ao longo do tempo ===");
  result.snapshots.forEach((s) => console.log(`  ${s.label.padEnd(24)} round=${s.round} season=${s.season}  ${(s.bytes / 1024).toFixed(1)}KB`));

  const first = result.snapshots[0].bytes, last = result.snapshots[result.snapshots.length - 1].bytes;
  console.log(`\nCrescimento em ${SEASONS} temporadas: ${((last - first) / 1024).toFixed(1)}KB (${(((last - first) / SEASONS) / 1024).toFixed(1)}KB/temporada em média)`);
  console.log(`MAX_BYTES atual: ${(result.maxBytes / 1024).toFixed(0)}KB. Tamanho final medido: ${(result.finalTotal / 1024).toFixed(1)}KB (${((result.finalTotal / result.maxBytes) * 100).toFixed(0)}% do limite).`);

  console.log("\n=== clubHistory (gap confirmado, sem cap) ===");
  console.log(`Custo por entrada: ~${result.perEntryBytes} bytes. Depois de ${result.clubHistoryEntries} trocas de clube: ${(result.perEntryBytes * result.clubHistoryEntries / 1024).toFixed(2)}KB.`);

  console.log("\n=== Breakdown por campo de topo (estado final, maior primeiro) ===");
  result.breakdown.slice(0, 15).forEach((b) => console.log(`  ${b.key.padEnd(24)} ${(b.bytes / 1024).toFixed(1)}KB`));

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
