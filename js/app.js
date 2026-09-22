// DevisElec — générateur de devis pour électriciens, 100% côté client (pas de backend en v1).
// Tout est stocké en local (localStorage) sur l'appareil de l'utilisateur.
// Le filet anti-clickjacking vit dans js/security.js, chargé avant ce fichier (partagé avec
// la page d'accueil, qui n'a pas besoin du reste de ce fichier).

// À configurer par 1GeleC : lien de paiement Stripe (Payment Link) pour le déblocage.
// Success URL du Payment Link à régler sur : <url du site>/?unlocked=1
const STRIPE_PAYMENT_LINK = '';

const PRESTATIONS = [
  { label: 'Point lumineux (simple allumage)', prix: 45 },
  { label: 'Point lumineux (va-et-vient)', prix: 65 },
  { label: 'Prise de courant 16A', prix: 40 },
  { label: 'Prise spécialisée 32A (four / plaque)', prix: 75 },
  { label: 'Prise RJ45 / réseau', prix: 50 },
  { label: 'Point de commande VMC', prix: 45 },
  { label: 'Interrupteur simple', prix: 35 },
  { label: 'Détecteur de fumée (DAAF) fourni posé', prix: 40 },
  { label: "Tableau électrique complet (fourniture et pose, jusqu'à 3 rangées)", prix: 950 },
  { label: 'Disjoncteur différentiel 30mA', prix: 95 },
  { label: 'Disjoncteur divisionnaire', prix: 45 },
  { label: 'Mise à la terre (piquet + liaison)', prix: 180 },
  { label: 'Chemin de câbles / goulotte (par mètre)', prix: 12 },
  { label: 'Forfait mise aux normes tableau électrique', prix: 650 },
  { label: "Taux horaire main d'œuvre", prix: 55 },
  { label: 'Forfait déplacement', prix: 40 },
];

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmt = (n) => euros.format(Number.isFinite(n) ? n : 0);
// Arrondir chaque ligne au centime AVANT de sommer : sinon le sous-total (somme des floats
// bruts) peut différer de quelques centimes de ce qu'un client obtiendrait en additionnant
// lui-même les totaux imprimés par ligne (chacun déjà arrondi individuellement à l'affichage).
const roundCents = (n) => Math.round(n * 100) / 100;
const ligneTotal = (l) => roundCents(l.qte * l.pu);

let state = null;
let ligneIdSeq = 1;

function defaultState() {
  return {
    numero: Storage.getNextNumero(),
    date: new Date().toISOString().slice(0, 10),
    client: { nom: '', adresse: '' },
    lignes: [{ id: ligneIdSeq++, designation: '', qte: 1, pu: 0 }],
    tvaTaux: 10,
    remise: 0,
  };
}

function syncFormFromState() {
  document.getElementById('cli-nom').value = state.client.nom;
  document.getElementById('cli-adresse').value = state.client.adresse;
  document.getElementById('devis-date').value = state.date;
  document.getElementById('tva-taux').value = String(state.tvaTaux);
  document.getElementById('remise').value = state.remise;
}

function init() {
  const savedDevis = Storage.getDevisState();
  state = savedDevis || defaultState();
  if (!savedDevis) Storage.setDevisState(state); // fige le numéro tout de suite : un simple
  // rechargement avant toute saisie ne doit pas en consommer un second.
  if (state.lignes.length) {
    ligneIdSeq = Math.max(...state.lignes.map((l) => l.id)) + 1;
  }

  const ent = Storage.getEntreprise();
  document.getElementById('ent-nom').value = ent.nom || '';
  document.getElementById('ent-siret').value = ent.siret || '';
  document.getElementById('ent-adresse').value = ent.adresse || '';
  document.getElementById('ent-tel').value = ent.tel || '';
  document.getElementById('ent-email').value = ent.email || '';
  if (ent.logo) {
    document.getElementById('preview-logo').src = ent.logo;
    document.getElementById('preview-logo').hidden = false;
  }

  syncFormFromState();

  // Options ajoutées via la propriété .value (jamais interpolées dans du HTML) : PRESTATIONS
  // est aujourd'hui une liste figée, mais si elle devient un jour dynamique, ce code reste sûr.
  const datalist = document.getElementById('prestations-courantes');
  PRESTATIONS.forEach((p) => {
    const option = document.createElement('option');
    option.value = p.label;
    datalist.appendChild(option);
  });

  wireEvents();
  checkUnlockFromURL();
  applyUnlockedUI();
  renderLignes();
  renderPreview();
}

