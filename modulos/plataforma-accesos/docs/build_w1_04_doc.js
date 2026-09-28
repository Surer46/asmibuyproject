const path = require('path');
const { createWordDocument } = require('C:/Tareas del 4-C/Aplicaciones web/.tools/generate_docx');

async function buildDoc() {
  const docData = {
    title: "Tarea W1-04: Navegación y Diseño Web Compartido",
    subtitle: "Módulo Plataforma y Accesos | Integrante 1 - Proyecto Asmibuy",
    subject: "Aplicaciones Web - Asmibuy MVP Web Móvil (4-C)",
    sections: [
      {
        title: "1. ¿Qué se diseñó en la Tarea W1-04?",
        content: [
          "Se construyó la interfaz gráfica y el sistema de navegación que utilizarán todos los empleados de la sucursal de alimentos Asmibuy.",
          "El diseño sigue la filosofía Cupertino (inspirada en la estética limpia, moderna y con esquinas redondeadas de los teléfonos móviles), utilizando iconos de Material Symbols Rounded y la tipografía estándar Roboto.",
          {
            type: "tip",
            text: "Diseñar para móviles primero (Mobile-First) asegura que un empleado con su celular en mano en el mostrador pueda presionar cualquier botón cómodamente sin equivocarse de platillo."
          }
        ]
      },
      {
        title: "2. Características de la Navegación y Prioridad Móvil (Mobile-First)",
        content: [
          {
            type: "bullet",
            bold: "En Teléfonos Celulares (Pantallas de 360px a 767px)",
            text: "Se despliega una doble interfaz móvil: un encabezado superior fijo tipo barra de estado con la sucursal y la insignia del usuario, y una barra de navegación inferior (Cupertino Tab Bar) con efecto de vidrio translúcido (blur), adaptada a la 'Safe Area' de teléfonos modernos (evitando colisión con la barra de inicio de iPhone o Android)."
          },
          {
            type: "bullet",
            bold: "Ergonomía Táctil y Prevención de Errores",
            text: "Todos los elementos interactivos tienen una altura mínima de 48 píxeles (superando los 44px estándar), con respuesta física de toque al pulsar (animación de rebote táctil :active) y tamaño de letra exacto de 16px en formularios para evitar que iOS Safari haga zoom no deseado al enfocar."
          },
          {
            type: "bullet",
            bold: "En Computadoras de Escritorio (768px en adelante)",
            text: "La barra se transforma automáticamente en un encabezado horizontal clásico con menú de enlaces directos, respetando la vista de mostrador de caja."
          },
          {
            type: "bullet",
            bold: "Control de Acceso Visual",
            text: "La pestaña de 'Gestión' solo aparece si el usuario autenticado tiene el perfil de ADMINISTRADOR. Si inicia sesión un TRABAJADOR, la pestaña se oculta automáticamente."
          }
        ]
      },
      {
        title: "3. Paleta Dinámica y Degradados (Verde, Naranja y Amarillo)",
        content: [
          "Para reflejar la identidad fresca y enérgica de una sucursal de alimentos, se diseñó una paleta dinámica y fluida utilizando gradientes vivos:",
          {
            type: "bullet",
            bold: "Degradado Naranja a Amarillo Sol (linear-gradient #ff6b35 a #ffb703)",
            text: "Acento principal de marca y acción: se aplica en el isotipo de Asmibuy, botones primarios con sombra de elevación luminosa (0 4px 16px rgba(249,115,22,0.28)), pestañas móviles activas y encabezados de tarjetas."
          },
          {
            type: "bullet",
            bold: "Degradado Verde Esmeralda a Menta (linear-gradient #059669 a #34d399)",
            text: "Se utiliza en confirmaciones de cobro, badges de éxito, inventario en condición normal y avatar del trabajador en turno."
          },
          {
            type: "bullet",
            bold: "Degradado Amarillo Dorado a Ámbar (linear-gradient #d97706 a #fbbf24)",
            text: "Para alertas de bajo stock y atención prioritaria en cocina. Se combina estrictamente con texto marrón oscuro (#451a03) para superar los estándares de accesibilidad WCAG AAA."
          },
          {
            type: "bullet",
            bold: "Línea de Acento Tricolor Cupertino (90deg: Verde -> Naranja -> Amarillo)",
            text: "Elegante línea sutil de 3px en el borde superior de la barra móvil y de escritorio que une armónicamente los tres colores del proyecto."
          }
        ]
      },
      {
        title: "4. Auditoría y Conclusión",
        content: [
          "Se completó la auditoría formal 'docs/auditorias/W1-04.md'. Con esta tarea quedan terminadas al 100% todas las tareas de máxima prioridad (P0) del Integrante 1. El entorno, la base ejecutable, la autenticación y la interfaz están listos para que los demás integrantes conecten sus módulos."
        ]
      }
    ]
  };

  const outPath = path.resolve('C:/Users/santi/Downloads/asmibuyproject-main (1)/asmibuyproject-main/modulos/plataforma-accesos/docs/Documentacion-Tarea-W1-04.docx');
  await createWordDocument(outPath, docData);
}

buildDoc().catch(console.error);
