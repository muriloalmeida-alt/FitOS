/* ===================================================================
   ADMIN.JS — Área administrativa (/admin)
   -------------------------------------------------------------------
   Separado de propósito do app.js dos usuários finais (ver comentário
   na rota /admin em server.js) — script próprio, mais simples, sem
   nada do motor de simulação/dados esportivos. Autenticação: mesmo
   login de sempre (cookie de sessão, POST /api/auth/login) — só
   precisa também ter role "admin" na conta (ver users.isAdmin no
   backend); toda chamada pra /api/adminpanel/* já é bloqueada lá se
   não for admin, esse arquivo só cuida de mostrar a tela certa.
=================================================================== */

let plansById = {}; // preenchido em boot() a partir de GET /api/support/plans

function fmtCurrency(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtPct(n, total) {
  if (!total) return "—";
  return `${((n / total) * 100).toFixed(1)}%`;
}
function planLabel(id) {
  return plansById[id]?.title || id || "—";
}

// Tradução dos status/motivos que o Mercado Pago manda — cobre os
// mais comuns (documentados publicamente); qualquer código que não
// estiver aqui aparece cru mesmo (melhor mostrar o código real do que
// esconder um motivo que ainda não traduzimos).
const STATUS_LABELS = {
  approved: "Aprovado", pending: "Pendente", in_process: "Em análise",
  rejected: "Recusado", cancelled: "Cancelado", refunded: "Reembolsado",
  charged_back: "Estornado", authorized: "Autorizado", in_mediation: "Em mediação",
};
const STATUS_PILL_CLASS = {
  approved: "ok", rejected: "off", cancelled: "off", charged_back: "off",
  pending: "warn", in_process: "warn", in_mediation: "warn", authorized: "warn", refunded: "neutral",
};
const STATUS_DETAIL_LABELS = {
  cc_rejected_insufficient_amount: "Saldo/limite insuficiente",
  cc_rejected_bad_filled_card_number: "Número do cartão incorreto",
  cc_rejected_bad_filled_date: "Validade incorreta",
  cc_rejected_bad_filled_security_code: "CVV incorreto",
  cc_rejected_bad_filled_other: "Dados do cartão incorretos",
  cc_rejected_call_for_authorize: "Cartão pediu autorização manual",
  cc_rejected_card_disabled: "Cartão desabilitado",
  cc_rejected_duplicated_payment: "Pagamento duplicado",
  cc_rejected_high_risk: "Recusado por suspeita de fraude",
  cc_rejected_max_attempts: "Excedeu tentativas",
  cc_rejected_invalid_installments: "Parcelamento inválido",
  cc_rejected_card_error: "Erro ao processar o cartão",
  cc_rejected_blacklist: "Cartão/comprador bloqueado",
  cc_rejected_other_reason: "Outro motivo (sem detalhe)",
  pending_contingency: "Aguardando validação",
  pending_review_manual: "Em análise manual",
  expired: "Expirado",
};
function statusLabel(status) { return STATUS_LABELS[status] || status || "—"; }
function statusDetailLabel(detail) { return detail ? (STATUS_DETAIL_LABELS[detail] || detail) : "—"; }
function statusPillHTML(status) {
  return `<span class="pill ${STATUS_PILL_CLASS[status] || "neutral"}">${statusLabel(status)}</span>`;
}
async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Falha em ${url}`);
  return data;
}

/* ---------- Boot / autenticação ---------- */
async function boot() {
  try {
    const plans = await fetchJSON("/api/support/plans");
    (plans.plans || []).forEach((p) => { plansById[p.id] = p; });
  } catch { /* segue sem os nomes bonitos dos planos, mostra o id cru */ }

  setupNav();
  document.getElementById("adminLoginForm").addEventListener("submit", onLoginSubmit);
  document.getElementById("adminDeniedBack").addEventListener("click", () => { window.location.href = "/"; });
  document.getElementById("adminLogoutBtn").addEventListener("click", onLogout);
  document.getElementById("usersSearch").addEventListener("input", renderUsersTable);

  await checkAuth();
}

function showScreen(name) {
  document.getElementById("adminLogin").style.display = name === "login" ? "flex" : "none";
  document.getElementById("adminDenied").style.display = name === "denied" ? "flex" : "none";
  document.getElementById("adminShell").style.display = name === "shell" ? "flex" : "none";
}

async function checkAuth() {
  try {
    const data = await fetchJSON("/api/auth/me");
    if (!data.authenticated) { showScreen("login"); return; }
    if (data.user.role !== "admin") { showScreen("denied"); return; }
    document.getElementById("adminNavUser").textContent = data.user.name;
    showScreen("shell");
    loadOverview();
  } catch {
    showScreen("login");
  }
}

async function onLoginSubmit(e) {
  e.preventDefault();
  const errBox = document.getElementById("adminLoginError");
  errBox.style.display = "none";
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { errBox.textContent = data.error || "Não foi possível entrar."; errBox.style.display = "block"; return; }
    await checkAuth();
  } catch (err) {
    errBox.textContent = "Falha de rede. Tente de novo.";
    errBox.style.display = "block";
  }
}

async function onLogout() {
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
  window.location.href = "/admin";
}

/* ---------- Navegação entre seções ---------- */
const SECTION_LOADERS = { overview: loadOverview, users: loadUsers, revenue: loadRevenue, integrations: loadIntegrations, behavior: loadBehavior, content: null };
let sectionsLoaded = {};
function setupNav() {
  document.querySelectorAll(".admin-nav .nav-item[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.section;
      document.querySelectorAll(".admin-nav .nav-item[data-section]").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".admin-section").forEach((s) => s.classList.toggle("active", s.id === `admin-${name}`));
      if (!sectionsLoaded[name] && SECTION_LOADERS[name]) { sectionsLoaded[name] = true; SECTION_LOADERS[name](); }
    });
  });
}

/* ---------- Visão geral ---------- */
function kpiTileHTML(lbl, val, small) {
  return `<div class="kpi-tile"><div class="lbl">${lbl}</div><div class="val">${val}${small ? ` <small>${small}</small>` : ""}</div></div>`;
}
function integRowHTML(name, ok, meta) {
  return `<div class="integ-row"><div><div class="name">${name}</div>${meta ? `<div class="meta">${meta}</div>` : ""}</div><span class="pill ${ok ? "ok" : "off"}">${ok ? "Ativo" : "Desligado"}</span></div>`;
}
async function loadOverview() {
  const usersKpis = document.getElementById("ovUsersKpis");
  const revKpis = document.getElementById("ovRevenueKpis");
  const integBox = document.getElementById("ovIntegrations");
  try {
    const data = await fetchJSON("/api/adminpanel/overview");
    const byPlanHTML = Object.entries(data.users.byPlan)
      .map(([id, n]) => kpiTileHTML(planLabel(id), n))
      .join("");
    usersKpis.innerHTML = kpiTileHTML("Usuários (total)", data.users.total) + kpiTileHTML("Sessões ativas", data.users.activeSessions) + byPlanHTML;

    revKpis.innerHTML =
      kpiTileHTML("Receita total", fmtCurrency(data.revenue.totalAllTime), `${data.revenue.countAllTime} pagto${data.revenue.countAllTime === 1 ? "" : "s"}`) +
      kpiTileHTML("Receita esse mês", fmtCurrency(data.revenue.totalThisMonth), `${data.revenue.countThisMonth} pagto${data.revenue.countThisMonth === 1 ? "" : "s"}`);

    const ig = data.integrations;
    integBox.innerHTML =
      integRowHTML(`Dados esportivos (${ig.dataProvider.name})`, ig.dataProvider.hasCredential, `Modo: ${ig.dataProvider.mode} · ${ig.dataProvider.liveModeEnabled ? "ao vivo" : "exemplo"}`) +
      integRowHTML("Mercado Pago (pagamentos)", ig.mercadoPago.configured) +
      integRowHTML("Google AdSense (anúncios)", ig.adsense.configured, ig.adsense.clientId || "") +
      integRowHTML("Grade de TV (onde assistir)", true, ig.epg.url) +
      integRowHTML("Notícias (RSS)", true, ig.newsRss.url || "usando busca padrão do Google Notícias (sem feed próprio configurado)");
  } catch (err) {
    integBox.innerHTML = `<div class="integ-row">Falha ao carregar: ${err.message}</div>`;
  }
}

/* ---------- Usuários ---------- */
let usersCache = [];
async function loadUsers() {
  const body = document.getElementById("usersTableBody");
  body.innerHTML = `<tr><td colspan="6">Carregando...</td></tr>`;
  try {
    const data = await fetchJSON("/api/adminpanel/users");
    usersCache = data.users;
    document.getElementById("usersSub").textContent = `${usersCache.length} conta${usersCache.length === 1 ? "" : "s"} cadastrada${usersCache.length === 1 ? "" : "s"}`;
    renderUsersTable();
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6">Falha ao carregar: ${err.message}</td></tr>`;
  }
}
function userRowHTML(u) {
  const planOptions = Object.keys(plansById).length ? Object.values(plansById) : [{ id: u.plan, title: u.plan }];
  const planSelect = `<select class="admin-select" data-field="plan" data-id="${u.id}">${planOptions.map((p) => `<option value="${p.id}" ${p.id === u.plan ? "selected" : ""}>${p.title}</option>`).join("")}</select>`;
  const statusOptions = ["active", "pending_payment", "checkout_error"];
  const statusLabels = { active: "Ativo", pending_payment: "Pagamento pendente", checkout_error: "Erro no checkout" };
  const statusSelect = `<select class="admin-select" data-field="planStatus" data-id="${u.id}">${statusOptions.map((s) => `<option value="${s}" ${s === u.planStatus ? "selected" : ""}>${statusLabels[s]}</option>`).join("")}</select>`;
  return `<tr data-row-id="${u.id}">
    <td><div style="font-weight:700; color:var(--text-0);">${escHtml(u.name)}</div><div style="font-size:11px; color:var(--text-2);">${escHtml(u.email)}</div></td>
    <td>${planSelect}</td>
    <td>${statusSelect}</td>
    <td>${u.activeSessions}</td>
    <td>${fmtDate(u.createdAt)}</td>
    <td style="white-space:nowrap;">
      <button class="admin-btn-sm" data-action="save" data-id="${u.id}" style="display:none;">Salvar</button>
      <button class="admin-btn-sm danger" data-action="logout" data-id="${u.id}">Forçar logout</button>
    </td>
  </tr>`;
}
function escHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function renderUsersTable() {
  const q = document.getElementById("usersSearch").value.trim().toLowerCase();
  const filtered = q ? usersCache.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : usersCache;
  const body = document.getElementById("usersTableBody");
  body.innerHTML = filtered.length ? filtered.map(userRowHTML).join("") : `<tr><td colspan="6">Nenhum usuário encontrado.</td></tr>`;

  body.querySelectorAll("select[data-field]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const row = sel.closest("tr");
      row.querySelector('[data-action="save"]').style.display = "inline-block";
    });
  });
  body.querySelectorAll('[data-action="save"]').forEach((btn) => btn.addEventListener("click", () => onSaveUserPlan(btn.dataset.id)));
  body.querySelectorAll('[data-action="logout"]').forEach((btn) => btn.addEventListener("click", () => onForceLogout(btn.dataset.id)));
}
async function onSaveUserPlan(id) {
  const row = document.querySelector(`tr[data-row-id="${id}"]`);
  const plan = row.querySelector('[data-field="plan"]').value;
  const planStatus = row.querySelector('[data-field="planStatus"]').value;
  const btn = row.querySelector('[data-action="save"]');
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    await fetchJSON(`/api/adminpanel/users/${encodeURIComponent(id)}/plan`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, planStatus }),
    });
    const idx = usersCache.findIndex((u) => u.id === id);
    if (idx >= 0) { usersCache[idx].plan = plan; usersCache[idx].planStatus = planStatus; }
    btn.style.display = "none";
  } catch (err) {
    alert("Falha ao salvar: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "Salvar";
  }
}
async function onForceLogout(id) {
  const user = usersCache.find((u) => u.id === id);
  if (!confirm(`Derrubar todas as sessões ativas de ${user?.email || id}?`)) return;
  try {
    const data = await fetchJSON(`/api/adminpanel/users/${encodeURIComponent(id)}/logout`, { method: "POST" });
    alert(`${data.sessionsRevoked} sessão(ões) encerrada(s).`);
    loadUsers();
  } catch (err) {
    alert("Falha: " + err.message);
  }
}

