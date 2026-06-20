const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret }      = require('firebase-functions/params')

const anthropicKey = defineSecret('ANTHROPIC_API_KEY')

exports.analyseTicket = onCall(
  { region: 'europe-west1', secrets: [anthropicKey] },
  async (request) => {
    // Vérification auth
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Vous devez être connecté.')
    }

    const { imageBase64, mimeType } = request.data
    if (!imageBase64 || !mimeType) {
      throw new HttpsError('invalid-argument', 'imageBase64 et mimeType requis.')
    }

    const apiKey = anthropicKey.value()

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Analyse ce ticket de caisse. Retourne UNIQUEMENT un objet JSON valide sans markdown, avec ces champs : montant (nombre décimal en euros, ex: 45.90), date (format YYYY-MM-DD), type (repas|carburant|materiel|autre), description (texte court). Si un champ est illisible, mets null.',
            },
          ],
        }],
      }),
    })

    if (!resp.ok) {
      throw new HttpsError('internal', `Anthropic error ${resp.status}`)
    }

    const json   = await resp.json()
    const text   = json.content?.[0]?.text || '{}'
    const match  = text.match(/\{[\s\S]*\}/)

    try {
      return JSON.parse(match?.[0] || '{}')
    } catch {
      return {}
    }
  }
)

exports.factureVocale = onCall(
  { region: 'europe-west1', secrets: [anthropicKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Vous devez être connecté.')
    }

    const { transcription, clients, chantiers } = request.data
    if (!transcription) {
      throw new HttpsError('invalid-argument', 'transcription requise.')
    }

    const clientsListe = (clients || []).map(c => c.nom).join(', ')
    const chantiersListe = (chantiers || []).map(c => `${c.nom} (client: ${c.clientNom || '?'})`).join(', ')

    const apiKey = anthropicKey.value()

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `Tu es un assistant de facturation pour une entreprise d'échafaudage.
Le patron vient de dicter une facture vocalement. Voici la transcription :
"${transcription}"

Clients existants : ${clientsListe || 'aucun'}
Chantiers existants : ${chantiersListe || 'aucun'}

Extrais les informations et retourne UNIQUEMENT un objet JSON valide (sans markdown) avec :
{
  "clientNom": "nom exact du client existant ou null",
  "chantierNom": "nom exact du chantier existant ou null",
  "type": "regie" ou "forfait",
  "description": "description courte de la prestation",
  "nbOuvriers": nombre ou null,
  "nbJours": nombre ou null,
  "tauxJournalier": nombre en euros ou null,
  "montantForfait": nombre en euros si forfait ou null,
  "notes": "toute info supplémentaire mentionnée"
}

Règles :
- Si le patron dit "3 ouvriers pendant 4 jours", c'est type "regie"
- Si le patron donne un montant global, c'est type "forfait"
- Cherche le client et chantier les plus proches dans les listes existantes
- Si tu n'es pas sûr d'un champ, mets null`
        }],
      }),
    })

    if (!resp.ok) {
      throw new HttpsError('internal', `Anthropic error ${resp.status}`)
    }

    const json = await resp.json()
    const text = json.content?.[0]?.text || '{}'
    const match = text.match(/\{[\s\S]*\}/)

    try {
      return JSON.parse(match?.[0] || '{}')
    } catch {
      return {}
    }
  }
)

exports.lireBDC = onCall(
  { region: 'europe-west1', secrets: [anthropicKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Connexion requise.')
    const { pdfBase64, mimeType } = request.data
    if (!pdfBase64) throw new HttpsError('invalid-argument', 'pdfBase64 requis.')
    const isPdf = !mimeType || mimeType === 'application/pdf'

    const apiKey = anthropicKey.value()
    const contentItem = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: pdfBase64 } }

    const prompt = `Tu lis un bon de commande (BDC) de travaux d'echafaudage en France.

ATTENTION — il y a 3 entites dans ce document :
1. LE CLIENT (celui qui ENVOIE le BDC) = l'entreprise dont le logo est en haut, ou dont les infos sont en pied de page (SIRET, adresse siege). C'est LUI qui paie. Exemples : J4R Echafaudages, ENEDIS, Bouygues...
2. LE DESTINATAIRE (section "Adresse a" ou "A l'attention de") = c'est nous (YM SERVICE / Mr BOUGHAZI). IGNORE cette section.
3. LE CHANTIER (section "Chantier") = le lieu des travaux. C'est souvent le client du client.

Extrais TOUTES les informations et retourne UNIQUEMENT un JSON valide (sans markdown) :
{
  "clientNom": "nom de l'entreprise qui ENVOIE le BDC (logo, en-tete, pied de page)",
  "clientRue": "numero et rue du SIEGE du client (PAS l'adresse du chantier)",
  "clientCP": "code postal du client (5 chiffres)",
  "clientVille": "ville du client",
  "clientEmail": "email du client (en-tete ou pied de page)",
  "clientTel": "telephone du client",
  "clientSiret": "SIRET ou TVA intra du client",
  "chantierNom": "nom ou reference du chantier (section Chantier)",
  "chantierRue": "numero et rue du CHANTIER (lieu des travaux)",
  "chantierCP": "code postal du chantier",
  "chantierVille": "ville du chantier",
  "dateIntervention": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD (si periode, sinon null)",
  "nbJours": nombre de jours prevus (1 si non precise),
  "description": "description courte des travaux",
  "montantHT": nombre en euros,
  "tauxTVA": 0.20 ou 0.10 ou 0,
  "montantTVA": nombre en euros,
  "montantTTC": nombre en euros
}
IMPORTANT :
- Le CLIENT n'est PAS "YM SERVICE" ni "BOUGHAZI" — c'est l'autre entreprise.
- Si une duree est mentionnee, calcule dateFin et nbJours.
- Cherche le SIRET, email et tel du client dans le pied de page du document.
- Si une info est absente, mets null.`

    let resp
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'pdfs-2024-09-25', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          messages: [{ role: 'user', content: [contentItem, { type: 'text', text: prompt }] }]
        })
      })
    } catch (fetchErr) {
      console.error('Fetch error:', fetchErr.message)
      throw new HttpsError('internal', 'Erreur réseau: ' + fetchErr.message)
    }

    if (!resp.ok) {
      const errBody = await resp.text()
      console.error('Anthropic error:', resp.status, errBody)
      throw new HttpsError('internal', 'Erreur IA ' + resp.status + ': ' + errBody.substring(0, 200))
    }

    const j = await resp.json()
    const t = j.content?.[0]?.text || '{}'
    const m2 = t.match(/\{[\s\S]*\}/)
    try { return JSON.parse(m2?.[0] || '{}') } catch { return {} }
  }
)
