const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");
const messages = document.getElementById("chatMessages");
const chipRow = document.getElementById("chipRow");
const chatStatus = document.getElementById("chatStatus");

function addMessage(role, text){
  const el = document.createElement("div");
  el.className = `chat-msg ${role}`;
  if (role === "user") el.setAttribute("data-role", "Sen");
  else if (role === "bot") el.setAttribute("data-role", "Asistan");
  else if (role === "system") el.setAttribute("data-role", "Sistem");
  el.textContent = text;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
  return el;
}

async function sendQuestion(q){
  const userText = q.trim();
  if(!userText) return;

  addMessage("user", userText);
  input.value = "";

  const pending = addMessage("bot", "Yanıt hazırlanıyor...");
  if (chatStatus) chatStatus.textContent = "Yanıt hazırlanıyor...";

  try{
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({question: userText})
    });
    if(!res.ok) throw new Error("API hatası: " + res.status);
    const data = await res.json();
    pending.textContent = data.answer || "Yanıt alınamadı.";
    if (data && data.openai_error) {
      addMessage("system", "Hata: " + data.openai_error);
    }
    if (chatStatus) {
      chatStatus.textContent = data.used_openai ? "AI yanıtı" : "Yerel veri yanıtı";
    }
  }catch(err){
    pending.textContent = "Bir hata oluştu. Lütfen tekrar deneyin.";
    addMessage("system", "Hata: " + (err && err.message ? err.message : "Bilinmeyen hata"));
    if (chatStatus) chatStatus.textContent = "Hata";
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  sendQuestion(input.value);
});

chipRow.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-q]");
  if(!btn) return;
  sendQuestion(btn.dataset.q);
});
