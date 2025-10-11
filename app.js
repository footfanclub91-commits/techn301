// app.js (module ES)
// Supabase client via esm.sh
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------- CONFIG ----------------
const SUPABASE_URL = "https://wukrnnktndqasxugudui.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1a3Jubmt0bmRxYXN4dWd1ZHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxODcwMzYsImV4cCI6MjA3NTc2MzAzNn0.N3qFqCA7t8HcNfihMR6C0ZtJMJLb9MRzxIMlLjND3ms";
const BUCKET = "uploads";
const SIGNED_URL_EXP = 60 * 60;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------- Utilities ----------------
const popup = id("popup");
const popupTitle = id("popup-title");
const popupText = id("popup-text");
const popupOk = id("popup-ok");
if (popupOk) popupOk.addEventListener("click", () => popup.classList.add("hidden"));
function showPopup(title, text) { if(!popup) return; popupTitle.textContent = title; popupText.textContent = text; popup.classList.remove("hidden"); }
function id(x){ return document.getElementById(x); }
function el(sel){ return document.querySelector(sel); }
function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'})[c]); }

// ---------------- LOGIN HANDLER ----------------
const loginForm = id("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = id("email").value.trim();
    const password = id("password").value.trim();
    showPopup("Connexion", "Connexion en cours...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showPopup("Succès", "Connexion réussie — redirection...");
      await wait(700);
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error(err);
      showPopup("Erreur", err?.message || "Identifiants invalides");
    }
  });
}

