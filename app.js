// app.js
const SUPABASE_URL = "https://wukrnnktndqasxugudui.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1a3Jubmt0bmRxYXN4dWd1ZHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxODcwMzYsImV4cCI6MjA3NTc2MzAzNn0.N3qFqCA7t8HcNfihMR6C0ZtJMJLb9MRzxIMlLjND3ms";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Connexion
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    document.getElementById("error-msg").textContent = "Identifiants invalides.";
  } else {
    window.location.href = "dashboard.html";
  }
});

async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

async function getUserRole(uid) {
  const { data } = await supabase.from("profiles").select("role").eq("id", uid).single();
  return data?.role || "student";
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
});
