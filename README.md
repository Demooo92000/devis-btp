# DevisBTP

Générateur de devis pour les artisans du bâtiment (électricien, plombier, peintre,
menuisier, maçon, carreleur, couvreur, chauffagiste...) : prestations courantes
préremplies par métier avec prix indicatifs modifiables, calcul automatique
HT/TVA/TTC, export PDF via l'impression navigateur. Vanilla JS, pas de framework ni
de bundler, aucun backend en v1 — tout est stocké en local (`localStorage`) dans le
navigateur de l'utilisateur.

Produit indépendant, sans lien technique avec AuditBTP ni note-calcul-electrique —
cible un public plus large (tout artisan du bâtiment établissant des devis), pas
seulement les bureaux d'études ni un seul corps de métier. Né sous le nom
« DevisElec », limité aux électriciens ; généralisé à tous les corps de métier du
BTP le 2026-09-22 (dépôt GitHub renommé en conséquence, `deviselec_` reste le
préfixe des clés `localStorage` pour ne pas perdre les données déjà enregistrées).

## Pages

- `index.html` — page d'accueil (présentation, pas d'outil).
- `app.html` — l'outil lui-même.
- Le filet anti-clickjacking (`js/security.js`) est chargé sur les deux pages ;
  `js/storage.js` et `js/app.js` uniquement sur `app.html`.

## Métiers couverts

La liste des prestations préremplies vit dans `METIERS` (`js/app.js`), un objet par
métier (`electricien`, `plombier`, `peintre`, `menuisier`, `macon`, `carreleur`,
`couvreur`, `chauffagiste`). Le métier choisi par l'utilisateur est mémorisé
(`Storage.getMetier()`/`setMetier()`) et détermine la liste d'autocomplétion
affichée. Prix indicatifs de marché, pas une source normative — point de départ à
ajuster, y compris par l'utilisateur dans le formulaire. Ajouter un métier : un
nouvel objet `{ label, prestations: [...] }` dans `METIERS` suffit, rien d'autre à
changer.

## Monétisation (v1)

Version gratuite : devis illimités, mais mention « généré avec DevisBTP » imprimée
en bas de chaque devis. Déblocage à vie (paiement unique Stripe) : retire la
mention. C'est une barrière **UX côté client uniquement** — il n'y a pas de backend
en v1 pour la faire respecter côté serveur, exactement comme documenté pour
AuditBTP : un utilisateur déterminé peut la contourner (ajouter `?unlocked=1` dans
l'URL sans avoir payé). Acceptable pour un v1 sans compte ni donnée sensible ; à
durcir plus tard si le produit prend, avec un vrai backend de vérification.

## Sécurité — revue du 2026-09-22

Revue adversariale complète faite (lecture des fichiers, historique git, exécution
réelle en navigateur avec tentatives d'injection). Deux points vérifiés en direct et
jugés non exploitables : le contournement du déblocage (`?unlocked=1`, voir
ci-dessus — ne gate que la mention imprimée, aucune fonctionnalité ni donnée) et un
logo SVG contenant un `<script>`/`onload=` forgé (rendu via `<img src="data:...">`,
qui n'exécute jamais de script selon la spec SVG Integration — confirmé en pratique).

Un vrai gap identifié : la CSP posée en `<meta>` dans les deux pages ne couvre
**pas** `frame-ancestors` (les navigateurs l'ignorent hors en-tête HTTP), et GitHub
Pages n'envoie pas non plus de `X-Frame-Options` — le site est donc réellement
embarquable dans un iframe. Un filet best-effort (JS `frame-busting`, `js/security.js`)
a été ajouté en attendant un hébergement qui permette de vrais en-têtes HTTP ;
impact jugé faible dans tous les cas (pas de session/cookie à détourner, le paiement
réel se fait sur une page Stripe séparée non embarquable).

## Avant mise en ligne réelle

- Créer un Stripe Payment Link et renseigner son URL dans
  `STRIPE_PAYMENT_LINK` (`js/app.js`) — success URL du lien à régler sur
  `<url du site>/app.html?unlocked=1`.
- Rédiger de vraies mentions légales / CGV (aucune ne sont incluses ici) avant
  d'accepter un paiement réel.
- Les prix par défaut des prestations (`METIERS` dans `js/app.js`) sont des
  ordres de grandeur indicatifs, pas une source normative — à ajuster librement,
  y compris par les utilisateurs eux-mêmes dans le formulaire.

## Lancer en local

Servir le dossier avec n'importe quel serveur statique, par exemple :

```
python -m http.server 8000
```

puis ouvrir `http://localhost:8000` (page d'accueil) ou
`http://localhost:8000/app.html` (l'outil directement).
