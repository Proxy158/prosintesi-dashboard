// Saturata Dashboard
const SUPABASE_URL = 'https://cadgobdxuqioaghstcry.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZGdvYmR4dXFpb2FnaHN0Y3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0OTMwMjgsImV4cCI6MjA5OTA2OTAyOH0.bA1wpasXOBa6l_F50XVw1pv3TN4lcZRmQ56I_mEotEo';
const ADMIN_HASH = '6b50cdd19a22c81d83fa26225afa459ad469ba284d0e064f37210c00e9363271';

const SERVICE_MAP = {
  lead_immobiliare: 'Immobiliare',
  lead_fotovoltaico: 'Fotovoltaico',
  lead_cessione_quinto: 'Cessione del Quinto',
  lead_mutui: 'Mutui',
  lead_climatizzazione: 'Climatizzazione',
  lead_efficienza_energetica: 'Efficienza Energetica',
};

let supabase = null;
let currentView = 'dashboard';
let agentsCache = [];

// ======================= INIT
function init() {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const session = sessionStorage.getItem('sat_session');
  if (session === 'ok') {
    showApp();
  } else {
    showLogin();
  }
}

// ======================= LOGIN
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('active');
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('active');
  loadDashboard();
}

async function doLogin() {
  const pwd = document.getElementById('login-pwd').value;
  const hash = await sha256(pwd);
  if (hash === ADMIN_HASH) {
    sessionStorage.setItem('sat_session', 'ok');
    showApp();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}

function doLogout() {
  sessionStorage.removeItem('sat_session');
  location.reload();
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ======================= NAVIGATION
function setView(view) {
  currentView = view;
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  document.querySelector(`.sidebar nav a[data-view="${view}"]`)?.classList.add('active');
  document.getElementById('page-title').textContent = view === 'dashboard' ? 'Dashboard' : view === 'leads' ? 'Lead' : 'Agenti';

  if (view === 'dashboard') loadDashboard();
  else if (view === 'leads') loadLeadsView();
  else if (view === 'agents') loadAgentsView();
}

// ======================= DASHBOARD (KPI)
async function loadDashboard() {
  const container = document.getElementById('content');
  container.innerHTML = '<div class="loading">Caricamento KPI...</div>';

  const today = new Date().toISOString().split('T')[0];
  const todayStart = `${today}T00:00:00+00:00`;
  const todayEnd = `${today}T23:59:59+00:00`;

  let totalLeads = 0;
  let todayLeads = 0;
  let unassigned = 0;

  for (const table of Object.keys(SERVICE_MAP)) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (!error) totalLeads += count || 0;

    const { count: c2, error: e2 } = await supabase.from(table).select('*', { count: 'exact', head: true }).gte('created_at', todayStart).lte('created_at', todayEnd);
    if (!e2) todayLeads += c2 || 0;

    const { count: c3, error: e3 } = await supabase.from(table).select('*', { count: 'exact', head: true }).is('agente_assegnato_id', null);
    if (!e3) unassigned += c3 || 0;
  }

  const { count: activeAgents, error: ae } = await supabase.from('agenti').select('*', { count: 'exact', head: true }).eq('status', 'attivo');

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">Lead Oggi</div>
        <div class="value">${todayLeads}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Lead Totali</div>
        <div class="value">${totalLeads}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Agenti Attivi</div>
        <div class="value success">${activeAgents || 0}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Non Assegnati</div>
        <div class="value ${unassigned > 0 ? 'warning' : ''}">${unassigned}</div>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Servizio</th><th>Lead Totali</th><th>Oggi</th><th>Non Assegnati</th></tr></thead>
        <tbody id="kpi-rows"></tbody>
      </table>
    </div>
  `;

  const tbody = document.getElementById('kpi-rows');
  for (const [table, label] of Object.entries(SERVICE_MAP)) {
    const { count: tot } = await supabase.from(table).select('*', { count: 'exact', head: true });
    const { count: td } = await supabase.from(table).select('*', { count: 'exact', head: true }).gte('created_at', todayStart).lte('created_at', todayEnd);
    const { count: un } = await supabase.from(table).select('*', { count: 'exact', head: true }).is('agente_assegnato_id', null);
    tbody.innerHTML += `<tr><td>${label}</td><td>${tot || 0}</td><td>${td || 0}</td><td>${un || 0}</td></tr>`;
  }
}

// ======================= LEADS
async function loadLeadsView() {
  const container = document.getElementById('content');
  container.innerHTML = `
    <div class="filters">
      <select id="lead-service" onchange="renderLeads()">
        <option value="lead_immobiliare">Immobiliare</option>
        <option value="lead_fotovoltaico">Fotovoltaico</option>
        <option value="lead_cessione_quinto">Cessione del Quinto</option>
        <option value="lead_mutui">Mutui</option>
        <option value="lead_climatizzazione">Climatizzazione</option>
        <option value="lead_efficienza_energetica">Efficienza Energetica</option>
      </select>
      <select id="lead-status" onchange="renderLeads()">
        <option value="">Tutti gli stati</option>
        <option value="nuovo">Nuovo</option>
        <option value="assegnato">Assegnato</option>
        <option value="contattato">Contattato</option>
      </select>
      <input type="text" id="lead-search" placeholder="Cerca nome, email, tel..." oninput="renderLeads()">
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th><th>Nome</th><th>Email</th><th>Telefono</th><th>Fonte</th><th>Stato</th><th>Agente</th>
          </tr>
        </thead>
        <tbody id="leads-tbody"><tr><td colspan="7" class="loading">Caricamento...</td></tr></tbody>
      </table>
    </div>
  `;
  await loadAgentsCache();
  await renderLeads();
}

async function renderLeads() {
  const table = document.getElementById('lead-service').value;
  const status = document.getElementById('lead-status').value;
  const search = document.getElementById('lead-search').value.toLowerCase();
  const tbody = document.getElementById('leads-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Caricamento...</td></tr>';

  let query = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(200);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Errore: ${error.message}</td></tr>`;
    return;
  }

  let rows = data || [];
  if (search) {
    rows = rows.filter(r =>
      (r.nome || '').toLowerCase().includes(search) ||
      (r.cognome || '').toLowerCase().includes(search) ||
      (r.email || '').toLowerCase().includes(search) ||
      (r.telefono || '').includes(search)
    );
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Nessun lead trovato</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const agent = agentsCache.find(a => a.id === r.agente_assegnato_id);
    const agentLabel = agent ? `${agent.nome || ''} ${agent.cognome || ''}`.trim() || agent.email : '-';
    const date = r.created_at ? new Date(r.created_at).toLocaleString('it-IT', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-';
    return `<tr>
      <td>${date}</td>
      <td>${r.nome || ''} ${r.cognome || ''}</td>
      <td>${r.email || '-'}</td>
      <td>${r.telefono || '-'}</td>
      <td>${r.fonte || '-'}</td>
      <td><span class="badge ${r.status || 'nuovo'}">${r.status || 'nuovo'}</span></td>
      <td>${agentLabel}</td>
    </tr>`;
  }).join('');
}

