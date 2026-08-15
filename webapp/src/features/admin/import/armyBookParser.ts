// ============================================================================
// Parser de "libro de ejército" al estilo de los Manuscritos de Nuth (Warhammer
// 6ª fan-made): una lista de ejército con secciones (COMANDANTES, HÉROES,
// UNIDADES BÁSICAS/ESPECIALES/SINGULARES) y, dentro de cada una, entradas de
// unidad con un formato muy consistente:
//
//   <Nombre de la unidad>           (puede llevar prefijo "0-1" / "0-1*")
//   M HA HP F R H I A L [TSA]        (cabecera de perfil)
//   <Nombre perfil> 12 7 6 4 3 3 8 4 10 -   (1+ filas: base, campeón, montura…)
//   Tipo de unidad: …
//   Tamaño de la unidad: 10+         (solo tropas; los personajes no lo llevan)
//   Coste: 145 puntos.  |  Coste: 12 puntos por miniatura
//   Armas: … (con opciones "Nombre (+X)" / "(+X/m)")
//   Armadura / Montura / Grupo de mando / Opciones: …
//   Reglas especiales: Regla1. Regla2. …
//
// El algoritmo se validó primero sobre los PDF reales del usuario (Elfos
// Silvanos / Reinos Enanos) antes de portarlo aquí. La extracción de TEXTO
// desde el PDF/DOCX vive aparte (extractText.ts); este módulo solo trabaja
// sobre el texto ya plano, así que es fácil de probar y no depende del
// navegador.
// ============================================================================

export interface ParsedOption {
  name: string
  cost: number
  perModel: boolean
  /** Etiqueta de origen (Armas, Armadura, Montura, Grupo de mando…) — informativa para la vista previa. */
  source: string
}

export interface ParsedProfile {
  m: string | null
  ha: string | null
  hp: string | null
  f: string | null
  r: string | null
  h: string | null
  i: string | null
  a: string | null
  l: string | null
}

export interface ParsedUnit {
  name: string
  unitType: 'tropa' | 'personaje'
  categoryCode: 'PERSONAJE' | 'BASICA' | 'ESPECIAL' | 'SINGULAR'
  isUnique: boolean
  baseCost: number | null
  /** true si el coste es "por miniatura" (tropas); false si es un coste plano (personajes/unidades únicas). */
  perModel: boolean
  minSize: number | null
  maxSize: number | null
  armorSave: number | null
  profile: ParsedProfile | null
  championProfileName: string | null
  /** Perfil del campeón/segunda fila del bloque de atributos, si la unidad trae una (p.ej. "Paladín del Bosque"). */
  championProfile: ParsedProfile | null
  equipmentText: string | null
  specialRules: string[]
  options: ParsedOption[]
  /** Avisos de parseo (p.ej. coste no numérico, posible personaje especial) para mostrar en la vista previa. */
  warnings: string[]
}

const SECTION_MAP: Record<string, { unitType: ParsedUnit['unitType']; categoryCode: ParsedUnit['categoryCode'] }> = {
  COMANDANTES: { unitType: 'personaje', categoryCode: 'PERSONAJE' },
  HÉROES: { unitType: 'personaje', categoryCode: 'PERSONAJE' },
  HEROES: { unitType: 'personaje', categoryCode: 'PERSONAJE' },
  'UNIDADES BÁSICAS': { unitType: 'tropa', categoryCode: 'BASICA' },
  'UNIDADES BASICAS': { unitType: 'tropa', categoryCode: 'BASICA' },
  'UNIDADES ESPECIALES': { unitType: 'tropa', categoryCode: 'ESPECIAL' },
  'UNIDADES SINGULARES': { unitType: 'tropa', categoryCode: 'SINGULAR' },
}

