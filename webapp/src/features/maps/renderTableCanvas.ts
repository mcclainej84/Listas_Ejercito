// ============================================================================
// Pintar una mesa en un CANVAS: el suelo, la escenografía y —si se piden— las
// peanas desplegadas. Es lo que se exporta como PNG y lo que va dentro del PDF
// del despliegue.
//
// SE DIBUJA A MANO Y NO SE CAPTURA LA PANTALLA. Capturar el DOM (html2canvas y
// similares) sale barato de escribir y caro de todo lo demás: reproduce mal los
// degradados de fondo, redondea las rotaciones, arrastra el tamaño que tuviera
// la ventana y falla en cuanto una imagen viene de otro dominio. Aquí se pinta
// desde los MISMOS datos en centímetros que usa la pantalla, a la resolución
// que se pida, y el resultado es idéntico en cualquier ordenador.
//
// LAS IMÁGENES DE R2 VIENEN CON CORS (el Worker sirve /image con
// Access-Control-Allow-Origin: *). Sin `crossOrigin = 'anonymous'` el navegador
// las pinta pero marca el canvas como "contaminado" y luego se niega a
// exportarlo: el fallo aparecería al descargar, no al dibujar, que es de los
// peores sitios donde puede aparecer.
// ============================================================================
import { RETICULA_CM, type Mesa } from '@/domain/deployment'
import { cuerpoDeAliasCm } from '@/domain/deploymentRefs'
import { DESGASTE } from '@/domain/factionColor'
import { SCENERY_KINDS_INFO, type FloorAsset, type SceneryPiece, type TexturaMapa } from '@/domain/scenery'

/** Pergamino, línea y tinta: los mismos colores que la pantalla. */
const PERGAMINO = '#e7dcc0'
const PERGAMINO_HIERBA = '#dfd9b4'
const RETICULA = 'rgba(125,121,95,.5)'
const CENTRO = 'rgba(122,36,32,.55)'
const BORDE = '#26231c'

/** Ilustraciones de fábrica, por tipo. Se piden aquí para no depender de la vista. */
function urlDeFabrica(kind: string): string | null {
  const base = import.meta.env.BASE_URL
  const nombres: Record<string, string> = {
    bosque: 'bosque',
    colina: 'colina',
    colinaRocosa: 'colina_rocosa',
    meseta: 'meseta',
    pantano: 'pantano',
    laguna: 'laguna',
    campo: 'campo',
    penasco: 'penasco',
    roca: 'roca',
    lajas: 'lajas',
    casa: 'casa',
    casaCuadrada: 'casa_cuadrada',
  }
  const nombre = nombres[kind]
  return nombre ? `${base}assets/scenery/${nombre}.webp` : null
}

