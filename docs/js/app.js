// spend-money — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
//
// Suivi des dépenses carte. Point d'entrée de l'application.
// Les données vivent dans un dépôt GitHub privé ; cette page est
// entièrement statique (GitHub Pages), aucun serveur intermédiaire.

import { Store, todayISO } from './store.js';
import { b64ToUtf8 } from './crypto.js';

const CFG_KEY = 'spend-money.config';
const $ = (id) => document.getElementById(id);

const els = {
  syncBadge: $('sync-badge'),
  settings: $('settings'),
  btnSettings: $('btn-settings'),
  cfg: {
    owner: $('cfg-owner'), repo: $('cfg-repo'), branch: $('cfg-branch'),
    path: $('cfg-path'), token: $('cfg-token'), pass: $('cfg-pass'),
    status: $('cfg-status')
  },
  form: $('entry-form'),
  f: { id: $('f-id'), amount: $('f-amount'), date: $('f-date'), desc: $('f-desc'), submit: $('f-submit'), cancel: $('f-cancel'), title: $('form-title') },
  q: { text: $('q-text'), from: $('q-from'), to: $('q-to') },
  totalFiltered: $('total-filtered'),
  countFiltered: $('count-filtered'),
  list: $('list'),
  listEmpty: $('list-empty'),
  btnReload: $('btn-reload'),
  toast: $('toast'),
  dlg: $('incoming'),
  in: { amount: $('in-amount'), desc: $('in-desc'), date: $('in-date') }
};

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

let store = null;
let editingId = null;

// ---------------------------------------------------------------- config
function guessRepo() {
  // Sur https://<owner>.github.io/<repo>/ on devine owner et repo.
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
  const seg = location.pathname.split('/').filter(Boolean);
  return { owner: m ? m[1] : '', repo: m && seg.length ? seg[0] : '' };
}

function loadConfig() {
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch { cfg = {}; }
  const guess = guessRepo();
  return {
    owner: cfg.owner || guess.owner,
    repo: cfg.repo || guess.repo || 'spend-money',
    branch: cfg.branch || 'main',
    path: cfg.path || 'data/expenses.json',
    token: cfg.token || '',
    passphrase: cfg.passphrase || ''
  };
}

function saveConfig(cfg) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

function fillConfigForm(cfg) {
  els.cfg.owner.value = cfg.owner;
  els.cfg.repo.value = cfg.repo;
  els.cfg.branch.value = cfg.branch;
  els.cfg.path.value = cfg.path;
  els.cfg.token.value = cfg.token;
  els.cfg.pass.value = cfg.passphrase;
}

function readConfigForm() {
  return {
    owner: els.cfg.owner.value.trim(),
    repo: els.cfg.repo.value.trim(),
    branch: els.cfg.branch.value.trim() || 'main',
    path: els.cfg.path.value.trim() || 'data/expenses.json',
    token: els.cfg.token.value.trim(),
    passphrase: els.cfg.pass.value
  };
}

// ------------------------------------------------------------------ UI
function setBadge(text, kind) {
  els.syncBadge.textContent = text;
  els.syncBadge.className = `badge badge-${kind}`;
}

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3200);
}

function status(msg, kind = '') {
  els.cfg.status.textContent = msg;
  els.cfg.status.className = `status ${kind}`;
}

// ------------------------------------------------------------- filtrage
function filtered() {
  if (!store) return [];
  const q = els.q.text.value.trim().toLowerCase();
  const from = els.q.from.value;
  const to = els.q.to.value;
  return store.items
    .filter((i) => (!q || i.description.toLowerCase().includes(q)))
    .filter((i) => (!from || i.date >= from))
    .filter((i) => (!to || i.date <= to))
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
}

