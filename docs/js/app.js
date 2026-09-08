// spend-money — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
//
// Suivi des dépenses carte. Point d'entrée de l'application.
// Les données vivent dans un dépôt GitHub privé ; cette page est
// entièrement statique (GitHub Pages), aucun serveur intermédiaire.

import { Store, todayISO } from './store.js';
import { b64ToUtf8 } from './crypto.js';

const CFG_KEY = 'spend-money.config';
const $ = (id) => document.getElementById(id);

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const shortMoney = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const dayLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

let store = null;
let range = 'month';          // month | prev | 30 | year | all | custom
let editing = null;           // dépense en cours d'édition, ou null

// ═══════════════════════════════════════════════════════ config ════
function guessRepo() {
  // Sur https://<owner>.github.io/<repo>/ on devine owner et repo.
  const host = location.hostname.match(/^([\w-]+)\.github\.io$/i);
  const seg = location.pathname.split('/').filter(Boolean);
  return { owner: host ? host[1] : '', repo: host && seg.length ? seg[0] : '' };
}

function loadConfig() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch { /* réglages illisibles */ }
  const guess = guessRepo();
  return {
    owner: saved.owner || guess.owner,
    repo: saved.repo || guess.repo || 'spend-money',
    branch: saved.branch || 'main',
    path: saved.path || 'data/expenses.json',
    token: saved.token || '',
    passphrase: saved.passphrase || ''
  };
}

function readConfigForm() {
  return {
    owner: $('cfg-owner').value.trim(),
    repo: $('cfg-repo').value.trim(),
    branch: $('cfg-branch').value.trim() || 'main',
    path: $('cfg-path').value.trim() || 'data/expenses.json',
    token: $('cfg-token').value.trim(),
    passphrase: $('cfg-pass').value
  };
}

function fillConfigForm(cfg) {
  $('cfg-owner').value = cfg.owner;
  $('cfg-repo').value = cfg.repo;
  $('cfg-branch').value = cfg.branch;
  $('cfg-path').value = cfg.path;
  $('cfg-token').value = cfg.token;
  $('cfg-pass').value = cfg.passphrase;
}

// ═══════════════════════════════════════════════════════════ vues ══
function showView(name) {
  $('view-home').hidden = name !== 'home';
  $('view-settings').hidden = name !== 'settings';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.view === name));
  $('fab').hidden = name !== 'home';
  window.scrollTo({ top: 0 });
}

function setSync(text, kind) {
  $('sync-text').textContent = text;
  $('sync-chip').className = `sync-chip ${kind}`;
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3400);
}

function setStatus(msg, kind = '') {
  $('cfg-status').textContent = msg;
  $('cfg-status').className = `status ${kind}`;
}

// ══════════════════════════════════════════════════════ filtrage ═══
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Bornes {from, to, label} de la période active. */
function bounds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (range) {
    case 'month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: cap(monthLabel.format(now)) };
    case 'prev': {
      const d = new Date(y, m - 1, 1);
      return { from: iso(d), to: iso(new Date(y, m, 0)), label: cap(monthLabel.format(d)) };
    }
    case '30': {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      return { from: iso(d), to: iso(now), label: '30 derniers jours' };
    }
    case 'year':
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: `Année ${y}` };
    case 'custom': {
      const from = $('q-from').value;
      const to = $('q-to').value;
      const fmt = (s) => s ? new Date(`${s}T12:00:00`).toLocaleDateString('fr-FR') : '…';
      return { from, to, label: `Du ${fmt(from)} au ${fmt(to)}` };
    }
    default:
      return { from: '', to: '', label: 'Depuis le début' };
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function filtered() {
  if (!store) return [];
  const q = $('q-text').value.trim().toLowerCase();
  const { from, to } = bounds();
  return store.items
    .filter((i) => !q || i.description.toLowerCase().includes(q))
    .filter((i) => !from || i.date >= from)
    .filter((i) => !to || i.date <= to)
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
}

