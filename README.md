# 🎡 ¿Qué anime empiezo?

Una ruleta que elige por vos qué anime arrancar (o retomar), armada dinámicamente a partir de tu lista de **MyAnimeList**.

Toma los animes en **Plan to Watch** y **On Hold** de un usuario de MAL, los muestra en una ruleta y sortea uno al azar, devolviendo su **nombre** y su **tipo** (TV, Movie, ONA, OVA, etc.).

## Demo

👉 https://lergio.github.io/ruleta_ptw/

## Funcionalidades

- Trae la lista directamente desde tu cuenta de MyAnimeList escribiendo tu usuario (no requiere login ni contraseña).
- Combina **Plan to Watch** y **On Hold** en una sola ruleta.
- Filtros por tipo de anime (TV, Movie, OVA, etc.) y por estado (todos / plan to watch / en espera).
- En los animes "en espera" muestra cuántos episodios ya viste y desde cuál retomar.
- Botón **"Ya lo empecé" / "Ya lo retomé"**: saca ese anime de la ruleta (se guarda en tu navegador, por usuario).
- Botón **"Borrar y girar de nuevo"**: descarta el último resultado sin marcarlo como empezado y vuelve a girar.
- Historial de tiradas anteriores, con opción de limpiarlo.
- Soporta modo claro/oscuro y es responsive.

## Estructura del proyecto

```
├── index.html              # Página principal
├── style.css                # Estilos
├── js/
│   ├── api.js                # Cliente de la API v2 de MyAnimeList (vía proxy)
│   └── ruleta.js              # Lógica de la ruleta y de la interfaz
└── proxy-cloudflare/
    └── worker.js              # Proxy CORS (Cloudflare Worker) — no se sube a GitHub Pages
```

## Cómo funciona

MyAnimeList no permite llamar a su API directamente desde el navegador (no envía cabeceras CORS), así que las peticiones no van directo a `api.myanimelist.net`: pasan primero por un **Cloudflare Worker** propio que actúa de proxy.

```
navegador (GitHub Pages) → Cloudflare Worker → API de MyAnimeList
```

El worker:
- Reenvía la consulta a `https://api.myanimelist.net/v2`, agregando el header `X-MAL-CLIENT-ID` con el Client ID (guardado como variable secreta, nunca expuesto en el código del navegador).
- Devuelve la respuesta con las cabeceras CORS habilitadas solo para el dominio de esta app.
- Solo reenvía pedidos `GET`; no expone ninguna operación que modifique la cuenta de MyAnimeList.

`js/api.js` pagina automáticamente los estados `plan_to_watch` y `on_hold` del endpoint [`GET /users/{user_name}/animelist`](https://myanimelist.net/apiconfig/references/api/v2#operation/users_user_id_animelist_get), los combina sin duplicados y los deja listos para la ruleta.

## Configuración (para levantar tu propia copia)

### 1. Client ID de MyAnimeList

Creá una app en [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) y anotá el **Client ID**.

### 2. Proxy en Cloudflare Workers (gratis)

1. Creá una cuenta en [Cloudflare](https://dash.cloudflare.com/sign-up).
2. **Workers & Pages** → **Create** → creá un Worker (ej: `mal-proxy`).
3. Abrí **Edit code**, pegá el contenido de `proxy-cloudflare/worker.js` y hacé **Deploy**.
4. En **Settings → Variables and Secrets**, agregá una variable secreta `MAL_CLIENT_ID` con tu Client ID.
5. En `proxy-cloudflare/worker.js`, ajustá `ALLOWED_ORIGIN` con el dominio exacto donde vas a publicar la app (sin ruta, ej: `https://tu-usuario.github.io`), y volvé a hacer Deploy.
6. Copiá la URL pública del worker (`https://mal-proxy.tu-usuario.workers.dev`).

### 3. Conectar la app al proxy

En `js/api.js`, seteá `BASE_URL` con la URL del worker:

```js
BASE_URL: "https://mal-proxy.tu-usuario.workers.dev",
```

### 4. Publicar

Con GitHub Pages alcanza con subir el repo y activarlo en **Settings → Pages**, apuntando a la rama y carpeta donde está `index.html`.

## Uso

1. Entrá a la app y escribí tu nombre de usuario de MyAnimeList.
2. Tocá **Cargar lista**.
3. Ajustá los filtros de tipo/estado si querés acotar la ruleta.
4. Tocá **Girar**.

## Privacidad

La app no guarda tu usuario ni tu lista en ningún servidor propio: la lista se pide en el momento a MyAnimeList (vía el proxy) y solo se guarda localmente en tu navegador qué animes marcaste como "ya empezado", asociado a tu nombre de usuario.