function render() {
  const items = filtered();
  const total = items.reduce((s, i) => s + i.amount, 0);
  els.totalFiltered.textContent = money.format(total);
  els.countFiltered.textContent = String(items.length);

  els.list.innerHTML = '';
  els.listEmpty.hidden = items.length > 0;

  const queuedIds = new Set(store ? store.pending.map((i) => i.id) : []);
  let currentDay = null;

  for (const item of items) {
    if (item.date !== currentDay) {
      currentDay = item.date;
      const sep = document.createElement('li');
      sep.className = 'day-sep';
      sep.textContent = longDate.format(new Date(`${item.date}T12:00:00`));
      els.list.appendChild(sep);
    }

    const li = document.createElement('li');
    li.className = 'item' + (queuedIds.has(item.id) ? ' queued' : '');

    const main = document.createElement('div');
    main.className = 'item-main';
    const desc = document.createElement('span');
    desc.className = 'item-desc';
    desc.textContent = item.description || '(sans description)';
    const meta = document.createElement('span');
    meta.className = 'item-meta';
    meta.textContent = item.source === 'shortcut' ? 'Apple Pay' : 'saisie manuelle';
    if (queuedIds.has(item.id)) meta.textContent += ' · en attente de synchro';
    main.append(desc, meta);

    const amount = document.createElement('span');
    amount.className = 'item-amount';
    amount.textContent = money.format(item.amount);

    const actions = document.createElement('div');
    actions.className = 'item-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Éditer';
    edit.addEventListener('click', () => startEdit(item));
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = 'Suppr.';
    del.addEventListener('click', () => removeItem(item));
    actions.append(edit, del);

    li.append(main, amount, actions);
    els.list.appendChild(li);
  }
}

// -------------------------------------------------------------- actions
function startEdit(item) {
  editingId = item.id;
  els.f.id.value = item.id;
  els.f.amount.value = item.amount;
  els.f.date.value = item.date;
  els.f.desc.value = item.description;
  els.f.title.textContent = 'Modifier la dépense';
  els.f.submit.textContent = 'Enregistrer';
  els.f.cancel.hidden = false;
  els.f.amount.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  editingId = null;
  els.form.reset();
  els.f.id.value = '';
  els.f.date.value = todayISO();
  els.f.title.textContent = 'Ajouter une dépense';
  els.f.submit.textContent = 'Ajouter';
  els.f.cancel.hidden = true;
}

async function removeItem(item) {
  if (!confirm(`Supprimer « ${item.description || 'sans description'} » (${money.format(item.amount)}) ?`)) return;
  try {
    setBadge('envoi…', 'busy');
    await store.remove(item.id);
    setBadge('synchronisé', 'ok');
    render();
    toast('Dépense supprimée.');
  } catch (err) {
    setBadge('erreur', 'err');
    toast(`Suppression impossible : ${err.message}`);
  }
}

async function submitForm(ev) {
  ev.preventDefault();
  if (!store) { toast('Configure d\'abord l\'accès GitHub (⚙).'); return; }
  const payload = {
    amount: els.f.amount.value,
    date: els.f.date.value,
    description: els.f.desc.value,
    source: 'manual'
  };
  els.f.submit.disabled = true;
  setBadge('envoi…', 'busy');
  try {
    if (editingId) {
      await store.update(editingId, payload);
      toast('Dépense modifiée.');
    } else {
      const { queued } = await store.add(payload);
      toast(queued ? 'Hors ligne : mise en file d\'attente locale.' : 'Dépense enregistrée sur GitHub.');
    }
    setBadge(store.pending.length ? `${store.pending.length} en attente` : 'synchronisé', store.pending.length ? 'busy' : 'ok');
    resetForm();
    render();
  } catch (err) {
    setBadge('erreur', 'err');
    toast(`Échec : ${err.message}`);
  } finally {
    els.f.submit.disabled = false;
  }
}

// ------------------------------------------ entrée depuis le raccourci
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

  const amount = Number(String(raw.amount ?? '').replace(',', '.').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(amount) || amount === 0) return null;
  return { amount, description: raw.note || '', date: raw.date || todayISO() };
}

function clearHash() {
  history.replaceState(null, '', location.pathname + location.search);
}

