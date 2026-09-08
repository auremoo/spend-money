#!/usr/bin/env bash
# spend-money — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
#
# Génère le prompt à coller dans ChatGPT (ou tout autre générateur d'images)
# pour obtenir l'icône de l'application, SANS coins arrondis.
#
# Usage :
#   ./scripts/icon-prompt.sh              # affiche le prompt
#   ./scripts/icon-prompt.sh --copy       # copie dans le presse-papiers
#   ./scripts/icon-prompt.sh --variant 2  # variante de style (1 à 3)

set -euo pipefail

VARIANT=1
COPY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --copy|-c) COPY=1; shift ;;
    --variant|-v) VARIANT="${2:-1}"; shift 2 ;;
    --help|-h)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 1 ;;
  esac
done

case "$VARIANT" in
  1) STYLE="Style : flat design moderne, aplats de couleur, contraste élevé, zéro dégradé bruité, zéro texture." ;;
  2) STYLE="Style : minimalisme géométrique, une seule forme forte, deux couleurs maximum, très lisible en 32x32 px." ;;
  3) STYLE="Style : rétro terminal / brutalisme numérique, typographie mono, grille visible, palette limitée." ;;
  *) echo "Variante inconnue : $VARIANT (attendu 1, 2 ou 3)" >&2; exit 1 ;;
esac

read -r -d '' PROMPT <<EOF || true
Crée l'icône d'une application mobile nommée « spend-money ».

Ce que fait l'app : un suivi personnel des dépenses par carte bancaire.
Chaque paiement Apple Pay est capturé avec son montant et une courte
description, puis archivé. L'icône doit évoquer la dépense maîtrisée et le
suivi de comptes — pas la banque institutionnelle, pas la publicité.

CONTRAINTE ABSOLUE — FORME :
- Carré PLEIN, arêtes vives, angles à 90°.
- AUCUN coin arrondi, AUCUN masque arrondi, AUCUN squircle iOS.
- Le fond doit remplir 100 % du carré, bord à bord, sans marge blanche,
  sans ombre portée à l'extérieur, sans effet de badge ou d'autocollant.
- Pas de bordure décorative simulant un cadre arrondi.

FORMAT :
- Image carrée 1024 x 1024 px, PNG, sans transparence.
- Composition centrée, sujet occupant ~60 % de la largeur, marge visuelle
  interne homogène.

CONTENU VISUEL :
- Un symbole unique et lisible : par exemple un « € » traité graphiquement,
  une flèche descendante sortant d'une carte, ou un ticket de caisse
  stylisé. Choisis UNE idée et pousse-la, ne les empile pas.
- $STYLE
- Palette : fond sombre profond (proche de #0F1115) et accent vert vif
  (proche de #4ADE80). Une couleur d'accent maximum.

INTERDITS :
- Aucun texte, aucun mot, aucune lettre autre que le symbole monétaire.
- Pas de logo de marque existante, pas de réseau de carte bancaire réel.
- Pas de reflet « glossy », pas de mockup de téléphone, pas de fond damier
  de transparence, pas de bordure blanche.

Livre l'image finale seule, prête à être enregistrée sous docs/icon.png.
EOF

if [[ "$COPY" -eq 1 ]]; then
  if command -v pbcopy >/dev/null 2>&1; then printf '%s' "$PROMPT" | pbcopy
  elif command -v wl-copy >/dev/null 2>&1; then printf '%s' "$PROMPT" | wl-copy
  elif command -v xclip >/dev/null 2>&1; then printf '%s' "$PROMPT" | xclip -selection clipboard
  else echo "Aucun outil de presse-papiers trouvé (pbcopy/wl-copy/xclip)." >&2; fi
  echo "Prompt (variante $VARIANT) copié dans le presse-papiers."
else
  printf '%s\n' "$PROMPT"
fi
