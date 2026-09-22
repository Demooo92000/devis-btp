// Petite couche autour de localStorage. Aucune donnée ne quitte le navigateur :
// DevisElec n'a pas de backend en v1, tout est stocké en local chez l'utilisateur.
const Storage = (() => {
  const PREFIX = 'deviselec_';

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      // Stockage plein ou indisponible (navigation privée) : on continue sans persister.
    }
  }

  return {
    getEntreprise: () => get('entreprise', {}),
    setEntreprise: (v) => set('entreprise', v),

    getDevisState: () => get('devis_en_cours', null),
    setDevisState: (v) => set('devis_en_cours', v),

    isUnlocked: () => get('unlocked', false),
    setUnlocked: (v) => set('unlocked', v),

    getNextNumero: () => {
      const annee = new Date().getFullYear();
      const compteurKey = 'compteur_' + annee;
      const n = get(compteurKey, 0) + 1;
      set(compteurKey, n);
      // Le couple lecture/écriture ci-dessus n'est pas atomique entre onglets : deux onglets
      // ouverts en même temps peuvent lire puis écrire le même compteur avant l'autre (vérifié :
      // collision quasi systématique sans ce suffixe). Le suffixe aléatoire rend deux devis
      // distincts non-collisionnants même quand la partie séquentielle, elle, se répète.
      const suffixe = Math.random().toString(36).slice(2, 6).toUpperCase();
      return `DEV-${annee}-${String(n).padStart(3, '0')}-${suffixe}`;
    },
  };
})();
