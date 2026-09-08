# Sécurité — ce qui est chiffré, ce qui ne l'est pas

Tu as demandé que « l'URL et les données qui transitent soient chiffrées
pour ne pas être interceptées ». Voici la réponse honnête, point par point.

## 1. En transit : c'est déjà chiffré, et il n'y a rien à ajouter

GitHub Pages est servi **exclusivement en HTTPS**. TLS chiffre la requête
entière — y compris le chemin et la query string. Un observateur sur le
réseau (Wi-Fi public, FAI, box) voit le nom d'hôte
(`auremoo.github.io`, via SNI/DNS) et le volume, **pas** l'URL complète ni
le montant.

Mieux : l'app reçoit les données dans le **fragment** (`#add?amount=…`).
Par conception du protocole HTTP, **le fragment n'est jamais envoyé au
serveur**. Il ne quitte pas ton téléphone. Il n'apparaît donc ni dans les
logs de GitHub, ni dans un éventuel proxy, ni dans un en-tête `Referer`
(la page envoie en plus `<meta name="referrer" content="no-referrer">`).

Chiffrer le contenu de l'URL par-dessus ça n'apporterait rien contre
l'interception réseau : il n'y a rien à intercepter.

## 2. Ce qui reste exposé (et que le chiffrement d'URL ne corrigerait qu'à moitié)

| Exposition | Réel ? | Remède |
|---|---|---|
| Historique Safari sur ton iPhone | oui | l'app efface le fragment de la barre d'adresse dès la lecture ; l'entrée d'historique reste, mais sans les paramètres |
| Synchro iCloud des onglets/historique | oui | même remède, partiel |
| Quelqu'un qui regarde ton écran | oui | rien d'informatique |
| Appareil compromis / déverrouillé | oui | code d'accès, Face ID |
| Journal d'exécution de Raccourcis | probable, je ne l'ai pas vérifié | — |

Le paramètre `d=` (payload base64) réduit le premier point à de la
lisibilité immédiate : `d=eyJhbW91bnQiOjEyLjM0fQ` est moins parlant que
`amount=12.34` pour un regard de passage. **Ce n'est pas du chiffrement**,
le base64 se décode en une seconde. Je ne le présente pas autrement.

## 3. Pourquoi pas un vrai chiffrement depuis le raccourci

Pour du chiffrement de bout en bout, il faudrait que l'app Raccourcis
chiffre le payload avec une clé partagée avant de construire l'URL.

**À ma connaissance, l'app Raccourcis d'Apple ne fournit aucune action de
chiffrement symétrique (AES) native.** Il n'y a ni action « Chiffrer »,
ni HMAC, ni dérivation de clé. Les contournements possibles — scripter via
une app tierce, ou l'action « Exécuter du JavaScript sur la page web » (qui
ne fonctionne que sur une page Safari déjà ouverte) — ajoutent une
dépendance et des points de panne pour un gain nul face à la menace réelle
(cf. point 1).

Je n'ai pas connaissance d'une solution propre. Si tu en trouves une, le
format `d=` est déjà là : il suffirait de remplacer le décodage base64 par
un déchiffrement AES-GCM dans `docs/js/app.js` (`parseIncoming`), la
primitive existe déjà dans `docs/js/crypto.js`.

## 4. Au repos : là, oui, il y a un vrai chiffrement

Si tu renseignes une passphrase dans les réglages, `data/expenses.json` ne
contient plus qu'une enveloppe :

- **AES-GCM 256 bits** (chiffrement authentifié — une modification du
  fichier est détectée)
- clé dérivée par **PBKDF2-SHA256, 250 000 itérations**, sel aléatoire de
  16 octets régénéré à chaque écriture
- IV aléatoire de 12 octets par écriture
- le tout via **WebCrypto**, l'implémentation native du navigateur

La passphrase ne quitte jamais la page : elle n'est ni envoyée à GitHub, ni
écrite dans le dépôt, ni dérivable du fichier. **Perdue = données perdues.**

Concrètement : même si le dépôt fuitait, ou si tu devais le rendre public
pour utiliser Pages sur un compte gratuit, tes dépenses resteraient
illisibles.

## 5. Le jeton GitHub

- C'est un **fine-grained PAT**, limité au seul dépôt `spend-money` et à
  la permission `Contents: Read and write`. Il ne peut rien faire d'autre,
  sur aucun autre dépôt.
- Il est stocké dans le `localStorage` du navigateur. Ce n'est **pas** un
  coffre-fort : quiconque a ton téléphone déverrouillé et ouvre les outils
  de développement peut le lire. C'est le compromis d'une app 100 %
  statique sans backend.
- Mets-lui une date d'expiration. En cas de doute, révoque-le sur GitHub :
  l'app affichera « erreur » et tu en génèreras un nouveau.
- Le bouton **Oublier cet appareil** efface jeton, passphrase et réglages
  du navigateur.

## 6. Ce que l'app ne fait jamais

- Aucun serveur tiers, aucun analytics, aucune dépendance externe : le seul
  domaine contacté est `api.github.com`.
- Aucun secret n'est commité : `.gitignore` couvre `.env`, `token.txt`, etc.
  et de toute façon jeton et passphrase ne transitent que par le
  `localStorage`.
- `data/expenses.json` est hors du dossier `docs/` publié par Pages : même
  avec un site public, le fichier n'est pas servi par le site.
