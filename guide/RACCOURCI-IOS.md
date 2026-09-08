# Raccourci iOS (Apple Pay → spend-money)

## Le format d'URL

**La forme recommandée** — aucun `?`, aucun caractère qui fasse tiquer le
validateur d'URL d'iOS :

```
https://<owner>.github.io/spend-money/#amount=12.34&note=Boulangerie&date=2026-09-08
```

Deux autres formes restent acceptées :

```
https://<owner>.github.io/spend-money/#add?amount=12.34&note=Boulangerie   (historique)
https://<owner>.github.io/spend-money/?amount=12.34&note=Boulangerie       (repli, voir SECURITE.md)
```

⚠️ La forme historique met un `?` **à l'intérieur** du fragment. La
RFC 3986 l'autorise, mais Raccourcis iOS la rejette avec « URL non
valide ». C'est pour ça que la forme recommandée n'en contient aucun.

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

## Variante A — la plus simple et la plus fiable (recommandée)

Un raccourci manuel, déclenché depuis le widget ou l'écran d'accueil.

1. App **Raccourcis** → **+** → nommer `Dépense`.

2. Action **« Demander une entrée »**
   - Type : **Nombre**
   - Question : `Montant payé ?`

3. Action **« URL »** (catégorie Web/Safari) — **ne saute pas cette étape**,
   voir le piège RTF plus bas. Contenu du champ :
   ```
   https://auremoo.github.io/spend-money/#amount=[Entrée fournie]
   ```
   `[Entrée fournie]` est la variable magique de l'étape 2, à **insérer**
   depuis la barre au-dessus du clavier, pas à taper.

4. Action **« Ouvrir des URL »**, en entrée l'**URL** de l'étape 3.

5. Flèche **⌄** à côté du nom → **Partager** → **Sur l'écran d'accueil**.

Résultat :

```
Demander     Nombre  « Montant payé ? »
URL          https://auremoo.github.io/spend-money/#amount=[Entrée fournie]
Ouvrir       [URL]
```

La description se saisit dans la feuille qu'affiche l'app à l'ouverture.
C'est volontaire : tu vois le montant en grand, tu peux corriger la date,
et si tu annules rien n'est écrit.

---

## Les deux erreurs que Raccourcis renvoie, et leur cause

### « URL non valide » à l'exécution

Deux causes, dans cet ordre de probabilité.

**1. Le `?` dans le fragment.** Si ton adresse est de la forme
`…/#add?amount=10`, Raccourcis refuse de la valider. Utilise la forme
recommandée, sans `?` :

```
https://auremoo.github.io/spend-money/#amount=[Entrée fournie]
```

**2. La mauvaise variable en entrée.** L'action « Ouvrir des URL » prend
par défaut la sortie de l'action précédente. Si son champ contient
`Entrée fournie` (le nombre) au lieu de la pastille `URL`, elle tente
d'ouvrir `12,34` — d'où « URL non valide ». Touche la pastille, supprime-la
et insère `URL`.

Vérifie aussi qu'aucun espace ni retour à la ligne ne traîne en fin
d'adresse.

### « Impossible de convertir Texte enrichi (RTF) en URL »

Raccourcis a traité ton adresse comme du **texte enrichi** et refuse de la
convertir. C'est le cas dès que le champ URL est alimenté par un texte
plutôt que par une valeur typée URL.

**Remède :** insérer une action **« URL »** entre la saisie et
« Ouvrir des URL » (étape 3 ci-dessus). Sa sortie est typée URL, la
conversion n'a plus lieu d'être.

Si l'erreur persiste, deuxième piste : le `#`. Certaines versions de
Raccourcis le digèrent mal. L'app accepte alors la **query string** :

```
https://auremoo.github.io/spend-money/?amount=[Entrée fournie]&note=
```

⚠️ Ce repli fonctionne, mais il perd l'avantage du fragment : la query
string **est envoyée au serveur** (voir `SECURITE.md`). Utilise-le
seulement si le `#` échoue. L'app efface l'adresse de la barre dans les
deux cas.

### « Le PDF est corrompu / n'a pas pu être lu »

Tu as utilisé **« Obtenir le contenu de l'URL »** (*Get Contents of URL*),
qui télécharge la page, puis Raccourcis a tenté d'en faire un aperçu.

**Remède :** cette action n'a rien à faire ici. Il faut **« Ouvrir des
URL »** (icône Safari, ne renvoie rien). Supprime aussi toute action
« Aperçu rapide » ou « Afficher le résultat ».

Cherche `Ouvrir` dans les actions, pas `URL` : la première proposition
sur `URL` est justement la mauvaise.

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
