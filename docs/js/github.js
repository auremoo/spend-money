// spend-money — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
//
// Client minimal de l'API GitHub Contents.
// Le jeton (PAT fine-grained, permission "Contents: Read and write" sur ce
// seul dépôt) est stocké dans le localStorage du navigateur uniquement.

import { utf8ToB64, b64ToUtf8 } from './crypto.js';

const API = 'https://api.github.com';

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
}

export class GitHubStore {
  constructor({ owner, repo, branch, path, token }) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch || 'main';
    this.path = path || 'data/expenses.json';
    this.token = token;
    this.sha = null;
  }

  get url() {
    return `${API}/repos/${this.owner}/${this.repo}/contents/${encodeURI(this.path)}`;
  }

  /** Vérifie le jeton et l'accès au dépôt. Renvoie {login, repoFullName}. */
  async check() {
    const me = await fetch(`${API}/user`, { headers: headers(this.token) });
    if (!me.ok) throw new Error(`Jeton refusé (HTTP ${me.status}). Vérifie le PAT.`);
    const user = await me.json();
    const r = await fetch(`${API}/repos/${this.owner}/${this.repo}`, { headers: headers(this.token) });
    if (!r.ok) throw new Error(`Dépôt inaccessible (HTTP ${r.status}). Vérifie owner/repo et les permissions du jeton.`);
    const repo = await r.json();
    return { login: user.login, repoFullName: repo.full_name, defaultBranch: repo.default_branch };
  }

  /** Lit le fichier de données. Renvoie null s'il n'existe pas encore. */
  async read() {
    const res = await fetch(`${this.url}?ref=${encodeURIComponent(this.branch)}&t=${Date.now()}`, {
      headers: headers(this.token),
      cache: 'no-store'
    });
    if (res.status === 404) { this.sha = null; return null; }
    if (!res.ok) throw new Error(`Lecture impossible (HTTP ${res.status}).`);
    const json = await res.json();
    this.sha = json.sha;
    const raw = b64ToUtf8(json.content.replace(/\n/g, ''));
    return JSON.parse(raw);
  }

  /** Liste les fichiers .json d'un dossier. Dossier absent = liste vide. */
  async listDir(dir) {
    const url = `${API}/repos/${this.owner}/${this.repo}/contents/${encodeURI(dir)}`;
    const res = await fetch(`${url}?ref=${encodeURIComponent(this.branch)}&t=${Date.now()}`, {
      headers: headers(this.token),
      cache: 'no-store'
    });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Lecture du dossier ${dir} impossible (HTTP ${res.status}).`);
    const json = await res.json();
    if (!Array.isArray(json)) return [];
    return json.filter((e) => e.type === 'file' && e.name.endsWith('.json'));
  }

  /** Lit un fichier JSON quelconque du dépôt. Renvoie {json, sha}. */
  async readAt(path) {
    const url = `${API}/repos/${this.owner}/${this.repo}/contents/${encodeURI(path)}`;
    const res = await fetch(`${url}?ref=${encodeURIComponent(this.branch)}&t=${Date.now()}`, {
      headers: headers(this.token),
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`Lecture de ${path} impossible (HTTP ${res.status}).`);
    const meta = await res.json();
    return { json: JSON.parse(b64ToUtf8(meta.content.replace(/\n/g, ''))), sha: meta.sha };
  }

  /** Supprime un fichier du dépôt. */
  async deleteAt(path, sha, message) {
    const url = `${API}/repos/${this.owner}/${this.repo}/contents/${encodeURI(path)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: headers(this.token),
      body: JSON.stringify({ message: message || `chore: suppression de ${path}`, sha, branch: this.branch })
    });
    if (!res.ok) throw new Error(`Suppression de ${path} impossible (HTTP ${res.status}).`);
  }

  /** Écrit le fichier de données (création ou mise à jour). */
  async write(obj, message) {
    const body = {
      message: message || 'chore(data): mise à jour des dépenses',
      content: utf8ToB64(JSON.stringify(obj, null, 2) + '\n'),
      branch: this.branch
    };
    if (this.sha) body.sha = this.sha;

    let res = await fetch(this.url, {
      method: 'PUT',
      headers: headers(this.token),
      body: JSON.stringify(body)
    });

    // Conflit de sha (écriture concurrente depuis un autre appareil) :
    // on relit et on retente une fois.
    if (res.status === 409 || res.status === 422) {
      const conflict = new Error('CONFLICT');
      conflict.code = 'CONFLICT';
      throw conflict;
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Écriture impossible (HTTP ${res.status}) : ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    this.sha = json.content.sha;
    return json.commit.sha;
  }
}
