## 13. Orquestación del flujo de trabajo

Cómo encara el agente una tarea de principio a fin: qué mirar antes de tocar código, cuándo planificar,
cómo verificar antes de decir "terminado" y cómo aprender de las correcciones. No repite [14-agent-efficiency.md](./14-agent-efficiency.md)
(modo de comunicación, consulta a otros agentes, reparto orquestador/subagentes): eso vive ahí.

Índice: [13.1](#131-explorar-antes-de-editar) Explorar antes de editar ·
[13.2](#132-plan-para-tareas-no-triviales) Plan para tareas no triviales ·
[13.3](#133-verificación-antes-de-dar-por-terminado) Verificación antes de "terminado" ·
[13.4](#134-commits-pequeños-y-acotados) Commits pequeños ·
[13.5](#135-no-ampliar-el-alcance) No ampliar el alcance ·
[13.6](#136-preguntar-todo-lo-necesario-una-sola-vez-antes-de-empezar) Preguntar todo antes de empezar ·
[13.7](#137-causa-raíz-y-simplicidad) Causa raíz, simplicidad y sin sobreingeniería ·
[13.8](#138-ciclo-de-auto-mejora-taskslessonsmd) Ciclo de auto-mejora ·
[13.9](#139-archivos-de-ia-en-gitignore) Archivos de IA en `.gitignore`.

### 13.1 Explorar antes de editar

- Antes de tocar un archivo: leerlo completo (no solo el fragmento del pedido) y revisar quién lo usa
  (callers, interfaces que implementa, registros en DI, tests que lo cubren). Editar a ciegas sobre un
  fragmento genera regresiones que el diff no deja ver.
- Buscar la convención ya usada en el feature (naming, estructura, forma de resolver un caso parecido:
  otro handler, otro repositorio, otro validador) antes de imponer un patrón propio nuevo.
- Si el pedido es ambiguo sobre **qué** archivos toca, localizar primero (`graphify query`, búsqueda por
  símbolo) y confirmar el alcance real antes de escribir una línea.
- La exploración pesada (soluciones grandes, buscar en varios proyectos) se delega a un subagente
  barato; ver [14-agent-efficiency.md](./14-agent-efficiency.md) §14.3.

### 13.2 Plan para tareas no triviales

- Tarea de **3 o más pasos**, con una decisión de arquitectura, o que toca **3 o más archivos** ⇒
  escribir el plan antes de programar. Tarea de 1-2 pasos mecánicos: ejecutar directo, planificarla
  cuesta más que hacerla.
- El plan vive en `tasks/todo.md` como checklist verificable (ítems chicos, cada uno con un criterio
  claro de "hecho"). Se marca cada ítem al completarlo, no se reescribe la lista entera.
- Un plan no trivial se relee de forma crítica (o se valida con el usuario cuando la tarea lo amerita)
  antes de arrancar la implementación: cambiar de rumbo después de escribir código sale más caro que
  ajustar el plan a tiempo.
- Si a mitad de camino una asunción del plan resulta falsa (el SP no devuelve lo que se pensaba, la API
  externa responde distinto, el alcance real es otro), **parar y replanificar** en el momento, no seguir
  forzando el plan original.

### 13.3 Verificación antes de dar por "terminado"

- Nunca marcar una tarea como terminada sin probar que funciona: `dotnet build` sin warnings nuevos y
  `dotnet test Tests/<X>.UnitTest` en verde (ver [10-logging-tests.md](./10-logging-tests.md) §10.2). Si no se pudo correr, decirlo.
- Si el bug o la feature tiene un caso reproducible (excepción en el log, request que falla, `traceId`
  de producción), demostrar que ahora desaparece: test que lo reproduce o request real contra la API
  local. No alcanza con "debería andar".
- Ante un arreglo que se siente parche: preguntarse si resuelve la causa raíz (§13.7) o solo tapa el
  síntoma.
- Antes de reportar el cambio, releer el diff completo (no solo el archivo pedido): código muerto,
  usings sin usar, registros de DI faltantes o el error original sin resolver de fondo no deberían
  llegar a revisión.

### 13.4 Commits pequeños y acotados

- Un commit = un cambio lógico coherente (una corrección, una feature chica, un refactor). No mezclar
  refactor y feature en el mismo commit: dificulta el review y el revert selectivo.
- El mensaje describe el **por qué** del cambio; el **qué** ya lo muestra el diff.
- Si una tarea terminó tocando features sin relación entre sí, separarlos en commits distintos aunque se
  hayan hecho en la misma sesión de trabajo.
- Scripts de base de datos (`.sql` idempotentes) en el mismo PR que el código que los necesita.

### 13.5 No ampliar el alcance

- Resolver exactamente lo pedido, aunque la skill prefiera otro enfoque: hacerlo y proponer la
  alternativa en una línea. No reescribir la arquitectura por cuenta propia.
- Si en el camino aparece otro problema (bug ajeno a la tarea, deuda de [12-tech-debt.md](./12-tech-debt.md), `TODO` viejo),
  anotarlo y reportarlo, no arreglarlo de paso dentro del mismo cambio.
- Un refactor "ya que estamos" que no hace falta para la tarea pedida se propone aparte, no se aplica
  sin que el usuario lo pida.
- Excepción: un cambio mínimo indispensable para que la tarea pedida compile o funcione (ej. ajustar una
  firma de interfaz que rompe con el cambio) sí entra en el mismo commit, documentado en el mensaje.

### 13.6 Preguntar todo lo necesario, una sola vez, antes de empezar

- Antes de una tarea no trivial (§13.2), identificar **todo** lo que falta saber para hacerla bien:
  contrato del endpoint (request, response, códigos), rol requerido, tabla o SP destino, cache sí/no,
  casos borde y restricciones.
- Juntar esas dudas y preguntarlas **en un solo turno**, antes de escribir código. Preguntar de a una
  a mitad de camino corta el trabajo varias veces y obliga a rehacer lo ya hecho.
- Cada pregunta con opciones concretas y una **recomendada** con su razón corta. En Claude Code usar
  `AskUserQuestion` (hasta 4 preguntas por llamada, con opciones).
- Si durante la tarea aparece una duda nueva que cambia el resultado, parar y preguntar. Si no lo
  cambia, elegir la opción razonable, seguir y mencionarla en el reporte final.
- No preguntar por algo que el agente puede resolver solo con la información del repo: convención ya
  usada en un handler similar, DTO ya definido, patrón ya aplicado en otro feature.
- Preguntar cuando: la decisión es de negocio (qué regla aplica, qué rol puede hacer qué), hay
  ambigüedad real entre dos caminos técnicos válidos sin una convención del equipo que desempate, o la
  acción es irreversible/riesgosa (borrar datos, migración destructiva, `push --force`, romper el
  contrato de un endpoint que consume el frontend).
- Al preguntar, proponer una opción por defecto razonada en vez de una pregunta abierta: "¿Uso X o
  dejo Y? Recomiendo X porque [razón corta]" avanza más rápido que "¿Qué hago acá?".

### 13.7 Causa raíz y simplicidad

- Buscar la causa raíz del problema, no el parche que lo esconde. Un arreglo temporal solo se acepta si
  queda documentado como tal (comentario + motivo + ticket) y no se presenta como solución definitiva.
- Cambio mínimo necesario: tocar solo lo que la tarea requiere. Reescribir alrededor "para dejarlo
  prolijo" es scope creep (§13.5), no una mejora gratis.
- Los límites de tamaño y cuándo dividir ya están en [01-solution-structure.md](./01-solution-structure.md) §1.3: no se repiten acá.

#### 13.7.1 Sin sobreingeniería

**Regla**: la solución más simple que resuelve lo pedido hoy. Nada "por si acaso". Código simple se
lee, se revisa y se cambia más rápido que una abstracción.

**Prohibido sin un caso real que lo pida:**

| ❌ Sobreingeniería | ✅ Simple |
| :--- | :--- |
| Interfaz + clase abstracta + factory para una sola implementación (fuera de repos y clientes, que llevan interfaz por convención) | Una clase concreta |
| `IRepository<T>` / `BaseRepository<T>` genérico | El repositorio Command / Query concreto |
| MediatR, AutoMapper, `Result<T>`, buses nuevos | El mediator del equipo, mapeo explícito, excepciones tipadas |
| Handler base genérico o pipeline behaviors para un solo caso | El handler concreto |
| Options + `IValidateOptions` para un valor que nunca cambia | Una constante en `Domain/Structs/` |
| Capa de "adapters" sobre Dapper o sobre un typed `HttpClient` | Llamar directo desde el repositorio o el cliente |
| Extraer métodos o clases de 5 líneas usadas una vez | Dejarlo en el método (§1.3) |
| Utilidades, extensiones o helpers "para el futuro" | Nada. Se crean cuando aparece el segundo uso |
| Paquete NuGet nuevo para algo que .NET o el BCL ya resuelven | La API nativa |

**Cuándo sí abstraer:** cuando el mismo código aparece **por segunda vez**, o cuando el usuario lo
pide. Nunca antes.

**Chequeo antes de entregar:**
- ¿Un dev nuevo entiende el cambio en 5 minutos?
- ¿Cada archivo, clase, método y parámetro nuevo tiene un uso hoy?
- ¿Se puede borrar algo y sigue funcionando? Entonces sobra: borrarlo.

Si la solución simple tiene un límite real (rendimiento, seguridad), elegir la simple igual y avisar
el límite en una línea. El usuario decide si vale la complejidad extra.

### 13.8 Ciclo de auto-mejora: `tasks/lessons.md`

- Después de cualquier corrección del usuario (rechazó un enfoque, señaló un error, pidió deshacer algo)
  registrar el patrón en `tasks/lessons.md`: qué se hizo mal y la regla concreta para no repetirlo.
- Revisar `tasks/lessons.md` al arrancar una sesión nueva sobre el mismo proyecto, antes de planificar.
- Iterar sobre las lecciones ya escritas: si una regla no bajó la tasa de errores, reformularla en vez
  de acumular reglas redundantes o contradictorias.

### 13.9 Archivos de IA en `.gitignore`

**Regla**: todo lo relacionado con IA y agentes queda fuera del repositorio. Al empezar a trabajar
en un proyecto, el agente verifica el `.gitignore` y agrega las entradas que falten:

```gitignore
# IA / agentes (skills-backend-mrydex)
.claude/
.agents/
.cursor/
.gemini/
.codex/
.windsurf/
.clinerules/
.opencode/
.aider*
skills/desarrollo-backend-buenas-practicas/
CLAUDE.md
CLAUDE.local.md
AGENTS.md
GEMINI.md
.cursorrules
.windsurfrules
.github/copilot-instructions.md
.mcp.json
graphify-out/
tasks/todo.md
tasks/lessons.md
tasks/brief-*.md
```

- Si aparece otra herramienta de IA con su propia carpeta o archivo de configuración, sumarlo al
  bloque.
- El instalador (`npx github:MRydex/skills-backend-mrydex`) agrega este bloque solo cuando instala en
  el proyecto. Si graphify crea un `.gitattributes` nuevo (merge driver del grafo), también lo ignora.
  Un `.gitattributes` que ya existía no se toca. Solo suma las entradas que faltan; correrlo de nuevo
  no duplica nada.
- `.gitignore` no saca del repo lo que ya estaba commiteado. Para eso hace falta
  `git rm --cached <archivo>`, que lo borra del repo para todo el equipo en el próximo push. **El
  agente pregunta antes de correrlo.**