// ======================= AGENTS
async function loadAgentsView() {
  const container = document.getElementById('content');
  container.innerHTML = '<div class="loading">Caricamento agenti...</div>';
  await loadAgentsCache();

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nome</th><th>Email</th><th>Servizi</th><th>Stato</th><th>Max Lead/Giorno</th><th>Performance</th><th>Azioni</th>
          </tr>
        </thead>
        <tbody id="agents-tbody"></tbody>
      </table>
    </div>
  `;
  renderAgentsTable();
}

async function loadAgentsCache() {
  const { data, error } = await supabase.from('agenti').select('*').order('created_at', { ascending: false });
  if (!error) agentsCache = data || [];
}

function renderAgentsTable() {
  const tbody = document.getElementById('agents-tbody');
  if (agentsCache.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Nessun agente trovato</td></tr>';
    return;
  }

  tbody.innerHTML = agentsCache.map(a => `
    <tr>
      <td>${a.nome || ''} ${a.cognome || ''}</td>
      <td>${a.email || '-'}</td>
      <td>${(a.servizi_abilitati || []).join(', ')}</td>
      <td><span class="badge ${a.status}">${a.status}</span></td>
      <td><input class="inline" type="number" value="${a.max_lead_giorno || 10}" onchange="updateAgent('${a.id}', 'max_lead_giorno', this.value)"></td>
      <td>${a.performance_score || 0}</td>
      <td>
        <input type="checkbox" class="toggle" ${a.status === 'attivo' ? 'checked' : ''} onchange="toggleAgentStatus('${a.id}', this.checked)">
      </td>
    </tr>
  `).join('');
}

async function toggleAgentStatus(id, isActive) {
  const newStatus = isActive ? 'attivo' : 'inattivo';
  const { error } = await supabase.from('agenti').update({ status: newStatus }).eq('id', id);
  if (error) alert('Errore aggiornamento: ' + error.message);
  else await loadAgentsCache();
}

async function updateAgent(id, field, value) {
  const update = {}; update[field] = parseInt(value) || 0;
  const { error } = await supabase.from('agenti').update(update).eq('id', id);
  if (error) alert('Errore aggiornamento: ' + error.message);
}

// ======================= BOOT
document.addEventListener('DOMContentLoaded', init);
