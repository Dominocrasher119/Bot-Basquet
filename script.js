const puppeteer = require('puppeteer');

const personas = [
  { nombre: 'Bernat', disponible: true, categoria: 'C.C. SOTS-20 MASCULÍ NIVELL A-2', equip: 'BÀSQUET SANT SADURNÍ' },
  { nombre: 'Lluc Entrenador', disponible: true, categoria: 'C.T. CADET MASCULÍ PROMOCIÓ', equip: 'BÀSQUET SANT SADURNÍ BLANC' },
  { nombre: 'Lluc Jugador', disponible: true, categoria: 'C.C. SOTS-20 MASCULÍ NIVELL A-2', equip: 'BÀSQUET SANT SADURNÍ' },
  { nombre: 'Agusti', disponible: true, categoria: '1A. TERRITORIAL SÈNIOR MASCULÍ', equip: 'BÀSQUET SANT SADURNÍ' },
  { nombre: 'Carla', disponible: true, categoria: 'C.T. JÚNIOR FEMENÍ PROMOCIÓ', equip: 'BÀSQUET SANT SADURNÍ NEGRE' },
  { nombre: 'Foix', disponible: true, categoria: 'C.T. JÚNIOR FEMENÍ PROMOCIÓ', equip: 'BÀSQUET SANT SADURNÍ NEGRE' },
  { nombre: 'Laia', disponible: true, categoria: 'C.T. JÚNIOR FEMENÍ PROMOCIÓ', equip: 'BÀSQUET SANT SADURNÍ NEGRE' },
  { nombre: 'Emma', disponible: true, categoria: 'C.T. JÚNIOR FEMENÍ PROMOCIÓ', equip: 'BÀSQUET SANT SADURNÍ NEGRE' },
  { nombre: 'Albert', disponible: true, categoria: 'C.T. CADET MASCULÍ PROMOCIÓ', equip: 'BÀSQUET SANT SADURNÍ NEGRE' },
  { nombre: 'Maria', disponible: true, categoria: 'C.T. JÚNIOR FEMENÍ PROMOCIÓ', equip: 'BÀSQUET SANT SADURNÍ NEGRE' },
  { nombre: 'Marti', disponible: true, categoria: 'C.T. CADET MASCULÍ PROMOCIÓ', equip: 'BÀSQUET SANT SADURNÍ GROC' },
  { nombre: 'Federada', disponible: true },
  // Agrega más personas según sea necesario
];

const taulesFederades = ['C.C. JÚNIOR MASCULÍ NIVELL A', '1A. TERRITORIAL SÈNIOR MASCULÍ', '2A. TERRITORIAL SÈNIOR FEMENÍ', 'C.C. SOTS-20 MASCULÍ NIVELL A-2', 'C.C. JÚNIOR FEMENÍ INTERTERRITORIAL'];

// Función para convertir una cadena de fecha y hora en un objeto Date
function parseFechaHora(fecha, hora) {
  const [dia, mes, anio] = fecha.split('/').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);
  return new Date(anio, mes - 1, dia, horas, minutos);
}

// Función para determinar si una persona puede asignarse a un partido
function puedeAsignarse(persona, partido, personasAsignadasComoJugador, partidos) {
  const horaPartido = parseFechaHora(partido.fecha, partido.hora);

  // Verificar si la persona tiene un partido 4 horas antes o después
  const cuatroHorasEnMs = 4 * 60 * 60 * 1000;
  for (const p of partidos) {
    if (p.categoria === persona.categoria && (p.equipoLocal === persona.equip || p.equipoVisitante === persona.equip)) {
      const horaP = parseFechaHora(p.fecha, p.hora);
      if (Math.abs(horaP - horaPartido) <= cuatroHorasEnMs) {
        return false;
      }
    }
  }

  if (taulesFederades.includes(partido.categoria)) {
    return persona.nombre === 'Federada';
  }
  if (persona.categoria === partido.categoria) {
    if (persona.equip && persona.equip === partido.equipoLocal) {
      return false; // La persona pertenece al equipo local y la categoría coincide
    }
    // Verificar si ya está asignado como jugador
    if (personasAsignadasComoJugador.includes(persona.nombre.replace(' Entrenador', ' Jugador'))) {
      return false;
    }
    return true; // La categoría coincide y la persona no pertenece al equipo local
  }
  // Condición final para que si juegas fuera no puedas hacer la mesa
  if (!taulesFederades.includes(partido.categoria)) {
    return persona.nombre !== 'Federada';
  }
  return false;
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.basquetcatala.cat/partits/calendari_club_mensual/3331');

  const partidos = await page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr');
    const partidos = [];
    rows.forEach((row) => {
      const fecha = row.querySelector('td:nth-child(1) .box').innerText;
      const hora = row.querySelector('td:nth-child(2) .box').innerText;
      const equipoLocal = row.querySelector('td:nth-child(3) strong').innerText;
      const equipoVisitante = row.querySelector('td:nth-child(4) strong').innerText;
      const categoria = row.querySelector('td:nth-child(5)').innerText;
      const lugar = row.querySelector('td:nth-child(6)').innerText;
      partidos.push({ fecha, hora, equipoLocal, equipoVisitante, categoria, lugar });
    });
    return partidos;
  });

  // Asignar personas a los partidos según las reglas
  partidos.forEach(partido => {
    const personasAsignadas = [];
    const notificaciones = [];
    const personasAsignadasComoJugador = [];

    personas.forEach(persona => {
      if (persona.disponible && puedeAsignarse(persona, partido, personasAsignadasComoJugador, partidos)) {
        personasAsignadas.push(persona.nombre);
        if (persona.nombre.includes('Jugador')) {
          personasAsignadasComoJugador.push(persona.nombre);
        }
        // Notificar si una persona asignada a la mesa tiene un partido el mismo día
        const partidoLocal = partidos.find(p => p.fecha === partido.fecha && p.categoria === persona.categoria && p.equipoLocal === persona.equip);
        const partidoVisitante = partidos.find(p => p.fecha === partido.fecha && p.categoria === persona.categoria && p.equipoVisitante === persona.equip);
        if (partidoLocal) {
          notificaciones.push(`Notificación: ${persona.nombre} tiene un partido el mismo día (${partido.fecha}) como equipo local y está asignado a la mesa.`);
        }
        if (partidoVisitante) {
          notificaciones.push(`Notificación: ${persona.nombre} tiene un partido el mismo día (${partido.fecha}) como equipo visitante a las ${partidoVisitante.hora} y está asignado a la mesa.`);
        }
      }
    });

    // Notificar si una persona juega el mismo día (informativo)
    personas.forEach(persona => {
      const partidoLocal = partidos.find(p => p.fecha === partido.fecha && p.categoria === persona.categoria && p.equipoLocal === persona.equip);
      const partidoVisitante = partidos.find(p => p.fecha === partido.fecha && p.categoria === persona.categoria && p.equipoVisitante === persona.equip);
      if (partidoLocal) {
        notificaciones.push(`Información: ${persona.nombre} tiene un partido el mismo día (${partido.fecha}) como equipo local a las ${partidoLocal.hora}.`);
      }
      if (partidoVisitante) {
        notificaciones.push(`Información: ${persona.nombre} tiene un partido el mismo día (${partido.fecha}) como equipo visitante a las ${partidoVisitante.hora}.`);
      }
    });

    partido.personasAsignadas = personasAsignadas;
    partido.notificaciones = notificaciones;
  });

  const partidosLocales = partidos.filter(partido => partido.lugar.includes('PAV. MUNICIPAL SANT SADURNI'));
  console.log(partidosLocales);
  await browser.close();
})();