const PROFILE_HDR = /^\s*M\s+HA\s+HP\s+F\s+R\s+H\s+I\s+A\s+L(\s+TSA)?\s*$/
const STAT = /^(?:-|\d+\+?)$/
// Opción con coste: "Nombre (+X)", "(+X/m)" (por miniatura) y también el
// formato de otros libros "(+X punto)"/"(+X puntos)".
const OPTION_RE = /([A-Za-zÁÉÍÓÚÑáéíóúñ][\wÁÉÍÓÚÑáéíóúñ .]*?)\s*\(\+(\d+)\s*(\/m)?(?:\s*(?:puntos?|pts?))?\)/g
const ATTR_KEYS = ['m', 'ha', 'hp', 'f', 'r', 'h', 'i', 'a', 'l'] as const

/** Une palabras partidas por guion al final de línea ("Baila-\nrines" → "Bailarines") y colapsa espacios. */
function dehyphenate(text: string): string {
  return text
    .replace(/(\p{L})-\s+(\p{L})/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Intenta leer una fila de perfil: `ncols` últimos tokens deben ser estadísticas (número o "-"). Devuelve [nombre, stats] o null. */
function parseProfileRow(line: string, ncols: number): [string, string[]] | null {
  const toks = line.trim().split(/\s+/)
  if (toks.length < ncols) return null
  const tail = toks.slice(toks.length - ncols)
  if (!tail.every((t) => STAT.test(t))) return null
  const name = toks.slice(0, toks.length - ncols).join(' ')
  if (!name) return null
  return [name, tail]
}

/** Extrae el valor de un campo etiquetado ("Coste:", "Armas:", "Reglas especiales:") de un bloque de texto multilínea. */
function readField(body: string, label: string): string | null {
  const re = new RegExp(`(?:^|\\n)\\s*${label}\\s*[:.]\\s*([\\s\\S]+?)(?=\\n\\s*[A-ZÁÉÍÓÚ][^\\n]{0,40}?[:.]\\s|$)`, 'i')
  const m = re.exec(body)
  return m ? dehyphenate(m[1]) : null
}

function extractOptions(value: string | null, source: string): ParsedOption[] {
  if (!value) return []
  const out: ParsedOption[] = []
  let m: RegExpExecArray | null
  OPTION_RE.lastIndex = 0
  while ((m = OPTION_RE.exec(value)) !== null) {
    const name = cleanOptionName(m[1])
    if (name) out.push({ name, cost: Number(m[2]), perModel: Boolean(m[3]), source })
  }
  return out
}

/** Limpia nombres de opción del prosa habitual ("Puede llevar Lanza" → "Lanza", "o Eternos" → "Eternos"). */
function cleanOptionName(raw: string): string {
  let s = dehyphenate(raw).replace(/^[•·\-*\s]+/, '')
  s = s.replace(
    /^(?:la unidad puede (?:equiparse con|llevar|elegir)|puede(?:n)?\s+(?:equiparse con|llevar|ir montado en un|elegir)|puede montar un|o|un|una|unos|unas|con|de)\s+/i,
    '',
  )
  return s.trim()
}

/** Coste base + si es por miniatura, a partir del texto del campo "Coste". */
function parseCost(costRaw: string | null): { baseCost: number | null; perModel: boolean; warning?: string } {
  if (!costRaw) return { baseCost: null, perModel: false, warning: 'Sin coste detectado' }
  const perModel = /miniatura|\/m/i.test(costRaw)
  const nums = costRaw.match(/\d+/g)
  if (!nums) return { baseCost: null, perModel, warning: 'Coste no numérico (revisar)' }
  // Si aparece más de un número (p.ej. "El X cuesta 80. Los Mastines 6/m…") es
  // una unidad de coste compuesto: tomamos el primero y avisamos.
  const warning = nums.length > 1 ? 'Coste compuesto: se toma el primer valor (revisar)' : undefined
  return { baseCost: Number(nums[0]), perModel, warning }
}

/** Divide "Regla1. Regla2. Regla3" en nombres de regla (descartando frases largas que son descripciones, no nombres). */
function parseRules(rulesRaw: string | null): string[] {
  if (!rulesRaw) return []
  return rulesRaw
    .split(/\.\s+/)
    .map((s) => s.trim().replace(/\.+$/, '').trim())
    .filter((s) => s.length > 0 && s.length < 40 && /^[A-ZÁÉÍÓÚ]/.test(s))
}

function parseSize(tam: string | null): { minSize: number | null; maxSize: number | null } {
  if (!tam) return { minSize: null, maxSize: null }
  const range = /(\d+)\s*-\s*(\d+)/.exec(tam)
  if (range) return { minSize: Number(range[1]), maxSize: Number(range[2]) }
  const plus = /(\d+)\+?/.exec(tam)
  return { minSize: plus ? Number(plus[1]) : null, maxSize: null }
}

/** Resumen corto de equipo básico (arma de mano, arco largo…) para el campo equipment_text: la parte inicial de "Armas"/"Arma de proyectiles" antes de las opciones con coste. */
function buildEquipmentText(body: string): string | null {
  const parts: string[] = []
  for (const label of [
    'Armas y armadura',
    'Armas y armaduras',
    'Armas',
    'Arma de proyectiles',
    'Armas de proyectiles',
  ]) {
    const v = readField(body, label)
    if (v) {
      const base = v.split(/\.|\(/)[0].trim()
      if (base && !parts.includes(base)) parts.push(base)
    }
  }
  return parts.length ? parts.join(', ') : null
}

export function parseArmyBook(text: string): ParsedUnit[] {
  const lines = text.split('\n').map((l) => l.replace(/\s+$/, ''))
  const n = lines.length
  const hdrIdx = new Set<number>()
  for (let k = 0; k < n; k++) if (PROFILE_HDR.test(lines[k])) hdrIdx.add(k)

  const units: ParsedUnit[] = []
  let section: { unitType: ParsedUnit['unitType']; categoryCode: ParsedUnit['categoryCode'] } | null = null
  let i = 0
  while (i < n) {
    const trimmed = lines[i].trim()
    if (SECTION_MAP[trimmed.toUpperCase()]) {
      section = SECTION_MAP[trimmed.toUpperCase()]
      i++
      continue
    }
    if (hdrIdx.has(i) && i > 0 && section) {
      const hdrMatch = PROFILE_HDR.exec(lines[i])!
      const hasTsa = Boolean(hdrMatch[1])
      const ncols = hasTsa ? 10 : 9

      // La "línea del nombre" (la de justo antes de la cabecera de perfil)
      // puede traer, según el libro, el coste y/o el "0-1" pegados al nombre
      // (formato tipo Reinos Enanos: "GUERREROS ENANOS puntos por miniatura:
      // 8", "ENANOS NÓRDICOS puntos por miniatura: 9 0-1"). Hay que separarlos
      // del nombre: si no, el nombre queda "sucio" y NUNCA empareja con la
      // unidad existente, así que todo saldría como "Nueva".
      let name = lines[i - 1].trim()
      let isUnique = false
      let headerCost: { baseCost: number; perModel: boolean } | null = null

      const perModelInName = /puntos?\s+por\s+miniatura\s*:?\s*(\d+)/i.exec(name)
      if (perModelInName) {
        headerCost = { baseCost: Number(perModelInName[1]), perModel: true }
        name = name.replace(perModelInName[0], ' ')
      } else {
        const flatInName = /\bpuntos?\s*:\s*(\d+)/i.exec(name)
        if (flatInName) {
          headerCost = { baseCost: Number(flatInName[1]), perModel: false }
          name = name.replace(flatInName[0], ' ')
        }
      }
      if (/(?:^|\s)0-1\*?(?:\s|$)/.test(name)) {
        isUnique = true
        name = name.replace(/(?:^|\s)0-1\*?(?=\s|$)/g, ' ')
      }
      name = name.replace(/\s+/g, ' ').trim()

      // Filas de perfil (base + campeón/montura), hasta la siguiente cabecera.
      let j = i + 1
      const profiles: [string, string[]][] = []
      while (j < n && !hdrIdx.has(j)) {
        const pr = parseProfileRow(lines[j], ncols)
        if (pr) {
          profiles.push(pr)
          j++
        } else break
      }

      // Cuerpo de campos etiquetados, hasta la siguiente cabecera o sección,
      // EXCLUYENDO la línea-nombre de la siguiente unidad (la de justo antes de
      // la próxima cabecera de perfil), y descartando números sueltos (pies de
      // página).
      let k = j
      while (k < n && !hdrIdx.has(k) && !SECTION_MAP[lines[k].trim().toUpperCase()]) k++
      const endBody = hdrIdx.has(k) ? k - 1 : k
      const bodyLines = lines.slice(j, endBody).filter((l) => !/^\d{1,3}$/.test(l.trim()))
      const body = bodyLines.join('\n')

      // Coste: primero el campo "Coste:" (formato Elfos); si no está, el coste
      // que venía en la línea del nombre (formato Enanos).
      const costRaw = readField(body, 'Coste')
      let baseCost: number | null
      let perModel: boolean
      let costWarning: string | undefined
      if (costRaw) {
        const parsed = parseCost(costRaw)
        baseCost = parsed.baseCost
        perModel = parsed.perModel
        costWarning = parsed.warning
      } else if (headerCost) {
        baseCost = headerCost.baseCost
        perModel = headerCost.perModel
      } else {
        baseCost = null
        perModel = false
        costWarning = 'Sin coste detectado'
      }
      const { minSize, maxSize } = parseSize(readField(body, 'Tama.o de la unidad'))
      const specialRules = parseRules(readField(body, 'Reglas especiales'))

      const options: ParsedOption[] = []
      for (const label of [
        'Armas y armadura',
        'Armas y armaduras',
        'Armas',
        'Armas de proyectiles',
        'Arma de proyectiles',
        'Armadura',
        'Montura',
        'Estirpes',
        'Opciones',
        'Grupo de mando',
      ]) {
        options.push(...extractOptions(readField(body, label), label))
      }

      const rowToProfile = (row: string[]): { profile: ParsedProfile; armorSave: number | null } => {
        let vals = row
        let armor: number | null = null
        if (hasTsa) {
          const tsa = vals[9]
          armor = tsa && tsa !== '-' ? parseInt(tsa, 10) : null
          vals = vals.slice(0, 9)
        }
        const prof = ATTR_KEYS.reduce((acc, key, idx) => {
          acc[key] = vals[idx] === '-' ? null : vals[idx]
          return acc
        }, {} as ParsedProfile)
        return { profile: prof, armorSave: armor }
      }

      let profile: ParsedProfile | null = null
      let armorSave: number | null = null
      let championProfile: ParsedProfile | null = null
      if (profiles.length > 0) {
        const base = rowToProfile(profiles[0][1])
        profile = base.profile
        armorSave = base.armorSave
      }
      if (profiles.length > 1) {
        championProfile = rowToProfile(profiles[1][1]).profile
      }

      const warnings: string[] = []
      if (costWarning) warnings.push(costWarning)

      // Heurística: dentro de secciones de tropa, una entrada SIN tamaño de
      // unidad y con coste plano suele ser un Personaje Especial listado tras
      // las unidades singulares. Se reclasifica como personaje y se avisa.
      let unitType = section.unitType
      let categoryCode = section.categoryCode
      if (unitType === 'tropa' && minSize == null && !perModel && baseCost != null) {
        unitType = 'personaje'
        categoryCode = 'PERSONAJE'
        warnings.push('Detectado como personaje (sin tamaño de unidad y coste plano) — revisa la categoría')
      }

      units.push({
        name,
        unitType,
        categoryCode,
        // El "0-1" que traen algunos libros pegado al nombre de un personaje
        // no se importa: en esta aplicación 0-1 es un distintivo de TROPAS
        // (el nombre ya se ha limpiado del prefijo más arriba, así que la
        // entrada entra bien; solo se descarta la marca).
        isUnique: unitType === 'personaje' ? false : isUnique,
        baseCost,
        perModel,
        minSize,
        maxSize,
        armorSave,
        profile,
        championProfileName: profiles.length > 1 ? profiles[1][0] : null,
        championProfile,
        equipmentText: buildEquipmentText(body),
        specialRules,
        options,
        warnings,
      })

      i = k
      continue
    }
    i++
  }

  return units
}
