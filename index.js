const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Variables de entorno
const PORT = process.env.PORT || 3000;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'test-token';

// En producción deberías validar la firma del webhook de Twilio
// Aquí se deja opcional, para que funcione también en sandbox/local sin complicaciones.
const ENABLE_TWILIO_VALIDATION = process.env.ENABLE_TWILIO_VALIDATION === 'true';

// "Base de datos" en memoria para estados de usuario
// Clave: from (número de WhatsApp), Valor: objeto de estado
const sessions = {};

// ======== MENSAJES BASE ========

const menuPrincipal = `
👨‍💻 *Bienvenido al Soporte de Mantenimiento de Computadoras*

Por favor elige una opción:
1️⃣ Diagnóstico rápido
2️⃣ Limpieza y optimización
3️⃣ Problemas de hardware
4️⃣ Soporte remoto
5️⃣ Estado de mi ticket
0️⃣ Hablar con un humano

Escribe el número de la opción:
`.trim();

const mensajeDespedida = `
✅ Listo, te hemos puesto en contacto con un especialista humano.
En breve se comunicarán contigo.  

Mientras tanto, si necesitas regresar al menú, escribe *menu*.
`.trim();

function crearRespuestaWhatsApp(text) {
  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(text);
  return twiml.toString();
}

function getSession(from) {
  if (!sessions[from]) {
    sessions[from] = {
      stage: 'MENU_PRINCIPAL',
      temp: {}
    };
  }
  return sessions[from];
}

function resetSession(from) {
  sessions[from] = {
    stage: 'MENU_PRINCIPAL',
    temp: {}
  };
}

// ======== LÓGICA DEL BOT ========

function procesarMensaje(from, body) {
  const session = getSession(from);
  const message = body.trim().toLowerCase();

  // Comandos globales
  if (['menu', 'menú', 'principal'].includes(message)) {
    resetSession(from);
    return menuPrincipal;
  }

  if (['salir', 'cancelar', 'cancel'].includes(message)) {
    resetSession(from);
    return '🔚 Proceso cancelado. Escribe *menu* para ver las opciones nuevamente.';
  }

  // Enrutamos según etapa
  switch (session.stage) {
    case 'MENU_PRINCIPAL':
      return manejarMenuPrincipal(session, message);

    case 'DIAG_RAPIDO_SO':
      return manejarDiagRapidoSO(session, message);

    case 'DIAG_RAPIDO_SINTOMA':
      return manejarDiagRapidoSintoma(session, message);

    case 'LIMPIEZA_TIPO':
      return manejarLimpiezaTipo(session, message);

    case 'HARDWARE_TIPO':
      return manejarHardwareTipo(session, message);

    case 'SOPORTE_REMOTO_CORREO':
      return manejarSoporteRemotoCorreo(session, message);

    case 'TICKET_ESTADO_ID':
      return manejarTicketEstadoId(session, message);

    default:
      resetSession(from);
      return menuPrincipal;
  }
}

// ======== HANDLERS DE ETAPAS ========

function manejarMenuPrincipal(session, message) {
  if (!['1', '2', '3', '4', '5', '0'].includes(message)) {
    return `❌ Opción no válida.\n\n${menuPrincipal}`;
  }

  switch (message) {
    case '1':
      session.stage = 'DIAG_RAPIDO_SO';
      return `
🩺 *Diagnóstico rápido*

¿Qué sistema operativo usas?
1️⃣ Windows
2️⃣ macOS
3️⃣ Linux

Escribe el número de la opción:
      `.trim();

    case '2':
      session.stage = 'LIMPIEZA_TIPO';
      return `
🧹 *Limpieza y optimización*

¿Qué tipo de limpieza deseas?
1️⃣ Limpieza de archivos temporales
2️⃣ Optimización de inicio
3️⃣ Limpieza completa recomendada

Escribe el número de la opción:
      `.trim();

    case '3':
      session.stage = 'HARDWARE_TIPO';
      return `
🔩 *Problemas de hardware*

¿Qué problema tienes?
1️⃣ La computadora no enciende
2️⃣ La computadora se apaga sola
3️⃣ Ruidos extraños (ventilador, disco, etc.)
4️⃣ Otros

Escribe el número de la opción:
      `.trim();

    case '4':
      session.stage = 'SOPORTE_REMOTO_CORREO';
      return `
🌐 *Soporte remoto*

Perfecto, podemos conectarnos a tu computadora de forma segura.

Por favor, escribe tu correo electrónico para enviarte el enlace de la sesión remota:
      `.trim();

    case '5':
      session.stage = 'TICKET_ESTADO_ID';
      return `
📋 *Estado de mi ticket*

Por favor, escribe el *ID de tu ticket* (ejemplo: TCK-1234):
      `.trim();

    case '0':
      resetSession('dummy');
      return mensajeDespedida;

    default:
      return `❌ Opción no válida.\n\n${menuPrincipal}`;
  }
}

