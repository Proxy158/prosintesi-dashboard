const SUPABASE_URL = 'https://cadgobdxuqioaghstcry.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZGdvYmR4dXFpb2FnaHN0Y3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0OTMwMjgsImV4cCI6MjA5OTA2OTAyOH0.bA1wpasXOBa6l_F50XVw1pv3TN4lcZRmQ56I_mEotEo';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById('partner-form');
const btn = document.getElementById('submit-btn');
const btnText = btn.querySelector('.btn-text');
const btnLoader = btn.querySelector('.btn-loader');
const successMsg = document.getElementById('success-msg');
const errorMsg = document.getElementById('error-msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.style.display = 'none';
  btn.disabled = true;
  btnText.style.display = 'none';
  btnLoader.style.display = 'inline';

  const fd = new FormData(form);
  const servizi = Array.from(form.querySelectorAll('input[name="servizi"]:checked')).map(cb => cb.value);

  const agente = {
    ragione_sociale: fd.get('ragione_sociale') || null,
    p_iva: fd.get('p_iva') || null,
    tipo_attivita: fd.get('tipo_attivita') || null,
    sito_web: fd.get('sito_web') || null,
    provincia: fd.get('provincia') || null,
    citta: fd.get('citta') || null,
    indirizzo_attivita: fd.get('indirizzo_attivita') || null,
    servizi_abilitati: servizi.length ? servizi : null,
    nome: fd.get('nome') || null,
    cognome: fd.get('cognome') || null,
    email: fd.get('email') || null,
    telefono: fd.get('telefono') || null,
    note: fd.get('note') || null,
    status: 'in_prova',
    fonte: 'form_accreditamento',
  };

  const { error } = await supabase.from('agenti').insert([agente]);

  btn.disabled = false;
  btnText.style.display = 'inline';
  btnLoader.style.display = 'none';

  if (error) {
    errorMsg.textContent = 'Errore: ' + error.message;
    errorMsg.style.display = 'block';
    console.error(error);
  } else {
    form.style.display = 'none';
    successMsg.style.display = 'block';
  }
});