/* ---------- Receita ---------- */
function eventDate(e) { return e.eventAt || e.approvedAt || e.recordedAt; } // approvedAt = campo antigo, antes do funil completo
function funnelRowHTML(status, count, extra) {
  return `<div class="funnel-row"><div>${statusPillHTML(status)} ${extra ? `<span style="color:var(--text-2); font-size:11.5px;">${extra}</span>` : ""}</div><b>${count}</b></div>`;
}
async function loadRevenue() {
  const kpis = document.getElementById("revKpis");
  const funnelBox = document.getElementById("revFunnel");
  const body = document.getElementById("revenueTableBody");
  const attemptsBody = document.getElementById("attemptsTableBody");
  const abandonedBody = document.getElementById("abandonedTableBody");
  body.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;
  attemptsBody.innerHTML = `<tr><td colspan="6">Carregando...</td></tr>`;
  abandonedBody.innerHTML = `<tr><td colspan="4">Carregando...</td></tr>`;
  try {
    const data = await fetchJSON("/api/adminpanel/revenue");

    kpis.innerHTML =
      kpiTileHTML("Total histórico", fmtCurrency(data.summary.totalAllTime), `${data.summary.countAllTime} pagto${data.summary.countAllTime === 1 ? "" : "s"}`) +
      kpiTileHTML("Esse mês", fmtCurrency(data.summary.totalThisMonth), `${data.summary.countThisMonth} pagto${data.summary.countThisMonth === 1 ? "" : "s"}`) +
      Object.entries(data.summary.byPlan).map(([id, v]) => kpiTileHTML(planLabel(id), fmtCurrency(v))).join("");

    // Funil: status de todo evento já visto + motivos de recusa mais
    // comuns, se houver algum.
    const byStatus = data.summary.byStatus || {};
    const statusEntries = Object.entries(byStatus).sort((a, b) => b[1] - a[1]);
    let funnelHTML = statusEntries.length
      ? statusEntries.map(([st, n]) => funnelRowHTML(st, n)).join("")
      : `<div class="funnel-row">Nenhum evento de pagamento registrado ainda.</div>`;
    const reasons = Object.entries(data.summary.rejectionReasons || {}).sort((a, b) => b[1] - a[1]);
    if (reasons.length) {
      funnelHTML += `<div class="funnel-row" style="border-top:2px solid var(--border); margin-top:6px; padding-top:10px; font-weight:700; color:var(--text-0);">Motivos de recusa mais comuns</div>` +
        reasons.map(([detail, n]) => `<div class="funnel-row"><span>${statusDetailLabel(detail)}</span><b>${n}</b></div>`).join("");
    }
    funnelBox.innerHTML = funnelHTML;

    body.innerHTML = data.payments.length
      ? data.payments.map((p) => `<tr>
          <td>${fmtDate(eventDate(p))}</td>
          <td>${escHtml(p.email)}</td>
          <td>${planLabel(p.plan)}</td>
          <td>${fmtCurrency(p.amount)}</td>
          <td>${escHtml(p.method || "—")}</td>
        </tr>`).join("")
      : `<tr><td colspan="5">Nenhum pagamento aprovado ainda.</td></tr>`;

    attemptsBody.innerHTML = data.attempts.length
      ? data.attempts.map((a) => `<tr>
          <td>${fmtDate(eventDate(a))}</td>
          <td>${escHtml(a.email)}</td>
          <td>${planLabel(a.plan)}</td>
          <td>${statusPillHTML(a.status)}</td>
          <td>${statusDetailLabel(a.statusDetail)}</td>
          <td>${fmtCurrency(a.amount)}</td>
        </tr>`).join("")
      : `<tr><td colspan="6">Nenhuma recusa/cancelamento registrado ainda.</td></tr>`;

    abandonedBody.innerHTML = data.abandoned.length
      ? data.abandoned.map((u) => `<tr>
          <td><div style="font-weight:700; color:var(--text-0);">${escHtml(u.name)}</div><div style="font-size:11px; color:var(--text-2);">${escHtml(u.email)}</div></td>
          <td>${planLabel(u.plan)}</td>
          <td>${fmtDate(u.createdAt)}</td>
          <td>${fmtDate(u.updatedAt)}</td>
        </tr>`).join("")
      : `<tr><td colspan="4">Nenhum abandono de checkout no momento.</td></tr>`;
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5">Falha ao carregar: ${err.message}</td></tr>`;
    attemptsBody.innerHTML = `<tr><td colspan="6">Falha ao carregar.</td></tr>`;
    abandonedBody.innerHTML = `<tr><td colspan="4">Falha ao carregar.</td></tr>`;
  }
}

