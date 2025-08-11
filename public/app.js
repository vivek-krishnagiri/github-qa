const $ = (sel) => document.querySelector(sel);

const loginBtn = $("#loginBtn");
const logoutBtn = $("#logoutBtn");
const userBox = $("#userBox");
const avatar = $("#avatar");
const welcome = $("#welcome");
const chat = $("#chat");
const messages = $("#messages");
const askForm = $("#askForm");
const q = $("#q");

loginBtn.addEventListener("click", () => {
  window.location.href = "/login";
});

logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/.netlify/functions/logout", { method: "POST" });
  } catch {}
  await refreshAuth(); // updates the UI to the logged-out state
});

askForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = q.value.trim();
  if (!text) return;
  pushMsg("You", text);
  q.value = "";
  typing(true);

  try {
    const res = await fetch("/.netlify/functions/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text })
    });
    const data = await res.json();
    typing(false);
    if (!res.ok || !data.ok) {
      pushMsg("App", data.error || "Something went wrong.");
    } else {
      pushMsg("App", data.answer);
      // console.log("intent", data.intent);
    }
  } catch (err) {
    typing(false);
    pushMsg("App", err.message);
  }
});

function pushMsg(who, text) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<div class="who">${who}</div><div class="bubble">${escapeHtml(text)}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function typing(on) {
  const id = "typing";
  const old = document.getElementById(id);
  if (on) {
    if (old) return;
    const div = document.createElement("div");
    div.id = id;
    div.className = "msg";
    div.innerHTML = `<div class="who">App</div><div class="bubble">Thinking…</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  } else if (old) {
    old.remove();
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

async function refreshAuth() {
  const res = await fetch("/.netlify/functions/me");
  const data = await res.json();
  if (data.authenticated) {
    loginBtn.classList.add("hidden");
    userBox.classList.remove("hidden");
    chat.classList.remove("hidden");
    avatar.src = data.user.avatar_url;
    welcome.textContent = `Signed in as ${data.user.login}`;
  } else {
    loginBtn.classList.remove("hidden");
    userBox.classList.add("hidden");
    chat.classList.add("hidden");
    messages.innerHTML = "";
  }
}
refreshAuth();
