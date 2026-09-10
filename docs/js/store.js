// spend-money — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
//
// Couche de données : lit/écrit data/expenses.json dans le dépôt privé,
// chiffre optionnellement le contenu, et met en file d'attente locale les
// entrées qui n'ont pas pu être poussées (hors-ligne, jeton expiré…).

import { GitHubStore } from './github.js';
import { encryptJSON, decryptJSON } from './crypto.js';

const PENDING_KEY = 'spend-money.pending';
const EMPTY = { app: 'spend-money', version: 1, encrypted: false, updatedAt: null, items: [] };

export function newId() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
}

/**
 * Lit un montant écrit par un humain ou par Raccourcis : « 12,34 »,
 * « 12.34 », « 10,00 € », « 1 234,56 », espaces insécables compris.
 * Renvoie NaN si rien d'exploitable.
 */
export function parseAmount(value) {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '').replace(/[^\d,.-]/g, '');
  if (!cleaned) return NaN;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized;
  if (lastComma === -1 && lastDot === -1) normalized = cleaned;
  else if (lastComma > lastDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else normalized = cleaned.replace(/,/g, '');

  return Number(normalized);
}

export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export class Store {
  constructor(config) {
    this.config = config;                 // {owner, repo, branch, path, token, passphrase}
    this.gh = new GitHubStore(config);
    this.items = [];
    this.loaded = false;
  }

  // ---- file d'attente locale -------------------------------------------
  get pending() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }
    catch { return []; }
  }
  set pending(list) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  }
  queue(item) {
    this.pending = [...this.pending, item];
  }

  // ---- (dé)sérialisation du fichier ------------------------------------
  async decode(file) {
    if (!file) return [];
    if (file.encrypted) {
      if (!this.config.passphrase) {
        const e = new Error('Données chiffrées : passphrase requise.');
        e.code = 'NEED_PASSPHRASE';
        throw e;
      }
      const payload = await decryptJSON(file.envelope, this.config.passphrase)
        .catch(() => { const e = new Error('Passphrase incorrecte.'); e.code = 'BAD_PASSPHRASE'; throw e; });
      return payload.items || [];
    }
    return file.items || [];
  }

  async encode(items) {
    const base = { app: 'spend-money', version: 1, updatedAt: new Date().toISOString() };
    if (this.config.passphrase) {
      return { ...base, encrypted: true, envelope: await encryptJSON({ items }, this.config.passphrase) };
    }
    return { ...base, encrypted: false, items };
  }

  // ---- lecture ----------------------------------------------------------
  async load() {
    const file = await this.gh.read();
    this.items = await this.decode(file || EMPTY);
    this.loaded = true;
    return this.items;
  }

  /**
   * Applique une mutation sur la liste et pousse le résultat.
   * Relit et rejoue en cas de conflit (écriture concurrente).
   */
  async commit(mutate, message) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const items = this.items.slice();
      const next = mutate(items) || items;
      try {
        const encoded = await this.encode(next);
        const sha = await this.gh.write(encoded, message);
        this.items = next;
        return sha;
      } catch (err) {
        if (err.code === 'CONFLICT' && attempt < 2) {
          const file = await this.gh.read();
          this.items = await this.decode(file || EMPTY);
          continue;
        }
        throw err;
      }
    }
  }

  sanitize(input) {
    const amount = Math.round(parseAmount(input.amount) * 100) / 100;
    // 0 est accepté : une entrée peut arriver du raccourci sans montant
    // exploitable, à compléter dans l'app.
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Montant invalide.');
    return {
      id: input.id || newId(),
      amount,
      description: String(input.description || '').trim(),
      date: input.date || todayISO(),
      createdAt: input.createdAt || new Date().toISOString(),
      source: input.source || 'manual'
    };
  }

  async add(input) {
    const item = this.sanitize(input);
    try {
      await this.commit(
        (items) => [item, ...items],
        `feat(data): dépense ${item.amount} — ${item.description || 'sans description'}`
      );
      return { item, queued: false };
    } catch (err) {
      this.queue(item);
      this.items = [item, ...this.items];
      return { item, queued: true, error: err };
    }
  }

  async update(id, patch) {
    const item = this.sanitize({ ...this.items.find((i) => i.id === id), ...patch, id });
    await this.commit(
      (items) => items.map((i) => (i.id === id ? item : i)),
      `fix(data): modification dépense ${id.slice(0, 8)}`
    );
    return item;
  }

  async remove(id) {
    await this.commit(
      (items) => items.filter((i) => i.id !== id),
      `chore(data): suppression dépense ${id.slice(0, 8)}`
    );
  }

  /**
   * Relève la boîte de réception : les fichiers déposés par le raccourci
   * iOS dans inbox/ sont intégrés à la liste, puis supprimés du dépôt.
   * Un fichier illisible est laissé en place plutôt que perdu.
   * Renvoie {added, skipped}.
   */
  async drainInbox(dir = 'inbox') {
    const files = await this.gh.listJsonFilesDeep(dir);
    if (!files.length) return { added: 0, skipped: 0 };

    const items = [];
    const collected = [];
    let skipped = 0;
    for (const file of files) {
      try {
        const { json, sha } = await this.gh.readAt(file.path);
        const amount = parseAmount(json.amount);
        if (!Number.isFinite(amount) || amount < 0) { skipped++; continue; }
        items.push(this.sanitize({
          amount,
          description: json.description ?? json.note ?? '',
          date: json.date,
          createdAt: json.createdAt,
          source: json.source || 'shortcut'
        }));
        collected.push({ path: file.path, sha });
      } catch { skipped++; /* fichier illisible : on n'y touche pas */ }
    }
    if (!items.length) return { added: 0, skipped };

    await this.commit(
      (list) => [...items, ...list].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)),
      `feat(data): ${items.length} dépense(s) reçue(s) du raccourci`
    );

    for (const file of collected) {
      try { await this.gh.deleteAt(file.path, file.sha, 'chore(inbox): entrée intégrée'); }
      catch { /* la prochaine relève réessaiera */ }
    }
    return { added: items.length, skipped };
  }

  /** Renvoie le nombre d'entrées poussées. */
  async flushPending() {
    const queued = this.pending;
    if (!queued.length) return 0;
    const known = new Set(this.items.map((i) => i.id));
    const toAdd = queued.filter((i) => !known.has(i.id));
    await this.commit(
      (items) => [...toAdd, ...items].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)),
      `feat(data): synchronisation de ${queued.length} dépense(s) en attente`
    );
    this.pending = [];
    return queued.length;
  }
}
