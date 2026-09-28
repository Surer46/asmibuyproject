# Reglas del integrante 4

Leer [reglas generales](../../AGENTS.md), [spec](../../spec.md), [plan](plan.md), [frontend](frontend/README.md) y [backend](backend/README.md). Aplicar la versión 2 web móvil y sus IDs W.

## Responsabilidad

Carrito, cotización, cobro, comprobante en pantalla, historial, total por periodo y anulación sencilla. Propiedad de datos: ordenes y orden_detalle. Usar contratos de los demás módulos, sin duplicar motores o escribir tablas ajenas.

## Estructura

Frontend TypeScript/Angular en frontend/src: separar presentación, estado y acceso a API. Backend TypeScript/Express en backend/src: separar dominio, aplicación, infraestructura e interfaz según uso real. PostgreSQL en Supabase Free mediante `pg` y decimal.js; cantidades como cadenas en API. Publicar entradas del paquete e integrar en la única web y API del proyecto.

## Diseño

Inspiración Cupertino, Roboto, Material Symbols Rounded y tokens verdes, morados, rojos y amarillos del AGENTS general. Validar diseño adaptable, foco, teclado, errores y texto ampliado. Evidencias del navegador real en móvil, no compilaciones nativas. Usar [seguimiento visual](../../docs/diseno-interfaz.md).

## Auditoría por tarea

Revisor principal: integrante 3. Dos cajas con el último stock, doble clic, reintento, respuesta perdida, cambios de cotización, historial inmutable y anulación repetida. El integrante 2 revisa consumo y el 1 verifica acceso. Cada tarea necesita docs/auditorias/ID.md con la [plantilla](../../docs/auditorias/plantilla.md). No afirmar prueba ejecutada o revisión aprobada sin evidencia. Una entrega pendiente de revisión permanece en revisión.

## Límites

Mantener el recorte de spec.md: perfiles fijos, Avisos de stock actual, promoción por un mismo platillo e historial sencillo. El frontend solo llama a Express; las credenciales Supabase quedan en el servidor. No reintroducir roles editables, push, aplicaciones nativas o motores de negocio en el cliente. Coordinar cambios de app/ y compartido/ con el integrante 1.
