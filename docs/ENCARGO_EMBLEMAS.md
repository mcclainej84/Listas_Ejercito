# Encargo: figuras heráldicas para los emblemas de ejército

> **YA HAY 120 FIGURAS.** Llegaron como PNG en negro sobre transparente (el
> "plan B" del apartado 7) y están trazadas a vectorial en
> `webapp/public/assets/emblemas/figuras.json`. Este documento sigue valiendo
> para pedir MÁS: es lo que hay que decirle a quien las dibuje.
>
> Para incorporarlas, no hay que tocar código:
>
> ```
> apt install potrace && pip install pillow
> python3 docs/trazar_figuras.py CARPETA_DE_LOS_PNG nuevas.json
> ```
>
> y fundir `nuevas.json` con el que ya hay, repasando a mano el nombre visible
> (`n`) y el grupo del catálogo (`g`) de cada una. El resto —encajarla en el
> contorno, teñirla, la miniatura del catálogo— sale solo.
>
> Los PNG valen perfectamente y son más fáciles de encargar que un SVG limpio,
> así que **el apartado 7 es ahora el camino recomendado**, no el plan B: figura
> en negro puro, fondo transparente, y nada más.
>
> **DOS COSAS QUE NO SON NEGOCIABLES, Y LAS DOS SON DE TAMAÑO:**
>
> 1. **Un archivo por figura.** Una hoja de contactos con las 120 juntas NO
>    sirve, por grande que parezca: en una hoja de 1536 px con once columnas,
>    cada figura ocupa unos 70 px. Recortarla y vectorizarla da una mancha —el
>    dragón pierde la cola, el castillo las ventanas, el león la melena—, y eso
>    ya no lo arregla ningún ajuste del trazador. Es exactamente el "sale
>    pixelado" del que veníamos huyendo.
>
> 2. **Cuanto más grandes, mejor: 1024 × 1024 como mínimo, 2048 si la
>    herramienta llega.** El vector no puede inventarse lo que no está en el
>    origen: con 512 px el trazo sale bien, pero las líneas de un milímetro —la
>    membrana del ala, el enrejado de una torre— llegan justas. Ese es hoy el
>    techo de calidad del catálogo, y solo sube subiendo el origen.

Documento para pasarle a una herramienta de generación (o a un ilustrador). Todo
lo que hay aquí son requisitos para que lo que llegue entre en WHArmy **sin
retocar nada**.

---

## 1. Para qué son

En WHArmy, cada ejército puede llevar su propio emblema. El emblema se monta en
la aplicación con cuatro piezas, y **solo se encarga una de ellas**:

| Pieza | Quién la hace |
|---|---|
| El campo (el fondo) y su partición (faja, palo, banda, cuartelado…) | La aplicación |
| El contorno del escudo | La aplicación |
| El marco, el viñeteado y el acabado | La aplicación |
| **La FIGURA de dentro** (la cruz, el águila, la calavera…) | **Esto es lo que se encarga** |

**Por eso la figura llega suelta y sin color**: el usuario elige el color del
fondo y el de la figura en un diseñador, y la aplicación los aplica en el
momento. Una figura que traiga sus propios colores no sirve para nada.

---

## 2. Requisitos técnicos — innegociables

Cada figura, **un archivo SVG**:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">
  <path d="..."/>
  <path fill-rule="evenodd" d="..."/>
