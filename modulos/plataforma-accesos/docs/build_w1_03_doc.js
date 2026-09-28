const path = require('path');
const { createWordDocument } = require('C:/Tareas del 4-C/Aplicaciones web/.tools/generate_docx');

async function buildDoc() {
  const docData = {
    title: "Tarea W1-03: Implementación del Acceso Sencillo y Seguridad",
    subtitle: "Módulo Plataforma y Accesos | Integrante 1 - Proyecto Asmibuy",
    subject: "Aplicaciones Web - Asmibuy MVP Web Móvil (4-C)",
    sections: [
      {
        title: "1. ¿Qué se logró en la Tarea W1-03?",
        content: [
          "Se programó el sistema completo de inicio y cierre de sesión seguro para el personal de la sucursal de alimentos, siguiendo las reglas estrictas de la versión 2.1 del proyecto Asmibuy.",
          {
            type: "tip",
            text: "El sistema funciona como la llave de un negocio: solo los empleados dados de alta pueden entrar a operar el sistema, y según su gafete (Administrador o Trabajador), podrán ver o modificar ciertas cosas."
          }
        ]
      },
      {
        title: "2. Características de Seguridad Implementadas",
        content: [
          {
            type: "bullet",
            bold: "Perfiles Fijos (Sin Roles Configurables)",
            text: "Solo existen dos perfiles definidos en código: ADMINISTRADOR (puede vender, ajustar inventario, crear platillos y anular ventas) y TRABAJADOR (solo puede vender, ver stock actual y consultar sus propias ventas del turno)."
          },
          {
            type: "bullet",
            bold: "Contraseñas Cifradas con Bcrypt",
            text: "Las contraseñas nunca se guardan en texto claro. Se les aplica un algoritmo criptográfico (Bcrypt con salting) para que nadie, ni siquiera quien revise la base de datos, pueda leerlas."
          },
          {
            type: "bullet",
            bold: "Sesiones en Servidor con Cookies HttpOnly",
            text: "En lugar de guardar tokens en el almacenamiento local del celular (localStorage, que es vulnerable a virus o ataques XSS), la sesión se guarda en una cookie segura HttpOnly, invisible para scripts maliciosos."
          },
          {
            type: "bullet",
            bold: "Protección Anti-CSRF",
            text: "Se generaron tokens CSRF criptográficos para evitar que páginas externas intenten enviar órdenes o ventas a espaldas del empleado."
          }
        ]
      },
      {
        title: "3. Utilidad de Mantenimiento de Cuentas (CLI)",
        content: [
          "Como el spec prohíbe tener una pantalla pública de registro o un editor de roles, se desarrolló la herramienta 'mantenimiento-cuentas.ts' en la consola, que permite dar de alta empleados legítimos:",
          {
            type: "bullet",
            bold: "Cuenta Administrador de prueba",
            text: "admin@asmibuy.com con contraseña Admin1234!"
          },
          {
            type: "bullet",
            bold: "Cuenta Trabajador de prueba",
            text: "cajero@asmibuy.com con contraseña Cajero1234!"
          }
        ]
      },
      {
        title: "4. Auditoría y Conclusión",
        content: [
          "Se generó y aprobó la auditoría 'docs/auditorias/W1-03.md'. Las pruebas de login exitoso (200 OK) y login rechazado (401 Unauthorized) demostraron un comportamiento impecable. Queda desbloqueada la tarea W1-04 (Diseño de la navegación web y estilos)."
        ]
      }
    ]
  };

  const outPath = path.resolve('C:/Users/santi/Downloads/asmibuyproject-main (1)/asmibuyproject-main/modulos/plataforma-accesos/docs/Documentacion-Tarea-W1-03.docx');
  await createWordDocument(outPath, docData);
}

buildDoc().catch(console.error);