/* ---------- Integrações (tráfego Sportmonks/EPG) ---------- */
async function loadIntegrations() {
  const smKpis = document.getElementById("smKpis");
  const smMeta = document.getElementById("smMeta");
  const smRecentBody = document.getElementById("smRecentTableBody");
  const epgDownloadKpis = document.getElementById("epgDownloadKpis");
  const epgDownloadMeta = document.getElementById("epgDownloadMeta");
  const epgLookupKpis = document.getElementById("epgLookupKpis");
  smRecentBody.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;
  try {
    const data = await fetchJSON("/api/adminpanel/integrations");
    const sm = data.sportmonks;
    const epg = data.epg;

    document.getElementById("integSub").textContent =
      `Fornecedor de dados esportivos ativo agora: ${data.activeProvider}. Métricas só em memória — zeram a cada reinício/deploy do servidor.`;

    smKpis.innerHTML =
      kpiTileHTML("Requisições", sm.totalRequests) +
      kpiTileHTML("Sucesso", sm.totalSuccess, fmtPct(sm.totalSuccess, sm.totalRequests)) +
      kpiTileHTML("Falhas", sm.totalFailures, fmtPct(sm.totalFailures, sm.totalRequests));
    smMeta.innerHTML =
      `Última chamada: ${fmtDateTime(sm.lastRequestAt)}` +
      (sm.lastFailureAt ? ` · Última falha: ${fmtDateTime(sm.lastFailureAt)} — ${escHtml(sm.lastFailureMessage || "")}` : "");
    smRecentBody.innerHTML = sm.recent.length
      ? sm.recent.map((r) => `<tr>
          <td>${fmtDateTime(r.at)}</td>
          <td style="font-family:monospace; font-size:11px;">${escHtml(r.path)}</td>
          <td><span class="pill ${r.ok ? "ok" : "off"}">${r.ok ? "OK" : (r.status || "Falha")}</span></td>
          <td>${r.ms != null ? `${r.ms}ms` : "—"}</td>
          <td style="font-size:11px; color:var(--brd-red);">${escHtml(r.error || "—")}</td>
        </tr>`).join("")
      : `<tr><td colspan="5">Nenhuma chamada registrada desde o último restart.</td></tr>`;

    epgDownloadKpis.innerHTML =
      kpiTileHTML("Downloads", epg.downloads.total) +
      kpiTileHTML("Sucesso", epg.downloads.success, fmtPct(epg.downloads.success, epg.downloads.total)) +
      kpiTileHTML("Falhas", epg.downloads.failures, fmtPct(epg.downloads.failures, epg.downloads.total));
    epgDownloadMeta.innerHTML =
      `Última atualização: ${fmtDateTime(epg.downloads.lastSuccessAt)}` +
      (epg.downloads.lastFailureAt ? ` · Última falha: ${fmtDateTime(epg.downloads.lastFailureAt)} — ${escHtml(epg.downloads.lastFailureMessage || "")}` : "");
    epgLookupKpis.innerHTML =
      kpiTileHTML("Consultas (jogos buscados)", epg.lookups.total) +
      kpiTileHTML("Achou o canal", epg.lookups.found, fmtPct(epg.lookups.found, epg.lookups.total)) +
      kpiTileHTML("Não achou", epg.lookups.notFound, fmtPct(epg.lookups.notFound, epg.lookups.total));
  } catch (err) {
    smRecentBody.innerHTML = `<tr><td colspan="5">Falha ao carregar: ${err.message}</td></tr>`;
  }
}

