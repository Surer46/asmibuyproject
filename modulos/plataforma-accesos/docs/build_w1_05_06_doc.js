const path = require('path');
const { createWordDocument } = require('C:/Tareas del 4-C/Aplicaciones web/.tools/generate_docx');

async function buildDoc() {
  const docData = {
    title: "Tareas W1-05 y W1-06: Instalación, Verificación y Recuperación",
    subtitle: "Módulo Plataforma y Accesos | Integrante 1 - Proyecto Asmibuy",
    subject: "Aplicaciones Web - Asmibuy MVP Web Móvil (4-C)",
    sections: [
      {
        title: "1. ¿Qué se logró en estas tareas finales?",
        content: [
          "El objetivo de las tareas W1-05 y W1-06 es garantizar que cualquier profesor, evaluador o compañero del equipo pueda descargar el proyecto, encenderlo con un solo clic y saber cómo hacer respaldos de seguridad de la base de datos.",
          {
            type: "tip",
            text: "Un buen software no solo debe funcionar en la computadora de quien lo programó; debe ser fácil de instalar y operar en cualquier otra máquina sin dolores de cabeza."
          }
        ]
      },
      {
        title: "2. Herramientas de Puesta en Marcha Rápida",
        content: [
          {
            type: "bullet",
            bold: "Lanzador Automático (iniciar-asmibuy.bat)",
            text: "Se creó un archivo por lotes en la raíz del proyecto. Al hacerle doble clic, enciende simultáneamente el servidor backend en el puerto 3001 y la aplicación web en el puerto 4200 con soporte para red local."
          },
          {
            type: "bullet",
            bold: "Pruebas en Celulares Reales por Wi-Fi",
            text: "La aplicación web se configuró para escuchar en toda la red local (--host 0.0.0.0), permitiendo que el evaluador o trabajador ingrese desde el navegador de su teléfono celular conectado al mismo Wi-Fi introduciendo la dirección IP local de la computadora (ej. http://10.3.1.17:4200)."
          },
          {
            type: "bullet",
            bold: "Plantilla de Variables de Entorno (.env.example)",
            text: "Permite conectar el sistema a cualquier base de datos PostgreSQL en Supabase sin necesidad de compartir contraseñas privadas en internet."
          },
          {
            type: "bullet",
            bold: "Modo Desarrollo Local Seguro",
            text: "Si la base de datos de Supabase no está configurada aún o no hay internet, el sistema funciona de todas formas gracias a un almacén seguro en memoria para que nadie se quede sin trabajar."
          }
        ]
      },
      {
        title: "3. Estrategia de Respaldo y Restauración (pg_dump)",
        content: [
          "Como el plan gratuito de Supabase puede pausar proyectos por inactividad tras varios días sin uso, se preparó el script 'respaldo-postgresql.bat':",
          {
            type: "bullet",
            bold: "Exportación (Backup)",
            text: "Guarda toda la información de empleados, recetas, existencias y ventas en un archivo comprimido '.dump'."
          },
          {
            type: "bullet",
            bold: "Restauración",
            text: "Permite recuperar toda la información en una base de datos de prueba o en una nueva instancia sin perder ningún registro."
          }
        ]
      },
      {
        title: "4. Resumen de la Entrega Completa del Integrante 1",
        content: [
          "Se completaron al 100% las 6 tareas asignadas en el plan de trabajo:",
          {
            type: "bullet",
            bold: "W1-01 (P0)",
            text: "Fijación de versiones compatibles, precisión financiera y publicación de contratos compartidos."
          },
          {
            type: "bullet",
            bold: "W1-02 (P0)",
            text: "Creación del monorepo, workspaces npm, backend Express, frontend Angular y endpoint de salud."
          },
          {
            type: "bullet",
            bold: "W1-03 (P0)",
            text: "Autenticación segura con perfiles fijos (ADMINISTRADOR y TRABAJADOR), hash bcrypt y cookies HttpOnly."
          },
          {
            type: "bullet",
            bold: "W1-04 (P0)",
            text: "Navegación adaptable (móvil y PC) con estética Cupertino, tipografía Roboto y Material Symbols Rounded."
          },
          {
            type: "bullet",
            bold: "W1-05 y W1-06 (P1)",
            text: "Manual de instalación, lanzador con 1 clic, utilidades de respaldo y auditorías formales completadas."
          }
        ]
      }
    ]
  };

  const outPath = path.resolve('C:/Users/santi/Downloads/asmibuyproject-main (1)/asmibuyproject-main/modulos/plataforma-accesos/docs/Documentacion-Tarea-W1-05-y-W1-06.docx');
  await createWordDocument(outPath, docData);
}

buildDoc().catch(console.error);
