/* Markdown is the source; HTML exists only in the browser. */
const $ = selector => document.querySelector(selector);
const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
let profiles = [];
let navigation = 0;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderList() {
  const query = normalize($('#search').value.trim());
  const selected = new URLSearchParams(location.hash.slice(1)).get('file');
  const matches = profiles.filter(p => normalize(p.name + ' ' + p.content).includes(query));
  $('#count').textContent = `${matches.length} de ${profiles.length} personas`;
  $('#profiles').replaceChildren();
  for (const profile of matches) {
    const link = element('a', '', 'profile');
    link.href = route(`${profile.id}/info.md`);
    const avatar = element('span', profile.name.split(' ').slice(0, 2).map(n => n[0]).join(''), 'avatar');
    avatar.setAttribute('aria-hidden', 'true');
    link.append(avatar, element('span', profile.name));
    if (selected === `${profile.id}/info.md`) link.setAttribute('aria-current', 'page');
    $('#profiles').append(link);
  }
  if (!matches.length) $('#profiles').append(element('p', 'No hay perfiles que coincidan.', 'muted'));
}

function route(file, section = '') {
  const params = new URLSearchParams({file});
  if (section) params.set('section', section);
  return '#' + params.toString();
}

function prepareArticle(file) {
  const article = $('#content');
  const used = new Map();
  $('#toc').replaceChildren();
  for (const heading of article.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
    const slug = normalize(heading.textContent).replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'seccion';
    const count = used.get(slug) || 0;
    used.set(slug, count + 1);
    heading.id = slug + (count ? '-' + count : '');
    if (heading.matches('h2,h3')) {
      const link = element('a', heading.textContent, heading.matches('h3') ? 'subsection' : '');
      link.href = route(file, heading.id);
      $('#toc').append(link);
    }
  }
  for (const link of article.querySelectorAll('a[href]')) {
    const raw = link.getAttribute('href');
    const url = new URL(raw, new URL('/' + file, location.origin));
    if (url.origin === location.origin && url.pathname.endsWith('.md')) {
      link.href = route(decodeURIComponent(url.pathname.slice(1)), decodeURIComponent(url.hash.slice(1)));
    } else if (raw.startsWith('#')) {
      link.href = route(file, decodeURIComponent(raw.slice(1)));
    } else if (url.origin !== location.origin && ['https:', 'http:'].includes(url.protocol)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else if (url.origin === location.origin) {
      link.href = url.href;
    }
  }
  for (const image of article.querySelectorAll('img[src]')) {
    image.src = new URL(image.getAttribute('src'), new URL('/' + file, location.origin)).href;
    image.loading = 'lazy';
  }
  for (const table of article.querySelectorAll('table')) {
    const wrapper = element('div', '', 'table-scroll');
    table.replaceWith(wrapper);
    wrapper.append(table);
  }
}

async function navigate() {
  const token = ++navigation;
  const params = new URLSearchParams(location.hash.slice(1));
  const file = params.get('file');
  renderList();
  $('#source').hidden = !file;
  $('#outline').hidden = !file;
  $('#toc').replaceChildren();
  if (!file) {
    document.title = 'Personas · Directorio';
    $('#breadcrumb').textContent = 'Directorio / Todas las personas';
    const intro = element('section', '', 'welcome');
    intro.append(element('p', 'UN LUGAR PARA RECORDAR', 'eyebrow'), element('h1', 'Personas y conexiones.'), element('p', 'El contexto de cada persona, a mano. Explora las fichas o busca un nombre, una organización o un proyecto.', 'intro'));
    const grid = element('div', '', 'cards');
    for (const profile of profiles) {
      const link = element('a', '', 'card');
      link.href = route(`${profile.id}/info.md`);
      link.append(element('span', profile.name.split(' ').slice(0, 2).map(n => n[0]).join(''), 'avatar'), element('h2', profile.name), element('span', 'Abrir ficha →', 'muted'));
      grid.append(link);
    }
    $('#content').replaceChildren(intro, grid);
    window.scrollTo(0, 0);
    return;
  }
  const profile = profiles.find(p => p.id === file.split('/')[0]);
  $('#breadcrumb').textContent = 'Directorio / ' + (profile?.name || file);
  $('#content').textContent = 'Cargando ficha…';
  try {
    if (!profile || !file.endsWith('.md') || file.split('/').some(p => p === '..' || p.startsWith('.'))) throw new Error('La ficha no existe.');
    const response = await fetch('/' + file.split('/').map(encodeURIComponent).join('/'), {cache: 'no-store'});
    if (!response.ok) throw new Error('No se ha podido abrir este Markdown.');
    const markdown = await response.text();
    if (token !== navigation) return;
    $('#content').innerHTML = DOMPurify.sanitize(marked.parse(markdown, {gfm: true}), {USE_PROFILES: {html: true}});
    prepareArticle(file);
    $('#source').href = '/' + file.split('/').map(encodeURIComponent).join('/');
    document.title = ($('#content h1')?.textContent || profile.name) + ' · Personas';
    const target = params.get('section');
    const heading = target && document.getElementById(target);
    if (heading && $('#content').contains(heading)) heading.scrollIntoView();
    else window.scrollTo(0, 0);
  } catch (error) {
    if (token !== navigation) return;
    $('#content').replaceChildren(element('h1', 'No se pudo abrir la ficha'), element('p', error.message));
    $('#source').hidden = true;
  }
}

$('#search').addEventListener('input', renderList);
window.addEventListener('hashchange', navigate);
async function readRevision() {
  const response = await fetch('/api/revision', {cache: 'no-store'});
  if (!response.ok) throw new Error('No se pudo comprobar la revisión.');
  return response.json();
}

async function watchChanges(baseline) {
  if (!baseline?.enabled) return;
  try {
    const current = await readRevision();
    if (current.revision !== baseline.revision) {
      sessionStorage.setItem('people-reload', JSON.stringify({search: $('#search').value, scroll: window.scrollY, hash: location.hash}));
      location.reload();
      return;
    }
  } catch {
    // A brief server restart or failed request should not disable the watcher.
  }
  setTimeout(() => watchChanges(baseline), 1000);
}

async function start() {
  let revision;
  try { revision = await readRevision(); } catch { /* Compatible with a server without reload. */ }
  if (revision?.enabled) $('#reload-status').textContent = 'Recarga automática activada.';
  try {
    const response = await fetch('/api/profiles', {cache: 'no-store'});
    if (!response.ok) throw new Error('No se ha podido cargar el directorio.');
    profiles = await response.json();
    const saved = sessionStorage.getItem('people-reload');
    sessionStorage.removeItem('people-reload');
    let position;
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.hash === location.hash) {
          $('#search').value = state.search;
          position = state.scroll;
        }
      } catch { /* Ignore obsolete local state. */ }
    }
    await navigate();
    if (position !== undefined) requestAnimationFrame(() => window.scrollTo(0, position));
  } catch (error) {
    $('#content').textContent = error.message + ' Recarga la página para reintentar.';
  }
  watchChanges(revision);
}
start();
