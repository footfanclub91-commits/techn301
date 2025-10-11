import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// === CONFIG SUPABASE ===
const SUPABASE_URL = "https://wukrnnktndqasxugudui.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1a3Jubmt0bmRxYXN4dWd1ZHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxODcwMzYsImV4cCI6MjA3NTc2MzAzNn0.N3qFqCA7t8HcNfihMR6C0ZtJMJLb9MRzxIMlLjND3ms";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === ELEMENTS ===
const loginForm = document.getElementById("loginForm");
const popup = document.getElementById("popup");
const popupTitle = document.getElementById("popup-title");
const popupMessage = document.getElementById("popup-message");
const popupClose = document.getElementById("popup-close");

// === POPUP FUNCTION ===
function showPopup(title, message, type = "info") {
  popupTitle.textContent = title;
  popupMessage.textContent = message;
  popup.classList.remove("hidden");

  if (type === "success") popupTitle.style.color = "#3cf281";
  else if (type === "error") popupTitle.style.color = "#ff4d4d";
  else popupTitle.style.color = "white";
}

popupClose.addEventListener("click", () => popup.classList.add("hidden"));

// === LOGIN ===
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  showPopup("Connexion en cours...", "Veuillez patienter.");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    showPopup("Erreur de connexion", "Identifiants incorrects ou compte inactif.", "error");
    console.error(error);
  } else {
    showPopup("Connexion réussie", "Bienvenue sur Techn301 !", "success");
    setTimeout(() => window.location.href = "dashboard.html", 1200);
  }
});