function wireEvents() {
  document.getElementById('ent-nom').addEventListener('input', saveEntrepriseFromForm);
  document.getElementById('ent-siret').addEventListener('input', saveEntrepriseFromForm);
  document.getElementById('ent-adresse').addEventListener('input', saveEntrepriseFromForm);
  document.getElementById('ent-tel').addEventListener('input', saveEntrepriseFromForm);
  document.getElementById('ent-email').addEventListener('input', saveEntrepriseFromForm);
  document.getElementById('ent-logo').addEventListener('change', handleLogoUpload);

  document.getElementById('cli-nom').addEventListener('input', (e) => {
    state.client.nom = e.target.value;
    persistAndRender();
  });
  document.getElementById('cli-adresse').addEventListener('input', (e) => {
    state.client.adresse = e.target.value;
    persistAndRender();
  });
  document.getElementById('devis-date').addEventListener('input', (e) => {
    state.date = e.target.value;
    persistAndRender();
  });
  document.getElementById('tva-taux').addEventListener('change', (e) => {
    state.tvaTaux = parseFloat(e.target.value);
    persistAndRender();
  });
  document.getElementById('remise').addEventListener('input', (e) => {
    // min/max sur l'input HTML ne suffisent pas (pas de <form>, et même avec un <form> la saisie
    // clavier/collage n'est pas bloquée) : une remise hors [0,100] rendait TVA et total négatifs.
    const clamped = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
    state.remise = clamped;
    if (e.target.value !== '' && Number(e.target.value) !== clamped) e.target.value = clamped;
    persistAndRender();
  });

  document.getElementById('btn-add-ligne').addEventListener('click', () => {
    state.lignes.push({ id: ligneIdSeq++, designation: '', qte: 1, pu: 0 });
    persistAndRender();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('Repartir sur un nouveau devis ? Les lignes actuelles seront perdues (les infos client et entreprise sont conservées).')) return;
    const client = state.client; // le message promet de garder le client : on le reporte réellement.
    state = defaultState();
    state.client = client;
    syncFormFromState(); // date/TVA/remise reviennent aussi à leur valeur par défaut à l'écran,
    // sinon le formulaire affiche l'ancienne TVA pendant que l'aperçu recalcule avec la nouvelle.
    persistAndRender();
  });

  document.getElementById('btn-print').addEventListener('click', () => window.print());

  document.getElementById('btn-unlock').addEventListener('click', openUnlockDialog);
  document.getElementById('dialog-unlock-close').addEventListener('click', closeUnlockDialog);
}

function saveEntrepriseFromForm() {
  const ent = {
    nom: document.getElementById('ent-nom').value,
    siret: document.getElementById('ent-siret').value,
    adresse: document.getElementById('ent-adresse').value,
    tel: document.getElementById('ent-tel').value,
    email: document.getElementById('ent-email').value,
    logo: Storage.getEntreprise().logo || null,
  };
  Storage.setEntreprise(ent);
  renderPreview();
}

function handleLogoUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const ent = Storage.getEntreprise();
    ent.logo = reader.result;
    Storage.setEntreprise(ent);
    document.getElementById('preview-logo').src = reader.result;
    document.getElementById('preview-logo').hidden = false;
  };
  reader.readAsDataURL(file);
}

function persistAndRender() {
  Storage.setDevisState(state);
  renderLignes();
  renderPreview();
}

function renderLignes() {
  const container = document.getElementById('lignes-container');
  container.innerHTML = '';
  state.lignes.forEach((ligne) => {
    const row = document.createElement('div');
    row.className = 'ligne-row';
    row.innerHTML = `
      <input type="text" list="prestations-courantes" placeholder="Désignation de la prestation" data-field="designation">
      <input type="number" min="0" step="0.5" data-field="qte" aria-label="Quantité">
      <input type="number" min="0" step="0.01" data-field="pu" aria-label="Prix unitaire HT">
      <span class="ligne-total">${fmt(ligneTotal(ligne))}</span>
      <button type="button" class="btn-danger-ghost" aria-label="Supprimer la ligne">✕</button>
    `;

    const [designationInput, qteInput, puInput] = row.querySelectorAll('input');
    // Affectées en propriétés JS (jamais interpolées dans le HTML) : une désignation
    // contenant un guillemet ne doit pas pouvoir s'échapper de l'attribut value.
    designationInput.value = ligne.designation;
    qteInput.value = ligne.qte;
    puInput.value = ligne.pu;
    designationInput.addEventListener('input', (e) => {
      ligne.designation = e.target.value;
      const match = PRESTATIONS.find((p) => p.label === e.target.value);
      if (match && !ligne.pu) {
        ligne.pu = match.prix;
        puInput.value = match.prix;
      }
      Storage.setDevisState(state);
      row.querySelector('.ligne-total').textContent = fmt(ligneTotal(ligne));
      renderPreview();
    });
    qteInput.addEventListener('input', (e) => {
      ligne.qte = parseFloat(e.target.value) || 0;
      Storage.setDevisState(state);
      row.querySelector('.ligne-total').textContent = fmt(ligneTotal(ligne));
      renderPreview();
    });
    puInput.addEventListener('input', (e) => {
      ligne.pu = parseFloat(e.target.value) || 0;
      Storage.setDevisState(state);
      row.querySelector('.ligne-total').textContent = fmt(ligneTotal(ligne));
      renderPreview();
    });
    row.querySelector('.btn-danger-ghost').addEventListener('click', () => {
      state.lignes = state.lignes.filter((l) => l.id !== ligne.id);
      if (state.lignes.length === 0) state.lignes.push({ id: ligneIdSeq++, designation: '', qte: 1, pu: 0 });
      persistAndRender();
    });

    container.appendChild(row);
  });
}

