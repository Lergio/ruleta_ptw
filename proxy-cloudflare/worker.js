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
 *
 * Seguridad: además de las cabeceras CORS (que solo respeta el navegador),
 * este worker valida del lado del servidor que:
 *  - el pedido venga con el header Origin igual a ALLOWED_ORIGIN (bloquea
 *    llamadas directas con curl/scripts que no manden ese header),
 *  - el método sea GET,
 *  - la ruta sea /users/{usuario}/animelist o /anime/{id} (esta última se
 *    usa para traer los animes relacionados del resultado sorteado),
 *  - en /animelist, el parámetro "status" sea plan_to_watch u on_hold.
 * Nada de esto es infalible (un atacante decidido puede falsear el header
 * Origin), pero frena el abuso casual de tu Client ID y tu cuota de la API
 * sin agregar pasos de instalación.
 */

const ALLOWED_ORIGIN = "https://lergio.github.io"; // el origen nunca incluye el path (ej: /ruleta_ptw/)
const UPSTREAM = "https://api.myanimelist.net/v2";
const LIST_PATH_RE = /^\/users\/[^/]+\/animelist$/;
const DETAILS_PATH_RE = /^\/anime\/\d+$/;
const ALLOWED_STATUS = new Set(["plan_to_watch", "on_hold"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonError(status, error, message) {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "GET") {
      return jsonError(405, "method_not_allowed", "Este proxy solo acepta GET.");
    }

    const origin = request.headers.get("Origin");
    if (ALLOWED_ORIGIN !== "*" && origin !== ALLOWED_ORIGIN) {
      return jsonError(403, "forbidden_origin", "Origen no permitido.");
    }

    const url = new URL(request.url);
    const isList = LIST_PATH_RE.test(url.pathname);
    const isDetails = DETAILS_PATH_RE.test(url.pathname);
    if (!isList && !isDetails) {
      return jsonError(404, "not_found", "Ruta no permitida en este proxy.");
    }
    if (isList) {
      const status = url.searchParams.get("status");
      if (status && !ALLOWED_STATUS.has(status)) {
        return jsonError(400, "bad_status", "El parámetro status debe ser plan_to_watch u on_hold.");
      }
    }

    if (!env.MAL_CLIENT_ID) {
      return jsonError(500, "server_config", "Falta la variable MAL_CLIENT_ID en el worker.");
    }

    const upstreamUrl = UPSTREAM + url.pathname + url.search;

    let upstreamRes;
    try {
      upstreamRes = await fetch(upstreamUrl, {
        headers: { "X-MAL-CLIENT-ID": env.MAL_CLIENT_ID },
      });
    } catch (err) {
      return jsonError(502, "upstream_unreachable", String(err));
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
