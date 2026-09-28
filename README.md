# 🎰 Ruleta PTW

Una ruleta interactiva para decidir **qué anime ver a continuación** cuando la lista de pendientes empieza a ser demasiado grande.

El proyecto nació como una forma sencilla de elegir aleatoriamente entre los animes que tengo pendientes, tanto los que todavía no empecé como aquellos que dejé en espera para retomarlos más adelante.

## ✨ Características

* 🎰 **Ruleta interactiva** para seleccionar un anime al azar.
* 📺 Soporte para distintos tipos de contenido:

  * `TV`
  * `Movie`
  * `ONA`
  * `OVA`
  * `Special`
  * `TV Special`
* 🔄 Tres modos de selección:

  * **Todos** — incluye animes sin empezar y animes en espera.
  * **Sin empezar** — solamente animes que todavía no comencé.
  * **En espera** — solamente animes que ya empecé y dejé pendientes.
* 🏷️ Filtros por tipo de anime.
* 📊 Contador de animes disponibles según los filtros seleccionados.
* ▶️ Indicación del episodio desde el que retomar un anime que estaba en espera.
* 📝 Historial de las últimas tiradas.
* 💾 Guarda localmente los animes que ya fueron seleccionados para evitar que vuelvan a aparecer.
* ↩️ Permite deshacer la selección de un anime y devolverlo a la ruleta.
* 🔁 Permite borrar el resultado actual y volver a girar.
* 🌙 Soporte para modo claro y oscuro.
* ♿ Respeta la configuración de reducción de movimiento del sistema.
* 📱 Diseño adaptable para escritorio y dispositivos móviles.

## 🎯 ¿Cómo funciona?

La lista de animes está almacenada directamente en el archivo HTML.

Cada anime contiene la siguiente información:

```javascript
{
    "t": "Nombre del anime",
    "y": "TV",
    "e": 12,
    "w": 0
}
```

Los campos representan:

| Campo | Significado                  |
| ----- | ---------------------------- |
| `t`   | Título del anime             |
| `y`   | Tipo de contenido            |
| `e`   | Cantidad total de episodios  |
| `w`   | Cantidad de episodios vistos |

Por ejemplo:

```javascript
{
    "t": "Bocchi the Rock!",
    "y": "TV",
    "e": 12,
    "w": 1
}
```

significa que **Bocchi the Rock!** tiene 12 episodios y que ya se vio 1 episodio.

Cuando `w` es `0`, el anime se considera **sin empezar**.

Cuando `w` es mayor que `0`, se considera **en espera**.

## 🎲 Modos de la ruleta

### Todos

Incluye todos los animes disponibles, independientemente de si fueron empezados o no.

### Sin empezar

Incluye únicamente los animes cuyo número de episodios vistos es `0`.

### En espera

Incluye únicamente los animes que ya tienen episodios vistos.

En este modo, cuando la ruleta selecciona un anime, muestra desde qué episodio se debería continuar.

Por ejemplo:

> En espera: viste 5 de 12. Retomá desde el episodio 6.

## 🏷️ Filtros por tipo

Además del estado, se puede filtrar la ruleta por tipo de contenido.

Los tipos disponibles se generan automáticamente a partir de los datos de la lista, por lo que no es necesario modificar el código si se agrega un nuevo tipo.

## 💾 Persistencia

La ruleta utiliza `localStorage` del navegador para recordar los animes que ya fueron seleccionados.

Esto significa que, después de sacar un anime, este deja de aparecer en las siguientes tiradas.

La información se guarda únicamente en el navegador utilizado y **no se envía a ningún servidor**.

Desde la propia interfaz se puede utilizar:

**"Restaurar los X que ya saqué"**

para devolver todos esos animes a la ruleta.

## 📝 Historial

Cada tirada se agrega al historial de la sesión.

El historial muestra las últimas tiradas realizadas y puede limpiarse desde:

**Tiradas anteriores → Limpiar lista**

El historial no forma parte de la lista permanente de animes seleccionados.

## 🚀 Uso

El proyecto no necesita instalación ni dependencias.

Simplemente descargá o cloná el repositorio y abrí:

```text
Ruleta_PTW.html
```

en un navegador moderno.

También puede utilizarse directamente desde una página estática, como GitHub Pages.

## 🛠️ Modificar la lista de animes

La lista se encuentra en la constante:

```javascript
const ALL = [...]
```

Cada entrada tiene esta estructura:

```javascript
{
    "t": "Nombre",
    "y": "TV",
    "e": 12,
    "w": 0
}
```

Por ejemplo:

```javascript
{
    "t": "Steins;Gate",
    "y": "TV",
    "e": 24,
    "w": 0
}
```

### Agregar un anime sin empezar

Utilizar:

```javascript
"w": 0
```

### Agregar un anime que quedó en espera

Si se vieron, por ejemplo, 7 episodios:

```javascript
"w": 7
```

La ruleta calculará automáticamente que debe retomarse desde el episodio 8.

## 🎨 Tecnologías

El proyecto está desarrollado utilizando únicamente tecnologías web del lado del cliente:

* **HTML5**
* **CSS3**
* **JavaScript**
* **Canvas API**
* **LocalStorage API**
* **Google Fonts**

No utiliza frameworks ni librerías JavaScript externas.

## 📁 Estructura

Actualmente el proyecto está pensado para mantenerse simple:

```text
Ruleta_PTW/
└── Ruleta_PTW.html
```

La aplicación completa —estructura, estilos, datos y lógica— se encuentra dentro del archivo HTML.

## 📌 Estado del proyecto

Proyecto personal en desarrollo.

La lista de animes y las funcionalidades de la ruleta pueden modificarse y ampliarse con el tiempo.

---

### 💡 Idea del proyecto

> "Tengo demasiados animes pendientes y no sé cuál ver."

La solución:

> **Que decida la ruleta.** 🎰

---

## 📜 Licencia

Este proyecto se distribuye bajo la licencia que se indique en el archivo `LICENSE`.