/** Carga una imagen lista para pintar en canvas. Devuelve null si no se puede: una pieza sin imagen no debe tumbar la exportación. */
function cargarImagen(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export interface PeanaParaPintar {
  xCm: number
  yCm: number
  anchoCm: number
  altoCm: number
  /** Color de la facción, "#rrggbb". */
  color: string
  /** Claro u oscuro, según el color (ver domain/factionColor). */
  colorTexto: string
  /** Lo que va dentro: las iniciales, con su número si se repiten. */
  texto: string
}

export interface OpcionesDeMesa {
  mesa: Mesa
  textura: TexturaMapa
  suelo: FloorAsset | null
  piezas: SceneryPiece[]
  peanas?: PeanaParaPintar[]
  /**
   * Imagen de fondo propia del despliegue, estirada a la mesa entera. Se pinta
   * ENCIMA del suelo y debajo de todo lo demás. null = sin imagen.
   */
  imagenFondoUrl?: string | null
  /**
   * El TERRENO se pinta girado 180°: es lo que se ve desde el lado norte de la
   * mesa (ver ArmyList.deploymentSide). Las peanas NO giran — se colocan siempre
   * abajo, que es lo cómodo para quien juega.
   */
  girado?: boolean
  /** Píxeles por centímetro. 8 da 1440 × 960 en una mesa normal: nítido e imprimible. */
  pxPorCm?: number
}

/**
 * Dibuja la mesa entera y devuelve el canvas.
 *
 * El orden es el mismo que en pantalla y no es casual: suelo, retícula, línea
 * central, escenografía y por último las peanas. Cada capa tapa a la anterior
 * porque eso es justo lo que hay que ver.
 */
export async function renderTableCanvas(opciones: OpcionesDeMesa): Promise<HTMLCanvasElement> {
  const { mesa, textura, suelo, piezas, peanas = [], imagenFondoUrl = null, girado = false, pxPorCm = 8 } = opciones
  const ancho = Math.round(mesa.anchoCm * pxPorCm)
  const alto = Math.round(mesa.altoCm * pxPorCm)

  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el lienzo para exportar.')

  // ---- Terreno, girado si toca -------------------------------------------
  // El giro envuelve suelo, retícula, línea central y escenografía, y se
  // deshace ANTES de las peanas: el terreno cambia de perspectiva con el lado
  // de despliegue, las peanas no (ver `girado`). La retícula y la línea central
  // caen dentro por comodidad y no por descuido — son simétricas respecto al
  // centro, así que girarlas no cambia un solo píxel.
  ctx.save()
  if (girado) {
    ctx.translate(ancho / 2, alto / 2)
    ctx.rotate(Math.PI)
    ctx.translate(-ancho / 2, -alto / 2)
  }

  // ---- Suelo -------------------------------------------------------------
  ctx.fillStyle = textura === 'hierba' ? PERGAMINO_HIERBA : PERGAMINO
  ctx.fillRect(0, 0, ancho, alto)

  if (imagenFondoUrl) {
    // Estirada a la mesa entera, igual que en pantalla: la mesa se ajusta a la
    // imagen al subirla, así que aquí no hay nada que recortar ni encajar.
    const fondo = await cargarImagen(imagenFondoUrl)
    if (fondo) ctx.drawImage(fondo, 0, 0, ancho, alto)
  }

  if (suelo?.imageUrl) {
    const losa = await cargarImagen(suelo.imageUrl)
    if (losa) {
      const lado = suelo.tileCm * pxPorCm
      ctx.save()
      ctx.globalAlpha = suelo.opacity
      for (let y = 0; y < alto; y += lado) {
        for (let x = 0; x < ancho; x += lado) ctx.drawImage(losa, x, y, lado, lado)
      }
      ctx.restore()
    }
  } else if (textura === 'hierba') {
    // Las manchas de la hierba de fábrica, con la misma idea que en CSS: verdes
    // muy tenues repartidos sin formar cuadrícula.
    ctx.save()
    for (let i = 0; i < Math.round((mesa.anchoCm * mesa.altoCm) / 900); i++) {
      const x = ((i * 173) % mesa.anchoCm) * pxPorCm
      const y = ((i * 97) % mesa.altoCm) * pxPorCm
      const r = (6 + (i % 5) * 2) * pxPorCm
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, 'rgba(107,122,46,.10)')
      grad.addColorStop(1, 'rgba(107,122,46,0)')
      ctx.fillStyle = grad
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    ctx.restore()
  }

  // ---- Retícula y línea central ------------------------------------------
  ctx.save()
  ctx.strokeStyle = RETICULA
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.35
  for (let cm = RETICULA_CM; cm < mesa.anchoCm; cm += RETICULA_CM) {
    ctx.beginPath()
    ctx.moveTo(Math.round(cm * pxPorCm) + 0.5, 0)
    ctx.lineTo(Math.round(cm * pxPorCm) + 0.5, alto)
    ctx.stroke()
  }
  for (let cm = RETICULA_CM; cm < mesa.altoCm; cm += RETICULA_CM) {
    ctx.beginPath()
    ctx.moveTo(0, Math.round(cm * pxPorCm) + 0.5)
    ctx.lineTo(ancho, Math.round(cm * pxPorCm) + 0.5)
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = CENTRO
  ctx.lineWidth = Math.max(1, pxPorCm / 6)
  ctx.setLineDash([pxPorCm, pxPorCm])
  ctx.beginPath()
  ctx.moveTo(ancho / 2, 0)
  ctx.lineTo(ancho / 2, alto)
  ctx.stroke()
  ctx.restore()

  // ---- Escenografía ------------------------------------------------------
  // Las imágenes se cargan todas a la vez y se pintan después, en orden: una a
  // una serían decenas de idas y venidas a la red en serie.
  const imagenes = await Promise.all(
    piezas.map((p) => {
      const url = p.imageUrl ?? urlDeFabrica(p.kind)
      return url ? cargarImagen(url) : Promise.resolve(null)
    }),
  )

  piezas.forEach((pieza, i) => {
    const w = pieza.anchoCm * pxPorCm
    const h = pieza.altoCm * pxPorCm
    ctx.save()
    ctx.translate(pieza.xCm * pxPorCm, pieza.yCm * pxPorCm)
    if (pieza.rotacion) ctx.rotate((pieza.rotacion * Math.PI) / 180)
    const img = imagenes[i]
    if (img) {
      ctx.drawImage(img, -w / 2, -h / 2, w, h)
    } else {
      // Sin ilustración (los tipos vectoriales) se pinta una mancha con el
      // color del tipo: en un PNG para imprimir, una silueta reconocible vale
      // más que reproducir el SVG entero.
      ctx.fillStyle = 'rgba(107,122,46,.55)'
      ctx.strokeStyle = 'rgba(63,74,25,.9)'
      ctx.lineWidth = Math.max(1, pxPorCm / 4)
      ctx.beginPath()
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#2b2013'
      ctx.font = `${Math.round(pxPorCm * 1.6)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(pieza.nombre ?? SCENERY_KINDS_INFO[pieza.kind]?.label ?? '', 0, 0)
    }
    ctx.restore()
  })

  // Fin del terreno: se deshace el giro para que las peanas vayan derechas.
  ctx.restore()

  // ---- Peanas ------------------------------------------------------------
  if (peanas.length > 0) {
    // El mismo cuerpo de letra que en pantalla, calculado con la misma
    // función: el papel y la pantalla tienen que decir lo mismo.
    const cuerpoCm = cuerpoDeAliasCm(
      peanas.map((p) => ({ texto: p.texto, tamano: { anchoCm: p.anchoCm, altoCm: p.altoCm } })),
    )

    for (const peana of peanas) {
      const w = peana.anchoCm * pxPorCm
      const h = peana.altoCm * pxPorCm
      const x = peana.xCm * pxPorCm - w / 2
      const y = peana.yCm * pxPorCm - h / 2
      const lado = Math.max(w, h)

      // El color, y encima el MISMO desgaste que en pantalla: se lee la lista
      // de manchas de domain/factionColor, así que el papel y la pantalla
      // enseñan la misma pieza y no dos parecidas.
      ctx.fillStyle = peana.color
      ctx.fillRect(x, y, w, h)

      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, w, h)
      ctx.clip()

      for (const m of DESGASTE) {
        const cx = x + (m.x / 100) * w
        const cy = y + (m.y / 100) * h
        const rx = Math.max(1, (m.rx / 100) * w)
        const ry = Math.max(1, (m.ry / 100) * h)
        const tinta = m.luz ? '255,255,255' : '0,0,0'
        // Elipse, no círculo: se escala el lienzo y se pinta dentro un
        // degradado redondo, que es como se consiguen elipses degradadas en
        // canvas. Las manchas redondas perfectas se notan.
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(1, ry / rx)
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
        grad.addColorStop(0, `rgba(${tinta},${m.alfa})`)
        grad.addColorStop(0.72, `rgba(${tinta},0)`)
        ctx.fillStyle = grad
        ctx.fillRect(-rx, -rx, rx * 2, rx * 2)
        ctx.restore()
      }

      // Viñeteado: el borde se apaga, y así el cuadro no parece recortado.
      const vineta = ctx.createRadialGradient(
        x + w * 0.48,
        y + h * 0.44,
        lado * 0.25,
        x + w * 0.48,
        y + h * 0.44,
        lado * 0.62,
      )
      vineta.addColorStop(0, 'rgba(0,0,0,0)')
      vineta.addColorStop(1, 'rgba(0,0,0,.40)')
      ctx.fillStyle = vineta
      ctx.fillRect(x, y, w, h)

      // El canto: luz arriba, sombra abajo.
      const canto = Math.max(1, h * 0.07)
      const luz = ctx.createLinearGradient(x, y, x, y + canto)
      luz.addColorStop(0, 'rgba(255,255,255,.34)')
      luz.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = luz
      ctx.fillRect(x, y, w, canto)
      const sombra = ctx.createLinearGradient(x, y + h - canto, x, y + h)
      sombra.addColorStop(0, 'rgba(0,0,0,0)')
      sombra.addColorStop(1, 'rgba(0,0,0,.38)')
      ctx.fillStyle = sombra
      ctx.fillRect(x, y + h - canto, w, canto)
      ctx.restore()

      ctx.strokeStyle = BORDE
      ctx.lineWidth = Math.max(1, pxPorCm / 8)
      ctx.strokeRect(x, y, w, h)

      if (peana.texto) {
        ctx.save()
        ctx.fillStyle = peana.colorTexto
        ctx.font = `bold ${Math.round(cuerpoCm * pxPorCm)}px "Times New Roman", serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0,0,0,.35)'
        ctx.shadowBlur = pxPorCm / 3
        ctx.shadowOffsetY = pxPorCm / 8
        ctx.fillText(peana.texto, x + w / 2, y + h / 2)
        ctx.restore()
      }
    }
  }

  // ---- Marco -------------------------------------------------------------
  ctx.strokeStyle = BORDE
  ctx.lineWidth = Math.max(2, pxPorCm / 3)
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, ancho - ctx.lineWidth, alto - ctx.lineWidth)

  return canvas
}

/** Descarga el canvas como PNG. */
export function descargarCanvas(canvas: HTMLCanvasElement, nombreArchivo: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombreArchivo
    enlace.click()
    // Se libera en el siguiente ciclo: revocarla en el acto cancela la descarga
    // en algunos navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, 'image/png')
}