/* ---------- Comportamento (funil de login + páginas mais navegadas) ---------- */
const PAGE_LABELS = {
  dashboard: "Dashboard", jogos: "Jogos", tabela: "Tabela", estatisticas: "Estatísticas",
  simulador: "Simulador", favoritos: "Favoritos", noticias: "Notícias", apoie: "Apoie o BR Data",
  time: "Página do Time", jogador: "Página do Jogador", mais: "Mais (menu)",
};
const FUNNEL_WINDOW_LABELS = { last7d: "Últimos 7 dias", last30d: "Últimos 30 dias", allTime: "Total (desde sempre)" };
function funnelRowUiHTML(label, w) {
  return `<tr>
    <td>${label}</td>
    <td>${w.gateShown}</td>
    <td>${w.loginSuccess}</td>
    <td>${w.conversionPct != null ? `<b>${w.conversionPct}%</b>` : "—"}</td>
  </tr>`;
}
async function loadBehavior() {
  const funnelBody = document.getElementById("funnelTableBody");
  const pageViewsBox = document.getElementById("pageViewsBox");
  funnelBody.innerHTML = `<tr><td colspan="4">Carregando...</td></tr>`;
  pageViewsBox.innerHTML = `Carregando...`;
  try {
    const data = await fetchJSON("/api/adminpanel/analytics");
    funnelBody.innerHTML = Object.entries(FUNNEL_WINDOW_LABELS)
      .map(([key, label]) => funnelRowUiHTML(label, data.funnel[key]))
      .join("");

    const views = data.pageViews;
    if (!views.length) {
      pageViewsBox.innerHTML = `<div class="empty">Nenhuma navegação registrada ainda nos últimos 30 dias.</div>`;
    } else {
      const max = views[0].count;
      pageViewsBox.innerHTML = views.map((v) => `
        <div class="pageview-row">
          <div class="pageview-head"><span>${PAGE_LABELS[v.page] || v.page}</span><b>${v.count}</b></div>
          <div class="pageview-track"><div class="pageview-fill" style="width:${Math.max((v.count / max) * 100, 3)}%;"></div></div>
        </div>`).join("");
    }
  } catch (err) {
    funnelBody.innerHTML = `<tr><td colspan="4">Falha ao carregar: ${err.message}</td></tr>`;
    pageViewsBox.innerHTML = `Falha ao carregar.`;
  }
}

boot();