// ---- Diagnóstico rápido ----

function manejarDiagRapidoSO(session, message) {
  if (!['1', '2', '3'].includes(message)) {
    return '❌ Opción no válida. Escribe 1, 2 o 3 para elegir tu sistema operativo.';
  }

  const sistemas = { '1': 'Windows', '2': 'macOS', '3': 'Linux' };
  session.temp.so = sistemas[message];
  session.stage = 'DIAG_RAPIDO_SINTOMA';

  return `
Perfecto, usas *${session.temp.so}*.

¿Qué problema describes mejor tu situación?
1️⃣ Lento en general
2️⃣ Tarda en iniciar
3️⃣ Aplicaciones se cierran solas
4️⃣ Pantallazos azules / errores críticos

Escribe el número de la opción:
  `.trim();
}

function manejarDiagRapidoSintoma(session, message) {
  if (!['1', '2', '3', '4'].includes(message)) {
    return '❌ Opción no válida. Escribe 1, 2, 3 o 4.';
  }

  const so = session.temp.so || 'tu sistema';

  let recomendacion = '';
  switch (message) {
    case '1':
      recomendacion = `
🔍 Recomendación para lentitud en *${so}*:
- Revisa programas que se ejecutan al inicio.
- Desinstala software que no uses.
- Ejecuta un análisis de virus.
- Considera agregar más RAM si es posible.

Si quieres una guía paso a paso personalizada, escribe: *menu* y luego elige opción 2 (Limpieza y optimización).
      `.trim();
      break;
    case '2':
      recomendacion = `
⏱️ Recomendación para inicio lento en *${so}*:
- Desactiva programas de inicio innecesarios.
- Verifica actualizaciones pendientes.
- Revisa el estado del disco (HDD/SSD).

Para obtener pasos detallados, escribe *menu* y selecciona la opción 2.
      `.trim();
      break;
    case '3':
      recomendacion = `
💥 Recomendación para aplicaciones que se cierran solas en *${so}*:
- Actualiza el sistema operativo.
- Actualiza las aplicaciones afectadas.
- Revisa si hay problemas de memoria (RAM) o espacio en disco.
- Ejecuta un escaneo de malware.

Si el problema persiste, te recomendamos soporte remoto (opción 4 del menú).
      `.trim();
      break;
    case '4':
      recomendacion = `
🧯 Pantallazos azules / errores críticos en *${so}*:
- Podría ser un problema de controladores o hardware.
- Actualiza drivers y revisa el estado del hardware.
- Si instalaste algo recientemente, intenta desinstalarlo.
- Haz un respaldo de tu información lo antes posible.

Te recomendamos fuertemente una revisión de hardware (opción 3 del menú).
      `.trim();
      break;
  }

  // Al terminar el diagnóstico, volvemos al menú
  session.stage = 'MENU_PRINCIPAL';
  session.temp = {};
  return recomendacion + `\n\nSi deseas ver el menú principal, escribe *menu*.`;
}

// ---- Limpieza y optimización ----

function manejarLimpiezaTipo(session, message) {
  if (!['1', '2', '3'].includes(message)) {
    return '❌ Opción no válida. Escribe 1, 2 o 3.';
  }

  let respuesta = '';

  switch (message) {
    case '1':
      respuesta = `
🧹 *Limpieza de archivos temporales (guía genérica)*

1. Abre el limpiador de disco o herramienta similar en tu sistema.
2. Marca archivos temporales, cachés y papelera.
3. Ejecuta la limpieza.
4. Reinicia la computadora.

Realizar esto al menos 1 vez por semana ayuda a mantener el rendimiento.
      `.trim();
      break;
    case '2':
      respuesta = `
🚀 *Optimización de inicio*

1. Revisa la lista de programas que inician con el sistema.
2. Desactiva los que no necesites para uso diario.
3. Evita desactivar antivirus o herramientas de seguridad.
4. Reinicia y mide el tiempo de arranque.

Hacer esto una vez al mes es una buena práctica.
      `.trim();
      break;
    case '3':
      respuesta = `
✨ *Limpieza completa recomendada*

Combinaremos limpieza de archivos temporales + optimización de inicio + verificación básica de disco.

1. Limpia archivos temporales.
2. Optimiza programas de inicio.
3. Verifica el disco en busca de errores.
4. Actualiza sistema y drivers principales.
5. Reinicia tu equipo.

Si quieres que hagamos esto por ti con soporte remoto, elige la opción 4 en el *menu*.
      `.trim();
      break;
  }

  session.stage = 'MENU_PRINCIPAL';
  session.temp = {};
  return respuesta + `\n\nEscribe *menu* para regresar al menú principal.`;
}

// ---- Hardware ----

