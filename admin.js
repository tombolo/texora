(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const COUNTRIES = window.ASIATIX_COUNTRIES;
  const tokenKey = "asiatix_admin_token";
  const token = () => sessionStorage.getItem(tokenKey) || "";
  const setToken = (t) => sessionStorage.setItem(tokenKey, t);
  let photoUrl = "";
  let activeThread = null;
  let poll = null;

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (token()) headers.Authorization = "Bearer " + token();
    if (opts.body && !(opts.body instanceof FormData) && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const res = await fetch(path, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== "/api/admin/login") { sessionStorage.removeItem(tokenKey); showLogin(); throw new Error("Please sign in"); }
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2800);
  }

  function showLogin() {
    $("#loginView").hidden = false;
    $("#appView").hidden = true;
    $("#appView").classList.remove("is-on");
  }
  function showApp() {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
    $("#appView").classList.add("is-on");
    loadTickets();
    loadInbox();
    if (poll) clearInterval(poll);
    poll = setInterval(loadInbox, 6000);
  }

  $("#loginBtn").addEventListener("click", async () => {
    $("#loginErr").hidden = true;
    try {
      const r = await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: $("#loginPass").value }) });
      setToken(r.token);
      showApp();
    } catch (e) { $("#loginErr").hidden = false; }
  });
  $("#loginPass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#loginBtn").click(); });
  $("#logoutBtn").addEventListener("click", () => { sessionStorage.removeItem(tokenKey); showLogin(); });

  const $$ = (s) => [...document.querySelectorAll(s)];
  $$(".aside-btn").forEach((b) => b.addEventListener("click", () => {
    $$(".aside-btn").forEach((x) => x.classList.toggle("on", x === b));
    $("#ticketsTab").hidden = b.dataset.tab !== "tickets";
    $("#inboxTab").hidden = b.dataset.tab !== "inbox";
    if (b.dataset.tab !== "inbox") {
      $("#inbox").classList.remove("show-thread");
      activeThread = null;
    } else loadInbox();
  }));

  const ccSel = $("#evCc");
  ccSel.innerHTML = Object.keys(COUNTRIES).map((k) => `<option value="${k}">${COUNTRIES[k].name}</option>`).join("");

  async function loadTickets() {
    const list = await api("/api/admin/events");
    $("#ticketList").innerHTML = list.map((e) => `
      <article class="admin-card">
        <img src="${e.img}" alt="" />
        <div class="pad">
          <h3>${esc(e.title)}</h3>
          <p class="muted">${e.city} · ${e.cc} · $${e.usd} · ${e.left} left</p>
          <div class="row">
            <button class="btn btn-ghost btn-sm" data-edit="${e.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-del="${e.id}">Delete</button>
          </div>
        </div>
      </article>`).join("") || `<p class="muted">No tickets yet. Click Add ticket.</p>`;
    window.__tickets = list;
  }

  $("#ticketList").addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    const edit = e.target.closest("[data-edit]");
    if (del && confirm("Delete this ticket?")) {
      await api("/api/admin/events/" + del.dataset.del, { method: "DELETE" });
      toast("Ticket removed");
      loadTickets();
    }
    if (edit) openForm(window.__tickets.find((x) => String(x.id) === edit.dataset.edit));
  });

  $("#newTicket").addEventListener("click", () => openForm(null));

  function openForm(ev) {
    $("#ticketModal").hidden = false;
    $("#ticketModalTitle").textContent = ev ? "Edit ticket" : "Add ticket";
    $("#evId").value = ev ? ev.id : "";
    $("#evTitle").value = ev ? ev.title : "";
    $("#evCity").value = ev ? ev.city : "";
    $("#evCc").value = ev ? ev.cc : "JP";
    $("#evCat").value = ev ? ev.cat : "music";
    $("#evUsd").value = ev ? ev.usd : "";
    $("#evDate").value = ev && ev.date ? ev.date.slice(0, 16) : "";
    $("#evLeft").value = ev ? ev.left : 50;
    $("#evHot").checked = !!(ev && ev.hot);
    $("#evDesc").value = ev ? (ev.desc || "") : "";
    photoUrl = ev ? ev.img : "";
    const prev = $("#evPreview");
    if (photoUrl) { prev.src = photoUrl; prev.hidden = false; } else prev.hidden = true;
    $("#evFile").value = "";
  }

  $("#ticketModal").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) $("#ticketModal").hidden = true; });

  $("#evFile").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 4.5 * 1024 * 1024) return toast("Image must be under 4.5 MB");
    const data = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const up = await api("/api/admin/upload", { method: "POST", body: JSON.stringify({ data }) });
    photoUrl = up.url;
    $("#evPreview").src = photoUrl;
    $("#evPreview").hidden = false;
    toast("Photo uploaded");
  });

  $("#ticketForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!photoUrl) return toast("Please upload a photo");
    const payload = {
      title: $("#evTitle").value.trim(),
      city: $("#evCity").value.trim(),
      cc: $("#evCc").value,
      cat: $("#evCat").value,
      usd: Number($("#evUsd").value),
      date: $("#evDate").value,
      left: Number($("#evLeft").value),
      hot: $("#evHot").checked,
      desc: $("#evDesc").value.trim(),
      img: photoUrl
    };
    const id = $("#evId").value;
    if (id) await api("/api/admin/events/" + id, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/api/admin/events", { method: "POST", body: JSON.stringify(payload) });
    $("#ticketModal").hidden = true;
    toast("Ticket saved — it is live on the site");
    loadTickets();
  });

  async function loadInbox() {
    if (!token()) return;
    try {
      const data = await api("/api/admin/messages");
      const badge = $("#unreadBadge");
      badge.hidden = !data.unread;
      badge.textContent = data.unread;
      const list = $("#threadList");
      if (!data.threads.length) {
        list.innerHTML = `<p class="muted" style="padding:16px">No messages yet. Visitors write from the chat icon on the site.</p>`;
        return;
      }
      window.__threads = data.threads;
      list.innerHTML = data.threads.map((t) => {
        const last = t.messages[t.messages.length - 1];
        return `<button type="button" class="t-item ${activeThread === t.id ? "on" : ""}" data-thread="${t.id}">
          <b>${esc(t.name || "Guest")} ${t.unread ? `<span class="badge">${t.unread}</span>` : ""}</b>
          <small>${esc(t.email || "")}</small>
          <small>${esc((last && last.text) || "")}</small>
        </button>`;
      }).join("");
      if (activeThread) {
        const th = data.threads.find((x) => x.id === activeThread);
        if (th) renderThread(th);
      }
    } catch { /* stay signed in view */ }
  }

  function openThread(id) {
    activeThread = id;
    const th = (window.__threads || []).find((x) => x.id === id);
    if (!th) return;
    renderThread(th);
    $("#inbox").classList.add("show-thread");
    $$(".t-item").forEach((el) => el.classList.toggle("on", el.dataset.thread === id));
    api("/api/admin/messages/" + encodeURIComponent(id) + "/read", { method: "POST" }).then(() => loadInbox()).catch(() => {});
  }

  $("#threadList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-thread]");
    if (!b) return;
    e.preventDefault();
    openThread(b.dataset.thread);
  });
  $("#backThread").addEventListener("click", () => {
    $("#inbox").classList.remove("show-thread");
    activeThread = null;
    $("#threadEmpty").hidden = false;
    $("#threadBody").classList.remove("is-on");
  });

  function renderThread(t) {
    $("#threadEmpty").hidden = true;
    $("#threadBody").classList.add("is-on");
    $("#threadMeta").innerHTML = `<b>${esc(t.name)}</b><br><span class="muted">${esc(t.email || "No email")}</span>`;
    $("#threadMsgs").innerHTML = t.messages.map((m) => `<div class="bubble ${m.from}">${esc(m.text)}<br><small class="muted">${new Date(m.at).toLocaleString()}</small></div>`).join("");
    $("#threadMsgs").scrollTop = 99999;
  }

  $("#replyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeThread) return;
    const text = $("#replyText").value.trim(); if (!text) return;
    await api("/api/admin/reply", { method: "POST", body: JSON.stringify({ threadId: activeThread, text }) });
    $("#replyText").value = "";
    loadInbox();
  });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  if (token()) showApp(); else showLogin();
})();
