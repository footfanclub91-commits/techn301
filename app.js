// app.js (module) — central frontend logic (auth + realtime messages + UI)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------- CONFIG (TA clé ANON utilisée) ----------------
const SUPABASE_URL = "https://wukrnnktndqasxugudui.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1a3Jubmt0bmRxYXN4dWd1ZHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxODcwMzYsImV4cCI6MjA3NTc2MzAzNn0.N3qFqCA7t8HcNfihMR6C0ZtJMJLb9MRzxIMlLjND3ms";
const BUCKET = "uploads";
const SIGNED_URL_EXP = 60*60;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------- Helpers UI ----------------
const popup = (id) => document.getElementById(id || "popup");
const toastWrap = () => document.getElementById("toast-wrap");
function showPopup(title, text){
  const p = popup(); if(!p) return;
  p.querySelector("#popup-title").textContent = title;
  p.querySelector("#popup-text").textContent = text || "";
  p.classList.remove("hidden");
}
function hidePopup(){ popup().classList.add("hidden"); }
document.addEventListener("click", e => { if(e.target?.id==="popup-ok") hidePopup(); });

function toast(text, t=3500){
  const w = toastWrap(); if(!w) return;
  const el = document.createElement("div"); el.className="toast"; el.textContent = text;
  w.appendChild(el);
  requestAnimationFrame(()=> el.classList.add("visible"));
  setTimeout(()=> el.classList.remove("visible"), t-400);
  setTimeout(()=> el.remove(), t);
}

// small selectors
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ---------------- AUTH / LOGIN ----------------
if($("#loginForm")){
  $("#loginForm").addEventListener("submit", async e=>{
    e.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value.trim();
    showPopup("Connexion","Veuillez patienter...");
    try{
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if(error) throw error;
      hidePopup();
      toast("Connexion réussie");
      setTimeout(()=> location.href = "dashboard.html", 600);
    }catch(err){
      hidePopup();
      showPopup("Erreur de connexion", err?.message || String(err));
    }
  });
}

