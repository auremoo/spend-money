<!-- spend-money — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT -->

# spend-money

> Créé par Aurélien Moote - Moo - 2026. Logiciel libre (licence MIT) :
> réutilisable à condition de conserver la mention de l'auteur.

Suivi des dépenses par carte bancaire. Une web app **entièrement statique**
servie par GitHub Pages, dont les données sont stockées dans ce dépôt
**privé** sous forme d'un simple fichier JSON versionné. Aucun serveur,
aucune base de données, aucun service tiers à héberger ou à payer.

## Ce que ça fait

- **Capture Apple Pay** — deux méthodes au choix : un raccourci iOS ouvre
  l'app avec le montant et tu saisis la description dans une feuille
  dédiée ; ou le raccourci écrit directement dans le dépôt, sans ouvrir de
  navigateur, et l'app relève la boîte de réception à son ouverture.
- **Saisie manuelle** — pour les paiements par carte physique, avec choix
  libre de la date.
- **Filtres** — recherche par nom/description et sélecteur de période
  (mois en cours, mois précédent, 30 jours, année, tout, ou plage
  personnalisée). Total, moyenne par jour et graphe quotidien recalculés
  en direct.
- **Édition et suppression** — touche une dépense dans la liste.
- **Chiffrement optionnel au repos** — AES-GCM 256 / PBKDF2-SHA256, clé
  dérivée d'une passphrase qui ne quitte jamais ton navigateur.
- **File d'attente hors-ligne** — une dépense saisie sans réseau est gardée
  localement et poussée à la reconnexion.

## Comment ça marche

```
Apple Pay
   │
   ▼
Raccourci iOS ──► https://<owner>.github.io/spend-money/#amount=12.34
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
3. Ouvrir l'app, onglet **Réglages**, renseigner owner / dépôt / branche / jeton
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
| [`guide/RACCOURCI-IOS.md`](guide/RACCOURCI-IOS.md) | Raccourci par URL : format et construction |
| [`guide/RACCOURCI-DIRECT.md`](guide/RACCOURCI-DIRECT.md) | Raccourci en arrière-plan, sans ouvrir Safari |
| [`guide/SECURITE.md`](guide/SECURITE.md) | Ce qui est chiffré, ce qui ne l'est pas, et pourquoi |
| [`guide/ICONE.md`](guide/ICONE.md) | Prompt d'icône et dépôt du fichier |

## Icône

Le prompt à donner à ChatGPT (contrainte explicite : **aucun coin arrondi**)
et la marche à suivre pour déposer le fichier sont dans
[`guide/ICONE.md`](guide/ICONE.md). L'image finale va dans `docs/icon.png`.

En attendant, l'app affiche son logo vectoriel interne
(`docs/img/logo.svg`) : un « € » dont le montant droit devient une flèche
descendante.

## Structure

```
docs/                 site publié par GitHub Pages
  index.html          interface
  css/style.css       styles (thème clair/sombre automatique)
  img/logo.svg        symbole vectoriel utilisé dans l'app
  js/app.js           vues, filtres, feuilles, réception du raccourci
  js/store.js         modèle de données, file d'attente, résolution de conflits
  js/github.js        client de l'API GitHub Contents
  js/crypto.js        AES-GCM + PBKDF2 (WebCrypto)
data/expenses.json    les dépenses (non publié par Pages)
inbox/                boîte de réception du raccourci direct, vidée à l'ouverture
guide/                documentation
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
