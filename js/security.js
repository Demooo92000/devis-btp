// Anti-clickjacking : la CSP livrée en <meta> ne couvre pas frame-ancestors (ignoré par les
// navigateurs hors en-tête HTTP, que GitHub Pages ne permet pas de définir). Filet best-effort
// en attendant un hébergement qui permette de vrais en-têtes : contournable par un iframe
// sandboxé sans allow-top-navigation, mais gratuit et sans risque de casse. Partagé entre
// toutes les pages (chargé avant tout autre script).
if (window.top !== window.self) {
  window.top.location = window.self.location;
}
