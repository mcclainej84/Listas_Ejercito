// ============================================================================
// Catálogo de SENDAS DE MAGIA y sus hechizos.
//
// Generado a partir del fichero "Resumen_sendas_20250309.md" que aportó el
// usuario (hoja "Resumen"): 30 sendas repartidas en cuatro grupos y 213
// hechizos en total. Los datos van en el código y no en el seed SQL porque se
// cargan una sola vez, de forma idempotente, desde catalogMaintenance — igual
// que el resto de correcciones de catálogo.
//
// SOBRE EL NÚMERO DE HECHIZOS. La estructura normal de una senda es 7: dos de
// nivel 1, dos de nivel 2, dos de nivel 3 y uno de nivel 4. La cumplen 28 de
// las 30. Las dos excepciones vienen así del fichero de origen y se cargan tal
// cual, a la espera de que el usuario las revise:
//
//   · Pergaminos sagrados — 13 hechizos (4+4+3+2)
//   · Yunque rúnico ....... 4 hechizos (uno por nivel)
//
// Ver MAX_SPELLS_PER_PATH en domain/magic.ts para el límite que se aplica al
// EDITAR: no se rechazan las que ya vienen pasadas, solo se impide crecer.
// ============================================================================

export interface MagicSpellSeed {
  level: number
  name: string
  difficulty: string | null
  range: string | null
  hits: string | null
  damage: string | null
  staysActive: boolean
  cac: string | null
  rules: string | null
}

export interface MagicPathSeed {
  code: string
  name: string
  group: string
  spells: MagicSpellSeed[]
}

