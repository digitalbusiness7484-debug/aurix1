/* ============================================================
   AURIX — Fonction serverless Netlify : synthese vocale ElevenLabs
   ============================================================
   Recoit le texte depuis le frontend, appelle ElevenLabs COTE
   SERVEUR (la cle n est jamais visible du client), renvoie l audio
   en base64. Meme contrat technique que la version Azure precedente
   (POST {text}, reponse audio/mpeg en base64) - AUCUN changement
   necessaire cote AURIX.html, seul ce fichier change.

   Variable d environnement requise (a definir dans Netlify,
   jamais dans le code) :
     ELEVENLABS_API_KEY - cle de ton compte ElevenLabs

   IMPORTANT, deja signale : le tier gratuit ElevenLabs interdit
   l usage commercial (attribution obligatoire, pas de monetisation).
   AURIX etant vendu a des clients, le tier Starter (5$/mois minimum)
   est necessaire pour rester en regle avec leurs conditions.
*/

/* Configuration centralisee : modifiable ici sans toucher au reste
   du code. voiceId = celle choisie dans la bibliotheque ElevenLabs.
   stability/similarityBoost regle le naturel de la voix : une
   stability plus basse (0.3-0.5) donne plus de variation naturelle
   d intonation, plus haute (0.7+) donne une voix plus constante mais
   plus proche du ton monotone - equilibre choisi ici pour eviter les
   deux extremes. */
const VOICE_CONFIG = {
  voiceId: "XE7sQPEca4v0CCW4WxUl",
  modelId: "eleven_multilingual_v2",
  stability: 0.5,
  similarityBoost: 0.75
};

exports.handler = async function (event) {
  const headersCORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: headersCORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headersCORS, body: JSON.stringify({ error: "Methode non autorisee" }) };
  }

  const cleAPI = process.env.ELEVENLABS_API_KEY;

  if (!cleAPI) {
    return {
      statusCode: 500,
      headers: headersCORS,
      body: JSON.stringify({ error: "ELEVENLABS_API_KEY manquant dans les variables d environnement Netlify" })
    };
  }

  let texte;
  try {
    const donnees = JSON.parse(event.body || "{}");
    texte = donnees.text;
  } catch (e) {
    return { statusCode: 400, headers: headersCORS, body: JSON.stringify({ error: "Corps de requete invalide" }) };
  }

  if (!texte || !texte.trim()) {
    return { statusCode: 400, headers: headersCORS, body: JSON.stringify({ error: "Texte manquant" }) };
  }

  const texteLimite = texte.length > 3000 ? texte.slice(0, 3000) : texte;

  try {
    const reponseEL = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_CONFIG.voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": cleAPI,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text: texteLimite,
          model_id: VOICE_CONFIG.modelId,
          voice_settings: {
            stability: VOICE_CONFIG.stability,
            similarity_boost: VOICE_CONFIG.similarityBoost
          }
        })
      }
    );

    if (!reponseEL.ok) {
      const detail = await reponseEL.text().catch(() => "");
      return {
        statusCode: reponseEL.status,
        headers: headersCORS,
        body: JSON.stringify({ error: `ElevenLabs a refuse la requete (HTTP ${reponseEL.status})`, detail: detail.slice(0, 300) })
      };
    }

    const tampon = Buffer.from(await reponseEL.arrayBuffer());
    return {
      statusCode: 200,
      headers: { ...headersCORS, "Content-Type": "audio/mpeg" },
      body: tampon.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: headersCORS,
      body: JSON.stringify({ error: "Impossible de contacter ElevenLabs : " + e.message })
    };
  }
};