// ---------------- DASHBOARD (if on dashboard page) ----------------
if (el(".app-shell")) {
  // elements
  const navBtns = Array.from(document.querySelectorAll(".nav-btn"));
  const views = Array.from(document.querySelectorAll(".view"));
  const signOutBtn = id("signOutBtn");
  const appsGrid = id("appsGrid");
  const welcomeTitle = id("welcomeTitle");
  const welcomeSub = id("welcomeSub");
  const userRoleLabel = id("userRole");
  const profileName = id("profileName");

  // messaging
  const messagesHolder = id("messages");
  const msgInput = id("msgInput");
  const sendBtn = id("sendBtn");
  const attachBtn = id("attachBtn");
  const fileInput = id("fileInput");
  const attachmentPreview = id("attachmentPreview");
  const recordBtn = id("recordBtn");

  // data
  let currentUser = null;
  let profile = null;
  let pendingFiles = [];
  let mediaRecorder = null;
  let audioChunks = [];

  // nav wiring
  navBtns.forEach(b => b.addEventListener("click", (e) => {
    navBtns.forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    const view = b.dataset.view;
    views.forEach(v => v.classList.toggle("hidden", v.id !== ("view-"+view)));
  }));
  signOutBtn.addEventListener("click", async ()=>{ await supabase.auth.signOut(); window.location.href='index.html'; });

  // init
  (async function initDashboard(){
    const { data } = await supabase.auth.getUser();
    currentUser = data.user;
    if(!currentUser) return window.location.href = "index.html";

    // fetch profile
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
    profile = prof || { full_name: currentUser.email, role:'student' };
    welcomeTitle.textContent = `Bonjour, ${profile.full_name?.split(' ')[0] || profile.full_name || 'Utilisateur'}`;
    welcomeSub.textContent = profile.role;
    userRoleLabel.textContent = profile.role;
    profileName.textContent = profile.full_name || currentUser.email;

    renderApps(profile.role);
    await loadRevisions();
    await loadEvaluations();
    await loadReports();
    initMessagingRealtime();
    loadMessagesOnce();
    wireCompose();

    id("createRev")?.addEventListener("click", createRevision);
    id("createEvalBtn")?.addEventListener("click", createEvaluation);
    id("sendReport")?.addEventListener("click", sendReport);
    renderAdmin();
  })();

  // ---------- Apps rendering ----------
  function renderApps(role){
    const common = [
      {k:'revisions', title:'Révisions interactives', desc:'Fiches & quiz'},
      {k:'notes', title:'Notes & Devoirs', desc:'Gérer évaluations et notes'},
      {k:'mess', title:'Messagerie', desc:'Chats instantanés & fichiers'},
      {k:'reports', title:'Signalements', desc:'Tickets & bugs'}
    ];
    const profExtras = [{k:'tools', title:'Outils du professeur', desc:'Import CSV, gestion élève'}];
    const adminExtras = [{k:'admin', title:'Administration', desc:'Gestion utilisateurs'}];
    const list = [...common, ...(role!=='student'?profExtras:[]), ...(role==='admin'?adminExtras:[])];

    appsGrid.innerHTML = '';
    list.forEach(a=>{
      const c = document.createElement('div'); c.className='app-card';
      c.innerHTML = `<div style="font-weight:700">${a.title}</div><div class="muted" style="margin-top:8px">${a.desc}</div><div style="margin-top:12px"><button class="btn" data-key="${a.k}">Ouvrir</button></div>`;
      c.querySelector('button').addEventListener('click', ()=> {
        const map = {revisions:'revisions', notes:'notes', mess:'messagerie', tools:'tools', reports:'reports', admin:'admin'};
        const v = map[a.k] || 'home';
        document.querySelector(`.nav-btn[data-view="${v}"]`)?.click();
      });
      appsGrid.appendChild(c);
    });
  }

  // ---------------- Revisions ----------------
  async function loadRevisions(){
    const { data } = await supabase.from('revisions').select('*').order('created_at',{ascending:false}).limit(100);
    const holder = id('revisionCards');
    if(!holder) return;
    holder.innerHTML = '';
    (data||[]).forEach(r=>{
      const d = document.createElement('div'); d.className='card';
      d.innerHTML = `<strong>${escapeHtml(r.title)}</strong><div class="muted" style="margin-top:6px">${escapeHtml(r.content||'')}</div>`;
      holder.appendChild(d);
    });
  }

  async function createRevision(){
    const title = id('revTitle').value.trim(); const content = id('revContent').value.trim();
    if(!title) return showPopup('Erreur', 'Titre requis');
    await supabase.from('revisions').insert({ title, content, author_id: currentUser.id });
    id('revTitle').value=''; id('revContent').value='';
    showPopup('Fait', 'Fiche créée');
    loadRevisions();
  }

  // ---------------- Evaluations & Notes ----------------
  async function loadEvaluations(){
    const { data } = await supabase.from('evaluations').select('*').order('created_at',{ascending:false}).limit(200);
    const holder = id('evaluationsList'); if(!holder) return;
    holder.innerHTML = '';
    (data||[]).forEach(ev=>{
      const el = document.createElement('div'); el.className='card';
      el.innerHTML = `<strong>${escapeHtml(ev.title)}</strong><div class="muted">${ev.date_eval||''}</div><div style="margin-top:8px"><button class="btn ghost" data-id="${ev.id}">Voir / Noter</button></div>`;
      holder.appendChild(el);
      el.querySelector('button').addEventListener('click', ()=> openEvaluation(ev.id));
    });
  }

  async function createEvaluation(){
    const title = id('evTitle').value.trim(); const date = id('evDate').value || null;
    if(!title) return showPopup('Erreur','Titre requis');
    await supabase.from('evaluations').insert({ title, date_eval: date, teacher_id: currentUser.id });
    id('evTitle').value=''; id('evDate').value='';
    showPopup('Créé','Évaluation ajoutée');
    loadEvaluations();
  }

  function openEvaluation(idEval){
    showPopup('Évaluation', `Ouvrir/Noter l'évaluation ${idEval} (prototype)`);
  }

  // ---------------- Reports ----------------
  async function loadReports(){
    const { data } = await supabase.from('reports').select('*').order('created_at',{ascending:false}).limit(200);
    const holder = id('reportsList'); if(!holder) return;
    holder.innerHTML = '';
    (data||[]).forEach(r=>{
      const el = document.createElement('div'); el.className='card';
      el.innerHTML = `<strong>${escapeHtml(r.type||'Signalement')}</strong><div class="muted">${escapeHtml(r.status||'ouvert')} · ${new Date(r.created_at).toLocaleString()}</div><div style="margin-top:6px">${escapeHtml(r.message)}</div>`;
      holder.appendChild(el);
    });
  }

  async function sendReport(){
    const txt = id('reportText').value.trim(); if(!txt) return showPopup('Erreur','Décris le problème');
    await supabase.from('reports').insert({ reporter_id: currentUser.id, type:'bug', message: txt });
    id('reportText').value=''; showPopup('Merci','Signalement envoyé'); loadReports();
  }

  // ---------------- Messaging (Realtime + uploads) ----------------
  function initMessagingRealtime(){
    supabase.channel('realtime-messages')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' }, payload => {
        appendMessageRow(payload.new);
      })
      .subscribe();
  }

  async function loadMessagesOnce(){
    const { data } = await supabase.from('messages').select('*').order('created_at',{ascending:true}).limit(1000);
    (data||[]).forEach(m => appendMessageRow(m));
    scrollMessages();
  }

  function appendMessageRow(m){
    if(!messagesHolder) return;
    const div = document.createElement('div'); div.className='msg';
    const t = new Date(m.created_at).toLocaleString();
    let inner = `<div style="display:flex;justify-content:space-between"><strong>${escapeHtml(m.sender_name||'Anonyme')}</strong><div class="muted small">${t}</div></div>`;
    if(m.content) inner += `<div style="margin-top:6px">${escapeHtml(m.content)}</div>`;
    div.innerHTML = inner;
    messagesHolder.appendChild(div);

    if(m.file_path){
      const parts = String(m.file_path).split(';');
      // create placeholders and then fetch signed URLs
      parts.forEach(async (p) => {
        const container = document.createElement('div'); container.className='attach-item'; container.textContent = 'Chargement...';
        div.appendChild(container);
        try {
          const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(p, SIGNED_URL_EXP);
          const u = urlData?.signedUrl || '';
          const lower = p.toLowerCase();
          if(lower.match(/\.(jpg|jpeg|png|gif)$/)) container.innerHTML = `<img src="${u}" style="max-width:260px;border-radius:8px"/>`;
          else if(lower.match(/\.(mp4|webm|ogg)$/)) container.innerHTML = `<video controls src="${u}" style="max-width:320px;border-radius:8px"></video>`;
          else if(lower.match(/\.(mp3|wav|webm)$/)) container.innerHTML = `<audio controls src="${u}"></audio>`;
          else container.innerHTML = `<a href="${u}" target="_blank">📎 ${p.split('/').pop()}</a>`;
        } catch(e){ container.textContent = 'Erreur preview'; console.error(e); }
      });
    }

    scrollMessages();
    // optional: show small notification popup
    showSmallNotification(`${m.sender_name || 'Anonyme'}: ${m.content ? m.content.slice(0,80) : '[fichier]'}`);
  }

  function scrollMessages(){ if(messagesHolder) messagesHolder.scrollTop = messagesHolder.scrollHeight; }

  function wireCompose(){
    attachBtn.addEventListener("click", ()=> fileInput.click());
    fileInput.addEventListener("change", (ev)=> {
      Array.from(ev.target.files).forEach(f => addPending(f));
      ev.target.value = "";
    });
    sendBtn.addEventListener("click", sendMessage);
    recordBtn.addEventListener("click", toggleRecording);
  }

  function addPending(file){ pendingFiles.push(file); renderAttachmentPreview(); }
  function renderAttachmentPreview(){
    if(!attachmentPreview) return;
    attachmentPreview.innerHTML = '';
    pendingFiles.forEach((f,i)=>{
      const d = document.createElement('div'); d.className='attach-item';
      d.innerHTML = `<div style="font-weight:700">${escapeHtml(f.name)}</div><div class="muted">${Math.round(f.size/1024)} KB</div><div style="margin-top:6px"><button class="btn ghost" data-i="${i}">Suppr</button></div>`;
      d.querySelector('button').addEventListener('click', ()=> { pendingFiles.splice(i,1); renderAttachmentPreview(); });
      attachmentPreview.appendChild(d);
    });
  }

  async function sendMessage(){
    const text = (msgInput?.value||'').trim();
    if(!text && pendingFiles.length===0) return;
    const attachments = [];
    for(const f of pendingFiles){
      const safe = f.name.replace(/[^a-zA-Z0-9_.-]/g,'_');
      const path = `chat/${Date.now()}_${safe}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(path, f, { upsert:false });
      if(error){ console.error('upload error', error); continue; }
      attachments.push(data.path);
    }
    const payload = {
      sender_id: currentUser.id,
      sender_name: profile.full_name || currentUser.email,
      content: text || null,
      file_path: attachments.length ? attachments.join(';') : null,
      file_type: pendingFiles[0]?.type || null
    };
    await supabase.from('messages').insert(payload);
    msgInput.value=''; pendingFiles = []; renderAttachmentPreview();
  }

  async function toggleRecording(){
    if(mediaRecorder && mediaRecorder.state==='recording'){ mediaRecorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks,{ type:'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type });
        addPending(file);
      };
      mediaRecorder.start();
      showPopup('Enregistrement', 'Enregistrement audio démarré — cliquez pour arrêter.');
    } catch(e){ showPopup('Erreur', 'Micro indisponible'); }
  }

  function showSmallNotification(text){
    // subtle transient non-blocking notification
    const el = document.createElement('div'); el.className='toast'; el.textContent = text;
    document.body.appendChild(el);
    setTimeout(()=> el.classList.add('visible'), 50);
    setTimeout(()=> el.classList.remove('visible'), 4500);
    setTimeout(()=> el.remove(), 5000);
  }

  // ---------------- Admin UI (view profiles) ----------------
  async function renderAdmin(){
    const holder = id('adminUsers');
    if(!holder) return;
    // profiles table
    const { data } = await supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(500);
    holder.innerHTML = '';
    (data||[]).forEach(p=>{
      const el = document.createElement('div'); el.className='card';
      el.innerHTML = `<strong>${escapeHtml(p.full_name || p.id)}</strong><div class="muted">${escapeHtml(p.role || '')} · ${p.id}</div>`;
      holder.appendChild(el);
    });
  }

} // END dashboard exists
