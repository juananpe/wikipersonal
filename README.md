# Visor de personas

Una interfaz HTML que renderiza los Markdown al abrirlos. Los archivos `info.md`
siguen siendo la única fuente de contenido: no se generan copias HTML ni hace
falta compilar o instalar paquetes.

## Abrir

Con Python 3.9 o posterior, desde esta carpeta:

```sh
python3 serve.py --reload
```

Abre <http://127.0.0.1:8765>. Para elegir otro puerto:

```sh
python3 serve.py --reload --port 9000
```

Las fichas se leen de la carpeta indicada en `PEOPLE_FOLDER` del archivo `.env`
(copia `.env.example` a `.env`). Por ejemplo:

```sh
PEOPLE_FOLDER=/opt/people
```

Si no se define, se usan las fichas dentro de este repositorio. Una variable de
entorno del shell tiene prioridad sobre `.env`.

Detén el servidor con `Ctrl+C`. La interfaz necesita el servidor; no se abre
directamente haciendo doble clic en `index.html`.

## Uso

- Busca por nombre o por cualquier texto del contenido, sin distinguir acentos.
- Abre una persona y salta entre secciones con el índice lateral.
- Los enlaces relativos a otros Markdown se abren dentro del visor.
- «Ver Markdown» muestra el archivo original; los enlaces externos se abren en otra pestaña.
- Puedes guardar una URL de una ficha o sección y usar Atrás/Adelante del navegador.
- Para añadir personas, crea una carpeta con un `info.md` y un título `# Nombre`.
- Con `--reload`, al editar, añadir o eliminar un Markdown se actualizan contenido,
  directorio y búsqueda automáticamente (comprobación cada segundo). Se conservan
  la ficha, sección, búsqueda y posición de lectura. También detecta cambios en la interfaz.
- Sin `--reload`, puedes recargar la página manualmente.

El servidor lee las carpetas en cada petición. Solo escucha en `127.0.0.1`.
Los cambios en Markdown no requieren reiniciar el proceso del servidor.
La interfaz y las bibliotecas se sirven localmente; no se envían los perfiles
a servicios externos. Los enlaces externos solo se visitan al pulsarlos.

## Implementación

`serve.py` descubre los perfiles y sirve los Markdown y recursos locales.
`viewer/app.js` los convierte con [Marked](https://marked.js.org/) y limpia el
HTML con [DOMPurify](https://github.com/cure53/DOMPurify). Las versiones y
licencias están en `viewer/vendor/`. Las tablas, listas, imágenes y enlaces
se renderizan en el navegador. Los bloques de código tienen formato, sin
resaltado de sintaxis. No incluye las funciones colaborativas de GitHub.