function manejarHardwareTipo(session, message) {
  if (!['1', '2', '3', '4'].includes(message)) {
    return '❌ Opción no válida. Escribe 1, 2, 3 o 4.';
  }

  let respuesta = '';

  switch (message) {
    case '1':
      respuesta = `
🔌 *La computadora no enciende*

- Verifica cables de corriente y enchufe.
- Prueba otro tomacorriente y/o cable.
- Si es laptop, quita batería (si es extraíble), mantén presionado el botón de encendido 20s y vuelve a conectar.
- Si sigue igual, es probable un problema de fuente de poder o tarjeta madre.

Te recomendamos agendar una revisión física en taller.
      `.trim();
      break;
    case '2':
      respuesta = `
🔥 *La computadora se apaga sola*

- Revisa ventilación (polvo en ventiladores y rejillas).
- Asegúrate de que no esté sobre superficies blandas.
- Posible sobrecalentamiento o fallo de fuente.
- Usa un programa de monitoreo de temperatura.

Si los apagados son frecuentes, se recomienda servicio de limpieza interna y cambio de pasta térmica.
      `.trim();
      break;
    case '3':
      respuesta = `
🔊 *Ruidos extraños*

- Podrían venir del ventilador: revisa si hay polvo acumulado.
- Si es un ruido "de clics" en el disco duro, haz respaldo inmediato.
- Si es un zumbido constante, revisa ventiladores y fuente.

Te recomendamos traer el equipo a revisión para evitar daños mayores.
      `.trim();
      break;
    case '4':
      respuesta = `
🛠️ *Otros problemas de hardware*

Cada caso es particular. Te sugerimos:
1. Escribir un resumen del problema.
2. Adjuntar una foto o video si es posible.
3. Considerar una cita en el taller.

Puedes escribir *menu* y elegir opción 4 para soporte remoto y una revisión guiada.
      `.trim();
      break;
  }

  session.stage = 'MENU_PRINCIPAL';
  session.temp = {};
  return respuesta + `\n\nEscribe *menu* para regresar al menú principal.`;
}

// ---- Soporte remoto ----

function manejarSoporteRemotoCorreo(session, message) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(message)) {
    return '❌ El formato de correo no parece válido. Intenta de nuevo (ejemplo: usuario@correo.com) o escribe *cancelar* para volver.';
  }

  session.temp.email = message;

  // Aquí podrías guardar el correo en una base de datos o enviar un correo real.
  // Por ahora solo simulamos.
  const respuesta = `
📨 ¡Gracias!

Enviaremos un enlace de sesión remota a: *${session.temp.email}*  
Revisa tu bandeja de entrada y/o spam en los próximos minutos.

Mientras tanto, si deseas regresar al menú principal, escribe *menu*.
  `.trim();

  session.stage = 'MENU_PRINCIPAL';
  session.temp = {};
  return respuesta;
}

// ---- Estado de ticket ----

function manejarTicketEstadoId(session, message) {
  const id = message.toUpperCase().trim();

  // En un sistema real, consultarías la BD. Aquí simulamos.
  let estadoSimulado = 'EN REVISIÓN TÉCNICA';
  const random = Math.random();
  if (random < 0.33) estadoSimulado = 'ABIERTO';
  else if (random < 0.66) estadoSimulado = 'EN ESPERA DE REPUESTOS';
  else estadoSimulado = 'CERRADO';

  const respuesta = `
📄 Estado del ticket *${id}*:
- Estado actual: *${estadoSimulado}*
- Última actualización: hace pocas horas (simulado)

Si necesitas más detalles, responde con una breve descripción del problema o escribe *menu* para volver al inicio.
  `.trim();

  session.stage = 'MENU_PRINCIPAL';
  session.temp = {};
  return respuesta;
}

// ======== ENDPOINT DE TWILIO WHATSAPP ========

app.post('/whatsapp', (req, res) => {
  if (ENABLE_TWILIO_VALIDATION && TWILIO_AUTH_TOKEN !== 'test-token') {
    const signature = req.headers['x-twilio-signature'];
    const url = process.env.PUBLIC_URL || `https://${req.headers.host}${req.originalUrl}`;

    const isValid = twilio.validateRequest(
      TWILIO_AUTH_TOKEN,
      signature,
      url,
      req.body
    );

    if (!isValid) {
      console.error('Solicitud no válida de Twilio (firma inválida)');
      return res.status(403).send('Invalid Twilio signature.');
    }
  }

  const from = req.body.From || 'unknown';
  const body = req.body.Body || '';

  const respuesta = procesarMensaje(from, body);

  res.set('Content-Type', 'text/xml');
  res.send(crearRespuestaWhatsApp(respuesta));
});

// Endpoint simple para probar que el server está vivo
app.get('/', (req, res) => {
  res.send('WhatsApp PC Maintenance Bot está funcionando ✅');
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

