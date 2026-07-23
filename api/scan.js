// Lee una boleta con Claude. La clave de API vive solo en el servidor,
// nunca llega al navegador.

const PROMPT = `Eres un lector de boletas y cuentas de restaurante. Devuelve SOLO un objeto JSON válido, sin markdown, sin explicaciones.

Formato exacto:
{"comercio":"","fecha":"YYYY-MM-DD","moneda":"CLP|ARS|USD","items":[{"nombre":"","monto":0}],"propina":0,"impuesto":0,"total":0}

Reglas:
- Un item por línea de consumo. Si una línea trae cantidad (ej: 2 cervezas), usa el monto total de esa línea y deja la cantidad en el nombre.
- "propina" es propina o servicio. "impuesto" es IVA u otros cargos separados. Si no aparecen, usa 0.
- No incluyas propina ni impuesto dentro de items.
- Moneda: infiere por símbolos, montos y contexto. Si no puedes, usa "CLP".
- Si la fecha no aparece, usa "".
- Todos los montos como números, sin separadores de miles ni símbolos.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Solo POST");
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(503).send("Falta configurar ANTHROPIC_API_KEY en Vercel");
  }

  const image = req.body && req.body.image;
  if (typeof image !== "string" || image.length < 100) {
    return res.status(400).send("Imagen inválida");
  }
  // ~6 MB de base64 como techo, para que nadie abuse del endpoint
  if (image.length > 8_000_000) {
    return res.status(413).send("Imagen demasiado grande");
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: image },
              },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).send("La API respondió " + r.status + ": " + detail.slice(0, 300));
    }

    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).send("Error al contactar la API: " + (e.message || "desconocido"));
  }
}
