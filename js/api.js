"use strict";

/**
 * Cliente mínimo de la API v2 de MyAnimeList.
 * Endpoints usados:
 *   GET /users/{user_name}/animelist
 *   https://myanimelist.net/apiconfig/references/api/v2#operation/users_user_id_animelist_get
 *   GET /anime/{anime_id} (solo para el campo related_anime del resultado sorteado,
 *   que no se puede pedir en el endpoint de la lista)
 *
 * Expone un único global: MalApi
 *   MalApi.configure({ baseUrl, pageSize })
 *   MalApi.fetchWatchlist(username) -> Promise<Anime[]>
 *   MalApi.fetchRelatedAnime(id) -> Promise<RelatedAnime[]>
 *
 * Anime = { id, t (título), y (tipo), e (episodios totales, 0 = sin dato),
 *           w (episodios vistos), s ("plan_to_watch" | "on_hold"),
 *           yr (año de estreno, número o null si no está disponible),
 *           img (URL de la portada en tamaño mediano, o null si no hay),
 *           genres (array de strings, puede estar vacío),
 *           durMin (duración por episodio en minutos, o null si no está disponible),
 *           u (boolean: true si todavía no se emitió / no tiene fecha de estreno
 *              confirmada en el pasado — cuenta para el total pero no entra al sorteo) }
 *
 * RelatedAnime = { id, t (título), rel (relation_type en inglés), relLabel (en español) }
 */
