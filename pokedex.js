const GEN_RANGES = {
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
};

const grid   = document.getElementById('card-grid');
const loading = document.getElementById('loading');
const search  = document.getElementById('search');
const genSel  = document.getElementById('gen-select');

let allCards = [];

function typeTag(t) {
  return `<span class="type-tag type-${t}">${t}</span>`;
}

function renderCards(list) {
  grid.innerHTML = list.map(p => `
    <a class="poke-card" href="card.html?id=${p.id}">
      <img src="${p.sprite}" alt="${p.name}" loading="lazy" />
      <span class="poke-num">#${String(p.id).padStart(3, '0')}</span>
      <span class="poke-name">${p.name}</span>
      <div class="type-tags">${p.types.map(typeTag).join('')}</div>
    </a>
  `).join('');
}

async function loadGen(gen) {
  const [start, end] = GEN_RANGES[gen];
  loading.style.display = 'block';
  grid.innerHTML = '';
  allCards = [];

  const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const chunks = [];
  for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));

  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(id =>
        fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
          .then(r => r.json())
          .then(data => ({
            id: data.id,
            name: data.name,
            sprite: data.sprites.front_default ||
                    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${data.id}.png`,
            types: data.types.map(t => t.type.name),
          }))
          .catch(() => null)
      )
    );
    const valid = results.filter(Boolean);
    allCards.push(...valid);
    renderCards(allCards);
  }

  loading.style.display = 'none';
}

search.addEventListener('input', () => {
  const q = search.value.toLowerCase().trim();
  renderCards(q ? allCards.filter(p => p.name.includes(q) || String(p.id).includes(q)) : allCards);
});

genSel.addEventListener('change', () => loadGen(genSel.value));

loadGen(1);
