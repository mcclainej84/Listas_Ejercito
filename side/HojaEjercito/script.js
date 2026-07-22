document.addEventListener("DOMContentLoaded", () => {

  let datos = {};
  
   mostrarEstadoVacio();
  
  
  // =========================
  // CARGAR JSON
  // =========================
  /*fetch("datos.json")*/
  fetch("datos.json?t=" + Date.now())
    .then(response => response.json())
    .then(data => {
      datos = data;
  
      cargarEjercitos();
      actualizarPMC(null);
  
      limpiarSelect("tropa");
      limpiarSelect("equipo");
      limpiarSelect("opciones");
  
      document.getElementById("btnAdd").addEventListener("click", añadirFila);
      document.getElementById("btnGuardar").addEventListener("click", guardarEjercito);
  
      document.getElementById("btnCargar").addEventListener("click", cargarEjercito);
      document.getElementById("btnBorrar").addEventListener("click", borrarEjercito);
      document.getElementById("btnPDF").addEventListener("click", exportarPDF); //Ojito    
      prepararBotonBorrarTodo();
      rellenarFilasVacias();
    });
  
  
  // =========================
  // RESET INPUTS (NO BORRA Nº)
  // =========================
  function resetInputs() {
    document.getElementById("coste").value = "";
  
    document.getElementById("checkP").checked = false;
    document.getElementById("checkM").checked = false;
    document.getElementById("checkC").checked = false;
  }
  
  
  // =========================
  // BOTÓN BORRAR TODO
  // =========================
  function prepararBotonBorrarTodo() {
    const ths = document.querySelectorAll(".army-table th");
    const thX = ths[9];
  
    thX.innerHTML = "";
  
    const btn = document.createElement("span");
    btn.textContent = "❌";
    btn.classList.add("borrar");
    btn.style.filter = "brightness(0) invert(1)";
    btn.style.cursor = "pointer";
    btn.title = "Borrar toda la tabla";
  
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("tablaUnidades").innerHTML = "";
      actualizarTotal();
      rellenarFilasVacias();
      mostrarEstadoVacio();
    });
  
    thX.appendChild(btn);
  }
  
  
  // =========================
  // EJÉRCITOS
  // =========================
  function cargarEjercitos() {
    const select = document.getElementById("ejercito");
    select.innerHTML = "";
  
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "-- Selecciona ejército --";
    select.appendChild(def);
  
    datos.ejercitos.forEach(e => {
      const op = document.createElement("option");
      op.value = e.IDejercito;
      op.textContent = e.EJERCITOS;
      select.appendChild(op);
    });
  }
  
  
  // =========================
  // EVENTO EJÉRCITO
  // =========================
  document.getElementById("ejercito").addEventListener("change", function () {
  
  document.getElementById("filtroTipo").addEventListener("change", function () {
    const idEjercito = parseInt(document.getElementById("ejercito").value);
  
    if (idEjercito) {
      cargarTropas(idEjercito);
    }
  });
    
    resetInputs();
  
    document.getElementById("filtroTipo").value = "";
  
    if (!this.value) {
      limpiarSelect("tropa");
      limpiarSelect("equipo");
      limpiarSelect("opciones");
      actualizarPMC(null);
      return;
    }
  
    cargarTropas(parseInt(this.value));
  });
  
  
  // =========================
  // TROPAS
  // =========================
  function cargarTropas(idEjercito) {
    const select = document.getElementById("tropa");
    select.innerHTML = "";
    select.disabled = false;
  
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "-- Selecciona tropa --";
    select.appendChild(def);
  
    const filtroTipo = document.getElementById("filtroTipo").value;
  
    let filtradas = datos.tropas.filter(t => t.IDejercito === idEjercito);
  
    // 🔥 aplicar filtro si hay uno seleccionado
    if (filtroTipo) {
      filtradas = filtradas.filter(t => t.IDtipo == filtroTipo);
    }
  
    filtradas.forEach(t => {
      const op = document.createElement("option");
      op.value = t.IDtropa;
      op.textContent = t.TROPA;
      select.appendChild(op);
    });
  
    limpiarSelect("equipo");
    limpiarSelect("opciones");
  }
  
  
  // =========================
  // EVENTO TROPA
  // =========================
  document.getElementById("tropa").addEventListener("change", function () {
  
    resetInputs();
  
    if (!this.value) {
      limpiarSelect("equipo");
      limpiarSelect("opciones");
      actualizarPMC(null);
      return;
    }
  
    const idTropa = parseInt(this.value);
  
    // 🔥 AUTOCOMPLETAR NÚMERO
    const tropa = datos.tropas.find(t => t.IDtropa === idTropa);
  
    if (tropa && tropa.NUMERO) {
      document.getElementById("numero").value = tropa.NUMERO;
    } else {
      document.getElementById("numero").value = "";
    }
  
    cargarEquipo(idTropa);
    cargarOpciones(idTropa);
    actualizarPMC(idTropa);
    calcularCoste();
  });
  
  
  // =========================
  // EQUIPO
  // =========================
  function cargarEquipo(idTropa) {
    const select = document.getElementById("equipo");
    select.innerHTML = "";
  
    const rel = datos.equipo_tropas.filter(r => r.IDtropa === idTropa);
    const ids = rel.map(r => r.IDequipo);
  
    const filtrado = datos.equipo.filter(e => ids.includes(e.IDequipo));
  
    if (filtrado.length === 0) {
      select.disabled = true;
      select.innerHTML = "<option>-- Sin equipo --</option>";
      return;
    }
  
    select.disabled = false;
  
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "-- Selecciona equipo --";
    select.appendChild(def);
  
    filtrado.forEach(e => {
      const op = document.createElement("option");
      op.value = e.IDequipo;
      op.textContent = e.EQUIPO;
      select.appendChild(op);
    });
  }
  
  
  // =========================
  // OPCIONES
  // =========================
  function cargarOpciones(idTropa) {
    const select = document.getElementById("opciones");
    select.innerHTML = "";
  
    const rel = datos.unidad_tropas.filter(r => r.IDtropa === idTropa);
    const ids = rel.map(r => r.IDunidad);
  
    const filtrado = datos.unidad.filter(u => ids.includes(u.IDunidad));
  
    if (filtrado.length === 0) {
      select.disabled = true;
      select.innerHTML = "<option>-- Sin opciones --</option>";
      return;
    }
  
    select.disabled = false;
  
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "-- Selecciona opción --";
    select.appendChild(def);
  
    filtrado.forEach(u => {
      const op = document.createElement("option");
      op.value = u.IDunidad;
      op.textContent = u.UNIDAD;
      select.appendChild(op);
    });
  }
  
  
  // =========================
  // LIMPIAR SELECT
  // =========================
  function limpiarSelect(id) {
    const select = document.getElementById(id);
    select.innerHTML = "<option>-- Selecciona --</option>";
    select.disabled = true;
  }
  
  
  // =========================
  // P M C
  // =========================
  /*function actualizarPMC(idTropa) {
    const checkP = document.getElementById("checkP");
    const checkM = document.getElementById("checkM");
    const checkC = document.getElementById("checkC");
  
    const p = datos.portaestandarte.find(x => x.IDtropa === idTropa);
    const m = datos.musico.find(x => x.IDtropa === idTropa);
    const c = datos.campeon.find(x => x.IDtropa === idTropa);
  
    checkP.disabled = !p;
    checkM.disabled = !m;
    checkC.disabled = !c;
  
    if (!p) checkP.checked = false;
    if (!m) checkM.checked = false;
    if (!c) checkC.checked = false;
  }*/
  
  function actualizarPMC(idTropa) {
    const checkP = document.getElementById("checkP");
    const checkM = document.getElementById("checkM");
    const checkC = document.getElementById("checkC");
  
    const p = datos.portaestandarte.find(x => x.IDtropa === idTropa);
    const m = datos.musico.find(x => x.IDtropa === idTropa);
    const c = datos.campeon.find(x => x.IDtropa === idTropa);
  
    // HABILITAR / DESHABILITAR
    checkP.disabled = !p;
    checkM.disabled = !m;
    checkC.disabled = !c;
  
    // 👇 OCULTAR SOLO EL CHECKBOX
    checkP.style.visibility = p ? "visible" : "hidden";
    checkM.style.visibility = m ? "visible" : "hidden";
    checkC.style.visibility = c ? "visible" : "hidden";
  
    // DESMARCAR si no existen
    if (!p) checkP.checked = false;
    if (!m) checkM.checked = false;
    if (!c) checkC.checked = false;
  }
  
  
  // =========================
  // CALCULAR COSTE
  // =========================
  function calcularCoste() {
    const idTropa = parseInt(document.getElementById("tropa").value);
    const idEquipo = parseInt(document.getElementById("equipo").value);
    const idUnidad = parseInt(document.getElementById("opciones").value);
    const numero = parseInt(document.getElementById("numero").value) || 0;
  
    if (!idTropa || numero === 0) {
      document.getElementById("coste").value = "";
      return;
    }
  
    const costeTropa = parseInt(datos.tropas.find(t => t.IDtropa === idTropa)?.COSTE) || 0;
    const costeEquipo = idEquipo ? parseInt(datos.equipo.find(e => e.IDequipo === idEquipo)?.COSTE) || 0 : 0;
    const costeUnidad = idUnidad ? parseInt(datos.unidad.find(u => u.IDunidad === idUnidad)?.COSTE) || 0 : 0;
  
    const costeP = document.getElementById("checkP").checked
      ? parseInt(datos.portaestandarte.find(p => p.IDtropa === idTropa)?.COSTE) || 0 : 0;
  
    const costeM = document.getElementById("checkM").checked
      ? parseInt(datos.musico.find(m => m.IDtropa === idTropa)?.COSTE) || 0 : 0;
  
    const costeC = document.getElementById("checkC").checked
      ? parseInt(datos.campeon.find(c => c.IDtropa === idTropa)?.COSTE) || 0 : 0;
  
    const total =
      (numero * (costeTropa + costeEquipo)) +
      costeUnidad + costeP + costeM + costeC;
  
    document.getElementById("coste").value = total;
  }
  
  
  // =========================
  // EVENTOS COSTE
  // =========================
  ["equipo", "opciones", "numero", "checkP", "checkM", "checkC"]
  .forEach(id => {
    document.getElementById(id).addEventListener("change", calcularCoste);
    document.getElementById(id).addEventListener("input", calcularCoste);
  });
  
  
  // =========================
  // AÑADIR FILA
  // =========================
  function añadirFila() {
    const numero = document.getElementById("numero").value;
    const tropaSelect = document.getElementById("tropa");
    const equipoSelect = document.getElementById("equipo");
    const opcionesSelect = document.getElementById("opciones");
    const checkP = document.getElementById("checkP");  /*20260408*/
    const checkM = document.getElementById("checkM");  /*20260408*/
    const checkC = document.getElementById("checkC");  /*20260408*/
    const coste = document.getElementById("coste").value;
  
    if (!numero || !tropaSelect.value || !coste) return;
  
    const idTropa = parseInt(tropaSelect.value);
  
    const textoEquipo = (!equipoSelect.value || equipoSelect.disabled)
      ? "--"
      : equipoSelect.options[equipoSelect.selectedIndex].text;
  
    const textoOpciones = (!opcionesSelect.value || opcionesSelect.disabled)
      ? "--"
      : opcionesSelect.options[opcionesSelect.selectedIndex].text;
  
      const idEquipo = equipoSelect.value || "";
      const idOpciones = opcionesSelect.value || "";
      
  
    const fila = document.createElement("tr");
  
    // 🔥 CLAVE PARA PDF
    fila.dataset.idTropa = idTropa;
    const tropaObj = datos.tropas.find(t => t.IDtropa === idTropa);
  
    let icono = "-";
  
    if (tropaObj) {
      if (tropaObj.IDtipo == 1) {
        icono = '<img src="ico/BASICA.png" class="icono-rango">';
      } else if (tropaObj.IDtipo == 2) {
        icono = '<img src="ico/ESPECIAL.png" class="icono-rango">';
      } else if (tropaObj.IDtipo == 3) {
        icono = '<img src="ico/SINGULAR.png" class="icono-rango">';
      }
    }
  
    fila.dataset.tipo = tropaObj ? tropaObj.IDtipo : 99;
  
    fila.dataset.idEquipo = idEquipo;
    fila.dataset.idOpciones = idOpciones;
  
    
  const rango = ""; // o lo que quieras (ej: "B", "E", "S")
  
  fila.innerHTML = `
    <td>${icono}</td>
    <td>${numero}</td>
    <td>${tropaSelect.options[tropaSelect.selectedIndex].text}</td>
      <td>${textoEquipo}</td>
      <td>${textoOpciones}</td>
      <td>${checkP.checked ? "✔" : ""}</td>
      <td>${checkM.checked ? "✔" : ""}</td>
      <td>${checkC.checked ? "✔" : ""}</td>
      <td class="costeFila">${coste}</td>
      <td class="borrar">❌</td>
    `;
  
  fila.addEventListener("click", function () {
  
    document.querySelectorAll("#tablaUnidades tr")
      .forEach(f => f.classList.remove("selected"));
  
    fila.classList.add("selected");
  
    const id = parseInt(fila.dataset.idTropa);
  
    if (id) {
      mostrarPanelDerecho();
  
      mostrarFicha(id);
      mostrarReglas(id);
      mostrarImagen(id);
      mostrarCostesUnidad(id, fila);
    }
  });
  
    fila.querySelector(".borrar").addEventListener("click", (e) => {
      e.stopPropagation();
      fila.remove();
      actualizarTotal();
      rellenarFilasVacias();
    });
  
    document.getElementById("tablaUnidades").appendChild(fila);
    
    ordenarTabla();
    actualizarTotal();
    rellenarFilasVacias();
  
    resetInputs(); /*20260408*/
    document.getElementById("numero").value = ""; /*20260408*/
    document.getElementById("tropa").value = ""; /*20260408*/
    limpiarSelect("equipo"); /*20260408*/
    limpiarSelect("opciones"); /*20260408*/
  
  }
  
  
  // =========================
  // ORDENAR TABLA
  // =========================
  function ordenarTabla() {
  
    const tabla = document.getElementById("tablaUnidades");
    const filas = Array.from(tabla.querySelectorAll("tr"));
  
    const ordenTipo = (tipo) => {
      if (tipo == 1) return 1; // Básica
      if (tipo == 2) return 2; // Especial
      if (tipo == 3) return 3; // Singular
      return 4;
    };
  
    filas.sort((a, b) => {
      return ordenTipo(a.dataset.tipo) - ordenTipo(b.dataset.tipo);
    });
  
    filas.forEach(f => tabla.appendChild(f));
  }
  
  
  
  
  
  // =========================
  // FILAS FANTASMA
  // =========================
  function rellenarFilasVacias() {
  
    const tabla = document.getElementById("tablaUnidades");
  
    // 🔥 borrar filas vacías anteriores
    tabla.querySelectorAll(".fila-vacia").forEach(f => f.remove());
  
    // 🔥 contar SOLO filas con contenido real (tropa)
    const filasReales = Array.from(tabla.querySelectorAll("tr"))
      .filter(f => {
        const celdas = f.querySelectorAll("td");
        return celdas.length > 1 && celdas[1].textContent.trim() !== "";
      }).length;
  
    const TOTAL_FILAS = 21;
    const faltan = TOTAL_FILAS - filasReales;
  
    for (let i = 0; i < faltan; i++) {
  
      const fila = document.createElement("tr");
      fila.classList.add("fila-vacia");
  
      fila.innerHTML = `
        <td></td>
        <td>&nbsp;</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      `;
  
      tabla.appendChild(fila);
    }
  }
  
  
  
  // =========================
  // TOTAL
  // =========================
  function actualizarTotal() {
    let total = 0;
    document.querySelectorAll(".costeFila").forEach(c => {
      total += parseInt(c.textContent) || 0;
    });
    document.getElementById("puntos").value = total;
  }
  
  // =========================
  // MOSTRAR PARTE DERECHA
  // =========================
  function mostrarPanelDerecho() {
    document.querySelector(".photo-box").style.display = "block";
    document.querySelector(".ficha-container").style.display = "block";
    document.querySelector(".rules").style.display = "block";
    document.querySelector(".info-unidad").style.display = "block";
  
    document.querySelector(".empty-state").style.display = "none";
  }
  
  // =========================
  // MOSTRAR VACIO
  // =========================
  function mostrarEstadoVacio() {
    document.querySelector(".photo-box").style.display = "none";
    document.querySelector(".ficha-container").style.display = "none";
    document.querySelector(".rules").style.display = "none";
    document.querySelector(".info-unidad").style.display = "none";
  
    document.querySelector(".empty-state").style.display = "block";
  }
  
  
  // =========================
  // REGLAS
  // =========================
  function mostrarReglas(idTropa) {
  
    const lista = document.querySelector(".rules ul");
    const descripcionBox = document.getElementById("descripcionRegla");
  
    lista.innerHTML = "";
    descripcionBox.style.display = "none"; // 🔥 ocultar siempre al recargar
  
    const relaciones = datos.reglas_tropas.filter(r => r.IDtropa === idTropa);
  
    relaciones.forEach(r => {
      const regla = datos.reglas.find(reg => reg.IDRegla === r.IDRegla);
  
      if (regla) {
        const li = document.createElement("li");
        li.textContent = regla.REGLA;
  
        // 🔥 CLICK EN REGLA
        li.addEventListener("click", (e) => {
          e.stopPropagation();
  
          // 🔥 quitar selección previa
          document.querySelectorAll(".rules li")
            .forEach(el => el.classList.remove("activa"));
  
          // 🔥 marcar esta
          li.classList.add("activa");
  
          // mostrar descripción
          descripcionBox.textContent = regla.DESCRIPCION || "-";
          descripcionBox.style.display = "block";
        });
  
        lista.appendChild(li);
      }
    });
  
    if (relaciones.length === 0) {
      lista.innerHTML = "<li>-</li>";
    }
  }
  
  
  // =========================
  // FICHA
  // =========================
  function mostrarFicha(idTropa) {
  
    const filas = document.querySelectorAll(".stats-table tbody tr");
  
    // =========================
    // 🟢 TROPA
    // =========================
    const tropa = datos.tropas.find(t => t.IDtropa === idTropa);
  
    const ficha = obtener("ficha", "ficha_tropas", "IDficha", idTropa);
  
    // 👉 nombre en primera columna
    filas[0].querySelector("td").textContent = tropa ? tropa.TROPA : "Unidad";
  
    rellenarFila(0, ficha);
  
  
    // =========================
    // 🟡 MONTURA
    // =========================
    const relMontura = datos.montura_tropas.find(m => m.IDtropa === idTropa);
    const montura = relMontura
      ? datos.montura.find(m => m.IDmontura === relMontura.IDmontura)
      : null;
  
    filas[1].querySelector("td").textContent =
      montura ? montura.MONTURA_DOTACION : "Montura/Dotación";
  
    rellenarFila(1, montura);
    toggleFila(1, !!montura);
  
  
    // =========================
    // 🔴 CARRO
    // =========================
    const relCarro = datos.carro_tropas.find(c => c.IDtropa === idTropa);
    const carro = relCarro
      ? datos.carro.find(c => c.IDcarro === relCarro.IDcarro)
      : null;
  
    filas[2].querySelector("td").textContent =
      carro ? carro.CARRO : "Carro";
  
    rellenarFila(2, carro);
    toggleFila(2, !!carro);
  }
  
  
    // =========================
    //  COSTES DE LA UNIDAD
    // =========================
  
  
  function mostrarCostesUnidad(idTropa, fila) {
  
    const tropa = datos.tropas.find(t => t.IDtropa === idTropa);
    if (!tropa) return;
  
    // =========================
    // 🟡 TIPO (Básica, Especial…)
    // =========================
    const tipoDiv = document.querySelector(".tipo-unidad");
  
    let tipoTexto = "";
  
    if (tropa.IDtipo === 1) tipoTexto = "Básica";
    if (tropa.IDtipo === 2) tipoTexto = "Especial";
    if (tropa.IDtipo === 3) tipoTexto = "Singular";
  
    tipoDiv.textContent = tipoTexto;
  
    // =========================
    // 💰 COSTES BASE
    // =========================
    const costeTropa = parseInt(tropa.COSTE) || 0;
  
    // Equipo
    let costeEquipo = 0;
    const idEquipo = parseInt(fila.dataset.idEquipo);
  
    if (idEquipo) {
      const eq = datos.equipo.find(e => e.IDequipo === idEquipo);
      if (eq) costeEquipo = parseInt(eq.COSTE) || 0;
    }
  
    // Opciones
  // Opciones
    let costeOpciones = 0;
    const idOpciones = parseInt(fila.dataset.idOpciones);
  
    if (idOpciones) {
      const op = datos.unidad.find(u => u.IDunidad === idOpciones);
      if (op) costeOpciones = parseInt(op.COSTE) || 0;
    }
  
    // PMC
    let costePMC = 0;
  
    if (fila.children[5].textContent) {
      costePMC += parseInt(datos.portaestandarte.find(p => p.IDtropa === idTropa)?.COSTE) || 0;
    }
  
    if (fila.children[6].textContent) {
      costePMC += parseInt(datos.musico.find(m => m.IDtropa === idTropa)?.COSTE) || 0;
    }
  
    if (fila.children[7].textContent) {
      costePMC += parseInt(datos.campeon.find(c => c.IDtropa === idTropa)?.COSTE) || 0;
    }
  
    // =========================
    // 🖊️ PINTAR
    // =========================
  document.getElementById("costeTropa").textContent = costeTropa || "-";
  document.getElementById("costeEquipo").textContent = costeEquipo || "-";
  document.getElementById("costeOpciones").textContent = costeOpciones || "-";
  document.getElementById("costePMC").textContent = costePMC || "-";
  }
  
  
  
  
  
  
  
  // =========================
  // HELPERS
  // =========================
  function obtener(tabla, rel, campo, idTropa) {
    const r = datos[rel].find(x => x.IDtropa === idTropa);
    return r ? datos[tabla].find(x => x[campo] === r[campo]) : null;
  }
  
  function rellenarFila(index, data) {
    const filas = document.querySelectorAll(".stats-table tbody tr");
    const fila = filas[index];
    const celdas = fila.querySelectorAll("td");
  
    if (!data) {
      for (let i = 1; i < celdas.length; i++) celdas[i].textContent = "";
      return;
    }
  
    ["M","Ha","Hp","F","R","H","I","A","L"].forEach((k, i) => {
      celdas[i + 1].textContent = data[k] || "";
    });
  }
  
  function toggleFila(index, visible) {
    const fila = document.querySelectorAll(".stats-table tbody tr")[index];
    fila.style.display = visible ? "" : "none";
  }
  
  
  // =========================
  // IMAGEN
  // =========================
  function mostrarImagen(idTropa) {
  
    const tropa = datos.tropas.find(t => t.IDtropa === idTropa);
    if (!tropa) return;
  
    const ejercito = datos.ejercitos.find(e => e.IDejercito === tropa.IDejercito);
    if (!ejercito) return;
  
    const contenedor = document.querySelector(".photo-box");
    if (!contenedor) return;
  
    // Limpia contenido anterior
    contenedor.innerHTML = "";
  
    // Si tienes IMAGEN en JSON
    if (ejercito.IMAGEN) {
      const img = document.createElement("img");
      img.src = "img/" + ejercito.IMAGEN;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
  
      contenedor.appendChild(img);
    }
  }
  
  //GUARDAR
  function guardarEjercito() {
  
    const filas = document.querySelectorAll("#tablaUnidades tr");
  
    let datosGuardar = [];
  
    filas.forEach(fila => {
  
      const celdas = fila.querySelectorAll("td");
  
      // 🚨 ignorar filas vacías o incompletas
      if (celdas.length < 8 || !celdas[1].textContent.trim()) return;
  
      datosGuardar.push({
        rango: fila.dataset.tipo || null,
        numero: celdas[1].textContent,
        tropa: celdas[2].textContent,
        equipo: celdas[3].textContent,
        opciones: celdas[4].textContent,
        p: celdas[5].textContent,
        m: celdas[6].textContent,
        c: celdas[7].textContent,
        coste: celdas[8].textContent,
        idTropa: fila.dataset.idTropa || null
      });
  
    });
  
    if (datosGuardar.length === 0) {
      alert("No hay unidades para guardar");
      return;
    }
  
    const nombre = prompt("Nombre del ejército:");
    if (!nombre) return;
  
    const blob = new Blob([JSON.stringify(datosGuardar, null, 2)], {
      type: "application/json"
    });
  
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre + ".json";
    a.click();
  }
  
  
  //CARGAR
  function cargarEjercito() {
    document.getElementById("fileInput").click();
  }
  
  document.getElementById("fileInput").addEventListener("change", function (event) {
  
    const file = event.target.files[0];
    if (!file) return;
  
    const reader = new FileReader();
  
    reader.onload = function (e) {
      const contenido = JSON.parse(e.target.result);
  
      const tabla = document.getElementById("tablaUnidades");
      tabla.innerHTML = "";
  
      contenido.forEach(item => {
  
        const fila = document.createElement("tr");
  
        let idTropa = item.idTropa ? parseInt(item.idTropa) : null;
  
        // 🔥 si no existe, lo buscamos por nombre
        if (!idTropa) {
          const tropaObj = datos.tropas.find(t =>
            t.TROPA.trim().toLowerCase() === item.tropa.trim().toLowerCase()
          );
          idTropa = tropaObj ? parseInt(tropaObj.IDtropa) : null;
        }
  
        // =========================
        // 🔥 EQUIPO (CORREGIDO)
        // =========================
        let idEquipo = null;
  
        if (item.equipo && item.equipo !== "--" && idTropa) {
  
          const rel = datos.equipo_tropas.filter(r => r.IDtropa === idTropa);
          const idsValidos = rel.map(r => r.IDequipo);
  
          const eq = datos.equipo.find(e =>
            idsValidos.includes(e.IDequipo) &&
            e.EQUIPO.trim().toLowerCase() === item.equipo.trim().toLowerCase()
          );
  
          idEquipo = eq ? eq.IDequipo : null;
        }
  
        // =========================
        // 🔥 OPCIONES (CORREGIDO)
        // =========================
        let idOpciones = null;
  
        if (item.opciones && item.opciones !== "--" && idTropa) {
  
          const rel = datos.unidad_tropas.filter(r => r.IDtropa === idTropa);
          const idsValidos = rel.map(r => r.IDunidad);
  
          const op = datos.unidad.find(u =>
            idsValidos.includes(u.IDunidad) &&
            u.UNIDAD.trim().toLowerCase() === item.opciones.trim().toLowerCase()
          );
  
          idOpciones = op ? op.IDunidad : null;
        }
  
        // =========================
        // DATASETS
        // =========================
        fila.dataset.idTropa = idTropa ? idTropa : "";
        fila.dataset.idEquipo = idEquipo ? idEquipo : "";
        fila.dataset.idOpciones = idOpciones ? idOpciones : "";
  
        // =========================
        // HTML FILA
        // =========================
        const tropaObj = datos.tropas.find(t => t.IDtropa === idTropa);
        const tipo = tropaObj ? tropaObj.IDtipo : null;
        fila.dataset.tipo = tipo || 99;
        let icono = "-";
  
        if (tipo == 1) icono = '<img src="ico/BASICA.png" class="icono-rango">';
        if (tipo == 2) icono = '<img src="ico/ESPECIAL.png" class="icono-rango">';
        if (tipo == 3) icono = '<img src="ico/SINGULAR.png" class="icono-rango">';
  
        // 🔥 HTML final
        fila.innerHTML = `
          <td>${icono}</td>
          <td>${item.numero}</td>
          <td>${item.tropa}</td>
          <td>${item.equipo}</td>
          <td>${item.opciones}</td>
          <td>${item.p ? "✔" : ""}</td>
          <td>${item.m ? "✔" : ""}</td>
          <td>${item.c ? "✔" : ""}</td>
          <td class="costeFila">${item.coste}</td>
          <td class="borrar">❌</td>
        `;
  
        // =========================
        // CLICK FILA
        // =========================
        fila.addEventListener("click", function () {
  
          document.querySelectorAll("#tablaUnidades tr")
            .forEach(f => f.classList.remove("selected"));
  
          fila.classList.add("selected");
  
          const id = parseInt(fila.dataset.idTropa);
  
          if (id) {
            mostrarPanelDerecho();
  
            mostrarFicha(id);
            mostrarReglas(id);
            mostrarImagen(id);
            mostrarCostesUnidad(id, fila);
          }
        });
  
        // =========================
        // BORRAR FILA
        // =========================
        fila.querySelector(".borrar").addEventListener("click", (e) => {
          e.stopPropagation();
          fila.remove();
          actualizarTotal();
          rellenarFilasVacias();
        });
  
        tabla.appendChild(fila);
      });
  
      actualizarTotal();
      rellenarFilasVacias();
    };
  
    reader.readAsText(file);
  });
  
  //BORRAR
  function borrarEjercito() {
    alert("Lo borras tu con tus pelotas.");
  }
  
  
  
  
  
  //PDF
  // =========================================================================
  // EXPORTAR PDF — "HOJA DE EJÉRCITO"
  // =========================================================================
  // Documento en tres tablas (lista de unidades + perfiles con reglas
  // especiales + resumen de reglas especiales), con fondo de pergamino a
  // sangre completa en TODAS las páginas, líneas finas y una tipografía
  // de época (Caslon Antique) reservada para los titulares, mientras el
  // cuerpo de las tablas usa una serif limpia para que los datos sigan
  // siendo legibles a tamaño pequeño.
  // El PDF se ABRE en una pestaña nueva del navegador (visor nativo) para
  // que sea el propio usuario quien decida si lo guarda o lo imprime.
  // =========================================================================

  const PALETA_PDF = {
    ink:           [40, 32, 24],    // texto principal
    inkSuave:      [112, 101, 87],  // texto secundario / etiquetas
    linea:         [166, 163, 154], // #A6A39A — reglas y separadores
    fondoAlt:      [217, 209, 193], // franja de fila alterna (zebra)
    fondoRespaldo: [235, 229, 216]  // sólo si la textura no llega a cargar
  };

  // Dimensiones reales (px) de ico/FONDO_HOJA.jpg — su proporción ya es
  // prácticamente A4, así que se encaja a sangre completa sin recortes
  // perceptibles ni deformar la textura.
  const TEXTURA_FONDO_PX = { ancho: 1054, alto: 1492 };

  // Tipografía decorativa para titulares (Caslon Antique, 1894). Sólo se usa
  // en el título, el nombre del ejército, las etiquetas de sección y la
  // cifra de puntos totales; el resto del documento (tablas, pie de página)
  // se mantiene en la serif estándar de jsPDF para que los datos sigan
  // siendo legibles a tamaños pequeños. Si por lo que sea no se puede
  // cargar/incrustar, todo el documento cae automáticamente a esa misma
  // serif estándar sin romperse.
  const FUENTE_TITULARES = {
    familia: "CaslonAntique",
    archivoRegular: "fonts/CaslonAntique-Regular.ttf",
    archivoBold: "fonts/CaslonAntique-Bold.ttf"
  };

  // Convierte una imagen del propio proyecto en un dataURL para poder
  // incrustarla en el PDF. Si falla la carga, se resuelve a null y el
  // documento sigue generándose con un color de respaldo.
  function cargarImagenDataURL(url) {
    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("No se pudo cargar " + url);
        return res.blob();
      })
      .then(blob => new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onloadend = () => resolve(lector.result);
        lector.onerror = reject;
        lector.readAsDataURL(blob);
      }))
      .catch(() => null);
  }

  // Convierte un archivo de fuente (.ttf) en el string base64 "a pelo" que
  // pide jsPDF (sin el prefijo "data:...;base64,"). Si falla, resuelve a
  // null para poder recurrir a la tipografía estándar sin romper el PDF.
  function cargarFuenteBase64(url) {
    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("No se pudo cargar " + url);
        return res.blob();
      })
      .then(blob => new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onloadend = () => {
          const resultado = String(lector.result || "");
          const coma = resultado.indexOf(",");
          resolve(coma >= 0 ? resultado.slice(coma + 1) : resultado);
        };
        lector.onerror = reject;
        lector.readAsDataURL(blob);
      }))
      .catch(() => null);
  }

  // Registra Caslon Antique (normal y negrita) en el documento. Devuelve
  // true sólo si AMBOS pesos se han podido incrustar correctamente; si
  // falta cualquiera de los dos, se usa la serif estándar en todo el
  // documento para mantener una tipografía consistente.
  async function registrarFuenteTitulares(doc) {
    try {
      const [base64Regular, base64Bold] = await Promise.all([
        cargarFuenteBase64(FUENTE_TITULARES.archivoRegular),
        cargarFuenteBase64(FUENTE_TITULARES.archivoBold)
      ]);

      if (!base64Regular || !base64Bold) return false;

      doc.addFileToVFS("CaslonAntique-Regular.ttf", base64Regular);
      doc.addFont("CaslonAntique-Regular.ttf", FUENTE_TITULARES.familia, "normal");

      doc.addFileToVFS("CaslonAntique-Bold.ttf", base64Bold);
      doc.addFont("CaslonAntique-Bold.ttf", FUENTE_TITULARES.familia, "bold");

      return true;
    } catch (err) {
      console.warn("No se pudo incrustar Caslon Antique, se usará la tipografía estándar:", err);
      return false;
    }
  }

  // Fondo de pergamino a sangre completa, sin marco ni recuadro encima.
  function dibujarFondoPagina(doc, texturaDataURL) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    if (texturaDataURL) {
      const escala = Math.max(w / TEXTURA_FONDO_PX.ancho, h / TEXTURA_FONDO_PX.alto);
      const anchoFinal = TEXTURA_FONDO_PX.ancho * escala;
      const altoFinal = TEXTURA_FONDO_PX.alto * escala;
      const x = (w - anchoFinal) / 2;
      const y = (h - altoFinal) / 2;
      doc.addImage(texturaDataURL, "JPEG", x, y, anchoFinal, altoFinal, undefined, "FAST");
    } else {
      doc.setFillColor(...PALETA_PDF.fondoRespaldo);
      doc.rect(0, 0, w, h, "F");
    }
  }

  // Filete fino simple (sin imagen: se probó con una barra ilustrada y no
  // convencía visualmente, así que se quedó en una línea recta lisa).
  function dibujarFilete(doc, xIzq, xDer, y) {
    doc.setDrawColor(...PALETA_PDF.linea);
    doc.setLineWidth(0.3);
    doc.line(xIzq, y, xDer, y);
  }

  // Cabecera completa (sólo primera página): el título centrado y, a la
  // derecha, un bloque de puntos totales enmarcado únicamente por dos
  // filetes finos (sin caja, sin relleno y sin ningún emblema encima).
  function dibujarCabeceraPrincipal(doc, opts) {
    const w = doc.internal.pageSize.getWidth();
    const margen = 12;
    const fTitulares = opts.familiaTitulares;

    const yTitulo = 20;

    // El título se centra "a mano" (calculando su ancho real, incluido el
    // interletraje) en vez de usar align:"center", para evitar el efecto
    // secundario conocido de jsPDF al combinar charSpace con alineaciones
    // automáticas.
    const tituloTexto = "HOJA DE EJÉRCITO";
    const tituloCharSpace = 0.5;
    doc.setFont(fTitulares, "normal");
    doc.setFontSize(25);
    const anchoTitulo = doc.getTextWidth(tituloTexto) + tituloCharSpace * (tituloTexto.length - 1);
    doc.setTextColor(...PALETA_PDF.ink);
    doc.text(tituloTexto, (w - anchoTitulo) / 2, yTitulo, { charSpace: tituloCharSpace });

    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...PALETA_PDF.inkSuave);
    doc.text(`Generado el ${opts.fecha} · ${opts.numUnidades} entrada(s) de ejército`, w / 2, yTitulo + 9, { align: "center" });

    // Bloque de puntos totales: filete / etiqueta / filete / cifra grande
    const anchoPlaca = 42;
    const xIzq = w - margen - anchoPlaca;
    const xDer = w - margen;
    const xCentro = xIzq + anchoPlaca / 2;

    const yLinea1 = yTitulo - 6;
    const yEtiqueta = yLinea1 + 4.4;
    const yLinea2 = yEtiqueta + 2;
    const yNumero = yLinea2 + 9;

    dibujarFilete(doc, xIzq, xDer, yLinea1);

    doc.setFont("times", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...PALETA_PDF.inkSuave);
    doc.text("PUNTOS TOTALES", xCentro, yEtiqueta, { align: "center" });

    dibujarFilete(doc, xIzq, xDer, yLinea2);

    doc.setFont(fTitulares, "bold");
    doc.setFontSize(20);
    doc.setTextColor(...PALETA_PDF.ink);
    doc.text(String(opts.totalPuntos || 0), xCentro, yNumero, { align: "center" });

    return yTitulo + 22;
  }

  // Cabecera reducida para páginas de continuación: título pequeño +
  // nombre del ejército + un único filete fino debajo.
  function dibujarCabeceraContinuacion(doc, opts) {
    const w = doc.internal.pageSize.getWidth();
    const margen = 12;

    doc.setTextColor(...PALETA_PDF.ink);
    doc.setFont(opts.familiaTitulares, "normal");
    doc.setFontSize(12);
    doc.text("HOJA DE EJÉRCITO", margen, 20, { charSpace: 0.35 });

    if (opts.nombreEjercito) {
      doc.setFont("times", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...PALETA_PDF.inkSuave);
      doc.text(opts.nombreEjercito, w - margen, 20, { align: "right" });
    }

    dibujarFilete(doc, margen, w - margen, 23);
  }

  // Etiqueta de sección en versalitas espaciadas, con un filete fino debajo
  // (introduce cada una de las tres tablas).
  function dibujarEtiquetaSeccion(doc, texto, y, familiaTitulares) {
    const w = doc.internal.pageSize.getWidth();
    const margen = 12;

    doc.setFont(familiaTitulares, "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...PALETA_PDF.ink);
    doc.text(texto.toUpperCase(), margen, y, { charSpace: 0.35 });

    dibujarFilete(doc, margen, w - margen, y + 2);

    return y + 7;
  }

  // Pie de página minimalista: un único filete fino y una línea de texto
  // centrada, sin sellos ni recuadros.
  function dibujarPiePagina(doc, pagina, totalPaginas, nombreEjercito) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const margen = 12;

    dibujarFilete(doc, margen, w - margen, h - 14);

    const texto = `${pagina}  ·  HOJA DE EJÉRCITO${nombreEjercito ? "  ·  " + nombreEjercito : ""}  ·  Página ${pagina} de ${totalPaginas}`;

    doc.setFont("times", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(...PALETA_PDF.inkSuave);
    doc.text(texto, w / 2, h - 9, { align: "center" });
  }

  // Dibuja a mano un filete fino bajo la fila de cabecera de una tabla.
  // Deliberadamente NO se usa la opción "lineWidth: {bottom: X}" de
  // jspdf-autotable para bordes por lado: esa sintaxis provoca un error
  // real y documentado de la propia librería ("Invalid arguments passed
  // to jsPDF.rect", ver issue #966 de jsPDF-AutoTable) que impedía
  // generar el PDF por completo. Dibujando la línea nosotros mismos en
  // didDrawCell se consigue el mismo efecto visual sin depender de esa
  // función rota.
  function dibujarBordeInferiorCabecera(data) {
    if (data.section !== "head") return;
    const doc = data.doc;
    dibujarFilete(doc, data.cell.x, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
  }

  // Texto de reglas especiales de una tropa, separado por comas.
  function formatearReglasPDF(idTropa) {
    const relaciones = datos.reglas_tropas.filter(r => r.IDtropa == idTropa);
    const nombres = relaciones
      .map(r => (datos.reglas.find(reg => reg.IDRegla === r.IDRegla) || {}).REGLA)
      .filter(Boolean);
    return nombres.length ? nombres.join(", ") : "—";
  }

  // Texto explicativo de una regla especial para el glosario final. Usa
  // exactamente el mismo campo (DESCRIPCION) y el mismo valor de reserva
  // ("-") que emplea mostrarReglas() al pulsar sobre una regla en la
  // aplicación, para que el PDF muestre siempre lo mismo que se ve en
  // pantalla.
  function obtenerDescripcionRegla(regla) {
    return regla.DESCRIPCION || "-";
  }

  // Fila de estadísticas [nombre, M, HA, HP, F, R, H, I, A, L].
  // Nota: las líneas de montura/carro se marcan con el carácter "•"
  // (viñeta, presente en la codificación estándar WinAnsi de jsPDF). No se
  // usan flechas tipográficas como "↳": esos glifos no existen en las
  // fuentes base de jsPDF y se dibujaban como un símbolo roto en el PDF.
  function filaEstadisticasPDF(nombre, ficha) {
    const g = campo => (ficha && ficha[campo] !== undefined && ficha[campo] !== null && ficha[campo] !== "")
      ? String(ficha[campo]) : "-";
    return [nombre, g("M"), g("Ha"), g("Hp"), g("F"), g("R"), g("H"), g("I"), g("A"), g("L")];
  }

  async function exportarPDF() {

    // Se reserva la pestaña nueva de forma SÍNCRONA, en el mismo instante
    // del clic, para que el navegador no la bloquee como ventana emergente
    // (los bloqueadores de pop-ups sólo permiten window.open si se llama
    // sin ningún "await" previo dentro del gestor del evento).
    const ventanaVistaPrevia = window.open("", "_blank");
    if (ventanaVistaPrevia && ventanaVistaPrevia.document) {
      ventanaVistaPrevia.document.write(
        "<title>Generando Hoja de Ejército…</title>" +
        "<body style='font-family:Georgia,serif;padding:3rem;color:#3a2a18;background:#f2e9d8'>" +
        "Generando la hoja de ejército… un momento.</body>"
      );
    }

    const boton = document.getElementById("btnPDF");
    if (boton) boton.disabled = true;

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const margen = 12;

      // -----------------------------------------------------------------
      // 1. Recopilar los datos del ejército actual
      // -----------------------------------------------------------------
      const selectEjercito = document.getElementById("ejercito");
      const nombreEjercito = (selectEjercito && selectEjercito.value)
        ? selectEjercito.options[selectEjercito.selectedIndex].text
        : "";

      const filas = Array.from(document.querySelectorAll("#tablaUnidades tr"))
        .filter(fila => fila.dataset && fila.dataset.idTropa);

      const totalPuntos = document.getElementById("puntos").value || "0";
      const fecha = new Date().toLocaleDateString("es-ES", {
        day: "2-digit", month: "long", year: "numeric"
      });

      // -----------------------------------------------------------------
      // 2. Precargar la textura de pergamino y la tipografía de titulares
      // -----------------------------------------------------------------
      const [texturaDataURL, fuenteOk] = await Promise.all([
        cargarImagenDataURL("ico/FONDO_HOJA.jpg"),
        registrarFuenteTitulares(doc)
      ]);

      const familiaTitulares = fuenteOk ? FUENTE_TITULARES.familia : "times";

      // -----------------------------------------------------------------
      // Garantiza el fondo de pergamino en TODAS las páginas, incluidas
      // las que crea automáticamente jspdf-autotable al pasar de página
      // en mitad de una tabla. En vez de fiarse de los hooks del plugin
      // (cuyo orden interno de ejecución no está documentado con
      // precisión y fue la causa de que la página del resumen de reglas
      // se quedara sin fondo), se intercepta directamente doc.addPage:
      // TODA página nueva pasa por aquí, la cree quien la cree.
      // -----------------------------------------------------------------
      const addPageOriginal = doc.addPage.bind(doc);
      doc.addPage = (...args) => {
        const resultado = addPageOriginal(...args);
        dibujarFondoPagina(doc, texturaDataURL);
        dibujarCabeceraContinuacion(doc, { nombreEjercito, familiaTitulares });
        return resultado;
      };

      // -----------------------------------------------------------------
      // 3. Cabecera de la primera página (ésta ya existe al crear el
      //    documento, así que se dibuja aparte, sin pasar por addPage)
      // -----------------------------------------------------------------
      dibujarFondoPagina(doc, texturaDataURL);

      let y = dibujarCabeceraPrincipal(doc, {
        nombreEjercito,
        totalPuntos,
        fecha,
        numUnidades: filas.length,
        familiaTitulares
      });

      y = dibujarEtiquetaSeccion(doc, "Lista de unidades", y + 3, familiaTitulares);

      // -----------------------------------------------------------------
      // 4. Tabla principal: lista de unidades
      // -----------------------------------------------------------------
      // Ojo: la fila real de #tablaUnidades tiene 10 <td>, en este orden:
      // [0] icono de rango, [1] número, [2] tropa, [3] equipo,
      // [4] opciones, [5] P, [6] M, [7] C, [8] coste, [9] botón borrar.
      // (antes se leía desde el índice 0 como si el icono no existiera,
      // lo que desplazaba todas las columnas una posición y dejaba el
      // coste real sin leerse).
      const cuerpoLista = filas.length
        ? filas.map(fila => {
            const c = fila.querySelectorAll("td");
            return [
              c[1].textContent,
              c[2].textContent,
              c[3].textContent,
              c[4].textContent,
              c[5].textContent.trim() ? "X" : "",
              c[6].textContent.trim() ? "X" : "",
              c[7].textContent.trim() ? "X" : "",
              c[8].textContent
            ];
          })
        : [[{
            content: "No se han añadido unidades a este ejército todavía.",
            colSpan: 8,
            styles: { halign: "center", fontStyle: "italic", textColor: PALETA_PDF.inkSuave }
          }]];

      let finalYLista = y;

      doc.autoTable({
        startY: y,
        margin: { top: 26, bottom: 18, left: margen, right: margen },
        head: [["Nº", "TROPA", "EQUIPO", "OPCIONES", "P", "M", "C", "COSTE"]],
        body: cuerpoLista,
        theme: "plain",
        styles: {
          font: "times",
          fontSize: 7.8,
          textColor: PALETA_PDF.ink,
          cellPadding: { top: 1.2, bottom: 1.2, left: 2.2, right: 2.2 },
          overflow: "linebreak"
        },
        headStyles: {
          textColor: PALETA_PDF.inkSuave,
          fontStyle: "bold",
          fontSize: 7.4,
          cellPadding: { top: 0.8, bottom: 0.8, left: 2.2, right: 2.2 }
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: "auto", halign: "left" },
          2: { cellWidth: "auto", halign: "left" },
          3: { cellWidth: "auto", halign: "left" },
          4: { cellWidth: 8, halign: "center" },
          5: { cellWidth: 8, halign: "center" },
          6: { cellWidth: 8, halign: "center" },
          7: { cellWidth: 18, halign: "right", fontStyle: "bold" }
        },
        alternateRowStyles: { fillColor: PALETA_PDF.fondoAlt },
        didDrawCell: data => {
          dibujarBordeInferiorCabecera(data);
          if (data.section === "body") {
            finalYLista = Math.max(finalYLista, data.cell.y + data.cell.height);
          }
        }
      });

      // -----------------------------------------------------------------
      // 5. Tabla de perfiles y reglas especiales
      // -----------------------------------------------------------------
      const alturaPie = 18;
      const alturaMinima = 34;

      if (finalYLista + alturaMinima > doc.internal.pageSize.getHeight() - alturaPie) {
        doc.addPage();
        finalYLista = 26;
      }

      const y2 = dibujarEtiquetaSeccion(doc, "Perfiles y reglas especiales", finalYLista + 8, familiaTitulares);

      const cuerpoPerfiles = [];

      filas.forEach(fila => {
        const idTropa = parseInt(fila.dataset.idTropa);
        // Igual que en la tabla anterior: [0] es el icono de rango, así
        // que el nombre de la tropa está en el índice 2, no en el 1
        // (eso era el número de miniaturas, no el nombre).
        const nombreTropa = fila.querySelectorAll("td")[2].textContent;

        const ficha = obtener("ficha", "ficha_tropas", "IDficha", idTropa);
        cuerpoPerfiles.push({
          datos: filaEstadisticasPDF(nombreTropa, ficha),
          reglas: formatearReglasPDF(idTropa)
        });

        const relMontura = datos.montura_tropas.find(m => m.IDtropa == idTropa);
        if (relMontura) {
          const montura = datos.montura.find(m => m.IDmontura === relMontura.IDmontura);
          if (montura) {
            cuerpoPerfiles.push({
              datos: filaEstadisticasPDF("• " + montura.MONTURA_DOTACION, montura),
              reglas: ""
            });
          }
        }

        const relCarro = datos.carro_tropas.find(c => c.IDtropa == idTropa);
        if (relCarro) {
          const carro = datos.carro.find(c => c.IDcarro === relCarro.IDcarro);
          if (carro) {
            cuerpoPerfiles.push({
              datos: filaEstadisticasPDF("• " + carro.CARRO, carro),
              reglas: ""
            });
          }
        }
      });

      const filasTabla2 = cuerpoPerfiles.length
        ? cuerpoPerfiles.map(f => [...f.datos, f.reglas])
        : [[{
            content: "No hay perfiles que mostrar.",
            colSpan: 11,
            styles: { halign: "center", fontStyle: "italic", textColor: PALETA_PDF.inkSuave }
          }]];

      let finalYPerfiles = y2;

      doc.autoTable({
        startY: y2,
        margin: { top: 26, bottom: 18, left: margen, right: margen },
        head: [["UNIDAD", "M", "HA", "HP", "F", "R", "H", "I", "A", "L", "REGLAS ESPECIALES"]],
        body: filasTabla2,
        theme: "plain",
        styles: {
          font: "times",
          fontSize: 7.1,
          textColor: PALETA_PDF.ink,
          cellPadding: { top: 1, bottom: 1, left: 2.2, right: 1.8 },
          overflow: "linebreak"
        },
        headStyles: {
          textColor: PALETA_PDF.inkSuave,
          fontStyle: "bold",
          fontSize: 7,
          cellPadding: { top: 0.8, bottom: 0.8, left: 2, right: 1.8 }
        },
        columnStyles: {
          0: { cellWidth: 42, halign: "left" },
          1: { cellWidth: 8, halign: "center" },
          2: { cellWidth: 8, halign: "center" },
          3: { cellWidth: 8, halign: "center" },
          4: { cellWidth: 8, halign: "center" },
          5: { cellWidth: 8, halign: "center" },
          6: { cellWidth: 8, halign: "center" },
          7: { cellWidth: 8, halign: "center" },
          8: { cellWidth: 8, halign: "center" },
          9: { cellWidth: 8, halign: "center" },
          10: { cellWidth: "auto", halign: "left" }
        },
        alternateRowStyles: { fillColor: PALETA_PDF.fondoAlt },
        didParseCell: data => {
          if (data.section !== "body") return;
          const primeraCelda = data.row.raw[0];
          const esSubfila = typeof primeraCelda === "string" && primeraCelda.startsWith("•");
          if (esSubfila) {
            data.cell.styles.textColor = PALETA_PDF.inkSuave;
            data.cell.styles.fontSize = 6.7;
          }
        },
        didDrawCell: data => {
          dibujarBordeInferiorCabecera(data);
          if (data.section === "body") {
            finalYPerfiles = Math.max(finalYPerfiles, data.cell.y + data.cell.height);
          }
        }
      });

      // -----------------------------------------------------------------
      // 5.5. Resumen de reglas especiales: glosario con el nombre y la
      //      descripción de cada regla usada por las unidades de esta
      //      lista (la misma descripción que se ve al pulsar sobre una
      //      regla en la aplicación).
      // -----------------------------------------------------------------
      if (finalYPerfiles + alturaMinima > doc.internal.pageSize.getHeight() - alturaPie) {
        doc.addPage();
        finalYPerfiles = 26;
      }

      const y3 = dibujarEtiquetaSeccion(doc, "Resumen de reglas especiales", finalYPerfiles + 8, familiaTitulares);

      const idsReglasUsadas = new Set();
      filas.forEach(fila => {
        const idTropa = parseInt(fila.dataset.idTropa);
        datos.reglas_tropas
          .filter(r => r.IDtropa == idTropa)
          .forEach(r => idsReglasUsadas.add(r.IDRegla));
      });

      const listaReglas = [...idsReglasUsadas]
        .map(id => datos.reglas.find(r => r.IDRegla === id))
        .filter(Boolean)
        .sort((a, b) => a.REGLA.localeCompare(b.REGLA, "es"));

      const cuerpoGlosario = listaReglas.length
        ? listaReglas.map(r => [r.REGLA, obtenerDescripcionRegla(r)])
        : [[{
            content: "Esta lista no utiliza ninguna regla especial.",
            colSpan: 2,
            styles: { halign: "center", fontStyle: "italic", textColor: PALETA_PDF.inkSuave }
          }]];

      doc.autoTable({
        startY: y3,
        margin: { top: 26, bottom: 18, left: margen, right: margen },
        head: [["REGLA", "DESCRIPCIÓN"]],
        body: cuerpoGlosario,
        theme: "plain",
        styles: {
          font: "times",
          fontSize: 7.6,
          textColor: PALETA_PDF.ink,
          cellPadding: { top: 1.4, bottom: 1.4, left: 2.2, right: 2.2 },
          overflow: "linebreak"
        },
        headStyles: {
          textColor: PALETA_PDF.inkSuave,
          fontStyle: "bold",
          fontSize: 7.4,
          cellPadding: { top: 0.8, bottom: 0.8, left: 2.2, right: 2.2 }
        },
        columnStyles: {
          0: { cellWidth: 45, halign: "left", fontStyle: "bold" },
          1: { cellWidth: "auto", halign: "left" }
        },
        alternateRowStyles: { fillColor: PALETA_PDF.fondoAlt },
        didDrawCell: data => dibujarBordeInferiorCabecera(data)
      });

      // -----------------------------------------------------------------
      // 6. Pie de página en todas las páginas del documento
      // -----------------------------------------------------------------
      const totalPaginas = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPaginas; p++) {
        doc.setPage(p);
        dibujarPiePagina(doc, p, totalPaginas, nombreEjercito);
      }

      // -----------------------------------------------------------------
      // 7. Abrir el documento en la pestaña reservada (el usuario decide
      //    si lo guarda o lo imprime desde el propio visor del navegador)
      // -----------------------------------------------------------------
      const nombreArchivo = "Hoja_de_Ejercito" +
        (nombreEjercito ? "_" + nombreEjercito.replace(/\s+/g, "_") : "") + ".pdf";

      doc.setProperties({ title: nombreArchivo.replace(/\.pdf$/, "") });

      const urlPDF = doc.output("bloburl");

      if (ventanaVistaPrevia) {
        ventanaVistaPrevia.location.href = urlPDF;
      } else {
        // El navegador bloqueó la pestaña emergente: recurrimos a la
        // descarga directa como alternativa para no perder el documento.
        doc.save(nombreArchivo);
      }

    } catch (err) {
      console.error("Error exportando el PDF:", err);
      if (ventanaVistaPrevia && !ventanaVistaPrevia.closed) ventanaVistaPrevia.close();
      alert("No se ha podido generar el PDF. Revisa la consola para más detalles.");
    } finally {
      if (boton) boton.disabled = false;
    }
  }
  document.addEventListener("click", function () {
    const descripcionBox = document.getElementById("descripcionRegla");
  
    descripcionBox.style.display = "none";
  
    // 🔥 quitar selección
    document.querySelectorAll(".rules li")
      .forEach(el => el.classList.remove("activa"));
  });
  
  
  
  
  const selectEjercito = document.getElementById("ejercito");
  const filtro = document.getElementById("filtroTipo");
  
  selectEjercito.addEventListener("change", function () {
  
    if (this.value === "") {
      filtro.disabled = true;
      filtro.value = ""; // reset
    } else {
      filtro.disabled = false;
    }
  
  });
  
  
  
  
  
  
  
  });