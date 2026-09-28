const path = require('path');
const { createWordDocument } = require('C:/Tareas del 4-C/Aplicaciones web/.tools/generate_docx');

async function buildDoc() {
  const docData = {
    title: "Tarea W1-01: Entorno, Convenciones y Contratos Comunes",
    subtitle: "Módulo Plataforma y Accesos | Integrante 1 - Proyecto Asmibuy",
    subject: "Aplicaciones Web - Asmibuy MVP Web Móvil (4-C)",
    sections: [
      {
        title: "1. ¿Qué se logró en esta actividad?",
        content: [
          "Como Integrante 1, mi responsabilidad es construir los cimientos sobre los cuales trabajarán mis tres compañeros de equipo (Inventario, Promociones y Ventas).",
          "En esta primera tarea (W1-01) fijamos las reglas del juego técnicas: qué programas y versiones usaremos, cómo se manejará el dinero para no perder centavos, y qué contratos de datos nos compartirán los módulos entre sí.",
          {
            type: "tip",
            text: "Antes de que los albañiles empiecen a levantar muros o pintar, los arquitectos deben acordar las medidas, los planos y las conexiones eléctricas. Eso es exactamente la tarea W1-01."
          }
        ]
      },
      {
        title: "2. Decisiones Técnicas Clave Acordadas",
        content: [
          {
            type: "bullet",
            bold: "Tecnología Principal",
            text: "TypeScript en todo el proyecto (tanto en la página web con Angular como en el servidor con Express y Node.js)."
          },
          {
            type: "bullet",
            bold: "Base de Datos",
            text: "PostgreSQL alojado en el plan gratuito de Supabase, conectándose de forma segura mediante 'pg' desde el servidor Express (el navegador jamás toca la base de datos directamente)."
          },
          {
            type: "bullet",
            bold: "El Dinero como Cadenas de Texto",
            text: "En computación, los números decimales a veces tienen fallas de redondeo (como 0.1 + 0.2 = 0.30000000000000004). Para evitar cobrar de más o de menos, todo monto financiero se calcula con la librería decimal.js y viaja en la API como texto (ej. '150.50')."
          },
          {
            type: "bullet",
            bold: "Zona Horaria Universal",
            text: "Todas las fechas se guardan en horario UTC (estándar mundial) y la aplicación del teléfono las traduce a la hora de la sucursal."
          }
        ]
      },
      {
        title: "3. Contratos de Datos para los Compañeros de Equipo",
        content: [
          "Se redactó y publicó el archivo 'docs/contratos/01-plataforma-accesos.md' donde se establecen los formatos que mis compañeros usarán:",
          {
            type: "bullet",
            bold: "Para Ventas e Inventario",
            text: "Un cliente de base de datos compartido para que cuando se venda una hamburguesa, se descuente la carne y el pan al mismo tiempo. Si algo falla, la venta se cancela limpiamente (Rollback)."
          },
          {
            type: "bullet",
            bold: "Para la Seguridad",
            text: "Se acordaron los dos perfiles fijos: ADMINISTRADOR y TRABAJADOR, sin enredos de roles configurables que compliquen el proyecto."
          }
        ]
      },
      {
        title: "4. Auditoría y Cierre",
        content: [
          "Se completó la auditoría formal 'docs/auditorias/W1-01.md' validando que las dependencias estén satisfechas. Con esto, queda formalmente desbloqueada la siguiente tarea: W1-02 (Crear la base ejecutable del servidor y la web)."
        ]
      }
    ]
  };

  const outPath = path.resolve('C:/Users/santi/Downloads/asmibuyproject-main (1)/asmibuyproject-main/modulos/plataforma-accesos/docs/Documentacion-Tarea-W1-01.docx');
  await createWordDocument(outPath, docData);
}

buildDoc().catch(console.error);
