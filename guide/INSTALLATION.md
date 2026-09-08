# Installation

## 1. Activer GitHub Pages

Dans le dépôt : **Settings → Pages**

- Source : `Deploy from a branch`
- Branch : `main` (ou ta branche par défaut) — dossier **`/docs`**

⚠️ Le dossier `/docs` est publié, **le reste du dépôt ne l'est pas**.
C'est volontaire : `data/expenses.json` est à la racine, donc il n'est
**jamais** servi par le site public. Ne déplace pas ce fichier dans `docs/`.

⚠️ Deux limites de GitHub à connaître (état de mes connaissances, vérifie sur
ton compte) :

- Publier des Pages depuis un dépôt **privé** demande un plan payant
  (GitHub Pro / Team). Sur un compte gratuit, Pages n'est disponible que
  pour les dépôts publics.
- Même depuis un dépôt privé, le **site publié est public** (les Pages
  privées avec contrôle d'accès sont une fonctionnalité Enterprise Cloud).

Autrement dit : le **code** de l'app peut rester privé, mais l'URL de l'app
est devinable par n'importe qui. C'est sans danger : la page ne contient
aucune donnée, elle ne sait rien sans ton jeton. Tes dépenses, elles,
restent dans le dépôt privé.

Si ton compte est gratuit, deux options :
1. rendre le dépôt public **et** activer le chiffrement (passphrase) pour
   que `data/expenses.json` soit illisible ;
2. héberger la page ailleurs (Netlify, Cloudflare Pages, ou simplement
   ouvrir `docs/index.html` en local) — le stockage GitHub continue de
   fonctionner à l'identique.

## 2. Créer le jeton d'accès

**GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token**

- Repository access : **Only select repositories** → `spend-money`
- Permissions → Repository permissions → **Contents : Read and write**
- Expiration : à toi de voir (il faudra le renouveler)

Copie le jeton (`github_pat_…`). Il ne sera plus jamais affiché.

## 3. Configurer l'app

Ouvre le site, clique sur **⚙**, renseigne :

| Champ | Valeur |
|---|---|
| Owner | `auremoo` |
| Dépôt | `spend-money` |
| Branche | `main` |
| Chemin | `data/expenses.json` |
| Jeton | le PAT copié |
| Passphrase | optionnelle, mais recommandée |

Puis **Enregistrer & connecter**.

Le jeton et la passphrase sont stockés dans le `localStorage` de ce
navigateur uniquement. Ils ne sont jamais écrits dans le dépôt, jamais
envoyés ailleurs qu'à `api.github.com`.

Sur iPhone : **Partager → Sur l'écran d'accueil** pour avoir une vraie icône
et le mode plein écran.

## 4. À propos de la passphrase

- Vide → `data/expenses.json` contient tes dépenses en clair (lisible dans
  l'historique GitHub, pratique pour faire un export).
- Renseignée → le fichier ne contient qu'un blob AES-GCM 256 bits (clé
  dérivée par PBKDF2-SHA256, 250 000 itérations).

**Si tu perds la passphrase, les données sont irrécupérables.** Il n'y a
aucun mécanisme de récupération, c'est le principe. Note-la dans ton
gestionnaire de mots de passe.

Changer d'avis plus tard fonctionne : ajoute ou retire la passphrase dans
les réglages, la prochaine écriture réencode le fichier entier. En
revanche, **l'historique git garde les anciennes versions** : si tu passes
du clair au chiffré, les anciens commits contiennent toujours le clair.
Choisis dès le départ si tu peux.
