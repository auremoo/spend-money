# Icône de l'application

L'icône n'est pas générée par du code : tu la fais produire par ChatGPT (ou
tout autre générateur d'images) avec le prompt ci-dessous, puis tu déposes
le PNG dans le dépôt.

## 1. Le prompt à copier-coller

> Crée l'icône d'une application mobile nommée « spend-money ».
>
> Ce que fait l'app : un suivi personnel des dépenses par carte bancaire.
> Chaque paiement Apple Pay est capturé avec son montant et une courte
> description, puis archivé. L'icône doit évoquer la dépense maîtrisée et
> le suivi de comptes — pas la banque institutionnelle, pas la publicité.
>
> CONTRAINTE ABSOLUE — FORME :
> - Carré PLEIN, arêtes vives, angles à 90°.
> - AUCUN coin arrondi, AUCUN masque arrondi, AUCUN squircle iOS.
> - Le fond remplit 100 % du carré, bord à bord, sans marge blanche, sans
>   ombre portée extérieure, sans effet de badge ou d'autocollant.
> - Pas de bordure décorative simulant un cadre arrondi.
>
> FORMAT :
> - Image carrée 1024 × 1024 px, PNG, sans transparence.
> - Composition centrée, sujet occupant ~60 % de la largeur.
>
> CONTENU VISUEL :
> - Un symbole unique et lisible : un « € » traité graphiquement dont le
>   côté droit se prolonge en flèche descendante.
> - Style : flat design moderne, aplats de couleur, contraste élevé, aucun
>   dégradé bruité, aucune texture.
> - Palette : fond sombre profond (proche de #0B0D12) et accent vert vif
>   (proche de #46E08A). Une seule couleur d'accent.
>
> INTERDITS :
> - Aucun texte, aucun mot, aucune lettre autre que le symbole monétaire.
> - Pas de logo de marque existante, pas de réseau de carte bancaire réel.
> - Pas de reflet « glossy », pas de mockup de téléphone, pas de fond
>   damier de transparence, pas de bordure blanche.

## 2. Déposer l'image

Enregistre le PNG obtenu sous **`docs/icon.png`** (1024 × 1024).

Via l'interface GitHub, sans ligne de commande :
`docs/` → **Add file** → **Upload files** → glisser le fichier renommé
`icon.png` → **Commit changes**.

En ligne de commande :

```bash
cp ~/Downloads/icone.png docs/icon.png
git add docs/icon.png
git commit -m "chore: icône de l'application"
git push
```

Tant que le fichier n'existe pas, la page renvoie un 404 sans conséquence :
l'app affiche son logo vectoriel interne (`docs/img/logo.svg`), et seule
l'icône d'écran d'accueil manque.

## 3. Le logo dans l'app

Le symbole affiché en haut de l'écran d'accueil est un SVG
(`docs/img/logo.svg`), indépendant de `icon.png`. Il reprend le même motif :
un « € » dont le montant droit devient une flèche vers le bas. Si tu
changes de direction artistique, remplace ce fichier **et** le SVG inline
en tête de `docs/index.html`.
