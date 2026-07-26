// Saturata CRM Dashboard
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

const PIPELINE_STATES = ['nuovo', 'assegnato', 'contattato', 'in_trattativa', 'convertito', 'perso'];
const PIPELINE_LABELS = {
  nuovo: 'Nuovo', assegnato: 'Assegnato', contattato: 'Contattato',
  in_trattativa: 'In Trattativa', convertito: 'Convertito', perso: 'Perso'
};

const COMMON_FIELDS = ['id','created_at','nome','cognome','email','telefono','fonte','status','agente_assegnato_id','ip','user_agent','referrer','note','brevo_contact_id'];
const TECH_FIELDS = ['id','created_at','ip','user_agent','referrer','agente_assegnato_id','fonte','status','brevo_contact_id'];

let supabase = null;
let currentView = 'dashboard';
let agentsCache = [];
let currentLead = null;
let currentLeadsData = [];

// ======================= INIT
function init() {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (sessionStorage.getItem('sat_session') === 'ok') showApp(); else showLogin();
}

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
  if (hash === ADMIN_HASH) { sessionStorage.setItem('sat_session', 'ok'); showApp(); }
  else { document.getElementById('login-error').style.display = 'block'; }
}
function doLogout() { sessionStorage.removeItem('sat_session'); location.reload(); }
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ======================= NAV
function setView(view) {
  currentView = view;
  document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
  document.querySelector(`.sidebar nav a[data-view="${view}"]`)?.classList.add('active');
  const titles = { dashboard:'Dashboard', leads:'Lead', agents:'Agenti' };
  document.getElementById('page-title').textContent = titles[view] || view;
  if (view === 'dashboard') loadDashboard();
  else if (view === 'leads') loadLeadsView();
  else if (view === 'agents') loadAgentsView();
}

