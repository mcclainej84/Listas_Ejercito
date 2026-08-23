"""Convierte PNG de siluetas en las figuras del diseñador de emblemas.

QUÉ ESPERA. Un directorio de PNG cuadrados con la figura en NEGRO sobre fondo
TRANSPARENTE (el canal alfa es lo que se traza; el color no se mira). 512 px o
más. Un archivo por figura, y el nombre del archivo es la clave: `04_dragon.png`
-> `dragon`. El número inicial se descarta.

QUÉ PRODUCE. `figuras.json`, que es lo que carga la aplicación desde
`webapp/public/assets/emblemas/figuras.json`. Cada figura queda como:

    "dragon": {"n": "Dragon", "g": "bestias", "d": "M…z", "w": 940, "h": 1000}

  · `d`  el contorno relleno, SIN color, dibujado en un cuadro de 1000×1000 y
         centrado en él.
  · `w`/`h`  la caja real de la figura dentro de ese cuadro. Viaja aparte porque
         es lo que permite encajarla en el contorno sin deformarla: una lanza es
         190×1000 y una faja 1000×300 (ver domain/emblemaDeEjercito#encajarFigura).
  · `n`  nombre visible. Sale del nombre del archivo; se retoca a mano después.
  · `g`  grupo del catálogo. Igual: se asigna a ojo y se corrige.

POR QUÉ ENTEROS Y COMANDOS RELATIVOS. Son 120 figuras y el archivo se descarga
entero. Redondear a entero sobre un cuadro de 1000 (0,1 % de error, invisible
incluso a tamaño grande) y emitir `c`/`l`/`h`/`v` en vez de coordenadas
absolutas baja el archivo a menos de la mitad. Los deltas se calculan sobre los
enteros YA redondeados, no sobre los originales, para que el error no se acumule
a lo largo del trazo.

CÓMO SE USA. Hace falta `potrace` (apt install potrace) y Pillow:

    python3 trazar_figuras.py CARPETA_CON_LOS_PNG figuras.json

Los parámetros de abajo son el equilibrio que salió bien con las 120 actuales:
más resolución da más detalle y un archivo enorme; menos, siluetas que se
redondean. Ver docs/ENCARGO_EMBLEMAS.md para lo que se le pide al dibujo.
"""
import glob, os, re, subprocess, sys, json, tempfile
from PIL import Image, ImageFilter

ORIGEN = sys.argv[1] if len(sys.argv) > 1 else '.'
DESTINO = sys.argv[2] if len(sys.argv) > 2 else 'figuras.json'
TMP = tempfile.mkdtemp(prefix='figuras-')
FUENTE = sorted(glob.glob(os.path.join(ORIGEN, '*.png')))
RES = 1024
TURD = 30
ALPHA = 1.33             # cuánto redondea las esquinas potrace
# EL DESENFOQUE ES LO QUE QUITA LOS DIENTES DE SIERRA. El PNG de origen trae el
# borde escalonado, y potrace lo copia tal cual: sale un vector con la escalera
# dentro, que a tamaño grande se ve exactamente igual de pixelado que el PNG.
# Desenfocar el alfa antes de umbralizar convierte esa escalera en una curva. Y
# el archivo sale MÁS PEQUEÑO, porque una curva limpia necesita menos nodos.
BLUR = 5.0               # en píxeles de RES; súbelo si aún se ven dientes
OPT = 0.5

num = re.compile(r'-?\d+(?:\.\d+)?')

def leer_d(svg: str) -> str:
    m = re.search(r'<path d="([^"]+)"', svg)
    return m.group(1) if m else ''