// ═══════════════════════════════════════════════════════ rendu ═════
/** Teinte stable dérivée du texte, pour la pastille de chaque dépense. */
function hue(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

function avatar(item) {
  const el = document.createElement('span');
  el.className = 'item-avatar';
  const label = (item.description || '?').trim();
  el.textContent = label.slice(0, 1).toUpperCase();
  const h = hue(label.toLowerCase());
  el.style.background = `hsl(${h} 62% 52% / .18)`;
  el.style.color = `hsl(${h} 70% 62%)`;
  return el;
}

function renderSpark(items, from, to) {
  const box = $('spark');
  box.innerHTML = '';
  if (!items.length) return;

  const dates = items.map((i) => i.date).sort();
  const start = new Date(`${from || dates[0]}T12:00:00`);
  const end = new Date(`${to || dates[dates.length - 1]}T12:00:00`);
  const days = Math.min(Math.round((end - start) / 86400000) + 1, 62);
  if (days < 2) return;

  const totals = new Array(days).fill(0);
  for (const it of items) {
    const idx = Math.round((new Date(`${it.date}T12:00:00`) - start) / 86400000);
    if (idx >= 0 && idx < days) totals[idx] += it.amount;
  }
  const max = Math.max(...totals);
  if (!max) return;

  const today = todayISO();
  for (let i = 0; i < days; i++) {
    const bar = document.createElement('i');
    bar.style.height = `${Math.max(2, (totals[i] / max) * 40)}px`;
    const d = new Date(start); d.setDate(d.getDate() + i);
    if (!totals[i]) bar.className = 'zero';
    else if (iso(d) === today) bar.className = 'hot';
    box.appendChild(bar);
  }
}

function render() {
  const items = filtered();
  const { from, to, label } = bounds();
  const total = items.reduce((s, i) => s + i.amount, 0);

  $('hero-label').textContent = label;
  $('hero-amount').textContent = store ? money.format(total) : '—';
  $('hero-count').textContent = `${items.length} dépense${items.length > 1 ? 's' : ''}`;

  const spanDays = from && to
    ? Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1)
    : 0;
  $('hero-avg').textContent = spanDays > 1 && total ? `${shortMoney.format(total / spanDays)} / jour` : '';

  renderSpark(items, from, to);
  $('q-clear').hidden = !$('q-text').value;

  const list = $('list');
  list.innerHTML = '';
  $('empty').hidden = items.length > 0;

  const queued = new Set(store ? store.pending.map((i) => i.id) : []);
  const byDay = new Map();
  for (const it of items) {
    if (!byDay.has(it.date)) byDay.set(it.date, []);
    byDay.get(it.date).push(it);
  }

  for (const [date, dayItems] of byDay) {
    const head = document.createElement('li');
    head.className = 'day';
    const name = document.createElement('span');
    name.className = 'day-name';
    name.textContent = cap(dayLabel.format(new Date(`${date}T12:00:00`)));
    const sum = document.createElement('span');
    sum.className = 'day-total';
    sum.textContent = money.format(dayItems.reduce((s, i) => s + i.amount, 0));
    head.append(name, sum);
    list.appendChild(head);

    for (const item of dayItems) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item' + (queued.has(item.id) ? ' queued' : '');
      btn.addEventListener('click', () => openEntry(item));

      const body = document.createElement('span');
      body.className = 'item-body';
      const desc = document.createElement('span');
      desc.className = 'item-desc';
      desc.textContent = item.description || 'Sans description';
      const sub = document.createElement('span');
      sub.className = 'item-sub';
      sub.textContent = item.source === 'shortcut' ? 'Apple Pay' : 'Saisie manuelle';
      if (queued.has(item.id)) sub.textContent += ' · en attente';
      body.append(desc, sub);

      const amount = document.createElement('span');
      amount.className = 'item-amount';
      amount.textContent = money.format(item.amount);

      btn.append(avatar(item), body, amount);
      li.appendChild(btn);
      list.appendChild(li);
    }
  }
}

// ═════════════════════════════════════════════════ feuille ajout ═══
const parseAmount = (v) => Number(String(v).replace(',', '.').replace(/[^\d.]/g, ''));

