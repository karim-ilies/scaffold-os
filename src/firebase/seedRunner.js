import {
  collection, addDoc, setDoc, getDoc, getDocs,
  doc, query, where, limit, deleteDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { db } from './config'

const API_KEY = 'AIzaSyBqk1vXxVUDRVNZLbTokbWiTD0QIGEmb54'

function ruid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substr(2, 12)
}

function ts(dateStr) {
  return Timestamp.fromDate(new Date(dateStr))
}

function ligne(desc, type, qty, prixHT, tauxTVA) {
  const montantHT  = Math.round(qty * prixHT * 100) / 100
  const montantTVA = Math.round(montantHT * tauxTVA * 100) / 100
  return {
    id: ruid(), type, description: desc,
    quantite: qty, prixUnitaireHT: prixHT, tauxTVA,
    montantHT, montantTVA, montantTTC: montantHT + montantTVA,
    nbOuvriers: 0, nbJours: 0, tauxJournalier: 0,
  }
}

async function createAuthAccount(email, password, displayName) {
  // Create via REST API — doesn't affect current SDK auth session
  const tryCreate = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
    }
  )
  const data = await tryCreate.json()
  if (!data.error) return data.localId

  if (data.error.message === 'EMAIL_EXISTS') {
    // Account exists — sign in to retrieve UID
    const trySignIn = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    )
    const d = await trySignIn.json()
    return d.error ? null : d.localId
  }
  throw new Error(`Auth ${email}: ${data.error.message}`)
}

