/* ── Helpers ─────────────────────────────────────────── */
const params = new URLSearchParams(location.search);
const pokemonId = params.get('id') || '1';

function typeTag(t) {
  return `<span class="type-tag type-${t}">${t}</span>`;
}

function statColor(val) {
  if (val >= 100) return '#2dc653';
  if (val >= 70)  return '#ffd60a';
  if (val >= 40)  return '#f77f00';
  return '#e63946';
}

function statBar(name, val) {
  const pct = Math.min(100, Math.round((val / 255) * 100));
  return `
    <div class="stat-row">
      <span class="stat-name">${name}</span>
      <span class="stat-val">${val}</span>
      <div class="stat-bar-bg">
        <div class="stat-bar" style="width:${pct}%;background:${statColor(val)}"></div>
      </div>
    </div>`;
}

const STAT_LABELS = { hp:'HP', attack:'Atk', defense:'Def',
  'special-attack':'Sp.Atk', 'special-defense':'Sp.Def', speed:'Spd' };

/* ── Data loading ────────────────────────────────────── */
let pokemon = null;
let species  = null;
let evoChain = null;

async function loadAll() {
  const [pData, sData] = await Promise.all([
    fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`).then(r => r.json()),
    fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`).then(r => r.json()),
  ]);
  pokemon = pData;
  species  = sData;

  const evoUrl = species.evolution_chain?.url;
  if (evoUrl) {
    evoChain = await fetch(evoUrl).then(r => r.json());
  }

  renderDetail();
  document.title = `#${pokemon.id} ${capitalize(pokemon.name)}`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ── Evolution chain parser ──────────────────────────── */
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

/* ── Render detail card ──────────────────────────────── */
function renderDetail() {
  const p  = pokemon;
  const sp = species;

  const flavorEntry = sp.flavor_text_entries.find(e => e.language.name === 'en');
  const flavor = flavorEntry ? flavorEntry.flavor_text.replace(/\f/g, ' ') : '';

  const genus = sp.genera.find(g => g.language.name === 'en')?.genus || '';

  const shinySprite = p.sprites.front_shiny || '';
  const mainSprite  = p.sprites.other?.['official-artwork']?.front_default
                   || p.sprites.front_default || '';

  const moves = p.moves.slice(0, 24).map(m => `<span class="move-tag">${m.move.name}</span>`).join('');

  let evoHtml = '';
  if (evoChain) {
    const steps = parseChain(evoChain.chain);
    evoHtml = steps.map((s, i) => {
      const arrow = i < steps.length - 1 ? '<span class="evo-arrow">→</span>' : '';
      return `
        <div class="evo-item">
          <a href="card.html?id=${s.id}">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${s.id}.png" alt="${s.name}" loading="lazy" />
            <span>${capitalize(s.name)}</span>
          </a>
        </div>${arrow}`;
    }).join('');
  }

  document.getElementById('card-detail').innerHTML = `
    <div class="detail-left">
      <img class="sprite-main" src="${mainSprite}" alt="${p.name}" />
      ${shinySprite ? `<div><img class="sprite-shiny" src="${shinySprite}" alt="shiny ${p.name}" title="Shiny form" /></div><div class="shiny-label">✨ Shiny</div>` : ''}
    </div>

    <div class="detail-right">
      <div class="detail-num">#${String(p.id).padStart(3,'0')} · ${genus}</div>
      <h2>${capitalize(p.name)}</h2>
      <div class="detail-types">${p.types.map(t => typeTag(t.type.name)).join(' ')}</div>

      <p class="flavor">"${flavor}"</p>

      <div class="section-label">Base Stats</div>
      <div class="stats-grid">
        ${p.stats.map(s => statBar(STAT_LABELS[s.stat.name] || s.stat.name, s.base_stat)).join('')}
      </div>

      <div class="section-label">Height / Weight</div>
      <div style="font-size:.88rem;color:var(--subtext)">
        ${(p.height / 10).toFixed(1)} m &nbsp;·&nbsp; ${(p.weight / 10).toFixed(1)} kg
      </div>

      ${evoHtml ? `<div class="section-label">Evolution Chain</div><div class="evo-chain">${evoHtml}</div>` : ''}

      <div class="section-label">Moves (first 24)</div>
      <div class="moves-grid">${moves}</div>
    </div>
  `;
}

/* ── Bot ─────────────────────────────────────────────── */
const bubble   = document.getElementById('bot-bubble');
const chat     = document.getElementById('bot-chat');
const closeBtn = document.getElementById('bot-close');
const input    = document.getElementById('bot-input');
const sendBtn  = document.getElementById('bot-send');
const msgs     = document.getElementById('bot-messages');

