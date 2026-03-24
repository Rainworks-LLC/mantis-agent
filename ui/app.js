// @ts-nocheck — vanilla JS for browser, no build step
const agentList = document.getElementById("agent-list");
const chatArea = document.getElementById("chat-area");
const messages = document.getElementById("messages");
const inputForm = document.getElementById("input-form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");

let ws = null;
let currentAgentId = null;
let streamingEl = null;

async function loadAgents() {
  const res = await fetch("/api/agents");
  const agents = await res.json();
  agentList.innerHTML = "";
  for (const agent of agents) {
    const card = document.createElement("div");
    card.className = "agent-card" + (agent.id === currentAgentId ? " active" : "");
    card.innerHTML = `
      <div class="name">${agent.emoji} ${agent.name}</div>
      <div class="meta">${agent.model} · ${agent.creatureType}</div>
    `;
    card.onclick = () => connectToAgent(agent.id);
    agentList.appendChild(card);
  }
}

function connectToAgent(agentId) {
  if (ws) {
    ws.close();
  }
  currentAgentId = agentId;
  messages.innerHTML = "";
  chatArea.classList.remove("empty");
  input.disabled = true;
  sendBtn.disabled = true;

  // Update active card
  document.querySelectorAll(".agent-card").forEach((c) => c.classList.remove("active"));
  document.querySelectorAll(".agent-card").forEach((c) => {
    if (c.querySelector(".name").textContent.includes(agentId)) {
      c.classList.add("active");
    }
  });

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/api/agents/${agentId}/chat`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWsMessage(data);
  };

  ws.onclose = () => {
    input.disabled = true;
    sendBtn.disabled = true;
  };

  ws.onerror = () => {
    addMessage("system", "Connection error");
  };
}

function handleWsMessage(data) {
  switch (data.type) {
    case "ready":
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
      addMessage("system", `Session: ${data.sessionId.slice(0, 8)}...`);
      break;
    case "token":
      if (!streamingEl) {
        streamingEl = addMessage("assistant", "", true);
      }
      streamingEl.textContent += data.content;
      messages.scrollTop = messages.scrollHeight;
      break;
    case "message":
      if (streamingEl) {
        streamingEl.classList.remove("streaming");
        streamingEl = null;
      }
      break;
    case "tool_call":
      addMessage("tool", `⚙ ${data.name}(${JSON.stringify(data.args)})`);
      break;
    case "tool_result": {
      const preview = data.result.length > 200 ? data.result.slice(0, 200) + "…" : data.result;
      addMessage("tool", `→ ${preview}`);
      break;
    }
    case "done":
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
      break;
    case "error":
      addMessage("system", `Error: ${data.message}`);
      input.disabled = false;
      sendBtn.disabled = false;
      break;
  }
}

function addMessage(role, content, streaming = false) {
  const el = document.createElement("div");
  el.className = `message ${role}` + (streaming ? " streaming" : "");
  el.textContent = content;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
  return el;
}

inputForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !ws) return;

  addMessage("user", text);
  ws.send(JSON.stringify({ type: "message", content: text }));
  input.value = "";
  input.disabled = true;
  sendBtn.disabled = true;
});

// Init
loadAgents();