def a_absoluto(d: str, escala: float, alto: float):
    """potrace: coords *10 y eje Y invertido con transform. Devuelve subpaths
    como listas de ('M'|'C'|'L', puntos...) en coordenadas ya enderezadas."""
    tokens = re.findall(r'[MmLlCcVvHhZz]|-?\d+(?:\.\d+)?', d)
    i = 0
    x = y = 0.0
    sub = []
    subpaths = []
    cmd = None
    def T(px, py):
        return (px * escala, alto - py * escala)
    while i < len(tokens):
        t = tokens[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            i += 1
            if cmd in 'Zz':
                if sub:
                    subpaths.append(sub)
                    sub = []
                continue
        n = lambda k: float(tokens[i + k])
        if cmd in 'Mm':
            nx, ny = (n(0), n(1)) if cmd == 'M' else (x + n(0), y + n(1))
            i += 2
            if sub:
                subpaths.append(sub)
            sub = [('M', T(nx, ny))]
            x, y = nx, ny
            cmd = 'L' if cmd == 'M' else 'l'
        elif cmd in 'Ll':
            nx, ny = (n(0), n(1)) if cmd == 'L' else (x + n(0), y + n(1))
            i += 2
            sub.append(('L', T(nx, ny)))
            x, y = nx, ny
        elif cmd in 'Hh':
            nx = n(0) if cmd == 'H' else x + n(0)
            i += 1
            sub.append(('L', T(nx, y)))
            x = nx
        elif cmd in 'Vv':
            ny = n(0) if cmd == 'V' else y + n(0)
            i += 1
            sub.append(('L', T(x, ny)))
            y = ny
        elif cmd in 'Cc':
            if cmd == 'C':
                p = [(n(0), n(1)), (n(2), n(3)), (n(4), n(5))]
            else:
                p = [(x + n(0), y + n(1)), (x + n(2), y + n(3)), (x + n(4), y + n(5))]
            i += 6
            sub.append(('C', T(*p[0]), T(*p[1]), T(*p[2])))
            x, y = p[2]
        else:
            i += 1
    if sub:
        subpaths.append(sub)
    return subpaths

def caja(subpaths):
    xs, ys = [], []
    for sp in subpaths:
        for seg in sp:
            for p in seg[1:]:
                xs.append(p[0]); ys.append(p[1])
    return min(xs), min(ys), max(xs), max(ys)

def emitir(subpaths, k, dx, dy):
    """Escala/traslada, redondea a entero y emite en comandos relativos."""
    out = []
    cx = cy = 0
    for sp in subpaths:
        for seg in sp:
            pts = [(round(p[0] * k + dx), round(p[1] * k + dy)) for p in seg[1:]]
            if seg[0] == 'M':
                out.append(f'M{pts[0][0]} {pts[0][1]}')
                cx, cy = pts[0]
            elif seg[0] == 'L':
                ddx, ddy = pts[0][0] - cx, pts[0][1] - cy
                if ddx == 0 and ddy == 0:
                    continue
                out.append(f'v{ddy}' if ddx == 0 else f'h{ddx}' if ddy == 0 else f'l{ddx} {ddy}')
                cx, cy = pts[0]
            else:
                a, b, c = pts
                out.append(f'c{a[0]-cx} {a[1]-cy} {b[0]-cx} {b[1]-cy} {c[0]-cx} {c[1]-cy}')
                cx, cy = c
        out.append('z')
    return ''.join(out)

os.makedirs(TMP, exist_ok=True)
figuras = {}
for f in FUENTE:
    nombre = os.path.splitext(os.path.basename(f))[0]
    clave = re.sub(r'^\d+_', '', nombre)
    im = Image.open(f).convert('RGBA').getchannel('A')
    im = im.resize((RES, RES), Image.LANCZOS).filter(ImageFilter.GaussianBlur(BLUR)).point(lambda v: 0 if v > 128 else 255).convert('1')
    pbm = f'{TMP}/{clave}.pbm'
    im.save(pbm)
    svg = f'{TMP}/{clave}.svg'
    subprocess.run(['potrace', '-s', '-o', svg, '--flat', '-a', str(ALPHA),
                    '-O', str(OPT), '-t', str(TURD), pbm], check=True)
    d = leer_d(open(svg).read())
    if not d:
        print('VACIO', clave); continue
    subpaths = a_absoluto(d, 0.1, RES)      # potrace escala 10x
    x0, y0, x1, y1 = caja(subpaths)
    w, h = x1 - x0, y1 - y0
    k = 1000.0 / max(w, h)                  # lado mayor -> 1000
    dx = -x0 * k + (1000 - w * k) / 2
    dy = -y0 * k + (1000 - h * k) / 2
    figuras[clave] = {
        'n': clave.replace('_', ' ').capitalize(),
        'g': 'simbolos',                    # se reparte a mano después
        'd': emitir(subpaths, k, dx, dy),
        'w': round(w * k),                  # ancho real dentro del cuadro 1000
        'h': round(h * k),
    }

json.dump(figuras, open(DESTINO, 'w'), separators=(',', ':'), ensure_ascii=False)
tot = sum(len(v['d']) for v in figuras.values())
print('figuras:', len(figuras), 'bytes de path:', tot, 'media:', tot // max(1, len(figuras)))
