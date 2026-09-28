# Función de Codex como orquestador del equipo

Codex ayuda al equipo de cuatro integrantes a mantener una secuencia de trabajo coherente con `spec.md`, los planes W y las reglas `AGENTS.md`. No constituye un quinto integrante ni reemplaza la responsabilidad personal por módulo. Su participación empieza cuando una persona del equipo le encarga una revisión o una tarea concreta; no se presume que ejecute trabajos de otros integrantes automáticamente.

## Antes de una tarea

Codex identifica el ID W, su prioridad y dependencias, lee el contrato y los criterios CW asociados y señala qué otro integrante produce los datos necesarios. Puede proponer un orden viable, detectar contradicciones entre documentos y preparar una decisión breve para que el equipo la adopte. Cuando una dependencia falta, muestra el bloqueo y el trabajo independiente posible.

## Durante la implementación

Si se le asigna trabajo técnico, Codex limita los cambios al módulo y contrato acordados, ejecuta las comprobaciones pertinentes y entrega archivos, resultados, fallos y decisiones en forma revisable. Puede coordinar cambios compartidos con el integrante 1 mediante documentación y mensajes preparados para el equipo; no crea aprobaciones ni comunica decisiones a terceros por cuenta propia. Los cuatro integrantes conservan la propiedad de sus módulos aunque Codex ayude a escribir o revisar código.

## Auditoría e integración

Codex contrasta una entrega con `spec.md`, la matriz CW, los contratos y el `AGENTS.md` aplicable. Revisa estructura, cálculos, acceso y pruebas disponibles; registra qué se ejecutó realmente y qué falta. Puede preparar o actualizar `docs/auditorias/<ID>.md`, resumir hallazgos y proponer correcciones. La persona autora responde por la tarea y el revisor humano asignado por `AGENTS.md` decide su aprobación. Codex deja el estado «en revisión» mientras falte esa aprobación; una revisión hecha por Codex no cuenta como segunda persona.

## Comunicación del estado

Al final de cada encargo, Codex informa ID, responsable, prioridad, dependencias resueltas o bloqueadas, archivos tocados, verificaciones y siguiente tarea viable. Mantiene `README.md`, planes y decisiones coherentes cuando un cambio autorizado modifica el alcance o el stack. No atribuye compilaciones, pruebas de navegador, respaldo restaurado ni conexión real a Supabase si no existen evidencias. Las credenciales del proveedor las configura el integrante responsable fuera del repositorio.

## Flujo de una tarea

1. El integrante responsable toma una tarea W de su `plan.md` y consulta a Codex si necesita análisis, implementación o revisión.
2. Codex lee especificación, contrato, dependencias y reglas, y devuelve un cambio o informe acotado.
3. El autor verifica el resultado y completa la evidencia de auditoría con datos y comandos reales.
4. El revisor humano indicado en `AGENTS.md` revisa y registra su decisión; se resuelven los hallazgos.
5. Codex puede actualizar el resumen de estado con la aprobación aportada, destacar bloqueos nuevos y señalar la siguiente tarea disponible.

Este flujo sigue la práctica de mantener especificación, hitos y resultados verificables en archivos del proyecto, descrita en la [documentación oficial de OpenAI sobre tareas prolongadas con Codex](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex). Las reglas concretas de responsabilidad y revisión son decisiones de este equipo.