// ─────────────────────────────────────────────────────────────────────────────
export async function runSeed(onProgress = () => {}) {
  onProgress('Vérification données existantes…')
  const check = await getDocs(query(collection(db, 'clients'), where('_seed', '==', true), limit(1)))
  if (!check.empty) return { alreadySeeded: true }

  // ── Clients ────────────────────────────────────────────────────────────────
  onProgress('Création clients…')
  const [dupontId, martinId, renaudId] = await Promise.all([
    addDoc(collection(db, 'clients'), {
      nom: 'Dupont SAS', type: 'pro', siret: '12345678901234',
      adresse: { rue: '15 rue de Vaugirard', cp: '75015', ville: 'Paris' },
      contact: { nom: 'Jean Dupont', tel: '0145678901', email: 'contact@dupont-sas.fr' },
      regimeTVADefaut: 'reduit', notes: 'Client depuis 2023', _seed: true,
      createdAt: serverTimestamp(),
    }).then(r => r.id),
    addDoc(collection(db, 'clients'), {
      nom: 'Martin SARL', type: 'pro', siret: '98765432109876',
      adresse: { rue: '8 avenue de Fontenay', cp: '94300', ville: 'Vincennes' },
      contact: { nom: 'Sophie Martin', tel: '0143567890', email: 'sophie@martin-sarl.fr' },
      regimeTVADefaut: 'normal', notes: '', _seed: true,
      createdAt: serverTimestamp(),
    }).then(r => r.id),
    addDoc(collection(db, 'clients'), {
      nom: 'Renaud Laurent', type: 'particulier', siret: '',
      adresse: { rue: '22 rue du Château', cp: '92100', ville: 'Boulogne-Billancourt' },
      contact: { nom: 'Renaud Laurent', tel: '0678901234', email: 'renaud.laurent@gmail.com' },
      regimeTVADefaut: 'reduit', notes: 'Rénovation particulier', _seed: true,
      createdAt: serverTimestamp(),
    }).then(r => r.id),
  ])

  // ── Chantiers ──────────────────────────────────────────────────────────────
  onProgress('Création chantiers…')
  const [chanDupontId, chanMartinId, chanRenaudId] = await Promise.all([
    addDoc(collection(db, 'chantiers'), {
      nom: 'Ravalement Dupont', clientId: dupontId, typeChantier: 'renovation',
      adresse: { rue: '15 rue de Vaugirard', cp: '75015', ville: 'Paris', lat: 48.8430, lng: 2.2935 },
      statut: 'en_cours', avancement: 75, nbOuvriers: 4,
      dateDebut: ts('2026-04-01'), dateFin: ts('2026-07-31'),
      description: 'Ravalement complet façade + isolation', _seed: true,
      createdAt: serverTimestamp(),
    }).then(r => r.id),
    addDoc(collection(db, 'chantiers'), {
      nom: 'Façade Martin', clientId: martinId, typeChantier: 'renovation',
      adresse: { rue: '8 avenue de Fontenay', cp: '94300', ville: 'Vincennes', lat: 48.8475, lng: 2.4390 },
      statut: 'en_cours', avancement: 20, nbOuvriers: 2,
      dateDebut: ts('2026-05-15'), dateFin: ts('2026-08-31'),
      description: 'Réfection façade complète', _seed: true,
      createdAt: serverTimestamp(),
    }).then(r => r.id),
    addDoc(collection(db, 'chantiers'), {
      nom: 'Rénovation Renaud', clientId: renaudId, typeChantier: 'renovation',
      adresse: { rue: '22 rue du Château', cp: '92100', ville: 'Boulogne-Billancourt', lat: 48.8404, lng: 2.2360 },
      statut: 'en_attente', avancement: 0, nbOuvriers: 0,
      dateDebut: null, dateFin: null,
      description: 'En attente de démarrage — devis accepté', _seed: true,
      createdAt: serverTimestamp(),
    }).then(r => r.id),
  ])

  // ── Comptes Firebase Auth + profils ───────────────────────────────────────
  onProgress('Création comptes de test (patron / chef / ouvrier / comptable)…')
  const testAccounts = [
    { email: 'patron@scaffold-test.fr',    password: 'Test1234!', nom: 'Boughazi', prenom: 'Test-Patron', role: 'patron',      tauxJournalier: 0   },
    { email: 'chef@scaffold-test.fr',      password: 'Test1234!', nom: 'Benali',   prenom: 'Test-Chef',   role: 'chef_equipe', tauxJournalier: 280 },
    { email: 'ouvrier@scaffold-test.fr',   password: 'Test1234!', nom: 'Leclerc',  prenom: 'Test-Ouvrier',role: 'ouvrier',     tauxJournalier: 220 },
    { email: 'comptable@scaffold-test.fr', password: 'Test1234!', nom: 'Dubois',   prenom: 'Test-Compta', role: 'comptable',   tauxJournalier: 0   },
  ]
  for (const acc of testAccounts) {
    const authUid = await createAuthAccount(acc.email, acc.password, `${acc.prenom} ${acc.nom}`)
    if (authUid) {
      const snap = await getDoc(doc(db, 'users', authUid))
      if (!snap.exists()) {
        await setDoc(doc(db, 'users', authUid), {
          nom: acc.nom, prenom: acc.prenom, email: acc.email,
          role: acc.role, actif: true, telephone: '',
          adresse: { rue: '', cp: '', ville: '' },
          typeContrat: 'CDI', gpsAutorise: true,
          tauxJournalier: acc.tauxJournalier,
          _seed: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        })
      }
    }
  }

  // ── Ouvriers fictifs (profils sans compte Auth) ────────────────────────────
  onProgress('Création ouvriers fictifs…')
  const [ahmedId, nabilId, samirId] = await Promise.all([
    addDoc(collection(db, 'users'), {
      nom: 'Kaddouri', prenom: 'Ahmed', poste: 'monteur', role: 'ouvrier',
      actif: true, telephone: '0611223344', email: '',
      adresse: { rue: '', cp: '', ville: '' },
      typeContrat: 'CDI', gpsAutorise: true, tauxJournalier: 220,
      _seed: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }).then(r => r.id),
    addDoc(collection(db, 'users'), {
      nom: 'Rami', prenom: 'Nabil', poste: 'monteur', role: 'ouvrier',
      actif: true, telephone: '0622334455', email: '',
      adresse: { rue: '', cp: '', ville: '' },
      typeContrat: 'CDI', gpsAutorise: true, tauxJournalier: 220,
      _seed: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }).then(r => r.id),
    addDoc(collection(db, 'users'), {
      nom: 'Dali', prenom: 'Samir', poste: 'aide-monteur', role: 'ouvrier',
      actif: true, telephone: '0633445566', email: '',
      adresse: { rue: '', cp: '', ville: '' },
      typeContrat: 'CDI', gpsAutorise: true, tauxJournalier: 200,
      _seed: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }).then(r => r.id),
  ])

  // ── Factures ───────────────────────────────────────────────────────────────
  onProgress('Création factures…')
  const facturesData = [
    {
      numero: 'FAC-2025-001', clientId: dupontId, chantierId: chanDupontId,
      statut: 'payee', regimeTVA: 'reduit',
      dateEmission: ts('2025-09-01'), dateEcheance: ts('2025-10-01'),
      lignes: [ligne('Installation échafaudage — Ravalement Dupont', 'forfait', 1, 4200, 0.10)],
      totalHT: 4200, totalTVA: 420, totalTTC: 4620,
      totalPaye: 4620, solde: 0,
      paiements: [{ date: '2025-10-05', montant: 4620, mode: 'virement', reference: 'VIR-001' }],
    },
    {
      numero: 'FAC-2025-002', clientId: martinId, chantierId: chanMartinId,
      statut: 'envoyee', regimeTVA: 'normal',
      dateEmission: ts('2025-10-15'), dateEcheance: ts('2026-07-30'),
      lignes: [ligne('Pose échafaudage façade — Façade Martin', 'forfait', 1, 7000, 0.20)],
      totalHT: 7000, totalTVA: 1400, totalTTC: 8400,
      totalPaye: 0, solde: 8400, paiements: [],
    },
    {
      numero: 'FAC-2025-003', clientId: dupontId, chantierId: chanDupontId,
      statut: 'envoyee', regimeTVA: 'reduit',
      dateEmission: ts('2025-11-01'), dateEcheance: ts('2025-12-01'), // EN RETARD
      lignes: [ligne('Prolongation chantier + matériaux supplémentaires', 'forfait', 1, 13616, 0.10)],
      totalHT: 13616, totalTVA: 1361.60, totalTTC: 14977.60,
      totalPaye: 0, solde: 14977.60, paiements: [],
    },
    {
      numero: 'FAC-2025-004', clientId: renaudId, chantierId: chanRenaudId,
      statut: 'brouillon', regimeTVA: 'reduit',
      dateEmission: ts('2026-06-01'), dateEcheance: ts('2026-07-01'),
      lignes: [ligne('Rénovation Renaud — phase 1', 'forfait', 1, 2909, 0.10)],
      totalHT: 2909, totalTVA: 290.90, totalTTC: 3199.90,
      totalPaye: 0, solde: 3199.90, paiements: [],
    },
    {
      numero: 'FAC-2025-005', clientId: martinId, chantierId: chanMartinId,
      statut: 'annulee', regimeTVA: 'normal',
      dateEmission: ts('2025-08-01'), dateEcheance: ts('2025-09-01'),
      lignes: [ligne('Façade Martin — phase 2 (annulé)', 'forfait', 1, 5000, 0.20)],
      totalHT: 5000, totalTVA: 1000, totalTTC: 6000,
      totalPaye: 0, solde: 0, paiements: [],
    },
  ]
  for (const f of facturesData) {
    await addDoc(collection(db, 'factures'), {
      ...f, notes: '', pdfUrl: null, devisId: null,
      _seed: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  }

  // ── Pointages ──────────────────────────────────────────────────────────────
  onProgress('Création pointages…')
  const pointagesData = [
    // Ahmed — lun/mar/mer semaine 24 · validés GPS
    { ouvrierId: ahmedId, chantierId: chanDupontId, date: '2026-06-09', heureDebut: '07:30', heureFin: '17:00', heuresTravaillees: 9, statut: 'valide',    tracesGPS: [{ lat: 48.8430, lng: 2.2935, ts: '2026-06-09T07:30' }, { lat: 48.8431, lng: 2.2936, ts: '2026-06-09T12:00' }] },
    { ouvrierId: ahmedId, chantierId: chanDupontId, date: '2026-06-10', heureDebut: '07:30', heureFin: '17:00', heuresTravaillees: 9, statut: 'valide',    tracesGPS: [{ lat: 48.8430, lng: 2.2935, ts: '2026-06-10T07:30' }] },
    { ouvrierId: ahmedId, chantierId: chanDupontId, date: '2026-06-11', heureDebut: '07:30', heureFin: '17:00', heuresTravaillees: 9, statut: 'valide',    tracesGPS: [{ lat: 48.8430, lng: 2.2935, ts: '2026-06-11T07:30' }] },
    // Nabil — lun/mar validés · mer absent
    { ouvrierId: nabilId, chantierId: chanMartinId, date: '2026-06-09', heureDebut: '08:00', heureFin: '17:00', heuresTravaillees: 8, statut: 'valide',    tracesGPS: [{ lat: 48.8475, lng: 2.4390, ts: '2026-06-09T08:00' }] },
    { ouvrierId: nabilId, chantierId: chanMartinId, date: '2026-06-10', heureDebut: '08:00', heureFin: '17:00', heuresTravaillees: 8, statut: 'valide',    tracesGPS: [{ lat: 48.8475, lng: 2.4390, ts: '2026-06-10T08:00' }] },
    // Samir — lun validé · mar hors zone GPS → a_verifier
    { ouvrierId: samirId, chantierId: chanDupontId, date: '2026-06-09', heureDebut: '08:00', heureFin: '17:00', heuresTravaillees: 8, statut: 'valide',    tracesGPS: [{ lat: 48.8430, lng: 2.2935, ts: '2026-06-09T08:00' }] },
    { ouvrierId: samirId, chantierId: chanDupontId, date: '2026-06-10', heureDebut: '08:00', heureFin: '16:30', heuresTravaillees: 7.5, statut: 'a_verifier', tracesGPS: [{ lat: 48.8510, lng: 2.3100, ts: '2026-06-10T08:00' }], notePatron: 'Hors zone GPS' },
  ]
  for (const p of pointagesData) {
    await addDoc(collection(db, 'pointages'), {
      ...p,
      pause: 60, heuresSupp: 0,
      chantierAdresse: p.chantierId === chanDupontId
        ? { lat: 48.8430, lng: 2.2935 }
        : { lat: 48.8475, lng: 2.4390 },
      validePar: null, dateValidation: null,
      syncStatus: 'synced', createdOffline: false,
      _seed: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  }

  // ── Stock ──────────────────────────────────────────────────────────────────
  onProgress('Création stock…')
  await Promise.all([
    addDoc(collection(db, 'stock'), { nom: 'Cadres aluminium 2m', categorie: 'cadres',   quantiteTotale: 50,  quantiteDisponible: 12, quantiteMin: 15, etat: 'bon', prixAchat: 35,   notes: 'ALERTE stock bas', _seed: true, updatedAt: serverTimestamp() }),
    addDoc(collection(db, 'stock'), { nom: 'Planches bois 3m',    categorie: 'planches', quantiteTotale: 30,  quantiteDisponible: 3,  quantiteMin: 10, etat: 'bon', prixAchat: 12,   notes: 'ALERTE stock bas', _seed: true, updatedAt: serverTimestamp() }),
    addDoc(collection(db, 'stock'), { nom: 'Tubes acier Ø48',     categorie: 'tubes',    quantiteTotale: 120, quantiteDisponible: 45, quantiteMin: 20, etat: 'bon', prixAchat: 8.50, notes: '',                _seed: true, updatedAt: serverTimestamp() }),
  ])

  // ── Trésorerie ─────────────────────────────────────────────────────────────
  onProgress('Création trésorerie…')
  const tresoData = [
    // Encaissements juin 2026 → total 38 240€
    { type: 'encaissement', categorie: 'facture',        label: 'Paiement chantier Ravalement Dupont', montant: 20000, date: '2026-06-02', mode: 'virement',    source: 'manuel' },
    { type: 'encaissement', categorie: 'facture',        label: 'Paiement chantier Façade Martin',     montant: 12000, date: '2026-06-05', mode: 'virement',    source: 'manuel' },
    { type: 'encaissement', categorie: 'acompte',        label: 'Acompte Renaud Laurent',              montant:  3240, date: '2026-06-10', mode: 'cheque',      source: 'manuel' },
    { type: 'encaissement', categorie: 'autre',          label: 'Remboursement assurance matériel',    montant:  3000, date: '2026-06-14', mode: 'virement',    source: 'manuel' },
    // Décaissements juin 2026 → total 13 930€
    { type: 'decaissement', categorie: 'achat_materiel', label: 'Achats matériaux — Lebrun fournitures', montant: 5000, date: '2026-06-01', mode: 'virement',    source: 'manuel' },
    { type: 'decaissement', categorie: 'salaire',        label: 'Salaires semaine 22',                   montant: 4800, date: '2026-06-03', mode: 'virement',    source: 'manuel' },
    { type: 'decaissement', categorie: 'achat_materiel', label: 'Location nacelle élévatrice',           montant: 2500, date: '2026-06-08', mode: 'virement',    source: 'manuel' },
    { type: 'decaissement', categorie: 'charges',        label: 'Charges sociales mai 2026',             montant: 1630, date: '2026-06-11', mode: 'prelevement', source: 'manuel' },
  ]
  for (const m of tresoData) {
    await addDoc(collection(db, 'tresorerie'), { ...m, _seed: true, createdAt: serverTimestamp() })
  }

  // Solde de trésorerie : 24 310€
  await setDoc(doc(db, 'tresorerie_solde', 'current'), {
    solde: 24310,
    totalEncaisseMonth: 38240,
    totalDecaisseMonth: 13930,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  onProgress('✅ Seed terminé !')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
export async function resetSeed(onProgress = () => {}) {
  onProgress('Suppression données de seed…')
  const COLS = ['clients', 'chantiers', 'factures', 'pointages', 'stock', 'tresorerie', 'users']
  for (const col of COLS) {
    const snap = await getDocs(query(collection(db, col), where('_seed', '==', true)))
    for (const d of snap.docs) {
      await deleteDoc(doc(db, col, d.id))
    }
    if (snap.size > 0) onProgress(`${col} : ${snap.size} doc(s) supprimé(s)`)
  }
  onProgress('✅ Reset terminé !')
}
