// Referencias al DOM
const form = document.getElementById('formArchivo');
const inputNombre = document.getElementById('nombreArchivo');
const selectTipo = document.getElementById('tipoDoc');
const inputArchivo = document.getElementById('inputArchivo');
const btnCancelar = document.getElementById('btnCancelar');
const listaArchivos = document.getElementById('listaArchivos');
const buscador = document.getElementById('buscador');
const mensaje = document.getElementById('mensaje');

// Estado de la aplicación 
let usuario = null;            // usuario con sesión activa
let carpetaActual = 'Todos';   // carpeta seleccionada en la barra lateral
let editando = null;           // registro que se está editando (null = modo "subir")

// Cada tipo de documento va a una carpeta de la barra lateral
const CARPETA_POR_TIPO = {
  'INE': 'Documentos Privados',
  'CURP': 'Documentos Privados',
  'Foto': 'Documentos Privados',
  'Acta de nacimiento': 'Documentos Familiares',
  'Recibo de luz': 'Documentos Familiares',
  'Recibo de teléfono': 'Documentos Familiares',
  'Cursos': 'Cursos de Actualización',
  'CV': 'Documentos Académicos',
  'Títulos': 'Documentos Académicos',
  'Cédulas profesionales': 'Documentos Académicos'
};

// Utilidades
function mostrar(texto, esError = true) {
  mensaje.textContent = texto;
  mensaje.className = 'mensaje ' + (esError ? 'error' : 'ok');
}

// Quita caracteres raros del nombre del archivo para Storage
function limpiarNombre(nombre) {
  return nombre.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// PROTECCIÓN DE SESIÓN
// Si no hay sesión, se regresa al login. Se ejecuta al abrir la página.
async function iniciar() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      window.location.href = 'index.html';
      return;
    }
    usuario = data.session.user;
    document.getElementById('nombreAlumno').textContent = NOMBRE_ALUMNO;
    document.getElementById('usuarioCorreo').textContent = usuario.email;
    await cargarArchivos();
  } catch (err) {
    window.location.href = 'index.html';
  }
}

// Si la sesión se cierra (en esta o en otra pestaña), se expulsa al login
db.auth.onAuthStateChange((evento) => {
  if (evento === 'SIGNED_OUT') window.location.href = 'index.html';
});

// CIERRE DE SESIÓN
document.getElementById('btnSalir').addEventListener('click', async () => {
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    window.location.href = 'index.html';
  } catch (err) {
    mostrar('Error al cerrar sesión: ' + err.message);
  }
});

//LEER (petición a la tabla + Storage) 
async function cargarArchivos() {
  try {
    // Petición a la tabla con filtros opcionales
    let consulta = db.from(TABLA).select('*').order('created_at', { ascending: false });

    if (carpetaActual !== 'Todos') consulta = consulta.eq('carpeta', carpetaActual);

    const texto = buscador.value.trim();
    if (texto) consulta = consulta.ilike('nombre', `%${texto}%`); // buscador

    const { data, error } = await consulta;
    if (error) throw error;

    // Petición a Storage: URLs firmadas (temporales) para ver los archivos privados
    let urls = {};
    if (data.length > 0) {
      const rutas = data.map(r => r.archivo_path);
      const { data: firmadas, error: errUrl } = await db.storage
        .from(BUCKET).createSignedUrls(rutas, 3600);
      if (errUrl) throw errUrl;
      firmadas.forEach(f => { urls[f.path] = f.signedUrl; });
    }

    dibujarLista(data, urls);
  } catch (err) {
    mostrar('Error al cargar archivos: ' + err.message);
  }
}

function dibujarLista(registros, urls) {
  listaArchivos.innerHTML = '';

  if (registros.length === 0) {
    listaArchivos.textContent = 'No hay archivos en esta vista.';
    return;
  }

  registros.forEach(reg => {
    const url = urls[reg.archivo_path];
    const tarjeta = document.createElement('div');
    tarjeta.className = 'archivo';

    // Vista previa: imagen si es imagen, texto "PDF" si no
    const vista = document.createElement('div');
    vista.className = 'vista-previa';
    if (reg.archivo_tipo && reg.archivo_tipo.startsWith('image/') && url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = reg.nombre;
      vista.appendChild(img);
    } else {
      vista.textContent = 'PDF';
    }

    const titulo = document.createElement('h3');
    titulo.textContent = reg.nombre;          // textContent evita inyección de HTML

    const info = document.createElement('p');
    info.textContent = `${reg.tipo_documento} · ${reg.carpeta}`;

    const acciones = document.createElement('div');
    acciones.className = 'botones';

    const btnVer = document.createElement('a');
    btnVer.href = url || '#';
    btnVer.target = '_blank';
    btnVer.textContent = 'Ver';
    btnVer.className = 'boton-enlace';

    const btnEditar = document.createElement('button');
    btnEditar.textContent = 'Editar';
    btnEditar.addEventListener('click', () => prepararEdicion(reg));

    const btnEliminar = document.createElement('button');
    btnEliminar.textContent = 'Eliminar';
    btnEliminar.className = 'peligro';
    btnEliminar.addEventListener('click', () => eliminarArchivo(reg));

    acciones.append(btnVer, btnEditar, btnEliminar);
    tarjeta.append(vista, titulo, info, acciones);
    listaArchivos.appendChild(tarjeta);
  });
}

