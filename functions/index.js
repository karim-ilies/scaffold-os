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
    const { pdfBase64 } = request.data
    if (!pdfBase64) throw new HttpsError('invalid-argument', 'pdfBase64 requis.')

    const apiKey = anthropicKey.value()
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: `Tu lis un bon de commande (BDC) de travaux d'échafaudage en France.
Extrais les informations et retourne UNIQUEMENT un JSON valide (sans markdown) :
{
  "clientNom": "nom de l'entreprise qui envoie le BDC",
  "clientAdresse": "adresse complete du client",
  "chantierNom": "nom ou reference du chantier",
  "chantierAdresse": "adresse du chantier",
  "dateIntervention": "YYYY-MM-DD",
  "description": "description courte des travaux",
  "montantHT": nombre en euros,
  "tauxTVA": 0.20 ou 0.10 ou 0,
  "montantTVA": nombre en euros,
  "montantTTC": nombre en euros
}
Si une info est absente, mets null.` }
          ]
        }]
      })
    })
    if (!resp.ok) throw new HttpsError('internal', 'Erreur IA ' + resp.status)
    const j = await resp.json()
    const t = j.content?.[0]?.text || '{}'
    const m = t.match(/\{[\s\S]*\}/)
    try { return JSON.parse(m?.[0] || '{}') } catch { return {} }
  }
)
