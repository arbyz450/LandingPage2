/* ── State ───────────────────────────────────────────── */
let currentPokemon = null;
let sidebarData    = [];
let botSprite      = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';

/* ── DOM refs ────────────────────────────────────────── */
const messagesEl  = document.getElementById('messages');
const inputEl     = document.getElementById('chat-input');
const sendBtn     = document.getElementById('send-btn');
const infoPanel   = document.getElementById('info-panel');
const infoContent = document.getElementById('info-content');
const infoClose   = document.getElementById('info-close');
const sidebarList = document.getElementById('sidebar-list');
const sidebarSrch = document.getElementById('sidebar-search');
const sidebarEl   = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

/* ── Sidebar toggle (mobile) ─────────────────────────── */
sidebarToggle.addEventListener('click', () => sidebarEl.classList.toggle('open'));

/* ── Load sidebar Pokémon list (Gen I) ───────────────── */
async function loadSidebar() {
  const resp = await fetch('https://pokeapi.co/api/v2/pokemon?limit=151&offset=0');
  const data = await resp.json();
  sidebarData = data.results.map((p, i) => ({ name: p.name, id: i + 1 }));
  renderSidebar(sidebarData);
}

function renderSidebar(list) {
  sidebarList.innerHTML = list.map(p => `
    <div class="sidebar-item" data-id="${p.id}" data-name="${p.name}">
      <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png"
           alt="${p.name}" loading="lazy" />
      <div class="sidebar-item-info">
        <div class="name">${capitalize(p.name)}</div>
        <div class="num">#${String(p.id).padStart(3,'0')}</div>
      </div>
    </div>
  `).join('');

  sidebarList.querySelectorAll('.sidebar-item').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      handleUserMessage(`Tell me about ${el.dataset.name}`);
      if (window.innerWidth < 680) sidebarEl.classList.remove('open');
    });
  });
}

sidebarSrch.addEventListener('input', () => {
  const q = sidebarSrch.value.toLowerCase();
  renderSidebar(q ? sidebarData.filter(p => p.name.includes(q) || String(p.id).includes(q)) : sidebarData);
});

/* ── Suggestions ─────────────────────────────────────── */
document.getElementById('suggestions').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (chip) handleUserMessage(chip.dataset.q);
});

/* ── Send ────────────────────────────────────────────── */
sendBtn.addEventListener('click', () => sendInput());
inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendInput(); });

function sendInput() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  handleUserMessage(text);
}

/* ── Message rendering ───────────────────────────────── */
function addMessage(html, role, avatarSrc) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const av = document.createElement(role === 'bot' ? 'img' : 'div');
  av.className = role === 'bot' ? 'avatar' : 'avatar user-av';
  if (role === 'bot') { av.src = avatarSrc || botSprite; av.alt = 'bot'; }
  else av.textContent = '👤';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = `<strong>${role === 'bot' ? 'Pokebot' : 'You'}</strong>${html}`;

  if (role === 'bot') { div.appendChild(av); div.appendChild(bubble); }
  else { div.appendChild(bubble); div.appendChild(av); }

  messagesEl.appendChild(div);
  messagesEl.parentElement.scrollTop = messagesEl.parentElement.scrollHeight;
  return div;
}

function addTyping() {
  return addMessage('<div class="typing-dots"><span></span><span></span><span></span></div>', 'bot');
}

function typeText(bubbleEl, html) {
  const p = document.createElement('div');
  p.innerHTML = html;
  const text = p.innerText;
  bubbleEl.querySelector('.bubble').innerHTML =
    `<strong>Pokebot</strong><p></p>`;
  const pEl = bubbleEl.querySelector('p');
  let i = 0;
  const t = setInterval(() => {
    pEl.textContent += text[i++];
    messagesEl.parentElement.scrollTop = messagesEl.parentElement.scrollHeight;
    if (i >= text.length) { pEl.innerHTML = html; clearInterval(t); }
  }, 14);
}

