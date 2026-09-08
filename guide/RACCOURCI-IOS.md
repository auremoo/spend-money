# Raccourci iOS (Apple Pay → spend-money)

## Le format d'URL

```
https://<owner>.github.io/spend-money/#add?amount=12.34&note=Boulangerie&date=2026-09-08
```

- `amount` — **obligatoire**, décimal, point ou virgule acceptés.
- `note` — optionnel, la description (encodée URL).
- `date` — optionnel, `AAAA-MM-JJ`. Absent → date du jour à la réception.

Variante « payload compact », si tu préfères ne pas exposer les paramètres
en clair dans l'historique Safari :

```
https://<owner>.github.io/spend-money/#add?d=<base64 de {"amount":12.34,"note":"Boulangerie"}>
```

Shortcuts sait faire ça nativement (action **Encoder en Base64**).
⚠️ C'est de l'**obfuscation**, pas du chiffrement — voir `SECURITE.md`.

**Tout est après le `#`.** C'est délibéré : le fragment d'URL n'est
jamais envoyé au serveur (voir `SECURITE.md`).

---

## Variante A — la plus simple et la plus fiable (recommandée pour démarrer)

Un raccourci manuel, déclenché depuis le widget ou l'écran d'accueil.

1. App **Raccourcis** → **+** → nommer `Dépense`.
2. Ajouter l'action **Demander une entrée**
   - Type : **Nombre**
   - Question : `Montant payé ?`
3. Ajouter l'action **Ouvrir des URL** avec :
   ```
   https://auremoo.github.io/spend-money/#add?amount=[Entrée fournie]
   ```
   (`[Entrée fournie]` = la variable magique de l'étape 2, à insérer, pas à
   taper.)
4. **Ajouter à l'écran d'accueil.**

La description, tu la saisis dans la fenêtre que l'app affiche à
l'ouverture — c'est exactement le « popup » que tu voulais, et il vaut
mieux qu'il soit dans l'app : tu vois le montant en grand, tu peux corriger
la date, et si tu annules rien n'est écrit.

Si tu préfères vraiment saisir la description dans Shortcuts : ajoute une
seconde action **Demander une entrée** (Type : Texte, Question :
`C'était quoi ?`) et construis l'URL avec
`#add?amount=[Nombre]&note=[Texte]`. Insère au préalable une action
**Encodage d'URL** sur le texte, sinon un `&` ou un espace casse l'URL.

---

## Variante B — automatique sur paiement Apple Pay

L'app Raccourcis propose une automatisation personnelle déclenchée par une
**transaction** sur une carte de Wallet (Automatisation → + → *Transaction*).

**Ce que je ne sais pas et que tu devras vérifier sur ton iPhone :**

- la disponibilité exacte du déclencheur selon ta version d'iOS et ta banque ;
- le nom et le contenu précis des variables fournies par le déclencheur
  (montant, commerçant…), et si le montant est utilisable directement dans
  une URL ;
- si l'automatisation peut s'exécuter **sans confirmation** dans ton cas
  (« Exécuter immédiatement ») — iOS restreint l'exécution silencieuse pour
  certains déclencheurs.

Je préfère te le dire plutôt que t'inventer une recette qui ne marchera
pas. La marche à suivre :

1. Raccourcis → onglet **Automatisation** → **+** → chercher **Transaction**.
2. Choisir la carte concernée, puis **Suivant**.
3. Regarder quelles variables sont proposées par le déclencheur. S'il y a
   un montant :
   - action **Ouvrir des URL** →
     `https://auremoo.github.io/spend-money/#add?amount=[Montant]`
   - si le commerçant est disponible, ajoute
     `&note=[Commerçant encodé URL]` : tu auras la description
     pré-remplie et tu n'auras qu'à la corriger.
4. Activer **Exécuter immédiatement** et désactiver **Demander avant
   d'exécuter** si iOS te le permet.

Si le déclencheur n'existe pas ou ne donne pas le montant : reste sur la
variante A. Deux tapes, c'est le prix de la fiabilité.

⚠️ Sur iPhone, **ouvre toujours l'app depuis le même navigateur**
(Safari, ou l'icône ajoutée à l'écran d'accueil). Le jeton est dans le
`localStorage` : un autre navigateur = app non configurée.

---

## Ce qui se passe côté app

1. La page lit le fragment, l'efface immédiatement de la barre d'adresse
   (`history.replaceState`) pour ne pas le laisser dans l'historique.
2. Une boîte de dialogue affiche le montant, demande la description et
   permet de corriger la date.
3. À la validation, l'entrée est ajoutée et poussée dans le dépôt via un
   commit sur `data/expenses.json`.
4. Pas de réseau ? L'entrée est gardée dans une file locale et repartira
   à la prochaine ouverture (ou au retour de la connexion). Elle apparaît
   dans la liste avec la mention « en attente de synchro ».
