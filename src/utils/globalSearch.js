import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'

export async function globalSearch(term) {
  if (!term || term.trim().length < 2) return {}
  const t = term.trim()
  const isFac   = /^(FAC|DEV)-/i.test(t)
  const isPhone = /^\d{10}$/.test(t.replace(/\s/g, ''))

  const results = {}
  const tasks   = []

  if (isPhone) {
    tasks.push(
      _searchClients(t).then(r  => { results.clients  = r }),
      _searchOuvriers(t).then(r => { results.ouvriers = r }),
    )
  } else if (isFac) {
    tasks.push(_searchFactures(t).then(r => { results.factures = r }))
  } else {
    tasks.push(
      _searchClients(t).then(r   => { results.clients   = r }),
      _searchFactures(t).then(r  => { results.factures  = r }),
      _searchChantiers(t).then(r => { results.chantiers = r }),
      _searchOuvriers(t).then(r  => { results.ouvriers  = r }),
    )
  }

  await Promise.allSettled(tasks)
  return results
}

const low = s => (s || '').toLowerCase()
const matchAny = (fields, term) => fields.some(f => low(f).includes(low(term)))

async function _searchClients(term) {
  try {
    const snap = await getDocs(query(collection(db, 'clients'), orderBy('nom'), limit(30)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(c => matchAny([c.nom, c.telephone, c.siret, c.adresse?.ville], term))
      .slice(0, 5)
  } catch { return [] }
}

async function _searchFactures(term) {
  try {
    const snap = await getDocs(query(collection(db, 'factures'), orderBy('numero', 'desc'), limit(50)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(f => matchAny([f.numero, f.clientNom, f.chantierNom], term))
      .slice(0, 5)
  } catch { return [] }
}

async function _searchChantiers(term) {
  try {
    const snap = await getDocs(query(collection(db, 'chantiers'), orderBy('nom'), limit(30)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(c => matchAny([c.nom, c.clientNom, c.adresse?.ville, c.chefEquipeNom], term))
      .slice(0, 5)
  } catch { return [] }
}

async function _searchOuvriers(term) {
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('nom'), limit(30)))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(u => matchAny([u.nom, u.prenom, u.telephone], term))
      .slice(0, 5)
  } catch { return [] }
}

export function highlight(text, term) {
  if (!term || !text) return text || ''
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return text
  return (
    text.slice(0, idx) +
    '##MARK##' + text.slice(idx, idx + term.length) + '##/MARK##' +
    text.slice(idx + term.length)
  )
}