/* ── Main message handler ────────────────────────────── */
async function handleUserMessage(text) {
  addMessage(`<p>${escHtml(text)}</p>`, 'user');
  const typingEl = addTyping();

  try {
    const reply = await buildReply(text);
    typingEl.remove();
    const msgEl = addMessage(reply.html, 'bot', reply.sprite);
    if (reply.pokemon) showInfoPanel(reply.pokemon);
  } catch (err) {
    typingEl.remove();
    addMessage(`<p>Oops, something went wrong. Try again!</p>`, 'bot');
  }
}

/* ── Info panel ──────────────────────────────────────── */
function showInfoPanel(p) {
  currentPokemon = p;
  const types = p.types.map(t => `<span class="type-tag type-${t.type.name}">${t.type.name}</span>`).join(' ');
  const stats = p.stats.map(s =>
    `<div class="info-stat-item"><span>${shortStat(s.stat.name)}</span> <span>${s.base_stat}</span></div>`
  ).join('');

  infoContent.innerHTML = `
    <img class="info-sprite"
      src="${p.sprites.other?.['official-artwork']?.front_default || p.sprites.front_default}"
      alt="${p.name}" />
    <div class="info-body">
      <div class="info-num">#${String(p.id).padStart(3,'0')}</div>
      <h3>${capitalize(p.name)}</h3>
      <div class="info-types">${types}</div>
      <div class="info-stats">${stats}</div>
    </div>
  `;
  infoPanel.classList.remove('hidden');
}

infoClose.addEventListener('click', () => infoPanel.classList.add('hidden'));

