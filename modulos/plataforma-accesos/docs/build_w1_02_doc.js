const path = require('path');
const { createWordDocument } = require('C:/Tareas del 4-C/Aplicaciones web/.tools/generate_docx');

async function buildDoc() {
  const docData = {
    title: "Tarea W1-02: Creación de la Base Ejecutable del Proyecto",
    subtitle: "Módulo Plataforma y Accesos | Integrante 1 - Proyecto Asmibuy",
    subject: "Aplicaciones Web - Asmibuy MVP Web Móvil (4-C)",
    sections: [
      {
        title: "1. Propósito de la Tarea W1-02",
        content: [
          "Una vez acordados los contratos en W1-01, el objetivo de W1-02 fue construir la estructura ejecutable del proyecto donde vivirá el sistema: crear el servidor backend con Express y la aplicación frontend con Angular en un solo espacio de trabajo ordenado (Monorepo con workspaces npm).",
          {
            type: "tip",
            text: "Piensa en esto como levantar el chasis del auto y ponerle el motor base. Aún no tiene asientos ni pintura final, pero el motor ya enciende y las ruedas ya giran."
          }
        ]
      },
      {
        title: "2. Estructura Implementada",
        content: [
          {
            type: "bullet",
            bold: "Monorepo con Workspaces",
            text: "El archivo 'package.json' en la raíz coordina las dos aplicaciones ('app/backend' y 'app/frontend'), permitiendo compilar o arrancar cualquiera de las dos con comandos sencillos."
          },
          {
            type: "bullet",
            bold: "Servidor Backend (Express + TypeScript)",
            text: "Ubicado en 'app/backend', incluye conexión a PostgreSQL en Supabase con 'pg', endpoint de comprobación de salud ('/api/v1/health') y scripts de migraciones SQL."
          },
          {
            type: "bullet",
            bold: "Aplicación Frontend (Angular v21)",
            text: "Ubicada en 'app/frontend', cuenta con arquitectura Standalone, configuración de proxy ('proxy.conf.json') para reenviar peticiones a la API automáticamente sin errores de CORS."
          }
        ]
      },
      {
        title: "3. Pruebas y Evidencias de Funcionamiento",
        content: [
          {
            type: "bullet",
            bold: "Compilación de TypeScript",
            text: "Se ejecutó 'npm run build' en backend, generando el código JavaScript en la carpeta 'dist' sin ningún error de tipos."
          },
          {
            type: "bullet",
            bold: "Compilación de Angular",
            text: "Se ejecutó 'ng build' en frontend, completándose en solo 3 segundos con 0 errores."
          },
          {
            type: "bullet",
            bold: "Prueba del Endpoint de Salud",
            text: "Se encendió el servidor y se consultó 'http://localhost:3001/api/v1/health', respondiendo exitosamente con estado OPERATIVO y fecha universal en UTC."
          }
        ]
      },
      {
        title: "4. Auditoría y Conclusión",
        content: [
          "Se generó la auditoría formal 'docs/auditorias/W1-02.md'. La base ejecutable está lista para recibir la programación del sistema de inicio de sesión con perfiles fijos (W1-03) y el diseño de la interfaz (W1-04)."
        ]
      }
    ]
  };

  const outPath = path.resolve('C:/Users/santi/Downloads/asmibuyproject-main (1)/asmibuyproject-main/modulos/plataforma-accesos/docs/Documentacion-Tarea-W1-02.docx');
  await createWordDocument(outPath, docData);
}

buildDoc().catch(console.error);