</svg>
```

1. **`viewBox="0 0 480 480"`**, cuadrado. Sin `width` ni `height` (los pone la aplicación).
2. **Sin ningún color**. Ni `fill`, ni `stroke`, ni `style`, ni `class`, ni
   `opacity`. Los elementos heredan el color, que se inyecta desde fuera. El
   único atributo de pintura permitido es **`fill-rule="evenodd"`**.
3. **Solo formas rellenas.** Nada de `stroke`. Si el dibujo necesita una línea,
   esa línea tiene que estar convertida a contorno relleno. Un trazo se rompe al
   escalar y desaparece a tamaño pequeño.
4. **Los huecos, con `fill-rule="evenodd"`** dentro del mismo `<path>` (las
   cuencas de una calavera, las ventanas de una torre, la pupila de un ojo). No
   se puede "tapar" un hueco pintándolo del color del fondo: el fondo cambia.
5. **Prohibido**: `<image>`, gradientes, `filter`, `mask`, `clipPath`,
   `<pattern>`, `<text>`, `<use>`, animaciones y grupos con `transform` que
   dependan de un sistema de coordenadas externo.
6. Solo `<path>`, `<circle>`, `<rect>`, `<ellipse>`, `<polygon>` y `<g>` simples.
7. **Un solo color, plano.** Sin sombras, sin degradados, sin volumen, sin
   perspectiva. Es heráldica, no ilustración.

---

## 3. Caja segura, tamaño y peso

- **Toda la figura dentro de `x ∈ [120, 360]`, `y ∈ [120, 360]`** (un cuadrado
  de 240×240 centrado en 240,240). Fuera de ahí la recorta el contorno del
  escudo.
- **Que llene esa caja**: el lado mayor de la figura, entre 200 y 240 unidades.
  Si una figura sale a 120 y otra a 235, en el catálogo unas parecen enormes y
  otras diminutas.
- **Centrada ópticamente**, no matemáticamente. Un creciente o un rayo se
  centran a ojo.
- **Grosor mínimo de cualquier parte: 16 unidades.** **Hueco mínimo entre dos
  partes: 12 unidades.** Por debajo de eso se emborrona.
- **La prueba que hay que pasar**: reducida a **40 × 40 píxeles y en un solo
  color**, la figura tiene que seguir reconociéndose. Ese es el tamaño al que
  sale en el listado de ejércitos. Si a 40 px es una mancha, no vale por bonita
  que sea a tamaño grande.
- Simétrica cuando la figura lo sea por tradición (cruz, águila, corona, flor de
  lis). Asimétrica solo donde toca (creciente, rayo, hacha de una hoja).

---

## 4. Prompt para copiar y pegar

> Diseña una **figura heráldica medieval** de «NOMBRE DE LA FIGURA» como **SVG
> de una sola silueta plana**.
>
> - Lienzo `viewBox="0 0 480 480"`. Toda la figura dentro del cuadrado
>   x 120–360, y 120–360, ocupando entre 200 y 240 unidades de lado mayor y
>   centrada ópticamente.
> - **Un solo color, y sin declararlo**: ningún atributo `fill`, `stroke`,
>   `style`, `class` ni `opacity` en ningún elemento. Solo se permite
>   `fill-rule="evenodd"`.
> - **Solo formas rellenas**, nunca trazos. Los detalles interiores (ojos,
>   ventanas, huecos) se hacen como agujeros con `fill-rule="evenodd"` dentro
>   del mismo `path`, nunca pintando encima del color de fondo.
> - Sin degradados, sombras, filtros, máscaras, texto, imágenes ni animación.
> - Estilo: **heráldica plana**, contundente y simétrica, como el mueble de un
>   escudo de armas del siglo XIV. Nada de perspectiva ni de volumen.
> - Grosor mínimo de cualquier parte, 16 unidades; hueco mínimo entre partes,
>   12 unidades. Tiene que reconocerse reducida a 40 × 40 píxeles.
>
> Devuelve solo el código SVG.

---

## 5. Las figuras

Nombre del archivo: **la clave**, en minúsculas y con guiones. `cruz-paty.svg`.

| Clave | Nombre visible | Qué debe representar |
|---|---|---|
| `cruz-paty` | Cruz paté | Cruz griega de brazos que se ensanchan hacia las puntas, lados cóncavos |
| `sotuer` | Sotuer | Cruz en aspa (San Andrés), brazos gruesos hasta el borde |
| `creciente` | Creciente | Luna en cuarto, cuernos hacia arriba, gruesa |
| `estrella` | Estrella | Estrella de ocho puntas, puntas rectas |
| `mullete` | Estrella de seis | Estrella de seis puntas, más ancha que la anterior |
| `sol` | Sol radiante | Disco central con rayos triangulares alrededor |
| `rueda` | Engranaje | Rueda dentada con el buje hueco |
| `torre` | Torre | Torreón almenado con puerta en arco y dos ventanas huecas |
| `lis` | Flor de lis | Flor de lis clásica: tres pétalos, banda horizontal y pie |
| `aguila` | Águila | Águila explayada de frente, alas abiertas, cabeza de perfil |
| `calavera` | Calavera | Cráneo de frente con las cuencas huecas, sobre dos tibias cruzadas |
| `espadas` | Espadas cruzadas | Dos espadas en aspa, con guarda, empuñadura y pomo |
| `martillo` | Martillo de guerra | Maza de cabeza rectangular con mango y pomo |
| `hacha` | Hacha | Hacha de una hoja, filo en media luna, mango largo |
| `corona` | Corona | Corona de cinco puntas rematadas en perla, con aro |
| `garra` | Garra | Tres zarpazos curvos y paralelos |
| `arbol` | Roble | Árbol de copa redonda y lobulada, tronco corto y raíz |
| `llama` | Llama | Llama única, lengua de fuego, contundente |
| `rayo` | Rayo | Rayo en zigzag de dos quiebros |
| `ojo` | Ojo | Ojo abierto de frente, iris y pupila huecos |
| `yelmo` | Yelmo | Yelmo cerrado de frente, con la vista y las respiraderas huecas |
| `roeles` | Tres roeles | Tres discos en triángulo (dos abajo, uno arriba) |
| `rombo` | Rombo | Losange con el centro hueco |

**Bienvenidas de más** (estas no me salieron bien y ahí hay hueco): dragón,
grifo, serpiente, cabeza de lobo, cabeza de carnero, cuervo, mano, ancla,
campana, luna y estrella, arpa, jabalí.

---

## 6. Cómo se comprueba lo que llegue

Antes de darlo por bueno, cada archivo:

1. Abre en el navegador y **no se ve nada** (correcto: no tiene color propio;
   hereda). Para mirarlo, envuélvelo:
   `<div style="color:#f6efdc;background:#3a2f28">…svg aquí…</div>`
2. **Buscar y que no aparezca**: `fill=`, `stroke=`, `style=`, `class=`,
   `opacity`, `<image`, `linearGradient`, `filter`, `mask`, `clipPath`, `<text`.
   Lo único permitido es `fill-rule=`.
3. **Reducir a 40 px** y comprobar que se reconoce.
4. Que ninguna coordenada se salga de 120–360.

Mándamelos como estén y los reviso, los corrijo si hace falta y los integro. Si
alguno no cumple algo de esto, casi siempre se arregla en un minuto (quitar los
`fill`, convertir trazos a contorno, reescalar a la caja).

---

## 7. Si la herramienta solo devuelve PNG

Sirve, con condiciones:

- **512 × 512**, fondo **transparente**.
- La figura en **negro puro** sobre transparencia, sin colores intermedios más
  allá del suavizado del borde.
- Sin sombras ni bordes de otro color.

Con eso puedo teñirla desde la aplicación usándola como máscara. Pesa más y no
escala igual de fino que un SVG, así que es el plan B.
