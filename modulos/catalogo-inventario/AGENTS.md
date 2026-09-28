# Reglas del integrante 2

Leer [reglas generales](../../AGENTS.md), [spec](../../spec.md), [plan](plan.md), [frontend](frontend/README.md) y [backend](backend/README.md). Aplicar la versión 2 web móvil y sus IDs W.

## Responsabilidad

Ingredientes, platillos, recetas, existencias, movimientos, consumo y alertas dentro de la web. Propiedad de datos: ingredientes, platillos, receta_detalle y movimientos_inventario. Usar contratos de los demás módulos, sin duplicar motores o escribir tablas ajenas.

## Estructura

Frontend TypeScript/Angular en frontend/src: separar presentación, estado y acceso a API. Backend TypeScript/Express en backend/src: separar dominio, aplicación, infraestructura e interfaz según uso real. PostgreSQL en Supabase Free mediante `pg` y decimal.js; cantidades como cadenas en API. Publicar entradas del paquete e integrar en la única web y API del proyecto.

## Diseño

Inspiración Cupertino, Roboto, Material Symbols Rounded y tokens verdes, morados, rojos y amarillos del AGENTS general. Validar diseño adaptable, foco, teclado, errores y texto ampliado. Evidencias del navegador real en móvil, no compilaciones nativas. Usar [seguimiento visual](../../docs/diseno-interfaz.md).

## Auditoría por tarea

Revisor principal: integrante 1. Cantidades exactas, demanda conjunta por ingrediente, stock cero, igualdad con el mínimo, ventas concurrentes, rollback y unidades gratuitas. El integrante 4 revisa además el contrato de consumo. Cada tarea necesita docs/auditorias/ID.md con la [plantilla](../../docs/auditorias/plantilla.md). No afirmar prueba ejecutada o revisión aprobada sin evidencia. Una entrega pendiente de revisión permanece en revisión.

## Límites

Mantener el recorte de spec.md: perfiles fijos, Avisos de stock actual, promoción por un mismo platillo e historial sencillo. El frontend solo llama a Express; las credenciales Supabase quedan en el servidor. No reintroducir roles editables, push, aplicaciones nativas o motores de negocio en el cliente. Coordinar cambios de app/ y compartido/ con el integrante 1.