function openEntry(item = null) {
  editing = item;
  $('sheet-title').textContent = item ? 'Modifier la dépense' : 'Nouvelle dépense';
  $('f-id').value = item ? item.id : '';
  $('f-amount').value = item ? item.amount.toFixed(2).replace('.', ',') : '';
  $('f-desc').value = item ? item.description : '';
  $('f-date').value = item ? item.date : todayISO();
  $('f-submit').textContent = item ? 'Enregistrer' : 'Ajouter';
  $('f-delete').hidden = !item;
  $('sheet-entry').showModal();
  if (!item) setTimeout(() => $('f-amount').focus(), 120);
}

async function submitEntry(ev) {
  ev.preventDefault();
  if (!store) { toast('Configure d\'abord l\'accès GitHub, onglet Réglages.'); return; }

  const amount = parseAmount($('f-amount').value);
  if (!Number.isFinite(amount) || amount <= 0) { toast('Montant invalide.'); return; }

  const payload = {
    amount,
    date: $('f-date').value,
    description: $('f-desc').value,
    source: editing ? editing.source : 'manual'
  };

  $('f-submit').disabled = true;
  setSync('envoi…', 'busy');
  try {
    if (editing) {
      await store.update(editing.id, payload);
      toast('Dépense modifiée.');
    } else {
      const { queued } = await store.add(payload);
      toast(queued ? 'Hors ligne : gardée en local, elle repartira plus tard.' : 'Dépense enregistrée.');
    }
    $('sheet-entry').close();
    refreshSync();
    render();
  } catch (err) {
    setSync('erreur', 'err');
    toast(`Échec : ${err.message}`);
  } finally {
    $('f-submit').disabled = false;
  }
}

async function deleteEntry() {
  if (!editing) return;
  if (!confirm(`Supprimer « ${editing.description || 'sans description'} » (${money.format(editing.amount)}) ?`)) return;
  setSync('envoi…', 'busy');
  try {
    await store.remove(editing.id);
    $('sheet-entry').close();
    refreshSync();
    render();
    toast('Dépense supprimée.');
  } catch (err) {
    setSync('erreur', 'err');
    toast(`Suppression impossible : ${err.message}`);
  }
}

// ══════════════════════════════════════ réception du raccourci ═════
/**
 * Formats acceptés dans le FRAGMENT d'URL (jamais transmis au serveur) :
 *   #add?amount=12.34&note=Boulangerie&date=2026-09-08
 *   #add?d=<base64 d'un JSON {amount, note, date}>
 */
function parseIncoming() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash.startsWith('add')) return null;
  const params = new URLSearchParams(hash.slice(hash.indexOf('?') + 1));

  let raw = { amount: params.get('amount'), note: params.get('note'), date: params.get('date') };
  const packed = params.get('d');
  if (packed) {
    try {
      const json = JSON.parse(b64ToUtf8(packed.replace(/-/g, '+').replace(/_/g, '/')));
      raw = { amount: json.amount, note: json.note ?? json.description, date: json.date };
    } catch { return null; }
  }

  const amount = parseAmount(raw.amount ?? '');
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, description: raw.note || '', date: raw.date || todayISO() };
}

async function handleIncoming() {
  const incoming = parseIncoming();
  if (!incoming) return;
  history.replaceState(null, '', location.pathname + location.search);

  const dlg = $('sheet-incoming');
  $('in-amount').textContent = money.format(incoming.amount);
  $('in-desc').value = incoming.description;
  $('in-date').value = incoming.date;
  showView('home');
  dlg.showModal();
  setTimeout(() => $('in-desc').focus(), 120);

  dlg.addEventListener('close', async () => {
    if (dlg.returnValue !== 'save') { toast('Dépense ignorée.'); return; }
    if (!store) { toast('Configure d\'abord l\'accès GitHub, onglet Réglages.'); return; }
    setSync('envoi…', 'busy');
    const { queued } = await store.add({
      amount: incoming.amount,
      description: $('in-desc').value,
      date: $('in-date').value,
      source: 'shortcut'
    });
    refreshSync();
    toast(queued ? 'Hors ligne : gardée en local.' : 'Dépense enregistrée.');
    render();
  }, { once: true });
}