// ======================= DASHBOARD
async function loadDashboard() {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="loading">Caricamento KPI...</div>';
  const today = new Date().toISOString().split('T')[0];
  const s = `${today}T00:00:00+00:00`, e = `${today}T23:59:59+00:00`;
  let total=0, todayCount=0, unassigned=0;
  for (const t of Object.keys(SERVICE_MAP)) {
    const {count:c1} = await supabase.from(t).select('*',{count:'exact',head:true});
    const {count:c2} = await supabase.from(t).select('*',{count:'exact',head:true}).gte('created_at',s).lte('created_at',e);
    const {count:c3} = await supabase.from(t).select('*',{count:'exact',head:true}).is('agente_assegnato_id',null);
    total += c1||0; todayCount += c2||0; unassigned += c3||0;
  }
  const {count:activeAgents} = await supabase.from('agenti').select('*',{count:'exact',head:true}).eq('status','attivo');
  c.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="label">Lead Oggi</div><div class="value">${todayCount}</div></div>
      <div class="kpi-card"><div class="label">Lead Totali</div><div class="value">${total}</div></div>
      <div class="kpi-card"><div class="label">Agenti Attivi</div><div class="value" style="color:var(--success)">${activeAgents||0}</div></div>
      <div class="kpi-card"><div class="label">Non Assegnati</div><div class="value" style="color:${unassigned>0?'var(--warning)':'var(--text)'}">${unassigned}</div></div>
    </div>
    <div class="table-wrap">
      <table><thead><tr><th>Servizio</th><th>Totali</th><th>Oggi</th><th>Non Assegnati</th><th>Convertiti</th></tr></thead><tbody id="kpi-rows"></tbody></table>
    </div>`;
  const tbody = document.getElementById('kpi-rows');
  for (const [t,l] of Object.entries(SERVICE_MAP)) {
    const {count:tot} = await supabase.from(t).select('*',{count:'exact',head:true});
    const {count:td} = await supabase.from(t).select('*',{count:'exact',head:true}).gte('created_at',s).lte('created_at',e);
    const {count:un} = await supabase.from(t).select('*',{count:'exact',head:true}).is('agente_assegnato_id',null);
    const {count:conv} = await supabase.from(t).select('*',{count:'exact',head:true}).eq('status','convertito');
    tbody.innerHTML += `<tr><td><strong>${l}</strong></td><td>${tot||0}</td><td>${td||0}</td><td>${un||0}</td><td style="color:var(--success)">${conv||0}</td></tr>`;
  }
}

// ======================= LEADS
async function loadLeadsView() {
  const c = document.getElementById('content');
  c.innerHTML = `
    <div class="toolbar">
      <select id="lead-service" onchange="renderLeads()">
        <option value="lead_immobiliare">🏠 Immobiliare</option>
        <option value="lead_fotovoltaico">☀️ Fotovoltaico</option>
        <option value="lead_cessione_quinto">💰 Cessione del Quinto</option>
        <option value="lead_mutui">🏦 Mutui</option>
        <option value="lead_climatizzazione">❄️ Climatizzazione</option>
        <option value="lead_efficienza_energetica">🌿 Efficienza Energetica</option>
      </select>
      <select id="lead-status" onchange="renderLeads()">
        <option value="">Tutti gli stati</option>
        <option value="nuovo">Nuovo</option>
        <option value="assegnato">Assegnato</option>
        <option value="contattato">Contattato</option>
        <option value="in_trattativa">In Trattativa</option>
        <option value="convertito">Convertito</option>
        <option value="perso">Perso</option>
      </select>
      <input type="date" id="lead-date-from" onchange="renderLeads()" title="Da">
      <input type="date" id="lead-date-to" onchange="renderLeads()" title="A">
      <input type="text" id="lead-search" placeholder="🔍 Cerca nome, email, tel..." oninput="renderLeads()" style="min-width:220px">
      <button class="btn btn-ghost" onclick="exportCSV()">📥 Esporta CSV</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th><th>Nome</th><th>Contatto</th><th>Fonte</th>
            <th>Stato</th><th>Agente</th><th>Servizio</th>
          </tr>
        </thead>
        <tbody id="leads-tbody"><tr><td colspan="7" class="loading">Caricamento...</td></tr></tbody>
      </table>
    </div>`;
  await loadAgentsCache();
  await renderLeads();
}

async function renderLeads() {
  const table = document.getElementById('lead-service').value;
  const status = document.getElementById('lead-status').value;
  const from = document.getElementById('lead-date-from').value;
  const to = document.getElementById('lead-date-to').value;
  const search = document.getElementById('lead-search').value.toLowerCase();
  const tbody = document.getElementById('leads-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Caricamento...</td></tr>';

  let query = supabase.from(table).select('*').order('created_at',{ascending:false}).limit(500);
  if (status) query = query.eq('status', status);
  if (from) query = query.gte('created_at', `${from}T00:00:00+00:00`);
  if (to) query = query.lte('created_at', `${to}T23:59:59+00:00`);

  const {data, error} = await query;
  if (error) { tbody.innerHTML = `<tr><td colspan="7" class="empty">Errore: ${error.message}</td></tr>`; return; }

  let rows = data || [];
  currentLeadsData = rows;
  if (search) {
    rows = rows.filter(r =>
      (r.nome||'').toLowerCase().includes(search) ||
      (r.cognome||'').toLowerCase().includes(search) ||
      (r.email||'').toLowerCase().includes(search) ||
      (r.telefono||'').includes(search)
    );
  }

  if (rows.length === 0) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Nessun lead trovato</td></tr>'; return; }

  tbody.innerHTML = rows.map(r => {
    const agent = agentsCache.find(a => a.id === r.agente_assegnato_id);
    const agentLabel = agent ? (agent.nome||'')+' '+(agent.cognome||'') || agent.email : '-';
    const date = r.created_at ? new Date(r.created_at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
    const contact = (r.email ? `<div>${r.email}</div>` : '') + (r.telefono ? `<div style="color:var(--text-muted);font-size:0.8rem">${r.telefono}</div>` : '');
    return `<tr onclick="openDrawer('${table}','${r.id}')">
      <td style="white-space:nowrap">${date}</td>
      <td><strong>${r.nome||''} ${r.cognome||''}</strong></td>
      <td>${contact||'-'}</td>
      <td>${r.fonte||'-'}</td>
      <td><span class="badge ${r.status||'nuovo'}">${PIPELINE_LABELS[r.status]||r.status||'nuovo'}</span></td>
      <td>${agentLabel}</td>
      <td>${SERVICE_MAP[table]}</td>
    </tr>`;
  }).join('');
}

function exportCSV() {
  if (!currentLeadsData.length) return alert('Nessun dato da esportare');
  const table = document.getElementById('lead-service').value;
  const keys = Object.keys(currentLeadsData[0]);
  let csv = keys.join(';') + '\n';
  for (const row of currentLeadsData) {
    csv += keys.map(k => {
      let v = row[k] ?? '';
      if (Array.isArray(v)) v = v.join(', ');
      return `"${String(v).replace(/"/g,'""')}"`;
    }).join(';') + '\n';
  }
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `leads_${table}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ======================= DRAWER DETTAGLIO
async function openDrawer(table, id) {
  const {data, error} = await supabase.from(table).select('*').eq('id', id).single();
  if (error || !data) { alert('Errore caricamento lead'); return; }
  currentLead = { table, record: data };
  const agent = agentsCache.find(a => a.id === data.agente_assegnato_id);
  const agentLabel = agent ? `${agent.nome||''} ${agent.cognome||''} (${agent.email})` : 'Non assegnato';
  const date = data.created_at ? new Date(data.created_at).toLocaleString('it-IT') : '-';

  // Pipeline
  let pipelineHTML = '<div class="pipeline">';
  for (const st of PIPELINE_STATES) {
    const idx = PIPELINE_STATES.indexOf(st);
    const currentIdx = PIPELINE_STATES.indexOf(data.status || 'nuovo');
    const cls = idx === currentIdx ? 'active' : idx < currentIdx ? 'done' : '';
    pipelineHTML += `<div class="pipeline-step ${cls}" onclick="setPipelineState('${st}')">${PIPELINE_LABELS[st]}</div>`;
  }
  pipelineHTML += '</div>';

  // Dati anagrafici
  const anag = ['nome','cognome','email','telefono'];
  let anagHTML = '<div class="detail-grid">';
  for (const f of anag) {
    anagHTML += `<div class="detail-field"><div class="label">${f}</div><div class="value">${data[f] || '-'}</div></div>`;
  }
  anagHTML += '</div>';

  // Dati servizio (tutti i campi non comuni)
  const serviceFields = Object.keys(data).filter(k => !COMMON_FIELDS.includes(k));
  let servHTML = '';
  if (serviceFields.length) {
    servHTML = '<div class="detail-section"><h4>📋 Dati Servizio</h4><div class="detail-grid">';
    for (const f of serviceFields) {
      let v = data[f];
      if (v === true) v = 'Sì'; else if (v === false) v = 'No'; else if (v === null || v === undefined) v = '-';
      else if (Array.isArray(v)) v = v.join(', ');
      servHTML += `<div class="detail-field"><div class="label">${f}</div><div class="value">${v}</div></div>`;
    }
    servHTML += '</div></div>';
  }

  // Dati tecnici
  let techHTML = '<div class="detail-section"><h4>🔧 Dati Tecnici</h4><div class="detail-grid">';
  const techs = [['Fonte','fonte'],['IP','ip'],['User Agent','user_agent'],['Referrer','referrer'],['Data inserimento','created_at'],['ID','id']];
  for (const [label,key] of techs) {
    let v = data[key] || '-';
    if (key === 'created_at' && data[key]) v = new Date(data[key]).toLocaleString('it-IT');
    techHTML += `<div class="detail-field"><div class="label">${label}</div><div class="value" style="font-size:0.8rem;color:var(--text-muted)">${v}</div></div>`;
  }
  techHTML += '</div></div>';

  // Note
  const noteHTML = `
    <div class="detail-section">
      <h4>📝 Note</h4>
      <textarea class="note-input" id="lead-note" placeholder="Aggiungi note su questo lead...">${data.note || ''}</textarea>
    </div>`;

  // Brevo
  const brevoHTML = data.brevo_contact_id
    ? `<div class="detail-section"><h4>📧 Brevo</h4><div class="detail-grid"><div class="detail-field"><div class="label">Contact ID</div><div class="value">${data.brevo_contact_id}</div></div></div></div>`
    : '';

  document.getElementById('drawer-title').innerHTML = `👤 ${data.nome||''} ${data.cognome||''} <span style="color:var(--text-muted);font-size:0.85rem;margin-left:8px">${SERVICE_MAP[table]} · ${agentLabel}</span>`;
  document.getElementById('drawer-body').innerHTML = `
    <div style="margin-bottom:16px;font-size:0.85rem;color:var(--text-muted)">Inserito il ${date}</div>
    ${pipelineHTML}
    <div class="detail-section"><h4>👤 Dati Anagrafici</h4>${anagHTML}</div>
    ${servHTML}
    ${techHTML}
    ${brevoHTML}
    ${noteHTML}
  `;

  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
  currentLead = null;
}

function setPipelineState(newStatus) {
  if (!currentLead) return;
  currentLead.record.status = newStatus;
  const steps = document.querySelectorAll('.pipeline-step');
  const newIdx = PIPELINE_STATES.indexOf(newStatus);
  steps.forEach((step, idx) => {
    step.classList.remove('active','done');
    if (idx === newIdx) step.classList.add('active');
    else if (idx < newIdx) step.classList.add('done');
  });
}

async function saveLeadChanges() {
  if (!currentLead) return;
  const {table, record} = currentLead;
  const note = document.getElementById('lead-note')?.value || '';
  const status = record.status;

  const {error} = await supabase.from(table).update({status, note}).eq('id', record.id);
  if (error) { alert('Errore salvataggio: ' + error.message); return; }

  closeDrawer();
  if (currentView === 'leads') renderLeads();
  else if (currentView === 'dashboard') loadDashboard();
}

// ======================= AGENTS
async function loadAgentsView() {
  const c = document.getElementById('content');
  c.innerHTML = '<div class="loading">Caricamento agenti...</div>';
  await loadAgentsCache();
  c.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Ragione Sociale</th><th>Nome</th><th>Email</th><th>Servizi</th>
            <th>Stato</th><th>Max/Giorno</th><th>Performance</th><th>Attivo</th>
          </tr>
        </thead>
        <tbody id="agents-tbody"></tbody>
      </table>
    </div>`;
  renderAgentsTable();
}