function computeTotals() {
  const sousTotal = roundCents(state.lignes.reduce((sum, l) => sum + ligneTotal(l), 0));
  const remiseMontant = roundCents(sousTotal * (state.remise / 100));
  const baseTva = roundCents(sousTotal - remiseMontant);
  const tvaMontant = roundCents(baseTva * (state.tvaTaux / 100));
  const totalTTC = roundCents(baseTva + tvaMontant);
  return { sousTotal, remiseMontant, tvaMontant, totalTTC };
}

function renderPreview() {
  const ent = Storage.getEntreprise();
  document.getElementById('preview-ent-nom').textContent = ent.nom || 'Votre entreprise';
  const details = [ent.adresse, ent.siret ? `SIRET : ${ent.siret}` : '', ent.tel, ent.email].filter(Boolean).join('\n');
  document.getElementById('preview-ent-details').textContent = details;

  document.getElementById('preview-numero').textContent = `N° ${state.numero}`;
  document.getElementById('preview-date').textContent = `Date : ${formatDateFr(state.date)}`;

  document.getElementById('preview-cli-nom').textContent = state.client.nom || '—';
  document.getElementById('preview-cli-adresse').textContent = state.client.adresse || '—';

  const tbody = document.getElementById('preview-lignes');
  tbody.innerHTML = state.lignes
    .filter((l) => l.designation || l.qte || l.pu)
    .map((l) => `
      <tr>
        <td>${escapeHtml(l.designation) || '—'}</td>
        <td class="col-qte">${l.qte}</td>
        <td class="col-pu">${fmt(l.pu)}</td>
        <td class="col-total">${fmt(ligneTotal(l))}</td>
      </tr>
    `).join('');

  const { sousTotal, remiseMontant, tvaMontant, totalTTC } = computeTotals();
  document.getElementById('preview-sous-total').textContent = fmt(sousTotal);
  const remiseRow = document.getElementById('preview-remise-row');
  if (remiseMontant > 0) {
    remiseRow.hidden = false;
    document.getElementById('preview-remise').textContent = `− ${fmt(remiseMontant)}`;
  } else {
    remiseRow.hidden = true;
  }
  document.getElementById('preview-tva-label').textContent = `TVA (${state.tvaTaux} %)`;
  document.getElementById('preview-tva').textContent = fmt(tvaMontant);
  document.getElementById('preview-total-ttc').textContent = fmt(totalTTC);
}

function formatDateFr(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function openUnlockDialog() {
  const link = document.getElementById('lien-stripe-unlock');
  if (STRIPE_PAYMENT_LINK) {
    link.href = STRIPE_PAYMENT_LINK;
    link.classList.remove('btn-ghost');
    link.textContent = 'Débloquer maintenant';
  } else {
    link.removeAttribute('href');
    link.classList.add('btn-ghost');
    link.textContent = 'Paiement bientôt disponible';
  }
  document.getElementById('dialog-unlock').showModal();
}

function closeUnlockDialog() {
  document.getElementById('dialog-unlock').close();
}

function checkUnlockFromURL() {
  const params = new URLSearchParams(location.search);
  if (params.get('unlocked') === '1') {
    Storage.setUnlocked(true);
    params.delete('unlocked');
    const clean = location.pathname + (params.toString() ? `?${params}` : '');
    history.replaceState({}, '', clean);
  }
}

function applyUnlockedUI() {
  const unlocked = Storage.isUnlocked();
  document.body.classList.toggle('unlocked', unlocked);
  const status = document.getElementById('unlock-status');
  const btnUnlock = document.getElementById('btn-unlock');
  if (unlocked) {
    status.textContent = 'Version pro';
    status.className = 'badge badge-pro';
    btnUnlock.hidden = true;
  } else {
    status.textContent = 'Version gratuite';
    status.className = 'badge badge-free';
    btnUnlock.hidden = false;
  }
}

document.addEventListener('DOMContentLoaded', init);
