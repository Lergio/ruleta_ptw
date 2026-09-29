"use strict";

/**
 * Cliente mínimo de la API v2 de MyAnimeList.
 * Endpoint usado: GET /users/{user_name}/animelist
 * https://myanimelist.net/apiconfig/references/api/v2#operation/users_user_id_animelist_get
 *
 * Expone un único global: MalApi
 *   MalApi.configure({ clientId, baseUrl, pageSize })
 *   MalApi.fetchWatchlist(username) -> Promise<Anime[]>
 *
 * Anime = { id, t (título), y (tipo), e (episodios totales, 0 = sin dato),
 *           w (episodios vistos), s ("plan_to_watch" | "on_hold"),
 *           u (boolean: true si todavía no se emitió / no tiene fecha de estreno
 *              confirmada en el pasado — cuenta para el total pero no entra al sorteo) }
 */
const MalApi = (() => {
  const CONFIG = {
    // MyAnimeList no permite llamadas directas desde el navegador (CORS),
    // así que BASE_URL apunta a tu proxy (ver proxy-cloudflare/worker.js),
    // que reenvía a https://api.myanimelist.net/v2 agregando el Client ID.
    // Reemplazá esto por la URL que te dio Cloudflare al desplegar el worker.
    BASE_URL: "https://mal-proxy.chiito53452.workers.dev/",
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
        fields: "list_status,media_type,num_episodes,start_date,status",
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
    return {
      id: node.id,
      t: node.title || "(sin título)",
      y: TYPE_LABELS[node.media_type] || TYPE_LABELS.unknown,
      e: node.num_episodes || 0,
      w: ls.num_episodes_watched || 0,
      s: ls.status,
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

  return { configure, fetchWatchlist, MalError };
})();