/* ── Reply builder ───────────────────────────────────── */
async function buildReply(raw) {
  const q = raw.toLowerCase();

  /* detect a Pokemon name or number */
  const detected = await detectPokemon(q);

  if (detected) {
    const p = detected;
    botSprite = p.sprites.front_default || botSprite;
    const types = p.types.map(t => `<span class="type-tag type-${t.type.name}">${t.type.name}</span>`).join(' ');

    /* about / tell me */
    if (/tell me|about|info|describe|what is|who is/.test(q)) {
      let flavor = '';
      try {
        const sp = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.id}`).then(r => r.json());
        const fe = sp.flavor_text_entries.find(e => e.language.name === 'en');
        if (fe) flavor = `<p><em>"${fe.flavor_text.replace(/\f/g,' ')}"</em></p>`;
      } catch {}
      return {
        html: `<p><strong>${capitalize(p.name)}</strong> is #${p.id} — ${types} type.<br/>
               Height: ${(p.height/10).toFixed(1)}m · Weight: ${(p.weight/10).toFixed(1)}kg</p>${flavor}`,
        pokemon: p, sprite: p.sprites.front_default
      };
    }

    /* stats */
    if (/\bstats?\b/.test(q)) {
      const rows = p.stats.map(s =>
        `${shortStat(s.stat.name)}: <strong>${s.base_stat}</strong>`).join(' · ');
      return { html: `<p><strong>${capitalize(p.name)}</strong>'s stats:<br/>${rows}</p>`,
               pokemon: p, sprite: p.sprites.front_default };
    }

    /* type */
    if (/\btype\b/.test(q)) {
      return { html: `<p>${capitalize(p.name)} is ${types} type.</p>`,
               pokemon: p, sprite: p.sprites.front_default };
    }

    /* moves */
    if (/\bmoves?\b/.test(q)) {
      const mv = p.moves.slice(0,10).map(m=>capitalize(m.move.name)).join(', ');
      return { html: `<p><strong>${capitalize(p.name)}</strong> can learn: ${mv}, and more.</p>`,
               pokemon: p, sprite: p.sprites.front_default };
    }

    /* evolution */
    if (/\bevo|evolv/.test(q)) {
      try {
        const sp = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.id}`).then(r=>r.json());
        const ec = await fetch(sp.evolution_chain.url).then(r=>r.json());
        const chain = parseChain(ec.chain).map(s=>capitalize(s.name)).join(' → ');
        return { html: `<p>Evolution line: <strong>${chain}</strong></p>`,
                 pokemon: p, sprite: p.sprites.front_default };
      } catch {
        return { html: `<p>Couldn't load evolution data for ${capitalize(p.name)}.</p>`, pokemon: p };
      }
    }

    /* abilities */
    if (/\babilit/.test(q)) {
      const ab = p.abilities.map(a=>capitalize(a.ability.name)).join(', ');
      return { html: `<p><strong>${capitalize(p.name)}</strong>'s abilities: ${ab}</p>`,
               pokemon: p, sprite: p.sprites.front_default };
    }

    /* default for named Pokemon */
    return {
      html: `<p>Found <strong>${capitalize(p.name)}</strong> ${types} — what would you like to know?<br/>
             <em>Try: stats, moves, evolution, type, or abilities.</em></p>`,
      pokemon: p, sprite: p.sprites.front_default
    };
  }

  /* ── Non-pokemon queries ─────────────────────────────── */

  /* strongest / highest stat queries */
  if (/strongest|best|powerful|highest (speed|attack|defense|hp)/.test(q)) {
    return { html: `<p>Among all Pokémon, <strong>Arceus</strong> is often considered the most powerful overall. For raw Attack, <strong>Deoxys</strong> and <strong>Kartana</strong> shine; for Speed, <strong>Deoxys-Speed</strong> leads at 180.</p>` };
  }

  /* hello */
  if (/\b(hi|hello|hey|howdy|sup|yo)\b/.test(q)) {
    return { html: `<p>Hey there, Trainer! 👋 I'm <strong>Pokebot</strong>. Ask me about any Pokémon by name or number!</p>` };
  }

  /* help */
  if (/\bhelp\b/.test(q)) {
    return { html: `<p>Try asking:<br/>
      · <em>"Tell me about Bulbasaur"</em><br/>
      · <em>"What type is Gengar?"</em><br/>
      · <em>"Show Mewtwo's stats"</em><br/>
      · <em>"What moves does Snorlax learn?"</em><br/>
      · <em>"How does Eevee evolve?"</em></p>` };
  }

  return { html: `<p>I'm not sure what you mean — try asking about a specific Pokémon, like <em>"What type is Pikachu?"</em> or <em>"Tell me about Gengar."</em></p>` };
}

/* ── Detect Pokemon in text ──────────────────────────── */
const pokeCache = {};

async function detectPokemon(q) {
  /* check by number */
  const numMatch = q.match(/\b(\d{1,3})\b/);

  /* check sidebar names first (fast) */
  const nameMatch = sidebarData.find(p => q.includes(p.name));

  const identifier = nameMatch?.name || (numMatch ? numMatch[1] : null);
  if (!identifier) return null;

  if (pokeCache[identifier]) return pokeCache[identifier];

  try {
    const data = await fetch(`https://pokeapi.co/api/v2/pokemon/${identifier}`).then(r => {
      if (!r.ok) throw new Error('not found');
      return r.json();
    });
    pokeCache[identifier] = data;
    return data;
  } catch {
    return null;
  }
}

/* ── Evo chain parser ────────────────────────────────── */
function parseChain(chain) {
  const steps = [];
  let node = chain;
  while (node) {
    const id = parseInt(node.species.url.split('/').at(-2));
    steps.push({ name: node.species.name, id });
    node = node.evolves_to?.[0] || null;
  }
  return steps;
}

/* ── Utils ───────────────────────────────────────────── */
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function shortStat(n) {
  return { hp:'HP', attack:'Atk', defense:'Def',
           'special-attack':'SpA', 'special-defense':'SpD', speed:'Spe' }[n] || n;
}

/* ── Boot ────────────────────────────────────────────── */
loadSidebar();