//GUARDAR (crear o actualizar)
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = inputNombre.value.trim();
  const tipo = selectTipo.value;
  const carpeta = CARPETA_POR_TIPO[tipo];
  const archivo = inputArchivo.files[0];

  try {
    if (!editando) {
      // MODO SUBIR: el archivo es obligatorio 
      if (!archivo) return mostrar('Selecciona un archivo.');

      const ruta = `${usuario.id}/${Date.now()}_${limpiarNombre(archivo.name)}`;

      // 1) Subir el archivo a Storage
      const { error: errSubida } = await db.storage.from(BUCKET).upload(ruta, archivo);
      if (errSubida) throw errSubida;

      // 2) Guardar los datos en la tabla
      const { error: errInsert } = await db.from(TABLA).insert({
        nombre, tipo_documento: tipo, carpeta,
        archivo_path: ruta, archivo_tipo: archivo.type
      });
      if (errInsert) {
        // Si falla la tabla, se borra el archivo para no dejar basura
        await db.storage.from(BUCKET).remove([ruta]);
        throw errInsert;
      }
      mostrar('Archivo guardado correctamente.', false);

    } else {
      //MODO EDITAR: el archivo es opcional
      const cambios = { nombre, tipo_documento: tipo, carpeta };

      if (archivo) {
        const ruta = `${usuario.id}/${Date.now()}_${limpiarNombre(archivo.name)}`;
        const { error: errSubida } = await db.storage.from(BUCKET).upload(ruta, archivo);
        if (errSubida) throw errSubida;
        cambios.archivo_path = ruta;
        cambios.archivo_tipo = archivo.type;
      }

      const { error: errUpdate } = await db.from(TABLA).update(cambios).eq('id', editando.id);
      if (errUpdate) throw errUpdate;

      // Si se reemplazó el archivo, se borra el anterior de Storage
      if (archivo) await db.storage.from(BUCKET).remove([editando.archivo_path]);

      mostrar('Cambios guardados.', false);
      cancelarEdicion();
    }

    form.reset();
    await cargarArchivos();
  } catch (err) {
    mostrar('Error al guardar: ' + err.message);
  }
});

//EDITAR
function prepararEdicion(reg) {
  editando = reg;
  inputNombre.value = reg.nombre;
  selectTipo.value = reg.tipo_documento;
  inputArchivo.value = '';
  document.getElementById('tituloForm').textContent = 'Editar documento';
  btnCancelar.hidden = false;
  document.getElementById('seccionSubir').scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicion() {
  editando = null;
  form.reset();
  document.getElementById('tituloForm').textContent = 'Subir documento';
  btnCancelar.hidden = true;
}
btnCancelar.addEventListener('click', cancelarEdicion);

//ELIMINAR
async function eliminarArchivo(reg) {
  if (!confirm(`¿Eliminar "${reg.nombre}"?`)) return;
  try {
    // 1) Borrar el archivo de Storage
    const { error: errStorage } = await db.storage.from(BUCKET).remove([reg.archivo_path]);
    if (errStorage) throw errStorage;

    // 2) Borrar el registro de la tabla
    const { error: errTabla } = await db.from(TABLA).delete().eq('id', reg.id);
    if (errTabla) throw errTabla;

    mostrar('Archivo eliminado.', false);
    await cargarArchivos();
  } catch (err) {
    mostrar('Error al eliminar: ' + err.message);
  }
}

// BARRA LATERAL (filtrar por carpeta) 
document.querySelectorAll('#listaCarpetas li').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('#listaCarpetas li').forEach(i => i.classList.remove('activa'));
    item.classList.add('activa');
    carpetaActual = item.dataset.carpeta;
    document.getElementById('tituloLista').textContent =
      carpetaActual === 'Todos' ? 'Todos los archivos' : carpetaActual;
    cargarArchivos();
  });
});

//BUSCADOR 
buscador.addEventListener('input', cargarArchivos);

//MENÚ PRINCIPAL
document.getElementById('menuInicio').addEventListener('click', () => {
  carpetaActual = 'Todos';
  buscador.value = '';
  document.querySelectorAll('#listaCarpetas li').forEach(i => i.classList.remove('activa'));
  document.querySelector('#listaCarpetas li[data-carpeta="Todos"]').classList.add('activa');
  cargarArchivos();
});
document.getElementById('menuSubir').addEventListener('click', () => {
  document.getElementById('seccionSubir').scrollIntoView({ behavior: 'smooth' });
  inputNombre.focus();
});

// ¡Arranque!
iniciar();
