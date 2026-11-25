const mensaje = document.getElementById('mensaje');
document.getElementById('nombreAlumno').textContent = NOMBRE_ALUMNO;

function mostrar(texto, esError = true) {
  mensaje.textContent = texto;
  mensaje.className = 'mensaje ' + (esError ? 'error' : 'ok');
}

// SESIÓN YA ECHA: si ya hay sesión guardada, entra directo sin pedir credenciales
async function revisarSesion() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (data.session) window.location.href = 'app.html';
  } catch (err) {
    mostrar('Error al verificar sesión: ' + err.message);
  }
}
revisarSesion();

// INICIO DE SESIÓN
document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const correo = document.getElementById('correo').value.trim();
  const clave = document.getElementById('clave').value;
  try {
    const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });
    if (error) throw error;
    window.location.href = 'app.html';
  } catch (err) {
    mostrar('No se pudo iniciar sesión: ' + err.message);
  }
});

// REGISTROUUUU
document.getElementById('btnRegistro').addEventListener('click', async () => {
  const correo = document.getElementById('correo').value.trim();
  const clave = document.getElementById('clave').value;
  if (!correo || clave.length < 6) {
    return mostrar('Escribe un correo y una contraseña de al menos 6 caracteres.');
  }
  try {
    const { data, error } = await db.auth.signUp({ email: correo, password: clave });
    if (error) throw error;
    if (data.session) {
      window.location.href = 'app.html';
    } else {
      mostrar('Cuenta creada. Revisa tu correo para confirmarla.', false);
    }
  } catch (err) {
    mostrar('No se pudo crear la cuenta: ' + err.message);
  }
});
