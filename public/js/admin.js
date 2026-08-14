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
function planLabel(id) {
  return plansById[id]?.title || id || "—";
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
const SECTION_LOADERS = { overview: loadOverview, users: loadUsers, revenue: loadRevenue, content: null };
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
async function loadRevenue() {
  const kpis = document.getElementById("revKpis");
  const body = document.getElementById("revenueTableBody");
  body.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;
  try {
    const data = await fetchJSON("/api/adminpanel/revenue");
    kpis.innerHTML =
      kpiTileHTML("Total histórico", fmtCurrency(data.summary.totalAllTime), `${data.summary.countAllTime} pagto${data.summary.countAllTime === 1 ? "" : "s"}`) +
      kpiTileHTML("Esse mês", fmtCurrency(data.summary.totalThisMonth), `${data.summary.countThisMonth} pagto${data.summary.countThisMonth === 1 ? "" : "s"}`) +
      Object.entries(data.summary.byPlan).map(([id, v]) => kpiTileHTML(planLabel(id), fmtCurrency(v))).join("");
    body.innerHTML = data.payments.length
      ? data.payments.map((p) => `<tr>
          <td>${fmtDate(p.approvedAt)}</td>
          <td>${escHtml(p.email)}</td>
          <td>${planLabel(p.plan)}</td>
          <td>${fmtCurrency(p.amount)}</td>
          <td>${escHtml(p.method || "—")}</td>
        </tr>`).join("")
      : `<tr><td colspan="5">Nenhum pagamento registrado ainda.</td></tr>`;
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5">Falha ao carregar: ${err.message}</td></tr>`;
  }
}

boot();
