<!-- spend-money — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT -->

# spend-money

> Créé par Aurélien Moote - Moo - 2026. Logiciel libre (licence MIT) :
> réutilisable à condition de conserver la mention de l'auteur.

Suivi des dépenses par carte bancaire. Une web app **entièrement statique**
servie par GitHub Pages, dont les données sont stockées dans ce dépôt
**privé** sous forme d'un simple fichier JSON versionné. Aucun serveur,
aucune base de données, aucun service tiers à héberger ou à payer.

## Ce que ça fait

- **Capture Apple Pay** — un raccourci iOS ouvre l'app avec le montant ;
  l'app affiche une fenêtre pour saisir la description pendant que tu t'en
  souviens encore, puis commite l'entrée.
- **Saisie manuelle** — pour les paiements par carte physique, avec choix
  libre de la date.
- **Filtres** — par nom/description (recherche texte) et par plage de dates,
  avec raccourcis « ce mois-ci », « mois dernier », « 30 derniers jours »,
  « cette année ». Total et nombre d'entrées recalculés en direct.
- **Édition et suppression** de n'importe quelle entrée.
- **Chiffrement optionnel au repos** — AES-GCM 256 / PBKDF2-SHA256, clé
  dérivée d'une passphrase qui ne quitte jamais ton navigateur.
- **File d'attente hors-ligne** — une dépense saisie sans réseau est gardée
  localement et poussée à la reconnexion.

## Comment ça marche

```
Apple Pay
   │
   ▼
Raccourci iOS ──► https://<owner>.github.io/spend-money/#add?amount=12.34
   │                                                     └── fragment :
   │                                                         jamais envoyé
   │                                                         au serveur
   ▼
Page statique (GitHub Pages, docs/)
   │  saisie de la description + date
   │  chiffrement optionnel (WebCrypto)
   ▼
API GitHub Contents ──► commit sur data/expenses.json (dépôt privé)
```

Le dossier `docs/` est le seul publié par Pages. `data/expenses.json` est à
la racine : il n'est **jamais** servi par le site.

## Démarrage

1. **Settings → Pages** : déployer depuis la branche par défaut, dossier
   `/docs`.
2. Créer un **fine-grained PAT** limité à ce dépôt, permission
   `Contents: Read and write`.
3. Ouvrir l'app, bouton **⚙**, renseigner owner / dépôt / branche / jeton
   (et une passphrase si tu veux le chiffrement).
4. Créer le raccourci iOS.

Détails : [`guide/INSTALLATION.md`](guide/INSTALLATION.md).

> ⚠️ Publier des Pages depuis un dépôt **privé** nécessite un plan GitHub
> payant, et le site publié reste public dans tous les cas. Ce que ça
> implique — et les alternatives — sont expliqués dans
> [`guide/INSTALLATION.md`](guide/INSTALLATION.md).

## Documentation

| Fichier | Contenu |
|---|---|
| [`guide/INSTALLATION.md`](guide/INSTALLATION.md) | Pages, jeton, configuration |
| [`guide/RACCOURCI-IOS.md`](guide/RACCOURCI-IOS.md) | Format d'URL et construction du raccourci |
| [`guide/SECURITE.md`](guide/SECURITE.md) | Ce qui est chiffré, ce qui ne l'est pas, et pourquoi |

## Icône

Le dépôt ne contient pas d'icône : elle se génère. Le script produit le
prompt à coller dans ChatGPT (contrainte explicite : **aucun coin arrondi**).

```bash
./scripts/icon-prompt.sh            # affiche le prompt
./scripts/icon-prompt.sh --copy     # copie dans le presse-papiers
./scripts/icon-prompt.sh -v 2       # variante de style (1 à 3)
```

Enregistre l'image obtenue sous `docs/icon.png` (1024×1024, PNG).

## Structure

```
docs/                 site publié par GitHub Pages
  index.html          interface
  css/style.css       styles (thème clair/sombre automatique)
  js/app.js           logique d'interface, filtres, réception du raccourci
  js/store.js         modèle de données, file d'attente, résolution de conflits
  js/github.js        client de l'API GitHub Contents
  js/crypto.js        AES-GCM + PBKDF2 (WebCrypto)
data/expenses.json    les dépenses (non publié par Pages)
guide/                documentation
scripts/              générateur de prompt d'icône
```

## Format des données

```json
{
  "app": "spend-money",
  "version": 1,
  "encrypted": false,
  "updatedAt": "2026-09-08T10:12:00.000Z",
  "items": [
    {
      "id": "…",
      "amount": 12.34,
      "description": "Boulangerie",
      "date": "2026-09-08",
      "createdAt": "2026-09-08T10:12:00.000Z",
      "source": "shortcut"
    }
  ]
}
```

Chiffré, `items` est remplacé par `envelope` (`{alg, kdf, iv, ciphertext}`)
et `encrypted` passe à `true`. Dans les deux cas, tout est du JSON dans git :
l'historique complet de tes dépenses est versionné et exportable.

## Développement local

```bash
npm run serve   # ou : python3 -m http.server 8080 --directory docs
```

L'app fonctionne à l'identique en local — le stockage passe toujours par
l'API GitHub. Un module ES est utilisé, il faut donc un vrai serveur HTTP
(pas d'ouverture en `file://`).

## Auteur & licence

Créé par **Aurélien Moote - Moo - 2026**.

Logiciel libre sous licence **MIT** (voir [`LICENSE`](LICENSE)) : réutilisable,
modifiable et redistribuable à condition de conserver la mention de l'auteur.

Voir aussi [`NOTICE`](NOTICE) et [`AUTHORS`](AUTHORS).