// ---------------- DASHBOARD UI ----------------
if(document.body.classList.contains("app-bg") && $(".app-shell")){
  // navigation
  const navBtns = $$(".nav-btn");
  const pages = $$(".page");
  function showPage(name){
    pages.forEach(p => p.classList.toggle("hidden", p.id !== `page-${name}`));
    navBtns.forEach(b => b.classList.toggle("active", b.dataset.page === name));
  }
  navBtns.forEach(b=>{
    b.addEventListener("click", ()=> {
      const page = b.dataset.page;
      showPage(page);
      // small actions: if messagerie open direct
      if(page === "messagerie"){
        // navigate to messagerie.html full app
        if(confirm("Ouvrir la messagerie complète ? (OK) ou Prévisualiser ici (Annuler)")) location.href = "messagerie.html";
      }
    });
  });

  // logout
  $("#logoutBtn")?.addEventListener("click", async ()=>{
    await supabase.auth.signOut();
    location.href = "index.html";
  });

  // welcome + load profile
  (async function init(){
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if(!user) return location.href = "index.html";
    // load profile join
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const profile = prof || { full_name: user.email, role: 'student' };
    $("#welcomeTitle").textContent = `Bonjour, ${profile.full_name?.split(' ')[0] || profile.full_name || 'Utilisateur'}`;
    $("#welcomeSub").textContent = profile.role;
    $("#profileRole").textContent = profile.role;
    // simple loads
    await loadRevisions();
    await loadEvaluations();
    await loadReports();
    await loadMessagesPreview();
  })();

  // Revisions
  $("#create-rev")?.addEventListener("click", async ()=>{
    const title = $("#rev-title").value.trim();
    if(!title) return toast("Titre requis");
    await supabase.from('revisions').insert({ title, content: '' });
    $("#rev-title").value = '';
    toast("Fiche créée");
    loadRevisions();
  });
  async function loadRevisions(){
    const el = $("#revisions-list");
    if(!el) return;
    const { data } = await supabase.from('revisions').select('*').order('created_at',{ascending:false}).limit(50);
    el.innerHTML = (data||[]).map(r=>`<div class="small-card"><strong>${escapeHtml(r.title)}</strong><div class="muted small">${new Date(r.created_at).toLocaleString()}</div></div>`).join('');
  }

  // Evaluations / notes
  $("#create-ev")?.addEventListener("click", async ()=>{
    const title = $("#ev-title").value.trim(); const date = $("#ev-date").value || null;
    if(!title) return toast("Titre requis");
    await supabase.from('evaluations').insert({ title, date_eval: date });
    $("#ev-title").value = ''; $("#ev-date").value = '';
    toast("Évaluation créée");
    loadEvaluations();
  });
  async function loadEvaluations(){
    const el = $("#evaluations-list");
    if(!el) return;
    const { data } = await supabase.from('evaluations').select('*').order('created_at',{ascending:false}).limit(100);
    el.innerHTML = (data||[]).map(ev=>`<div class="small-card"><strong>${escapeHtml(ev.title)}</strong><div class="muted small">${ev.date_eval||''}</div></div>`).join('');
  }

  // Reports / discipline
  $("#create-disc")?.addEventListener("click", async ()=>{
    const idStu = $("#disc-student").value.trim(); const cat = $("#disc-cat").value.trim(); const desc = $("#disc-desc").value.trim();
    if(!idStu || !cat) return toast("ID élève et catégorie requis");
    await supabase.from('discipline').insert({ student_id: idStu, category: cat, description: desc });
    $("#disc-student").value='';$("#disc-cat").value='';$("#disc-desc").value='';
    toast("Observation ajoutée");
    loadReports();
  });
  async function loadReports(){
    const el = $("#discipline-list");
    if(!el) return;
    const { data } = await supabase.from('discipline').select('*').order('created_at',{ascending:false}).limit(200);
    el.innerHTML = (data||[]).map(d=>`<div class="small-card"><strong>${escapeHtml(d.category)}</strong><div class="muted small">${escapeHtml(d.description)}</div><div class="muted tiny">${new Date(d.created_at).toLocaleString()}</div></div>`).join('');
  }

  // messages preview (dashboard)
  async function loadMessagesPreview(){
    const el = $("#messages-preview"); if(!el) return;
    const { data } = await supabase.from('messages').select('*').order('created_at',{ascending:false}).limit(8);
    el.innerHTML = (data||[]).reverse().map(m=>`<div class="msg-mini"><strong>${escapeHtml(m.sender_name||'Anonyme')}</strong><div class="muted tiny">${new Date(m.created_at).toLocaleString()}</div><div>${escapeHtml((m.content||'').slice(0,120))}</div></div>`).join('');
  }

  // load evaluations and revisions on start
  async function loadRevisions(){ /* declared above via closure to allow early calls */ }
  async function loadEvaluations(){ /* declared above */ }
  async function loadReports(){ /* declared above */ }

  // small escaping
  function escapeHtml(s){ return String(s||'').replace(/[&<>"'`]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'})[c]); }

} // end dashboard init

// ---------------- MESSAGING PAGE (full chat) ----------------
if(document.body.classList.contains("app-bg") && $("#sendBtn") ){
  // elements
  const messagesEl = $("#messages");
  const msgText = $("#msgText");
  const fileInput = $("#fileInput");
  const attachBtn = $("#attachBtn");
  const recordBtn = $("#recordBtn");
  const sendBtn = $("#sendBtn");
  const attachmentPreview = $("#attachmentPreview");

  let user = null;
  let profile = null;
  let pendingFiles = [];
  let mediaRecorder = null;
  let audioChunks = [];

  // get user
  (async function initChat(){
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if(!user) return location.href = "index.html";
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = prof || { full_name: user.email };
    await loadMessages();
    subscribeRealtime();
  })();

  attachBtn?.addEventListener("click", ()=> fileInput.click());
  fileInput?.addEventListener("change", ev=> { Array.from(ev.target.files).forEach(f=> addPending(f)); ev.target.value=''; });
  sendBtn?.addEventListener("click", sendMessage);
  recordBtn?.addEventListener("click", toggleRecording);

  function addPending(f){ pendingFiles.push(f); renderAttachments(); }
  function renderAttachments(){
    if(!attachmentPreview) return;
    attachmentPreview.innerHTML = '';
    pendingFiles.forEach((f,i)=> {
      const d = document.createElement('div'); d.className='attach-item';
      d.innerHTML = `<div><strong>${f.name}</strong><div class="muted tiny">${Math.round(f.size/1024)} KB</div></div><div style="margin-top:6px"><button class="btn ghost" data-i="${i}">Suppr</button></div>`;
      d.querySelector('button').addEventListener('click', ()=> { pendingFiles.splice(i,1); renderAttachments(); });
      attachmentPreview.appendChild(d);
    });
  }

  async function sendMessage(){
    const text = msgText.value.trim();
    if(!text && pendingFiles.length===0) return;
    // upload files
    const paths = [];
    for(const f of pendingFiles){
      const safe = f.name.replace(/[^a-zA-Z0-9_.-]/g,'_');
      const path = `chat/${Date.now()}_${safe}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(path, f, { upsert:false });
      if(error){ console.error(error); toast("Erreur upload"); continue; }
      paths.push(data.path);
    }
    const payload = { sender_id: user.id, sender_name: profile.full_name || user.email, content: text || null, file_path: paths.length?paths.join(';'):null, file_type: pendingFiles[0]?.type || null };
    await supabase.from('messages').insert(payload);
    msgText.value=''; pendingFiles=[]; renderAttachments();
  }

  async function loadMessages(){
    messagesEl.innerHTML = '';
    const { data } = await supabase.from('messages').select('*').order('created_at',{ascending:true}).limit(1000);
    for(const m of (data||[])) appendMessage(m);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function subscribeRealtime(){
    supabase.channel('messages-channel')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
        appendMessage(payload.new);
      })
      .subscribe();
  }

  async function appendMessage(m){
    const node = document.createElement('div'); node.className='msg';
    const time = new Date(m.created_at).toLocaleString();
    let html = `<div style="display:flex;justify-content:space-between"><strong>${escapeHtml(m.sender_name||'Anonyme')}</strong><div class="muted tiny">${time}</div></div>`;
    if(m.content) html += `<div style="margin-top:6px">${escapeHtml(m.content)}</div>`;
    node.innerHTML = html;
    messagesEl.appendChild(node);

    if(m.file_path){
      const parts = String(m.file_path).split(';');
      for(const p of parts){
        const cont = document.createElement('div'); cont.className='attach-item'; cont.textContent = 'Chargement...'; node.appendChild(cont);
        try{
          const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(p, SIGNED_URL_EXP);
          const url = urlData.signedUrl;
          const lower = p.toLowerCase();
          if(lower.match(/\.(jpg|jpeg|png|gif)$/)) cont.innerHTML = `<img src="${url}" style="max-width:360px;border-radius:8px"/>`;
          else if(lower.match(/\.(mp4|webm|ogg)$/)) cont.innerHTML = `<video controls src="${url}" style="max-width:360px;border-radius:8px"></video>`;
          else if(lower.match(/\.(mp3|wav|webm)$/)) cont.innerHTML = `<audio controls src="${url}"></audio>`;
          else cont.innerHTML = `<a href="${url}" target="_blank">📎 ${p.split('/').pop()}</a>`;
        }catch(e){ cont.textContent = 'Aperçu indisponible'; console.error(e); }
      }
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function toggleRecording(){
    if(mediaRecorder && mediaRecorder.state==='recording'){ mediaRecorder.stop(); return; }
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async ()=> {
        const blob = new Blob(audioChunks, { type:'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type });
        addPending(file);
        toast("Audio ajouté");
      };
      mediaRecorder.start();
      toast("Enregistrement... cliquez à nouveau pour stopper");
    }catch(e){ showPopup("Erreur micro", e?.message || String(e)); }
  }

  // small escape
  function escapeHtml(s){ return String(s||'').replace(/[&<>"'`]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'})[c]); }
}

// ---------------- Utility - generic ----------------
function toast(text){ const w = document.getElementById('toast-wrap'); if(!w) return; const el = document.createElement('div'); el.className='toast'; el.textContent=text; w.appendChild(el); requestAnimationFrame(()=>el.classList.add('visible')); setTimeout(()=>el.classList.remove('visible'),3500); setTimeout(()=>el.remove(),3600); }
