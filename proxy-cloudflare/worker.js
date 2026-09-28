/**
 * Proxy CORS para la API de MyAnimeList.
 *
 * MyAnimeList no permite llamadas directas desde el navegador (no manda
 * cabeceras CORS), así que este worker recibe el pedido desde tu página,
 * lo reenvía a https://api.myanimelist.net/v2 agregando el Client ID,
 * y devuelve la respuesta con las cabeceras CORS habilitadas.
 *
 * Instalación (gratis, sin tarjeta):
 *  1. Creá una cuenta en https://dash.cloudflare.com/sign-up
 *  2. En el panel, andá a "Workers & Pages" -> "Create" -> "Create Worker".
 *  3. Ponele un nombre (ej: "mal-proxy") y desplegalo.
 *  4. Abrí "Edit code", borrá el contenido de ejemplo, pegá este archivo
 *     completo, y hacé click en "Deploy".
 *  5. En el panel del worker, andá a "Settings" -> "Variables and Secrets"
 *     y agregá una variable llamada MAL_CLIENT_ID con tu Client ID de
 *     https://myanimelist.net/apiconfig (marcala como secreta/encrypt).
 *  6. Copiá la URL que te da Cloudflare, algo como:
 *     https://mal-proxy.TU-USUARIO.workers.dev
 *  7. En js/api.js de tu app, poné esa URL en BASE_URL (ver comentario ahí).
 *     El CLIENT_ID de api.js ya no hace falta, porque ahora vive en el
 *     worker; podés dejarlo vacío o con cualquier valor no usado.
 *
 * Opcional pero recomendado: en "Settings" -> "Triggers" restringí qué
 * dominios pueden llamar a este worker cambiando ALLOWED_ORIGIN abajo
 * por tu dominio de GitHub Pages (ej: "https://lergio.github.io"), en vez
 * de "*". Así nadie más puede usar tu Client ID a través de tu proxy.
 */

const ALLOWED_ORIGIN = "https://lergio.github.io"; // reemplazá por "https://lergio.github.io" para restringir
const UPSTREAM = "https://api.myanimelist.net/v2";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (!env.MAL_CLIENT_ID) {
      return new Response(
        JSON.stringify({ error: "server_config", message: "Falta la variable MAL_CLIENT_ID en el worker." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    const url = new URL(request.url);
    // Todo lo que llega después de la raíz del worker se reenvía tal cual a la API de MAL.
    const upstreamUrl = UPSTREAM + url.pathname + url.search;

    let upstreamRes;
    try {
      upstreamRes = await fetch(upstreamUrl, {
        headers: { "X-MAL-CLIENT-ID": env.MAL_CLIENT_ID },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "upstream_unreachable", message: String(err) }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } }
      );
    }

    const body = await upstreamRes.text();
    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        "Content-Type": upstreamRes.headers.get("Content-Type") || "application/json",
        ...corsHeaders(),
      },
    });
  },
};