async function handleIncoming() {
  const incoming = parseIncoming();
  if (!incoming) return;
  clearHash();

  els.in.amount.textContent = money.format(incoming.amount);
  els.in.desc.value = incoming.description;
  els.in.date.value = incoming.date;
  els.dlg.showModal();
  els.in.desc.focus();

  els.dlg.addEventListener('close', async () => {
    if (els.dlg.returnValue !== 'save') { toast('Dépense ignorée.'); return; }
    if (!store) { toast('Configure d\'abord l\'accès GitHub (⚙).'); return; }
    setBadge('envoi…', 'busy');
    const { queued } = await store.add({
      amount: incoming.amount,
      description: els.in.desc.value,
      date: els.in.date.value,
      source: 'shortcut'
    });
    setBadge(queued ? `${store.pending.length} en attente` : 'synchronisé', queued ? 'busy' : 'ok');
    toast(queued ? 'Hors ligne : conservé localement.' : 'Dépense enregistrée.');
    render();
  }, { once: true });
}

// ------------------------------------------------------------ connexion
async function connect(cfg, { silent = false } = {}) {
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    setBadge('non configuré', 'idle');
    if (!silent) status('Owner, dépôt et jeton sont obligatoires.', 'err');
    els.settings.hidden = false;
    return false;
  }
  store = new Store(cfg);
  setBadge('connexion…', 'busy');
  try {
    const info = await store.gh.check();
    await store.load();
    const n = await store.flushPending();
    setBadge('synchronisé', 'ok');
    status(`Connecté à ${info.repoFullName} en tant que ${info.login}.`, 'ok');
    if (n) toast(`${n} dépense(s) en attente synchronisée(s).`);
    render();
    return true;
  } catch (err) {
    setBadge('erreur', 'err');
    status(err.message, 'err');
    if (err.code === 'NEED_PASSPHRASE' || err.code === 'BAD_PASSPHRASE') els.settings.hidden = false;
    render();
    return false;
  }
}

// -------------------------------------------------------- initialisation
function bindFilters() {
  ['input', 'change'].forEach((ev) => {
    els.q.text.addEventListener(ev, render);
    els.q.from.addEventListener(ev, render);
    els.q.to.addEventListener(ev, render);
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const now = new Date();
      const p = (n) => String(n).padStart(2, '0');
      const first = (y, m) => `${y}-${p(m + 1)}-01`;
      const last = (y, m) => todayISO(new Date(y, m + 1, 0));
      switch (chip.dataset.range) {
        case 'month':
          els.q.from.value = first(now.getFullYear(), now.getMonth());
          els.q.to.value = last(now.getFullYear(), now.getMonth());
          break;
        case 'prev-month': {
          const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          els.q.from.value = first(d.getFullYear(), d.getMonth());
          els.q.to.value = last(d.getFullYear(), d.getMonth());
          break;
        }
        case '30': {
          const d = new Date(now); d.setDate(d.getDate() - 29);
          els.q.from.value = todayISO(d);
          els.q.to.value = todayISO(now);
          break;
        }
        case 'year':
          els.q.from.value = `${now.getFullYear()}-01-01`;
          els.q.to.value = `${now.getFullYear()}-12-31`;
          break;
        default:
          els.q.text.value = ''; els.q.from.value = ''; els.q.to.value = '';
      }
      render();
    });
  });
}

function init() {
  const cfg = loadConfig();
  fillConfigForm(cfg);
  resetForm();
  bindFilters();

  els.btnSettings.addEventListener('click', () => { els.settings.hidden = !els.settings.hidden; });
  els.form.addEventListener('submit', submitForm);
  els.f.cancel.addEventListener('click', resetForm);
  els.btnReload.addEventListener('click', () => connect(loadConfig()));

  els.$saveCfg = $('btn-save-cfg');
  els.$saveCfg.addEventListener('click', async () => {
    const next = readConfigForm();
    saveConfig(next);
    if (await connect(next)) els.settings.hidden = true;
  });

  $('btn-forget').addEventListener('click', () => {
    if (!confirm('Effacer le jeton, la passphrase et les réglages de cet appareil ?\n(Les dépenses déjà poussées sur GitHub sont conservées.)')) return;
    localStorage.removeItem(CFG_KEY);
    location.reload();
  });

  window.addEventListener('online', () => { if (store) store.flushPending().then((n) => { if (n) { render(); toast(`${n} dépense(s) synchronisée(s).`); } }); });
  window.addEventListener('hashchange', handleIncoming);

  connect(cfg, { silent: true }).then(handleIncoming);
}

init();