async function loadAgentsCache() {
  const {data, error} = await supabase.from('agenti').select('*').order('created_at',{ascending:false});
  if (!error) agentsCache = data || [];
}

function renderAgentsTable() {
  const tbody = document.getElementById('agents-tbody');
  if (!agentsCache.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">Nessun agente</td></tr>'; return; }
  tbody.innerHTML = agentsCache.map(a => {
    const servizi = (a.servizi_abilitati||[]).map(s => `<span class="badge" style="margin-right:4px">${s}</span>`).join('') || '-';
    return `<tr>
      <td>${a.ragione_sociale || '-'}</td>
      <td><strong>${a.nome||''} ${a.cognome||''}</strong></td>
      <td>${a.email||'-'}</td>
      <td>${servizi}</td>
      <td><span class="badge ${a.status}">${a.status}</span></td>
      <td><input class="inline" type="number" value="${a.max_lead_giorno||10}" onchange="updateAgent('${a.id}','max_lead_giorno',this.value)"></td>
      <td>${a.performance_score||0}</td>
      <td><input type="checkbox" class="toggle" ${a.status==='attivo'?'checked':''} onchange="toggleAgentStatus('${a.id}',this.checked)"></td>
    </tr>`;
  }).join('');
}

async function toggleAgentStatus(id, isActive) {
  const {error} = await supabase.from('agenti').update({status: isActive?'attivo':'inattivo'}).eq('id', id);
  if (error) alert('Errore: '+error.message); else await loadAgentsCache();
}
async function updateAgent(id, field, value) {
  const upd={}; upd[field]=parseInt(value)||0;
  const {error} = await supabase.from('agenti').update(upd).eq('id', id);
  if (error) alert('Errore: '+error.message);
}

// ======================= BOOT
document.addEventListener('DOMContentLoaded', init);