// ════════════════════════════════════════════════════ connexion ════
function refreshSync() {
  const n = store ? store.pending.length : 0;
  if (n) setSync(`${n} en attente`, 'busy');
  else setSync('à jour', 'ok');
}

async function connect(cfg, { silent = false } = {}) {
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    setSync('non configuré', '');
    $('conn-line').textContent = 'Non connecté';
    if (!silent) setStatus('Owner, dépôt et jeton sont obligatoires.', 'err');
    render();
    return false;
  }

  store = new Store(cfg);
  setSync('connexion…', 'busy');
  try {
    const info = await store.gh.check();
    await store.load();
    const flushed = await store.flushPending();
    refreshSync();
    $('conn-line').textContent = `${info.repoFullName} · ${info.login}${cfg.passphrase ? ' · chiffré' : ''}`;
    setStatus('Connecté.', 'ok');
    if (flushed) toast(`${flushed} dépense(s) en attente synchronisée(s).`);
    render();
    return true;
  } catch (err) {
    setSync('erreur', 'err');
    $('conn-line').textContent = 'Erreur de connexion';
    setStatus(err.message, 'err');
    render();
    return false;
  }
}

// ═════════════════════════════════════════════════════════ init ════
function bindControls() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });
  $('sync-chip').addEventListener('click', () => showView('settings'));

  $('fab').addEventListener('click', () => openEntry(null));
  $('entry-form').addEventListener('submit', submitEntry);
  $('f-cancel').addEventListener('click', () => $('sheet-entry').close());
  $('f-delete').addEventListener('click', deleteEntry);

  $('q-text').addEventListener('input', render);
  $('q-clear').addEventListener('click', () => { $('q-text').value = ''; render(); });

  document.querySelectorAll('#segmented button').forEach((btn) => {
    btn.addEventListener('click', () => {
      range = btn.dataset.range;
      document.querySelectorAll('#segmented button').forEach((b) => b.classList.toggle('on', b === btn));
      $('custom-range').hidden = true;
      render();
    });
  });

  $('toggle-custom').addEventListener('click', () => {
    const box = $('custom-range');
    box.hidden = !box.hidden;
    if (!box.hidden) {
      range = 'custom';
      document.querySelectorAll('#segmented button').forEach((b) => b.classList.remove('on'));
      if (!$('q-from').value) {
        const now = new Date();
        $('q-from').value = iso(new Date(now.getFullYear(), now.getMonth(), 1));
        $('q-to').value = todayISO();
      }
    }
    render();
  });
  $('q-from').addEventListener('change', () => { range = 'custom'; render(); });
  $('q-to').addEventListener('change', () => { range = 'custom'; render(); });

  $('btn-save-cfg').addEventListener('click', async () => {
    const next = readConfigForm();
    localStorage.setItem(CFG_KEY, JSON.stringify(next));
    setStatus('Connexion…');
    if (await connect(next)) { showView('home'); toast('Connecté.'); }
  });

  $('btn-reload').addEventListener('click', () => connect(loadConfig()));

  $('btn-forget').addEventListener('click', () => {
    if (!confirm('Effacer le jeton, la passphrase et les réglages de cet appareil ?\n\nLes dépenses déjà poussées sur GitHub sont conservées.')) return;
    localStorage.removeItem(CFG_KEY);
    location.reload();
  });

  window.addEventListener('online', () => {
    if (!store) return;
    store.flushPending().then((n) => { if (n) { refreshSync(); render(); toast(`${n} dépense(s) synchronisée(s).`); } });
  });
  window.addEventListener('hashchange', handleIncoming);
}

function init() {
  const cfg = loadConfig();
  fillConfigForm(cfg);
  bindControls();

  showView('home');
  render();
  connect(cfg, { silent: true }).then(handleIncoming);
  if (!cfg.token) showView('settings');
}

init();
