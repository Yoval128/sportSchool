if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

setTimeout(() => {
  document.getElementById('splashScreen').classList.add('oculto');
  document.getElementById('homeScreen').classList.remove('oculto');
}, 1500);

const estadoRed = document.getElementById('estadoRed');
const btnNotificaciones = document.getElementById('btnNotificaciones');
const btnFetchRemoto = document.getElementById('btnFetchRemoto');
const estadoRemoto = document.getElementById('estadoRemoto');
const formEstudiante = document.getElementById('formEstudiante');
const formActividad = document.getElementById('formActividad');
const selectEstudiante = document.getElementById('selectEstudiante');
const filtroEstudiante = document.getElementById('filtroEstudiante');
const listaHistorial = document.getElementById('listaHistorial');
const btnUbicacion = document.getElementById('btnUbicacion');
const textoUbicacion = document.getElementById('textoUbicacion');

let db;
let ubicacionActual = 'No registrada';

const solicitudDB = indexedDB.open('SportSchoolDB', 1);

solicitudDB.onupgradeneeded = (e) => {
  db = e.target.result;
  db.createObjectStore('estudiantes', { keyPath: 'id' });
  db.createObjectStore('actividades', { keyPath: 'id' });
};

solicitudDB.onsuccess = (e) => {
  db = e.target.result;
  cargarEstudiantes();
  cargarHistorialYDesempeno();
};

function actualizarEstadoConexion() {
  if (navigator.onLine) {
    estadoRed.textContent = 'En linea';
    estadoRed.classList.remove('offline');
  } else {
    estadoRed.textContent = 'Sin conexion';
    estadoRed.classList.add('offline');
  }
}

window.addEventListener('online', actualizarEstadoConexion);
window.addEventListener('offline', actualizarEstadoConexion);
actualizarEstadoConexion();

btnNotificaciones.addEventListener('click', () => {
  if ('Notification' in window) {
    Notification.requestPermission().then((permiso) => {
      if (permiso === 'granted') {
        mostrarNotificacion('Notificaciones activadas en SportSchool.');
      }
    });
  }
});

function mostrarNotificacion(texto) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('SportSchool', { body: texto });
  }
}

btnFetchRemoto.addEventListener('click', async () => {
  if (!navigator.onLine) {
    estadoRemoto.textContent = 'Estado remoto: Sin conexion (usando datos locales)';
    return;
  }
  estadoRemoto.textContent = 'Estado remoto: Consultando endpoint...';
  try {
    const respuesta = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    const datos = await respuesta.json();
    estadoRemoto.textContent = `Estado remoto: Consulta Fetch exitosa (ID prueba: ${datos.id})`;
  } catch {
    estadoRemoto.textContent = 'Estado remoto: Servicio externo no disponible (modo local activo)';
  }
});

btnUbicacion.addEventListener('click', () => {
  if (!navigator.geolocation) {
    textoUbicacion.textContent = 'Ubicacion: No soportada';
    return;
  }
  textoUbicacion.textContent = 'Ubicacion: Obteniendo coordenadas...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      ubicacionActual = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
      textoUbicacion.textContent = `Ubicacion: ${ubicacionActual}`;
    },
    () => {
      textoUbicacion.textContent = 'Ubicacion: Permiso denegado o no disponible';
    }
  );
});

formEstudiante.addEventListener('submit', (e) => {
  e.preventDefault();
  const estudiante = {
    id: Date.now(),
    nombre: document.getElementById('nombreEstudiante').value.trim(),
    grupo: document.getElementById('grupoEstudiante').value.trim(),
    disciplina: document.getElementById('disciplinaEstudiante').value
  };

  const tx = db.transaction(['estudiantes'], 'readwrite');
  tx.objectStore('estudiantes').add(estudiante);

  tx.oncomplete = () => {
    formEstudiante.reset();
    cargarEstudiantes();
  };
});

function cargarEstudiantes() {
  const tx = db.transaction(['estudiantes'], 'readonly');
  const peticion = tx.objectStore('estudiantes').getAll();

  peticion.onsuccess = () => {
    const estudiantes = peticion.result;
    selectEstudiante.innerHTML = '<option value="">Seleccione un estudiante</option>';
    filtroEstudiante.innerHTML = '<option value="todos">Todos los estudiantes</option>';

    estudiantes.forEach((est) => {
      const texto = `${est.nombre} (${est.grupo} - ${est.disciplina})`;
      selectEstudiante.innerHTML += `<option value="${est.id}">${texto}</option>`;
      filtroEstudiante.innerHTML += `<option value="${est.id}">${texto}</option>`;
    });
  };
}

// Registro de actividad deportiva en IndexedDB y notificacion
formActividad.addEventListener('submit', (e) => {
  e.preventDefault();
  const idEstudiante = Number(selectEstudiante.value);
  const textoEstudiante = selectEstudiante.options[selectEstudiante.selectedIndex].text;

  const actividad = {
    id: Date.now(),
    estudianteId: idEstudiante,
    estudianteNombre: textoEstudiante,
    fecha: document.getElementById('fechaActividad').value,
    actividad: document.getElementById('nombreActividad').value.trim(),
    duracion: Number(document.getElementById('duracionMin').value),
    distancia: Number(document.getElementById('distanciaKm').value),
    observaciones: document.getElementById('observaciones').value.trim() || 'Sin observaciones',
    ubicacion: ubicacionActual
  };

  const tx = db.transaction(['actividades'], 'readwrite');
  tx.objectStore('actividades').add(actividad);

  tx.oncomplete = () => {
    formActividad.reset();
    ubicacionActual = 'No registrada';
    textoUbicacion.textContent = 'Ubicacion: No registrada';
    cargarHistorialYDesempeno();
    mostrarNotificacion(`Actividad "${actividad.actividad}" registrada con exito.`);
  };
});

function cargarHistorialYDesempeno() {
  const tx = db.transaction(['actividades'], 'readonly');
  const peticion = tx.objectStore('actividades').getAll();

  peticion.onsuccess = () => {
    const todas = peticion.result;
    const filtro = filtroEstudiante.value;
    const filtradas = filtro === 'todos'
      ? todas
      : todas.filter((act) => act.estudianteId === Number(filtro));

    let sumaMinutos = 0;
    let sumaKm = 0;
    listaHistorial.innerHTML = '';

    if (filtradas.length === 0) {
      listaHistorial.innerHTML = '<li>No hay actividades registradas para mostrar.</li>';
    }

    filtradas.forEach((item) => {
      sumaMinutos += item.duracion;
      sumaKm += item.distancia;

      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${item.estudianteNombre}</strong><br>
        Actividad: ${item.actividad} | Fecha: ${item.fecha}<br>
        Duracion: ${item.duracion} min | Distancia: ${item.distancia} km<br>
        Observaciones: ${item.observaciones}<br>
        <small>GPS: ${item.ubicacion}</small><br>
        <button type="button" class="btn-eliminar" onclick="eliminarActividad(${item.id})">Eliminar</button>
      `;
      listaHistorial.appendChild(li);
    });

    document.getElementById('totalActividades').textContent = filtradas.length;
    document.getElementById('totalTiempo').textContent = `${sumaMinutos} min`;
    document.getElementById('totalDistancia').textContent = `${sumaKm.toFixed(1)} km`;
  };
}

filtroEstudiante.addEventListener('change', cargarHistorialYDesempeno);

window.eliminarActividad = (id) => {
  const tx = db.transaction(['actividades'], 'readwrite');
  tx.objectStore('actividades').delete(id);
  tx.oncomplete = () => cargarHistorialYDesempeno();
};