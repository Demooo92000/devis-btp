# DevisElec

Générateur de devis pour électriciens (artisans, PME du bâtiment) : prestations
courantes préremplies avec prix indicatifs modifiables, calcul automatique
HT/TVA/TTC, export PDF via l'impression navigateur. Vanilla JS, pas de
framework ni de bundler, aucun backend en v1 — tout est stocké en local
(`localStorage`) dans le navigateur de l'utilisateur.

Produit indépendant, sans lien technique avec AuditBTP ni
note-calcul-electrique — cible un public plus large (tout électricien
indépendant établissant des devis), pas seulement les bureaux d'études.

## Monétisation (v1)

Version gratuite : devis illimités, mais mention « généré avec DevisElec »
imprimée en bas de chaque devis. Déblocage à vie (paiement unique Stripe) :
retire la mention. C'est une barrière **UX côté client uniquement** — il n'y a
pas de backend en v1 pour la faire respecter côté serveur, exactement comme
documenté pour AuditBTP : un utilisateur déterminé peut la contourner
(ajouter `?unlocked=1` dans l'URL sans avoir payé). Acceptable pour un v1 sans
compte ni donnée sensible ; à durcir plus tard si le produit prend, avec un
vrai backend de vérification.

## Avant mise en ligne réelle

- Créer un Stripe Payment Link et renseigner son URL dans
  `STRIPE_PAYMENT_LINK` (`js/app.js`) — success URL du lien à régler sur
  `<url du site>/?unlocked=1`.
- Rédiger de vraies mentions légales / CGV (aucune ne sont incluses ici) avant
  d'accepter un paiement réel.
- Les prix par défaut des prestations (`PRESTATIONS` dans `js/app.js`) sont
  des ordres de grandeur indicatifs, pas une source normative — à ajuster
  librement, y compris par les utilisateurs eux-mêmes dans le formulaire.

## Lancer en local

Servir le dossier avec n'importe quel serveur statique, par exemple :

```
python -m http.server 8000
```

puis ouvrir `http://localhost:8000`.
