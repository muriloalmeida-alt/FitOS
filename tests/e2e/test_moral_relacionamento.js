const { chromium } = require("playwright-core");

async function newCareer(page, base, email) {
  await page.goto(base + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async ({ email }) => {
    await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Moral Test", email, password: "senha123", phone: "11999999999", plan: "freemium" }) });
    await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "senha123" }) });
  }, { email });
  await page.goto(base + "/carreira.html", { waitUntil: "domcontentloaded" });
  await page.click('.mt-competition-card[data-competition="brasileirao"]');
  await page.waitForTimeout(200);
  await page.click(".m3-club-row");
  await page.waitForTimeout(150);
  await page.click("#btnConfirmClub");
  await page.click("#btnClaimDailyLogin", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1,MAP fonts.gstatic.com 127.0.0.1"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.on("dialog", (d) => d.dismiss());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("fonts.googleapis") && !m.text().includes("fundingchoices")) console.log("CONSOLE ERROR:", m.text()); });

  const base = "http://localhost:8787";
  await newCareer(page, base, `moral${Date.now()}@teste.com`);

  const result = await page.evaluate(() => {
    const out = {};
    const bench = CAREER.squad.find((p) => CAREER.lineup.bench.includes(p.id)) || CAREER.squad.find((p) => !CAREER.lineup.starters.includes(p.id));
    const starter = CAREER.squad.find((p) => CAREER.lineup.starters.includes(p.id));

    // 1) Simula 3 rodadas de vitória com o mesmo jogador de fora do time
    // titular -- benchStreak sobe, motivo muda pra "insatisfeito".
    for (let i = 0; i < 3; i++) applyMoraleAfterMatch(2, 0);
    out.benchStreak = bench.benchStreak;
    out.reasonAfter3 = bench.moraleReason;
    out.starterReason = starter.moraleReason;
    out.starterBenchStreakZero = starter.benchStreak === 0;

    // 2) Botão "Conversar" fica disponível pra quem está insatisfeito.
    out.canTalkBench = canTalkTo(bench);
    out.canTalkStarter = canTalkTo(starter);

    // 3) Aplica a conversa "Ouvir e apoiar" -- moral sobe, motivo muda,
    // não pode conversar de novo na MESMA rodada.
    const moraleBefore = bench.morale;
    TALK_CTX = { playerId: bench.id };
    applyTalkOption("apoiar");
    out.moraleRoseAfterTalk = bench.morale > moraleBefore;
    out.reasonAfterTalk = bench.moraleReason;
    out.cannotTalkAgainSameRound = !canTalkTo(bench);

    // 4) "Pede transferência": força benchStreak/moral baixos o
    // suficiente e confere a flag.
    bench.benchStreak = 6;
    bench.morale = 10;
    bench.lastTalkRound = null;
    applyMoraleAfterMatch(0, 2); // derrota também, só reforça
    out.wantsTransfer = bench.wantsTransfer;

    // 5) "Cobrar postura" em quem já está muito infeliz PIORA (efeito
    // contextual pedido no documento).
    bench.lastTalkRound = null;
    const moraleBeforeCobra = bench.morale;
    TALK_CTX = { playerId: bench.id };
    applyTalkOption("cobrar");
    out.cobrarPioraQuandoMuitoInfeliz = bench.morale < moraleBeforeCobra;

    return out;
  });

  console.log("1) benchStreak sobe pra reserva (3 rodadas fora):", result.benchStreak === 3);
  console.log("   motivo reflete insatisfação:", result.reasonAfter3.includes("Insatisfeito") || result.reasonAfter3.includes("Contrariado"));
  console.log("   titular não acumula benchStreak:", result.starterBenchStreakZero);
  console.log("2) Conversar disponível pro insatisfeito, não pro titular feliz:", result.canTalkBench === true, result.canTalkStarter === false);
  console.log("3) Moral sobe após 'Ouvir e apoiar':", result.moraleRoseAfterTalk, "| motivo atualizado:", result.reasonAfterTalk.includes("Conversou"));
  console.log("   Não pode conversar de novo na mesma rodada:", result.cannotTalkAgainSameRound);
  console.log("4) 'Pede transferência' fica marcado com moral muito baixa + banco prolongado:", result.wantsTransfer === true);
  console.log("5) 'Cobrar postura' piora quem já está muito infeliz (efeito contextual):", result.cobrarPioraQuandoMuitoInfeliz);

  // 6) Fluxo real via UI: abre o detalhe do jogador insatisfeito, vê a
  // seção "Relacionamento" e o botão Conversar, conversa e confere o
  // toast + fechamento do modal.
  const uiResult = await page.evaluate(() => {
    const bench = CAREER.squad.find((p) => !CAREER.lineup.starters.includes(p.id));
    bench.benchStreak = 4;
    bench.moraleReason = "Insatisfeito no banco há 4 jogos seguidos";
    bench.lastTalkRound = null;
    bench.wantsTransfer = false;
    openDetail(bench.id);
    return { id: bench.id, hasTalkBtn: !!document.querySelector('[data-act="talk"]') };
  });
  console.log("6) Botão Conversar aparece no detalhe:", uiResult.hasTalkBtn);
  await page.click('[data-act="talk"]');
  await page.waitForSelector("#talkOverlay.open");
  await page.waitForTimeout(150);
  const talkText = await page.evaluate(() => document.getElementById("talkContext").textContent);
  console.log("   Modal mostra o motivo atual:", talkText.includes("Insatisfeito"));
  await page.click('[data-talk="prometer"]');
  await page.waitForTimeout(200);
  const closedAfterTalk = await page.evaluate(() => !document.getElementById("talkOverlay").classList.contains("open"));
  console.log("   Modal fecha após escolher uma resposta:", closedAfterTalk);
  const toastVisible = await page.evaluate(() => !!document.querySelector(".ct-toast, #toast, [class*='toast']"));
  console.log("   Toast de resultado aparece:", toastVisible);

  await browser.close();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