export const MAGIC_PATH_SEED: MagicPathSeed[] = [
  {
    code: 'FUEGO',
    name: 'Fuego',
    group: 'ELEMENTALES',
    spells: [
      {
        level: 1,
        name: 'Bola de fuego',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F4.'
      },
      {
        level: 1,
        name: 'Encantamiento',
        difficulty: '6+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Puede lanzarse sobre cualquier miniatura y proporciona ataques igneos y -1 a la tirada de salvación. No requiere linea de visión.'
      },
      {
        level: 2,
        name: 'Furia ígnea',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D4',
        damage: 'F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D4 impactos de F5. Chequeo de pánico.'
      },
      {
        level: 2,
        name: 'Calavera ardiente',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1xFila',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1 impacto por fila. -1 a la tirada de salvación. Si hay bajas chequeo de pánico.'
      },
      {
        level: 3,
        name: 'Infierno',
        difficulty: '8+',
        range: null,
        hits: '1xFila',
        damage: 'F4',
        staysActive: false,
        cac: 'En CaC',
        rules: '1 impacto por fila. -1 a la tirada de salvación. Si hay bajas chequeo de pánico.'
      },
      {
        level: 3,
        name: 'Muro de fuego',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Barrera de 20 cm.'
      },
      {
        level: 4,
        name: 'Meteorito',
        difficulty: '9+',
        range: null,
        hits: 'Plantilla',
        damage: 'F8 / F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Situa la plantilla pequeña en el punto elegido y tira el dado de artillería y de dispersión. Problemas: sin efecto. Impacto central: F8, resto de impactos: F4 a miniaturas totalmente cubiertas (impacto automático), parcialmente cubiertas (impacto con 4+).'
      }
    ]
  },
  {
    code: 'RELAMPAGO',
    name: 'Relámpago',
    group: 'ELEMENTALES',
    spells: [
      {
        level: 1,
        name: 'Saeta cargada',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'Hiere 5+',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos que hieren con 5+.'
      },
      {
        level: 1,
        name: 'Teletransporte',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Teletransporte a cualquier parte del campo de batalla excepto en terreno impasable.'
      },
      {
        level: 2,
        name: 'Campo de energía',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Reduce la fuerza de cualquier proyectil lanzado contra la unidad en -1.'
      },
      {
        level: 2,
        name: 'Rayo',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D3+1',
        damage: 'F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D3+1 impactos de F5.'
      },
      {
        level: 3,
        name: 'Relámpagos',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F4. Cada impacto que consiga herir provocará otro nuevo impacto con -1F acumulativo.'
      },
      {
        level: 3,
        name: 'Maldición de Odhín',
        difficulty: '8+',
        range: null,
        hits: '1.0',
        damage: 'F10',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Un impacto de F10 que causa 1D3 heridas.'
      },
      {
        level: 4,
        name: 'Tormenta',
        difficulty: '9+',
        range: null,
        hits: '2D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos de F4. Cada 6 obtenido para herir causará un impacto adicional.'
      }
    ]
  },
  {
    code: 'FRIO',
    name: 'Frío',
    group: 'ELEMENTALES',
    spells: [
      {
        level: 1,
        name: 'Punta helada',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. Los 6 obtenidos para herir anulan la tirada de salvación.'
      },
      {
        level: 1,
        name: 'Armadura de hielo',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'La armadura de hielo ofrece una tirada de salvación de 2+ al hechicero.'
      },
      {
        level: 2,
        name: 'Ventisca',
        difficulty: '7+',
        range: '75 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Una unidad de proyectiles enemiga tendrá -1 al impactar.'
      },
      {
        level: 2,
        name: 'Nova de hielo',
        difficulty: '7+',
        range: null,
        hits: 'Plantilla',
        damage: 'F3',
        staysActive: false,
        cac: 'En CaC',
        rules: 'Situa la plantilla pequeña sobre el hechicero. Las miniaturas cubiertas sufrirán un impacto de F3. Cada 6 obtenido para herir anulará la tirada de salvación.'
      },
      {
        level: 3,
        name: 'Congelación',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1D3+1',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D3+1 impactos de F4 que anulan tirada de salvación.'
      },
      {
        level: 3,
        name: 'Rayo de escarcha',
        difficulty: '8+',
        range: '45 cm.',
        hits: '1xFila',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1 impacto por fila. Si hay bajas chequeo de pánico.'
      },
      {
        level: 4,
        name: 'Tormenta de hielo',
        difficulty: '9+',
        range: null,
        hits: '3D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '3D6 impactos de F3. La unidad no podrá marchar el siguiente turno.'
      }
    ]
  },
  {
    code: 'VIENTOS',
    name: 'Vientos',
    group: 'ELEMENTALES',
    spells: [
      {
        level: 1,
        name: 'Ráfaga',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. Con un resultado de 1 o 2 en 1D6 no marchará en su próximo turno.'
      },
      {
        level: 1,
        name: 'Escudo aéreo',
        difficulty: '6+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Puede lanzarse sobre cualquier unidad y proporciona cobertura ligera. No requiere línea de visión.'
      },
      {
        level: 2,
        name: 'Señor de los vientos',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Permite cambiar el clima de la batalla.'
      },
      {
        level: 2,
        name: 'Furia de Aéres',
        difficulty: '7+',
        range: null,
        hits: 'Plantilla',
        damage: 'F3',
        staysActive: false,
        cac: 'En CaC',
        rules: 'Situa la plantilla pequeña sobre el hechicero. Las miniaturas cubiertas sufrirán un impacto de F3. Estos impactos han de ser salvados como si fueran causados por proyectiles.'
      },
      {
        level: 3,
        name: 'Vientos arcanos',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero puede volver a tirar uno de los dos dados que tira al intentar lanzar un hechizo.'
      },
      {
        level: 3,
        name: 'Vientos del Asghar',
        difficulty: '8+',
        range: '60 cm.',
        hits: '2D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos de F3. Si hay bajas no podrá marchar en su próximo turno.'
      },
      {
        level: 4,
        name: 'Tornado',
        difficulty: '9+',
        range: null,
        hits: 'Plantilla',
        damage: 'F4',
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Situa la plantilla pequeña en el punto elegido y tira el dado de artillería y de dispersión. Problemas: se desvanece. Impactos de F4 a miniaturas totalmente cubiertas (impacto automático), parcialmente cubiertas (impacto con 4+).'
      }
    ]
  },
  {
    code: 'TIERRA',
    name: 'Tierra',
    group: 'ELEMENTALES',
    spells: [
      {
        level: 1,
        name: 'Terremoto',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3 con -1 a la tirada de salvación.'
      },
      {
        level: 1,
        name: 'Sello de la tierra',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Proporciona cobertura pesada contra las armas de proyectiles a la unidad del hechicero.'
      },
      {
        level: 2,
        name: 'Furia de la tierra',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F4. Además, cada 6 obtenido en la tirada para herir anula tirada de salvación.'
      },
      {
        level: 2,
        name: 'Nube de arena',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'En CaC',
        rules: 'Cada miniatura de la primera fila tira 1D6. Con un resultado de 1 no podrá atacar en la siguiente ronda de combate.'
      },
      {
        level: 3,
        name: 'Levantamiento de tierra',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Crea una superficie elevada en cualquier parte del campo de batalla. Cualquier unidad sobre ella sufrirá 1D6 impactos de F3 durante el lanzamiento de este hechizo. Este nuevo elemento de escenografía funciona como una colina a todos los efectos.'
      },
      {
        level: 3,
        name: 'Petrificar',
        difficulty: '8+',
        range: '60 cm.',
        hits: '2D6',
        damage: 'Hiere 4+',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos que hieren con 4+. Solo tamaño humano.'
      },
      {
        level: 4,
        name: 'Abismo infernal',
        difficulty: '9+',
        range: null,
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Declara una distancia que se mide desde el hechicero. Tira el dado de dispersión para ver en que dirección se abre la tierra (30 cm.). Cualquier miniatura bajo la abertura, será retirada con un resultado de 4+. Cualquier unidad que se encuentre en un elemento de escenografía rozado por el abismo sufrirá 1D6 impactos de F3. Solo tamaño humano.'
      }
    ]
  },
  {
    code: 'AGUA',
    name: 'Agua',
    group: 'ELEMENTALES',
    spells: [
      {
        level: 1,
        name: 'Geiser',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: '1D6 impactos de F3 con un -1 a la tirada de salvación. Si es lanzado en combate cuerpo a cuerpo, la unidad del hechicero sufrirá 1D3 impactos de F3 con -1 a la tirada de salvación.'
      },
      {
        level: 1,
        name: 'Condensación',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Las unidades enemigas que dispararen contra la unidad del mago tendrán -1 al impactar. Este efecto se aplicará también a las unidades que se encuentren a 15 cm. de la unidad del hechicero si obtienen un resultado de 4+ (cada una).'
      },
      {
        level: 2,
        name: 'Maldición de agua',
        difficulty: '7+',
        range: '75 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'La unidad enemiga verá reducido su alcance en 1/3. Las maquinas de guerra y unidades de pólvora tendrán que tirar un dado por cada miniatura de la unidad y obtener un resultado de 4+ en 1D6 para poder disparar.'
      },
      {
        level: 2,
        name: 'Muro de agua',
        difficulty: '7+',
        range: '5D6 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Crea un muro de agua de 20 cm. que permanecerá siempre a la misma distancia del hechicero aunque este se mueva. Las unidades enemigas no podrán cargar a través del muro de agua, aunque podrán decidir atravesarlo utilizando su movimiento.'
      },
      {
        level: 3,
        name: 'Dragón marino',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1D6 / 1xfila',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F4 o un impacto de F4 por cada fila de la unidad. Si hay bajas chequeo de pánico.'
      },
      {
        level: 3,
        name: 'Elemental de agua',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Crea un elementar de agua tras el hechicero. H5, F5, H2, A3. Ataca en ambas fases de magia. Las bajas que cause en cuerpo a cuerpo se contabilizaran de forma normal al resultado del combate. Cuando este hechizo sea dispersado, el elemental perderá una herida.  Si pierde todas sus heridas el hechizo se dispersará completamente.'
      },
      {
        level: 4,
        name: 'Señor de las aguas',
        difficulty: '9+',
        range: '5D6 cm.',
        hits: null,
        damage: 'Hiere 5+',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Declara una distancia que se mide desde el mago y a partir de esta se tiran 5D6 cm. y todas las miniaturas que se encuentren en la trayectoria del imponente caudal de 20 cm. de anchura sufrirán un impacto que herirá con un resultado de 5+ en 1D6.'
      }
    ]
  },
  {
    code: 'VOLCANES',
    name: 'Volcanes',
    group: 'ELEMENTALES',
    spells: [
      {
        level: 1,
        name: 'Abrazo incandescente',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3 / F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3 o de F4 si la unidad enemiga está equipada con armadura pesada.'
      },
      {
        level: 1,
        name: 'Armadura de magma',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero obtiene una tirada de salvación de 4+ inmodificable por fuerza. Cada herida salvada por el hechicero causará un impacto de F4.'
      },
      {
        level: 2,
        name: 'Nube de ceniza',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Las unidades de proyectiles enemigas a más de 30 cm. no podrán disparar a la unidad del hechicero, a menos de esa distancia dispararán con una penalización de -1 a su tirada para impactar.'
      },
      {
        level: 2,
        name: 'Maldición de azufre',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Los ataques del hechicero se consideran ataques envenenados.'
      },
      {
        level: 3,
        name: 'Roca gigante',
        difficulty: '8+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Declara una distancia que se mide desde el mago y tira el dado de artillería como si de un proyectil de cañón se tratara. Si se obtiene un resultado de “problemas” la roca simplemente fallará su objetivo.'
      },
      {
        level: 3,
        name: 'Seísmo',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'La unidad objetivo quedará desorganizada y deberá emplear su siguiente turno en formar.'
      },
      {
        level: 4,
        name: 'Torrente de lava',
        difficulty: '9+',
        range: null,
        hits: '1D3xfila',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D3 impactos de F4 por fila.'
      }
    ]
  },
  {
    code: 'BESTIAS',
    name: 'Bestias',
    group: 'MISTICAS',
    spells: [
      {
        level: 1,
        name: 'Llamar a los cuervos',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: '1D6 impactos de F3.'
      },
      {
        level: 1,
        name: 'Vientos de Arhenur',
        difficulty: '6+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'La unidad deberá efectuar un chequeo de liderazgo, si no lo supera no podrá hacer nada en ese turno. Si es lanzado contra unidades con montura y fallan el chequeo la unidad saldrá huyendo. No puede lanzarse contra unidades trabadas en combate cuerpo a cuerpo.'
      },
      {
        level: 2,
        name: 'Lanza de caza',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1.0',
        damage: 'F6',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Un impacto de F6 que causa 1D3 heridas.'
      },
      {
        level: 2,
        name: 'Manada de lobos',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Crea 8 lobos que aparecen por el borde del tablero más próximo al mago. Moverán como una unidad normal, aunque cuando luchen nunca huirán ni harán huir al enemigo. La actuación de los lobos no contará en el resultado del combate. El hechicero podrá volver a lanzar el hechizo y llamar 1D6 lobos adicionales (máximo 10). No requiere línea de visión.'
      },
      {
        level: 3,
        name: 'Aguijón de avispa',
        difficulty: '8+',
        range: '60 cm.',
        hits: '5.0',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '5 impactos de F4. Cada 6 en la tirada para herir causará -1 a la tirada de salvación.'
      },
      {
        level: 3,
        name: 'Crinos',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero gana +1F, +1R y +2A. No puede lanzar hechizos.'
      },
      {
        level: 4,
        name: 'Fuerza del oso',
        difficulty: '9+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'La unidad del hechicero obtiene  +1 a herir (máximo de 3+). Su fuerza no se ve modificada.'
      }
    ]
  },
  {
    code: 'DRAGONES',
    name: 'Dragones',
    group: 'MISTICAS',
    spells: [
      {
        level: 1,
        name: 'Relámpago azul',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6 / 1D6+2',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. A 30 cm. o menos 1D6+2 impactos de F3.'
      },
      {
        level: 1,
        name: 'Ojo del dragón',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Permite saber si hay tropas ocultas o refuerzos.'
      },
      {
        level: 2,
        name: 'Escamas de dragón',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero obtiene una tirada de salvación de 3+  inmodificable por fuerza.'
      },
      {
        level: 2,
        name: 'Vientos de magia',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'El hechicero enemigo deberá tirar 1D6. 1 no podrá hacer nada en su siguiente turno. 2 +2 a la dificultad de todos sus hechizos el siguiente turno. 3-5 +1 a la dificultad. 6 sin efecto.'
      },
      {
        level: 3,
        name: 'Aliento de dragón',
        difficulty: '8+',
        range: '40 cm.',
        hits: '1D6+3',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6+3 impactos de F4'
      },
      {
        level: 3,
        name: 'Terror del dragón',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'La unidad enemiga tendrá que superar un chequeo de liderazgo con un modificador de -1 o huirá hacia su borde de despliegue. No afecta a unidades inmunes a psicología.'
      },
      {
        level: 4,
        name: 'Despertar a la bestia',
        difficulty: '9+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'El hechicero se transforma en un dragón. M20, Ha6, Hp6, F5, R6, H6, I3, A5, L9, Salvación 3+. Si las heridas del Dragón se reducen a 0, el hechicero volverá a su forma humana con 1 herida y no podrá volver a transformarse. Cada vez que este hechizo sea dispersado el dragón perderá una herida. Las heridas que reciba el dragón por dispersiones podrán ser recuperadas si el hechicero vuelve a lanzar el conjuro. Mientras el mago permanezca en esta forma podrá lanzar los siguientes hechizos: Ojo de Dragón, Escamas de Dragón y Aliento de Dragón.'
      }
    ]
  },
  {
    code: 'INVOCACION',
    name: 'Invocación',
    group: 'MISTICAS',
    spells: [
      {
        level: 1,
        name: 'Flecha mágica',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6 / 1',
        damage: 'F3 / F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3 o un impacto de F5 sin tirada de salvación.'
      },
      {
        level: 1,
        name: 'Invocar guardián',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Cada turno, el guardián podrá absorber una herida sufrida por el hechicero.'
      },
      {
        level: 2,
        name: 'Cristal arcano',
        difficulty: '7+',
        range: '30 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Crea un cristal mágico con movimiento aleatorio determinado mediante el dado de Artillería, en la dirección que desee el hechicero. Permite lanzar hechizos desde el cristal. Si la gema choca contra una unidad causará 1D6 impactos de F4.'
      },
      {
        level: 2,
        name: 'Desconvocar',
        difficulty: '7+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Permite dispersar activo o infligir 1D3 heridas a una criatura invocada. Estas heridas serán restablecidas si el adversario vuelve a invocar a la criatura.'
      },
      {
        level: 3,
        name: 'Orbe solar',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F4. Por cada baja se obtendrá un impacto adicional.'
      },
      {
        level: 3,
        name: 'Invocar Fénix',
        difficulty: '8+',
        range: '15 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Invoca un Fenix. M22, Ha5, F5, R4, H3, I4, A3, L8. Cada herida que sufra causará 1 impacto de F4. Si muere, revivirá al final de la fase de combate con 1 herida. Si es desmoralizado se desvanecerá.'
      },
      {
        level: 4,
        name: 'Invocar sierpe',
        difficulty: '9+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Invoca una Sierpe. Ha3, F6, R5, H3, I1, A4, L10. El monstruo irrumpirá en medio de una unidad enemiga causando 1D6 impactos de F4. En turnos posteriores la unidad enemiga podrá decidir huir del combate y el monstruo no perseguirá. Si es desmoralizado se desvanecerá.'
      }
    ]
  },
  {
    code: 'MENTE',
    name: 'Mente',
    group: 'MISTICAS',
    spells: [
      {
        level: 1,
        name: 'Ataque mental',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: '= R de la ud.',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de una fuerza igual a resistencia que posea la unidad. Solo tamaño humano.'
      },
      {
        level: 1,
        name: 'Leer la mente',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero obtiene +1 al impactar y todo aquel que lo ataque tendrá -1 al impactar.'
      },
      {
        level: 2,
        name: 'Telequinesia',
        difficulty: '7+',
        range: '40 cm.',
        hits: '1D3',
        damage: 'F5',
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: '1D3 impactos de F5. (Solo fuera CaC). o la unidad del hechicero tendrá +1 a la tirada de salvación contra proyectiles enemigos. Mientras este activo, no se podrá utilizar para atacar.'
      },
      {
        level: 2,
        name: 'Telepatía',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Hechiceros aliados podrán lanzar un hechizos desde la posición del hechicero o viceversa. Las unidades a 30 cm. del hechicero podrán utilizar su liderazgo aunque no sea el general del ejército.'
      },
      {
        level: 3,
        name: 'Dementación',
        difficulty: '8+',
        range: null,
        hits: 'Chequeo I',
        damage: 'F5',
        staysActive: false,
        cac: 'En CaC',
        rules: 'Cada miniatura de la primera fila tira 1D6. Si el resultado supera su iniciativa sufrirán un impacto de F5.'
      },
      {
        level: 3,
        name: 'Tormento psíquico',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'Hiere 4+',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos que hieren con 4+, sin tirada de salvación. Solo tamaño humano.'
      },
      {
        level: 4,
        name: 'Control mental',
        difficulty: '9+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Tira 1D6 por la mitad de las miniaturas que posea la unidad y con un resultado de 4+ el hechicero las controlará mentalmente. Cada miniatura controlada efectuará un ataque utilizando su arma de mano. Sus ataques impactarán automáticamente.La unidad tan solo podrá reorganizarse en su próximo turno.'
      }
    ]
  },
  {
    code: 'ESPIRITUS',
    name: 'Espíritus',
    group: 'MISTICAS',
    spells: [
      {
        level: 1,
        name: 'Proyección espiritual',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6+1D3',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. Si esta ha perdido más del 25% de sus guerreros iniciales causará 1D3 impactos adicionales.'
      },
      {
        level: 1,
        name: 'Etéreo',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero solo podrá ser herido con armas mágicas. 1 impacto automático sin tirada de salvación.'
      },
      {
        level: 2,
        name: 'Aullido espectral',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Si es lanzado a distancia, la unidad enemiga deberá superar un chequeo de liderazgo o no podrá moverse ese turno.en combate causará 1D6 impactos de F4 que no modifican la tirada de salvación.'
      },
      {
        level: 2,
        name: 'Visión del aura',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'El hechicero puede centrar su atención en un bosque, o cuadrante del campo de batalla y adivinar que tropas hay escondidas o como refuerzo. El oponente decidirá que unidad es la descubierta por el mago. La unidad deberá superar un chequeo de liderazgo sin ningún modificador para entrar en el campo de batalla o abandonar un bosque.'
      },
      {
        level: 3,
        name: 'Espíritu guardián',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero suma +2 y +1 a dos de sus atributos. Mientras permanezca activo solo podrá lanzar un hechizo por fase de magia.'
      },
      {
        level: 3,
        name: 'Fuegos fatuos',
        difficulty: '8+',
        range: '20 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Invoca unos Fuegos fatuos. M15, Ha2, F4, R4, H4, I1, A3, L6. Las unidades de proyectiles sufrirán -1 al impactar. Cada herida sufrida causará un impacto de F4. 2 grupos de fuegos fatuos adicionales podrán ser invocados. Son inmunes a desmoralización. No influyen en el resultado del combate y nunca huirán ni harán huir al enemigo. Cada vez que el hechizo sea dispersado, desaparecerá un grupo de fuegos fatuos. No requiere línea de visión.'
      },
      {
        level: 4,
        name: 'Furia espiritual',
        difficulty: '9+',
        range: null,
        hits: '2D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos de F4. La unidad deberá efectuar un chequeo de liderazgo; si no lo supera no podrá moverse ni disparar en su próximo turno.'
      }
    ]
  },
  {
    code: 'GAIA',
    name: 'Gaia',
    group: 'MISTICAS',
    spells: [
      {
        level: 1,
        name: 'Tormenta de zarzas',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. Puede lanzarse desde cualquier elemento de escenografía.'
      },
      {
        level: 1,
        name: 'Abrazo de Gaia',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero puede desplazarse 30 cm. Recupera 1 herida.'
      },
      {
        level: 2,
        name: 'Enredadera',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'En CaC',
        rules: '3 miniaturas de la primera fila deberán obtener 4+ o sufrirán +1 al impactar en CaC. Los ataques a los guerreros afectados serán impactados automáticamente.'
      },
      {
        level: 2,
        name: 'Lamento de Gaia',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D4',
        damage: 'F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D4 impactos de F5. Chequeo de pánico.'
      },
      {
        level: 3,
        name: 'Espinas',
        difficulty: '8+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'La unidad enemiga deberá obtener un resultado inferior a su fuerza en 1D6 para poder moverse o bien huir en ese turno.'
      },
      {
        level: 3,
        name: 'Canto de las hadas',
        difficulty: '8+',
        range: '60 cm.',
        hits: '3xfila',
        damage: 'Hiere 6+',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '3 impactos por fila que hieren con 6 y anulan tirada de salvación.'
      },
      {
        level: 4,
        name: 'Despertar a los árboles',
        difficulty: '9+',
        range: '20 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Invoca un Hombre arbol. M15, Ha5, F6, R6, H6, I2, A5, L9, S3+. Si sus heridas se reducen a 0  no podrá volver a ser invocado. Dispersión = 1 herida. Las heridas por dispersión podrán ser recuperadas si se vuelve a lanzar el hechizo. Si el hombre árbol ve reducidas sus heridas a 0 por dispersiones enemigas quedará inmovilizado en el sitio hasta que el hechicero vuelva a invocarlo (las heridas sufridas en cuerpo a cuerpo no serán restablecidas) y será impactado automáticamente si el enemigo decide atacarlo. No requiere linea de visión.'
      }
    ]
  },
  {
    code: 'CIELOS',
    name: 'Cielos',
    group: 'MISTICAS',
    spells: [
      {
        level: 1,
        name: 'Cometa',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. Anula tirada de salvación especial.'
      },
      {
        level: 1,
        name: 'Manto de estrellas',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'La unidad puede repetir los chequeos de psicología fallados.'
      },
      {
        level: 2,
        name: 'Salto mágico',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Teletransporte a cualquier parte del campo de batalla excepto en terreno impasable. +1 a la dificultad de dispersión.'
      },
      {
        level: 2,
        name: 'Premonición',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Una unidad en refuerzo podrá elegir zona de despliegue.'
      },
      {
        level: 3,
        name: 'Sello de los cielos',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Revela todos los objetos mágicos y tirada de salvación especial del enemigo. Inutiliza sus efectos en una unidad. Puede lanzarse a otras unidades en turnos posteriores.'
      },
      {
        level: 3,
        name: 'Negación de magia',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Todos los hechizos que no pertenezcan a la senda de los cielos tendrán un +1 a su dificultad.'
      },
      {
        level: 4,
        name: 'Tormenta celestial',
        difficulty: '9+',
        range: null,
        hits: '2D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos de F4. La unidad enemiga tira el dado de dispersión para ver en qué dirección se encara la unidad, si obtiene un resultado de punto de mira la unidad logra permanecer en su posición.'
      }
    ]
  },
  {
    code: 'OSCURIDAD',
    name: 'Oscuridad',
    group: 'OSCURAS',
    spells: [
      {
        level: 1,
        name: 'Viento de corrosión',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. -1 a la tirada de salvación por armadura.'
      },
      {
        level: 1,
        name: 'Bendición oscura de Khalad',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero obtiene +1 a la fuerza.'
      },
      {
        level: 2,
        name: 'Relámpago de Arkhan',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D3+1',
        damage: 'F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D3+1 impactos de F5. Chequeo de pánico.'
      },
      {
        level: 2,
        name: 'Filo del espíritu',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Los ataques del hechicero anulan tirada de salvación por armadura.'
      },
      {
        level: 3,
        name: 'Horror negro de Arnhiral',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'En CaC',
        rules: 'Si el enemigo no supera un chequeo de liderazco con -1 a su dificultad atacará en segundo lugar. No afecta a unidades inmunes a desmoralización.'
      },
      {
        level: 3,
        name: 'Oscuridad de Karond Ghaar',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'La unidad objetivo tendrá una penalización de -1 al impactar con proyectiles. No podrá disparar a menos que supere un chequeo de liderazgo sin modificadores de ninguna clase.'
      },
      {
        level: 4,
        name: 'Rayo oscuro',
        difficulty: '9+',
        range: null,
        hits: '2D6 / 1D6',
        damage: 'F4 / F6',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos de F4 o 1D6 impactos de F6.'
      }
    ]
  },
  {
    code: 'PODREDUMBRE',
    name: 'Podredumbre',
    group: 'OSCURAS',
    spells: [
      {
        level: 1,
        name: 'Enjambre',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F2',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F2. Anulan tirada de salvación por armadura.'
      },
      {
        level: 1,
        name: 'Báculo de corrupción',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'En CaC',
        rules: 'Los ataques del hechicero causarán -3 a la tirada de salvación por armadura.'
      },
      {
        level: 2,
        name: 'Nube de moscas',
        difficulty: '7+',
        range: '75 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'La unidad objetivo tendrá una penalización de -1 al impactar con proyectiles.'
      },
      {
        level: 2,
        name: 'Aliento de enfermedad',
        difficulty: '7+',
        range: null,
        hits: '4.0',
        damage: 'F4',
        staysActive: false,
        cac: 'En CaC',
        rules: '4 impactos de F4. No afecta a criaturas No muertas.'
      },
      {
        level: 3,
        name: 'Nube de pestilencia',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'En CaC',
        rules: 'La unidad objetivo tendrá -1 al impactar. No afecta a criaturas No muertas.'
      },
      {
        level: 3,
        name: 'Llamar a la peste',
        difficulty: '8+',
        range: '45 cm. / 30 cm.',
        hits: '1 x miniatura (5+)',
        damage: 'Chequeo R',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 por cada miniatura de la unidad. Impacta con 5+. Los afectados deberán realizar un chequeo de resistencia sin tirada de salvación posible. Si en la batalla hay viento o viento fuerte, el alcance se verá reducido a 30 cm. No afecta a criaturas No muertas.'
      },
      {
        level: 4,
        name: 'Torrente de corrupción',
        difficulty: '9+',
        range: null,
        hits: '2D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos de F4. Si la unidad objetivo sufre bajas deberá realizar un chequeo de pánico.'
      }
    ]
  },
  {
    code: 'MUERTE',
    name: 'Muerte',
    group: 'OSCURAS',
    spells: [
      {
        level: 1,
        name: 'Robo de alma',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1.0',
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1 impacto que hiere con 4+ y anula tirada de salvación por armadura. Otorga al hechicero +1 a uno de sus atributos. Solo puede lanzarse a miniaturas con 1 única herida.'
      },
      {
        level: 1,
        name: 'Aura de muerte',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Los ataques del hechicero hieren con 2+.'
      },
      {
        level: 2,
        name: 'Relámpago negro',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D4',
        damage: 'F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D4 impactos de F5. Chequeo de pánico.'
      },
      {
        level: 2,
        name: 'Armadura de sombras',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero obtiene una tirada de salvación especial de 4+.'
      },
      {
        level: 3,
        name: 'Viento de muerte',
        difficulty: '8+',
        range: null,
        hits: 'Plantilla llamas',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Todos los enemigos cubiertos total o parcialmente sufren un impacto de F4. No afecta a criaturas No muertas.'
      },
      {
        level: 3,
        name: 'Mano de Nagash',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'La unidad objetivo huirá si no supera un chequeo de desmoralización con una penalización de -1 a su liderazgo. Afecta a unidades inmunes a psicología. En cuerpo a cuerpo no se podrá perseguir a la unidad que huye.'
      },
      {
        level: 4,
        name: 'Mirada de Nagash',
        difficulty: '9+',
        range: null,
        hits: '2D6+2',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6+2 impactos de F4.'
      }
    ]
  },
  {
    code: 'SANGRE',
    name: 'Sangre',
    group: 'OSCURAS',
    spells: [
      {
        level: 1,
        name: 'Toque del espíritu',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de 3. Si la unidad sufre alguna baja se deberá realizar un chequeo de pánico.'
      },
      {
        level: 1,
        name: 'Deshacerse en niebla',
        difficulty: '6+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Teletransporte a 45 cm. o menos excepto en terreno impasable. Mientras esté activo el hechicero no podrá atacar, lanzar hechizos, ni ser designado como objetivo.'
      },
      {
        level: 2,
        name: 'Maldición de Seth',
        difficulty: '7+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'La unidad objetivo deberá realizar un chequeo de miedo cada vez que cargue o sea cargada.'
      },
      {
        level: 2,
        name: 'Absorción de sangre',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: 'F4',
        staysActive: false,
        cac: 'En CaC',
        rules: 'Impacto de F4 por cada miniatura enemiga peana con peana con el hechicero, por cada baja que cause, restablecerá una herida.'
      },
      {
        level: 3,
        name: 'Muerte y agonía',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1 por cada fila',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Causa un impacto de F4 por cada fila que posea la unidad enemiga. Además, cada herida no salvada causa un impacto adicional.'
      },
      {
        level: 3,
        name: 'Poder de sangre',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Gana +2HA , +1F ,+1A. Cuando el mago esté afectado por este hechizo, podrá sacrificar uno o varios ataques cuerpo a cuerpo para lanzar hechizos.'
      },
      {
        level: 4,
        name: 'Hervir la sangre',
        difficulty: '9+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Sitúa en cualquier punto a la plantilla pequeña. Cada miniatura bajo la plantilla, y con 4+ sufrirá un impacto de la misma fuerza que la resistencia de la miniatura. No afecta a  no-muertos.'
      }
    ]
  },
  {
    code: 'SOMBRAS',
    name: 'Sombras',
    group: 'OSCURAS',
    spells: [
      {
        level: 1,
        name: 'Llama sombría',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Cada baja hará aque la unidad mueva - 1 cm el próximo turno.'
      },
      {
        level: 1,
        name: 'Ofuscación',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechiero solo puede ser impactado con 6. La tirada para huir será con 2+'
      },
      {
        level: 2,
        name: 'Presencia oscura',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'La unidad tendrá que hacer un chequeo de miedo para cargar. Quien quiera atacar al hechicero lo hará en último lugar'
      },
      {
        level: 2,
        name: 'Tormenta de sombras',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F4 que obligan a la unidad a efectuar un chequeo de pánico con -1 a su liderazgo.'
      },
      {
        level: 3,
        name: 'Maldición',
        difficulty: '8+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Los resultados de 1 que obtenga la unidad para impactar obligaran a repetir un éxito. Si la unidad posee bendición o protección mágica, la maldición no surtirá efecto, pero anulará los efectos de la protección.'
      },
      {
        level: 3,
        name: 'Vórtice de oscuridad',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F5 que no modificaran su tirada de salvación por armadura.'
      },
      {
        level: 4,
        name: 'Eclipse',
        difficulty: '9+',
        range: null,
        hits: '1D6 por unidad',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Designa un punto en el campo de batalla. Todas las unidades enemigas a 20 cm. sufren 1D6 impactos de F4 sin tirada de salvación.'
      }
    ]
  },
  {
    code: 'DESTRUCCION',
    name: 'Destrucción',
    group: 'OSCURAS',
    spells: [
      {
        level: 1,
        name: 'Lluvia negra',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1d3 + 1 por fila',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Causa 1D3 impactos de F3 + 1 por cada fila que posea la unidad (hasta un máximo de 3).'
      },
      {
        level: 1,
        name: 'Consumir',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Durante un combate cuerpo a cuerpo, el hechicero podrá efectuar un único ataque que causará 1D3 heridas.'
      },
      {
        level: 2,
        name: 'Desintegrar',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1d3',
        damage: 'F4',
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Cada turno la unidad objetivo de este conjuro sufrirá 1D3 impactos de F4.'
      },
      {
        level: 2,
        name: 'Filo infernal',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Cada impacto efectuado con éxito por el hechicero causará 1D3 impactos.'
      },
      {
        level: 3,
        name: 'Arrasar',
        difficulty: '8+',
        range: null,
        hits: '2d6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Al lanzar el conjuro el mago selecciona un elemento de escenografía y este es destruido y retirado del juego si se obtiene un resultado de 4+.Si había una unidad sobre él o en su interior, esta sufre 2D6 impactos de F3 y se ve obligada a huir en sentido contrario al lugar donde se encuentre el hechicero.'
      },
      {
        level: 3,
        name: 'Ira de Khorne',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'En CaC',
        rules: 'Alrededor del mago se sitúa la plantilla pequeña. Todas las miniaturas enemigas bajo la plantilla sufren un impacto que hiere con 3+.'
      },
      {
        level: 4,
        name: 'Tierra corrupta',
        difficulty: '9+',
        range: null,
        hits: '2d6',
        damage: 'F4',
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'En una superficie de 15cm, todas las unidades que atraviesen la zona sufren 2d6 impactos de F4.'
      }
    ]
  },
  {
    code: 'DEMONIOS',
    name: 'Demonios',
    group: 'OSCURAS',
    spells: [
      {
        level: 1,
        name: 'Espíritus demoníacos',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1d6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Las bajas causadas contarán el doble en la experiencia del hechicero.'
      },
      {
        level: 1,
        name: 'Látigo del inframundo',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El látigo cuenta como un arma de mano y causa un impacto automático de F4 que anula tirada de salvación.'
      },
      {
        level: 2,
        name: 'Abrir el abismo',
        difficulty: '7+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'La unidad enemiga se verá afectada por la regla “Temor”.'
      },
      {
        level: 2,
        name: 'Aura demoníaca',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 't.s.  especial de 5+ contra armas no mágicas y los hechizos enemigos lanzados contra la unidad tendrán un +1 a la dificultad.'
      },
      {
        level: 3,
        name: 'Posesión',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'En CaC',
        rules: 'La unidad efectuará tantos ataques contra sus congéneres como  en su primera fila. Las bajas no se contabilizarán en el resultado.'
      },
      {
        level: 3,
        name: 'Relámpago de Arhunan',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1d6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Tirar 1D6 por cada baja causada, con  4+ la unidad del hechicero reanimará un guerrero. Sólo afecta a criaturas de tamaño humano.'
      },
      {
        level: 4,
        name: 'Gran Demonio',
        difficulty: '9+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'M18, Ha6, Hp3, F6, R6, H6, I2, A6, L9. Aura demoníaca.'
      }
    ]
  },
  {
    code: 'LUZ',
    name: 'Luz',
    group: 'MANUSCRITOS',
    spells: [
      {
        level: 1,
        name: 'Luz de Helios',
        difficulty: '6+',
        range: '60 cm.',
        hits: '4.0',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '4 impactos de F4. -1 adiciónal a la tirada de salvación por armadura.'
      },
      {
        level: 1,
        name: 'Fulgor de Arashur',
        difficulty: '6+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'La unidad enemiga deberá superar un chequeo de iniciativa o no podrá hacer nada en su siguiente turno.'
      },
      {
        level: 2,
        name: 'Presencia de Isha',
        difficulty: '7+',
        range: '75 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: 'Causa -1 a la tirada para impactar con proyectiles a una unidad enemiga.'
      },
      {
        level: 2,
        name: 'Rayo de luz',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D3+2',
        damage: 'F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D3+2 impactos de F5.'
      },
      {
        level: 3,
        name: 'Bendición de Isha',
        difficulty: '8+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Otorga una tirada de salvación especial de 6+.'
      },
      {
        level: 3,
        name: 'Anulación de Vaul',
        difficulty: '8+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Los ataques realizados por la unidad enemiga objetivo no reduciran la tirada de salvación por armadura.'
      },
      {
        level: 4,
        name: 'Llamas del Fénix',
        difficulty: '9+',
        range: null,
        hits: '2D6',
        damage: 'F4',
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos de F4. Cada turno que permanezca activo se reducirá su fuerza en -1.'
      }
    ]
  },
  {
    code: 'NIGROMANCIA',
    name: 'Nigromancia',
    group: 'MANUSCRITOS',
    spells: [
      {
        level: 1,
        name: 'Alarido de muerte',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. Se debe realizar un chequeo de liderazgo. En caso de fallo la diferencia serán impactos adicionales.'
      },
      {
        level: 1,
        name: 'Alzar a los muertos',
        difficulty: '6+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Recupera 1D6 No muertos convencionales. No se puede superar el límite original de la unidad. No requiere línea de visión.'
      },
      {
        level: 2,
        name: 'Danza macabra de Vanhel',
        difficulty: '7+',
        range: '30 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Permite a una unidad mover adicionalmente.'
      },
      {
        level: 2,
        name: 'Saeta de hueso',
        difficulty: '7+',
        range: '60 cm.',
        hits: null,
        damage: 'F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1 impacto de F5. Atraviesa filas como un virote. Anula tirada de salvación.'
      },
      {
        level: 3,
        name: 'Vigor infernal',
        difficulty: '8+',
        range: '30 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Permite atacar en primer lugar.'
      },
      {
        level: 3,
        name: 'Invocar horda No-muerta',
        difficulty: '8+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Recupera 2D6 No muertos convencionales o bien 1D6 No muertos de élite. No se puede superar el límite original de la unidad. No requiere línea de visión.'
      },
      {
        level: 4,
        name: 'La maldición de los años',
        difficulty: '9+',
        range: '60 cm.',
        hits: '2D6',
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos que hieren con 6+. Cada turno que permanezca activo se restará -1 a la tirada necesaria para herir, hasta un máximo de 3+.'
      }
    ]
  },
  {
    code: 'PIELESVERDES',
    name: 'Pieles verdes',
    group: 'MANUSCRITOS',
    spells: [
      {
        level: 1,
        name: 'Relámpago verde',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6+1xbaja',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3 +1 por cada baja causada.'
      },
      {
        level: 1,
        name: 'Presencia de Morko',
        difficulty: '6+',
        range: '20 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Permite repetir chequeos de animosidad fallidos.'
      },
      {
        level: 2,
        name: 'Puños de Gorko',
        difficulty: '7+',
        range: '60 cm.',
        hits: null,
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1 ataque de F4 por cada miniatura de la primera fila de la unidad enemiga. Estos ataques cuentan con Ha3. Se consideran ataques cuerpo a cuerpo.'
      },
      {
        level: 2,
        name: 'El ímpetu de la horda',
        difficulty: '7+',
        range: '30 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'La unidad objetivo sumará +1 al resultado del combate si su potencia de unidad es mayor a la del enemigo.'
      },
      {
        level: 3,
        name: 'La llamada del Waaagh',
        difficulty: '8+',
        range: '20 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Las unidades a 20 cm. del chamán moverán 5D6 cm. Se considera una carga si alcanzan al enemigo con dicho movimiento. Solo se puede reaccionar manteniendo la posición.'
      },
      {
        level: 3,
        name: 'Mirada de Morko',
        difficulty: '8+',
        range: '60 cm.',
        hits: '1D6+2',
        damage: 'F4',
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: '1D6+2 impactos de F4. En cuerpo a cuerpo estos impactos se reparten entre ambas unidades.'
      },
      {
        level: 4,
        name: 'El pie de Gorko',
        difficulty: '9+',
        range: null,
        hits: '1D6',
        damage: 'F5',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F5. Tras estos impactos, con un resultado de 5-6 pisará a otra unidad. 2-4 el hechizo se desvanecerá y con 1 pisará a la unidad del chamán.'
      }
    ]
  },
  {
    code: 'SALVAJE',
    name: 'Salvaje',
    group: 'MANUSCRITOS',
    spells: [
      {
        level: 1,
        name: 'Impulso salvaje',
        difficulty: '6+',
        range: '15 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Todas las manadas a 15 cm. del hechicero moverán 3D6+3 cm. Se considera una carga si alcanzan al enemigo con dicho movimiento.'
      },
      {
        level: 1,
        name: 'Rayo de disformidad',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. Causa el doble de heridas a criaturas inflamables.'
      },
      {
        level: 2,
        name: 'Regresión',
        difficulty: '7+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Una unidad enemiga deberá efectuar un chequeo de liderazgo. Si lo falla sufriá un nº de heridas igual a la diferencia por la que haya fallado el chequeo. Anula tirada de salvación por armadura.'
      },
      {
        level: 2,
        name: 'El hedor de las bestias',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Cualquier unidad enemiga que cargue a la unidad del hechicero deberá efectuar un chequeo de liderazgo. Si lo falla se detendrá a 15 cm.'
      },
      {
        level: 3,
        name: 'El odio de los sometidos',
        difficulty: '8+',
        range: '60 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Las monturas con H1 atacarán a sus jinetes. No se aplica las modificaciónes a la armadura por Montado y Barda. No afecta a No muertos.'
      },
      {
        level: 3,
        name: 'El grito del rebaño',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'En CaC',
        rules: 'La unidad del chamán se verá afectada por la regla Furia primitiva.'
      },
      {
        level: 4,
        name: 'Dominio salvaje',
        difficulty: '9+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Invoca un Gran Shaggoth, un Gigante o un Escuerzo alado a 20 cm. El hechicero no podrá lanzar hechizos. Si muere o lanza hechizos la criatura atacará a la unidad más cercana (amiga o enemiga).'
      }
    ]
  },
  {
    code: 'LAHMIA',
    name: 'Lahmia',
    group: 'MANUSCRITOS',
    spells: [
      {
        level: 1,
        name: 'Lamento de Lahmia',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3. Los 6 obtenidos para herir anulan la tirada de salvación.'
      },
      {
        level: 1,
        name: 'Alzar a los Muertos',
        difficulty: '6+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Recupera 1D6 No muertos convencionales. No se puede superar el límite original de la unidad. No requiere línea de visión.'
      },
      {
        level: 2,
        name: 'Danza Macabra de Vanhel',
        difficulty: '7+',
        range: '30 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Permite a una unidad mover adicionalmente.'
      },
      {
        level: 2,
        name: 'Criaturas de la noche',
        difficulty: '7+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: '1D6 impactos de F4. Si se sufren bajas la unidad no podrá marchar ni cargar en el siguiente turno.'
      },
      {
        level: 3,
        name: 'Vigorem Vitae',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El hechicero gana +2Ha +1F, +1R y +1A. No puede lanzar hechizos.'
      },
      {
        level: 3,
        name: 'Invocar Horda No-muerta',
        difficulty: '8+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Recupera 2D6 No muertos convencionales o bien 1D6 No muertos de élite. No se puede superar el límite original de la unidad. No requiere línea de visión.'
      },
      {
        level: 4,
        name: 'La Maldición de los años',
        difficulty: '9+',
        range: '60 cm.',
        hits: '2D6',
        damage: null,
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos que hieren con 6+. Cada turno que permanezca activo se restará -1 a la tirada necesaria para herir, hasta un máximo de 3+.'
      }
    ]
  },
  {
    code: 'TZEENTCH',
    name: 'Tzeentch',
    group: 'MANUSCRITOS',
    spells: [
      {
        level: 1,
        name: 'Fuego Rojo de la Alteración',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F1D6',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F1D6.'
      },
      {
        level: 1,
        name: 'Fuego Naranja de la Transición',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Teletransporte a cualquier parte del campo de batalla excepto en terreno impasable.'
      },
      {
        level: 2,
        name: 'Fuego Amarillo de la Transformación',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Tirada de salvación especial de 5+ para el hechicero y su montura. No puede combinarse con otras tiradas de salvación especiales.'
      },
      {
        level: 2,
        name: 'Fuego Verde de la Mutación',
        difficulty: '7+',
        range: null,
        hits: '1D6',
        damage: 'F4',
        staysActive: false,
        cac: 'En CaC',
        rules: '1D6 impactos de F4. Anulan tirada de salvación por armadura.'
      },
      {
        level: 3,
        name: 'Fuego Azul de la Metamorfosis',
        difficulty: '8+',
        range: '60 cm.',
        hits: '2D6',
        damage: 'F1D6',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos de F1D6.'
      },
      {
        level: 3,
        name: 'Fuego Índigo del Cambio',
        difficulty: '8+',
        range: '45 cm.',
        hits: '1xminiatura',
        damage: 'F2',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1 impacto de F2 por cada miniatura de la unidad. Por cada baja se genera un horror rosa que entra en combate con la unidad.'
      },
      {
        level: 4,
        name: 'Fuego Violeta de Tzeentch',
        difficulty: '9+',
        range: '15 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Se lanza a un personaje enemigo. Debe superar un chequeo de liderazgo. Si falla será retirado como baja.'
      }
    ]
  },
  {
    code: 'PERGAMINOSSAGRADOS',
    name: 'Pergaminos sagrados',
    group: 'MANUSCRITOS',
    spells: [
      {
        level: 1,
        name: 'Dispersión de magia',
        difficulty: '5+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Disperasa un hechizo enemigo.'
      },
      {
        level: 1,
        name: 'Aliento de Cocatriz',
        difficulty: '5+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F3.'
      },
      {
        level: 1,
        name: 'Teatro de sombras',
        difficulty: '5+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: '+1 a la Iniciativa'
      },
      {
        level: 1,
        name: 'Visión de Shenron',
        difficulty: '5+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'Permite ver si hay tropas escondidas en un elemento de escenografía o un área de refuerzos o seleccionar una unidad enemiga y saber si lleva alguna tropa oculta o algún objeto mágico.'
      },
      {
        level: 2,
        name: 'Llamas del dragón',
        difficulty: '6+',
        range: '60 cm.',
        hits: '1D6',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F4.'
      },
      {
        level: 2,
        name: 'Protección de Danggra',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Las unidades enemigas tendrán -1 a la tirada para impactar con proyectiles a la unidad del hechicero.'
      },
      {
        level: 2,
        name: 'Maldición de terracota',
        difficulty: '6+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'El enemigo atacará en último lugar en su siguiente turno.'
      },
      {
        level: 2,
        name: 'Rasgar el vínculo',
        difficulty: '6+',
        range: '90 cm.',
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Causa 1D3 heridas a criaturas o unidades mágicas. Anula tirada de salvación por armadura.'
      },
      {
        level: 3,
        name: 'Clarividencia de Aluín Doa',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Al dispersar un hechizo enemigo, el mago podrá volver a lanzarlo el mísmo si obtiene un resultado de 5+.'
      },
      {
        level: 3,
        name: 'Senda del guerrero',
        difficulty: '7+',
        range: '45 cm.',
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Otorga a una unidad L10 y la regla Inmune a psicología.'
      },
      {
        level: 3,
        name: 'Flores de ceniza',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Permite al hechicero y su unidad abandonar el campo de batalla.'
      },
      {
        level: 4,
        name: 'Castigo de Danggra',
        difficulty: '8+',
        range: null,
        hits: '1.0',
        damage: 'F10',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1 impacto de F10 que causa 1D3 heridas.'
      },
      {
        level: 4,
        name: 'El Señor de los Cielos',
        difficulty: '8+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Añade +1 a la dificultad de todos los conjuros salvo los de la Senda de los cielos (y los propios pergaminos).'
      }
    ]
  },
  {
    code: 'DISFORMIDAD',
    name: 'Disformidad',
    group: 'MANUSCRITOS',
    spells: [
      {
        level: 1,
        name: 'Torrente de disformidad',
        difficulty: '5+',
        range: '60 cm.',
        hits: '1xFila+1',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1 impacto por fila +1 de F3.'
      },
      {
        level: 1,
        name: 'Horda de ratas',
        difficulty: '5+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Crea 1 Horda de ratas que aparecen a 20cm. o menos del hechicero. No requiere línea de visión.'
      },
      {
        level: 2,
        name: 'Aliento hediondo',
        difficulty: '6+',
        range: null,
        hits: '1D6',
        damage: 'F3',
        staysActive: false,
        cac: 'En CaC',
        rules: '1D6 impactos de F3. Anula tirada de salvación por armadura.'
      },
      {
        level: 2,
        name: 'Mutación',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'En CaC',
        rules: 'Un de los guerreros de la primera fila de la unidad del mago obtendrá +1F y +2A. Este será retirado como baja al ser dispersado el hechizo o finalice el combate.'
      },
      {
        level: 3,
        name: 'Pestilencia',
        difficulty: '7+',
        range: null,
        hits: null,
        damage: null,
        staysActive: true,
        cac: 'Dentro o Fuera del CaC',
        rules: '-1 al impactar contra el hechicero y su unidad. La unidad del hechicero sufrirá 1D6 impactos de F3 al inicio de la fase de magia propia mientras el hechizo siga activo.'
      },
      {
        level: 3,
        name: 'Explosión de cadaveres',
        difficulty: '7+',
        range: '20 cm.',
        hits: '1.0',
        damage: 'F4',
        staysActive: false,
        cac: 'Dentro o Fuera del CaC',
        rules: 'Las bajas causadas a unidades a 20 cm. o menos del hechicero causaran al enemigo 1 impacto de F4 en la siguiente fase de combate al lanzamiento del hechizo.'
      },
      {
        level: 4,
        name: 'Plaga',
        difficulty: '8+',
        range: null,
        hits: '2D6+1xbaja',
        damage: 'F4',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D6 impactos de F4 +1 impacto adicional por cada baja causada por los impactos iniciales.'
      }
    ]
  },
  {
    code: 'YUNQUERUNICO',
    name: 'Yunque rúnico',
    group: 'MANUSCRITOS',
    spells: [
      {
        level: 1,
        name: 'Runa del relámpago',
        difficulty: '5+',
        range: null,
        hits: '2D3',
        damage: 'F3',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '2D3 impactos de F3.'
      },
      {
        level: 2,
        name: 'Runa del trueno',
        difficulty: '6+',
        range: null,
        hits: null,
        damage: null,
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: 'La unidad objetivo no podrá marchar ni disparar en el siguiente turno a menos que supere un chequeo de resistencia (obteniendo un resultado inferior a la misma).'
      },
      {
        level: 3,
        name: 'Runa del rayo',
        difficulty: '7+',
        range: null,
        hits: '1D4',
        damage: 'F6',
        staysActive: false,
        cac: 'Fuera del CaC',
        rules: '1D4 impactos de F6.'
      },
      {
        level: 4,
        name: 'Runa de la tormenta',
        difficulty: '8+',
        range: null,
        hits: '1D6',
        damage: 'F4',
        staysActive: true,
        cac: 'Fuera del CaC',
        rules: '1D6 impactos de F4 por turno. La unidad objetivo sufrirá una penalización de -1D6 cm. a su movimiento de marcha. La unidad impactará y será impactada con -1 con armas de proyectiles. El hechizo permanece activo hasta que la unidad entre en combate cuerpo a cuerpo.'
      }
    ]
  }
]