bubble.addEventListener('click', () => { chat.classList.remove('hidden'); input.focus(); });
closeBtn.addEventListener('click', () => chat.classList.add('hidden'));
sendBtn.addEventListener('click', sendMessage);
input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

function addMsg(text, role) {
  const div = document.createElement('div');
  div.className = `bot-msg ${role}`;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function typeReply(text) {
  const div = addMsg('', 'bot');
  let i = 0;
  const timer = setInterval(() => {
    div.textContent += text[i++];
    msgs.scrollTop = msgs.scrollHeight;
    if (i >= text.length) clearInterval(timer);
  }, 18);
}

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addMsg(text, 'user');

  if (!pokemon) {
    typeReply("Still loading Pokémon data — give me a second!");
    return;
  }
  typeReply(buildReply(text.toLowerCase()));
}

/* ── Bot reply logic ─────────────────────────────────── */
function buildReply(q) {
  const p  = pokemon;
  const sp = species;
  const name = capitalize(p.name);

  /* type */
  if (/\btype\b/.test(q)) {
    const types = p.types.map(t => capitalize(t.type.name)).join(' and ');
    return `${name} is a ${types}-type Pokémon.`;
  }

  /* stats — individual */
  if (/\bhp\b/.test(q)) return `${name}'s HP is ${getStat('hp')}.`;
  if (/\battack\b/.test(q) && !/special/.test(q)) return `${name}'s Attack is ${getStat('attack')}.`;
  if (/\bdefense\b/.test(q) && !/special/.test(q)) return `${name}'s Defense is ${getStat('defense')}.`;
  if (/sp\.?\s*atk|special.attack/.test(q)) return `${name}'s Special Attack is ${getStat('special-attack')}.`;
  if (/sp\.?\s*def|special.defense/.test(q)) return `${name}'s Special Defense is ${getStat('special-defense')}.`;
  if (/\bspeed\b/.test(q)) return `${name}'s Speed is ${getStat('speed')}.`;

  /* all stats */
  if (/\bstats?\b/.test(q)) {
    const s = p.stats.map(s => `${s.stat.name.replace('special-','sp.')} ${s.base_stat}`).join(', ');
    return `${name}'s base stats — ${s}.`;
  }

  /* height/weight */
  if (/\bheight\b/.test(q)) return `${name} is ${(p.height / 10).toFixed(1)} m tall.`;
  if (/\bweight\b/.test(q)) return `${name} weighs ${(p.weight / 10).toFixed(1)} kg.`;

  /* moves */
  if (/\bmoves?\b/.test(q)) {
    const sample = p.moves.slice(0, 8).map(m => capitalize(m.move.name)).join(', ');
    return `${name} can learn moves like: ${sample}, and more.`;
  }

  /* evolution */
  if (/\bevo\b|evolv/.test(q) && evoChain) {
    const steps = parseChain(evoChain.chain).map(s => capitalize(s.name)).join(' → ');
    return `The evolution line is: ${steps}.`;
  }

  /* abilities */
  if (/\babilit/.test(q)) {
    const abs = p.abilities.map(a => capitalize(a.ability.name)).join(', ');
    return `${name}'s abilities: ${abs}.`;
  }

  /* description / info */
  if (/\bdescri|info|about|what is|tell me/.test(q)) {
    const flavorEntry = sp?.flavor_text_entries.find(e => e.language.name === 'en');
    if (flavorEntry) return flavorEntry.flavor_text.replace(/\f/g, ' ');
    return `${name} is a Pokémon with ID #${p.id}.`;
  }

  /* number / id */
  if (/\bnumber\b|\bid\b|\bpokedex\b/.test(q)) return `${name} is #${p.id} in the Pokédex.`;

  /* shiny */
  if (/\bshiny\b/.test(q)) return `Yes! ${name} has a shiny form — look at the sparkle sprite on the card!`;

  /* hello / greeting */
  if (/\b(hi|hello|hey|howdy|sup)\b/.test(q)) {
    return `Hello, Trainer! I'm Professor Oak's assistant. Ask me about ${name}'s type, stats, moves, abilities, or evolution!`;
  }

  /* help */
  if (/\bhelp\b/.test(q)) {
    return `Try asking: "What type is it?", "What are its stats?", "What moves can it learn?", "Does it evolve?", or "Tell me about it."`;
  }

  return `Hmm, I'm not sure about that. Try asking about ${name}'s type, stats, moves, abilities, height, weight, or evolution!`;
}

function getStat(name) {
  return pokemon.stats.find(s => s.stat.name === name)?.base_stat ?? '?';
}

/* ── Boot ────────────────────────────────────────────── */
loadAll().catch(err => {
  document.getElementById('detail-loading').textContent = 'Failed to load Pokémon data.';
  console.error(err);
});