const MalApi = (() => {
  const CONFIG = {
    // MyAnimeList no permite llamadas directas desde el navegador (CORS),
    // así que BASE_URL apunta a tu proxy (ver proxy-cloudflare/worker.js),
    // que reenvía a https://api.myanimelist.net/v2 agregando el Client ID.
    // Reemplazá esto por la URL que te dio Cloudflare al desplegar el worker.
    BASE_URL: "https://mal-proxy.chiito53452.workers.dev",
    // Máximo permitido por la API para este endpoint: 1000
    PAGE_SIZE: 1000,
  };

  // Estados de la lista que alimentan la ruleta (la API acepta un solo status por pedido).
  const STATUSES = ["plan_to_watch", "on_hold"];

  const TYPE_LABELS = {
    tv: "TV",
    movie: "Movie",
    ova: "OVA",
    ona: "ONA",
    special: "Special",
    tv_special: "TV Special",
    music: "Music",
    unknown: "Unknown",
  };

  // Traducción de relation_type (documentados por MAL, más algunos extra que
  // devuelve la API en la práctica aunque no figuren en la referencia).
  const RELATION_LABELS = {
    sequel: "Secuela",
    prequel: "Precuela",
    alternative_setting: "Ambientación alternativa",
    alternative_version: "Versión alternativa",
    side_story: "Historia secundaria",
    parent_story: "Historia principal",
    summary: "Resumen",
    full_story: "Historia completa",
    spin_off: "Spin-off",
    adaptation: "Adaptación",
    character: "Comparte personajes",
    other: "Relacionado",
  };

  class MalError extends Error {
    /** kind: config | network | auth | forbidden | notfound | badrequest | http */
    constructor(kind, message, status) {
      super(message);
      this.name = "MalError";
      this.kind = kind;
      this.status = status;
    }
  }

  function configure(opts = {}) {
    if (opts.baseUrl) CONFIG.BASE_URL = opts.baseUrl;
    if (opts.pageSize) CONFIG.PAGE_SIZE = opts.pageSize;
  }

  function errorForStatus(status) {
    switch (status) {
      case 400: return new MalError("badrequest", "Solicitud inválida.", status);
      case 401: return new MalError("auth", "Client ID inválido o token rechazado.", status);
      case 403: return new MalError("forbidden", "Acceso denegado.", status);
      case 404: return new MalError("notfound", "Usuario no encontrado.", status);
      default: return new MalError("http", `MyAnimeList respondió con error ${status}.`, status);
    }
  }

  async function request(path, params) {
    if (!CONFIG.BASE_URL || CONFIG.BASE_URL.includes("TU-USUARIO")) {
      throw new MalError("config", "Falta configurar la URL del proxy en BASE_URL.");
    }
    const url = new URL(CONFIG.BASE_URL.replace(/\/+$/, "") + path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    let res;
    try {
      res = await fetch(url.toString());
    } catch (err) {
      throw new MalError("network", "No se pudo conectar con el proxy.");
    }
    if (!res.ok) throw errorForStatus(res.status);
    return res.json();
  }

  /** Descarga todas las páginas de un status. */
  async function fetchStatus(username, status) {
    const items = [];
    let offset = 0;
    for (;;) {
      const page = await request(`/users/${encodeURIComponent(username)}/animelist`, {
        status,
        limit: CONFIG.PAGE_SIZE,
        offset,
        fields: "list_status,media_type,num_episodes,start_date,status,main_picture,genres,average_episode_duration",
        nsfw: "true",
      });
      const data = Array.isArray(page.data) ? page.data : [];
      items.push(...data);
      const hasNext = page.paging && page.paging.next;
      if (!hasNext || data.length === 0) break;
      offset += data.length;
    }
    return items;
  }

  function toAnime(item) {
    const node = item.node || {};
    const ls = item.list_status || {};
    // MAL indica el estado de emisión con "status": not_yet_aired | currently_airing | finished_airing.
    // Si por algún motivo no viene ese campo, usamos start_date como respaldo: sin fecha = todavía no emitido.
    const upcoming = node.status ? node.status === "not_yet_aired" : !node.start_date;
    const yearMatch = typeof node.start_date === "string" && node.start_date.match(/^\d{4}/);
    const pic = node.main_picture || {};
    const genres = Array.isArray(node.genres) ? node.genres.map((g) => g && g.name).filter(Boolean) : [];
    const durSec = node.average_episode_duration || 0;
    return {
      id: node.id,
      t: node.title || "(sin título)",
      y: TYPE_LABELS[node.media_type] || TYPE_LABELS.unknown,
      e: node.num_episodes || 0,
      w: ls.num_episodes_watched || 0,
      s: ls.status,
      yr: yearMatch ? Number(yearMatch[0]) : null,
      img: pic.medium || pic.large || null,
      genres,
      durMin: durSec > 0 ? Math.round(durSec / 60) : null,
      u: upcoming,
    };
  }

  /** Plan to watch + On hold de un usuario, sin duplicados. */
  async function fetchWatchlist(username) {
    const results = await Promise.all(STATUSES.map((s) => fetchStatus(username, s)));
    const byId = new Map();
    results.flat().forEach((item) => {
      const a = toAnime(item);
      if (a.id != null && !byId.has(a.id)) byId.set(a.id, a);
    });
    return [...byId.values()].sort((x, y) => x.t.localeCompare(y.t));
  }

  // Para no hacer demasiado largo el resultado, de todos los relation_type que
  // existen (ver RELATION_LABELS) solo nos interesan precuela y secuela.
  const RELATED_KINDS = new Set(["prequel", "sequel"]);

  /** Precuela y secuela (si existen) de un anime puntual. */
  async function fetchRelatedAnime(id) {
    const data = await request(`/anime/${encodeURIComponent(id)}`, { fields: "related_anime" });
    const rel = Array.isArray(data.related_anime) ? data.related_anime : [];
    return rel
      .filter((r) => r.node && r.node.id != null && RELATED_KINDS.has(r.relation_type))
      .map((r) => ({
        id: r.node.id,
        t: r.node.title || "(sin título)",
        rel: r.relation_type,
        relLabel: RELATION_LABELS[r.relation_type] || r.relation_type_formatted || r.relation_type || "Relacionado",
      }));
  }

  return { configure, fetchWatchlist, fetchRelatedAnime, MalError };
})();
