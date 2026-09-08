# Raccourci en arrière-plan (sans ouvrir Safari)

Le raccourci écrit **directement dans GitHub**. Aucun navigateur ne
s'ouvre, rien ne s'affiche : tu tapes le montant, la description, et c'est
enregistré.

## Pourquoi ça ne pouvait pas passer par la page

GitHub Pages ne sert que des fichiers statiques. Il n'exécute aucun code
côté serveur, ne reçoit rien, n'enregistre rien. Envoyer une requête à
`auremoo.github.io/spend-money/` en arrière-plan ne déclenche
**strictement rien** : tout le traitement est dans le JavaScript de la
page, donc il faut un navigateur pour l'exécuter.

La seule voie sans navigateur, c'est de parler à l'API GitHub. C'est ce
que fait ce raccourci — exactement comme l'app, mais depuis Raccourcis.

## Le principe : une boîte de réception

Le raccourci ne touche pas à `data/expenses.json` (il faudrait le lire, le
décoder, le modifier, gérer les conflits — dix actions de plus). Il dépose
**un petit fichier par dépense** dans `inbox/` :

```
inbox/20260908-101500.json   {"amount":12.40,"description":"Boulangerie","date":"2026-09-08"}
```

Une seule requête, aucune lecture préalable, aucun conflit possible.

À la prochaine ouverture de l'app, celle-ci relève la boîte : elle intègre
les fichiers à la liste principale, puis les supprime. Tu n'as rien à
faire. Un fichier illisible est laissé en place plutôt que perdu.

`inbox/` est à la racine du dépôt, donc **hors du dossier publié par
Pages** : son contenu n'est jamais servi par le site.

## Construire le raccourci

Il te faut le même **fine-grained PAT** que dans l'app (`Contents : Read
and write` sur ce seul dépôt).

1. **Demander une entrée** — Type **Nombre** — « Montant payé ? »
2. **Demander une entrée** — Type **Texte** — « C'était quoi ? »
3. **Date** (action « Date », donne la date actuelle)
4. **Formater la date** — format personnalisé `yyyy-MM-dd`
   → c'est la date de la dépense
5. **Formater la date** (seconde fois, sur la même date) — format
   personnalisé `yyyyMMdd-HHmmss`
   → c'est le nom du fichier, il doit être unique
6. **Dictionnaire** — trois clés :
   | Clé | Valeur |
   |---|---|
   | `amount` | la variable de l'étape 1 |
   | `description` | la variable de l'étape 2 |
   | `date` | la variable de l'étape 4 |
7. **Obtenir le texte de l'entrée** (sur le dictionnaire) → produit le JSON
8. **Encoder en Base64** — ⚠️ désactive l'option **sauts de ligne**
9. **Obtenir le contenu de l'URL** :
   - URL :
     `https://api.github.com/repos/auremoo/spend-money/contents/inbox/[étape 5].json`
   - Méthode : **PUT**
   - En-têtes :
     | Clé | Valeur |
     |---|---|
     | `Authorization` | `Bearer github_pat_…` |
     | `Accept` | `application/vnd.github+json` |
   - Corps de la requête : **JSON**
     | Clé | Type | Valeur |
     |---|---|---|
     | `message` | Texte | `feat(inbox): dépense` |
     | `content` | Texte | la variable de l'étape 8 |

Ajoute le raccourci à l'écran d'accueil. Aucun affichage, aucun Safari.

### Ce que je ne garantis pas

Je n'ai pas d'iPhone pour dérouler ces étapes. Deux points à vérifier chez
toi :

- **L'étape 7.** « Obtenir le texte de l'entrée » appliqué à un
  dictionnaire devrait produire du JSON valide, avec l'échappement correct
  des guillemets et des accents. Si le libellé de l'action diffère sur ta
  version d'iOS, cherche une action qui convertit un dictionnaire en texte.
- **L'option sauts de ligne** de l'encodage Base64. Si l'API répond une
  erreur, c'est le premier suspect.

**Repli si l'étape 6-7 coince :** remplace-les par une action **Texte**
contenant littéralement

```
{"amount":[étape 1],"description":"[étape 2]","date":"[étape 4]"}
```

Ça marche, mais une description contenant un guillemet `"` casse le JSON.
Le dictionnaire évite ce piège, c'est pour ça que je le préfère.

### Vérifier que ça marche

Lance le raccourci une fois. Va sur GitHub, dossier `inbox/` : le fichier
doit y être. Ouvre l'app : la dépense apparaît dans la liste et le fichier
disparaît de `inbox/`.

Si l'API refuse, l'erreur la plus fréquente est un **403** (le jeton n'a
pas la permission `Contents: Read and write`, ou n'est pas autorisé sur ce
dépôt) ou un **404** (owner/repo mal orthographié dans l'URL).

## Les trois compromis, dits franchement

**1. Ton jeton GitHub est en clair dans le raccourci.** Quiconque a ton
iPhone déverrouillé et ouvre le raccourci peut le lire. C'est inévitable :
Raccourcis n'a pas de coffre-fort. Utilise un jeton dédié, limité à ce
dépôt, avec une date d'expiration, et révoque-le au moindre doute.

**2. Ça casse en partie le chiffrement.** Le raccourci ne sait pas faire
d'AES. Les fichiers de `inbox/` sont donc en clair, et **l'historique git
les conserve même après leur suppression**. Concrètement : `expenses.json`
reste chiffré, mais chaque dépense passée par le raccourci laisse une
trace lisible dans l'historique du dépôt. Si le chiffrement compte
vraiment pour toi, garde la méthode par URL (`guide/RACCOURCI-IOS.md`),
qui ne stocke jamais rien en clair.

**3. La saisie se fait dans Raccourcis, pas dans l'app.** Tu tapes la
description au moment du paiement, dans la fenêtre de Raccourcis. C'est
d'ailleurs ce que tu décrivais au départ.

## Peut-on l'enchaîner à Apple Pay ?

L'automatisation **Transaction** peut déclencher ce raccourci sans que tu
touches à rien — si elle existe sur ta version d'iOS et fournit le
montant. Je ne sais toujours pas si c'est le cas chez toi ; la démarche
pour vérifier est dans `RACCOURCI-IOS.md`, section « Variante B ».
