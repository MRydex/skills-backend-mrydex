---
name: desarrollo-backend-buenas-practicas
description: >
  Convenciones del equipo para APIs backend .NET 10 (ASP.NET Core, Clean Architecture, mediator propio, FluentValidation, ProblemDetails, Dapper / EF Core, Key Vault, seguridad OWASP, xUnit + Moq, Azure DevOps con SonarCloud) y forma de trabajar del agente (caveman, graphify, subagentes). Usar siempre, antes de la primera herramienta, en cualquier repo con *.sln, *.csproj o Program.cs, para cualquier pedido: preguntas, explicaciones, revisión, depuración, refactor o cambios, aunque no mencione .NET. Incluye pedidos sobre endpoints, controllers, handlers, validación o errores; acceso a datos (SQL, stored procedures, transacciones, cache); contrato con el front (Request / Response, mapeo, paginado); configuración (appsettings, Options, secretos); integraciones (HttpClient, Polly); logging, tests o pipelines; seguridad de la API ("auditá la seguridad", "¿es seguro?"); y auditorías ("auditá", "optimizá", "limpiá"): calidad, eficiencia, código duplicado y sin uso.
metadata:
  version: 1.30.0
  triggers:
    files:
      - "**/*.sln"
      - "**/*.csproj"
      - "**/Program.cs"
      - "**/*.cs"
      - "**/appsettings*.json"
      - "**/*.sql"
      - "azure-pipelines*.yml"
    keywords:
      - dotnet
      - c#
      - asp.net core
      - endpoint
      - controller
      - handler
      - mediator
      - dapper
      - ef core
      - sql
      - stored procedure
      - transacción
      - validación
      - fluentvalidation
      - signalr
      - websocket
      - hub
      - problemdetails
      - appsettings
      - key vault
      - httpclient
      - polly
      - cache
      - request
      - response
      - mapeo
      - logging
      - xunit
      - pipeline
      - sonarcloud
      - seguridad
      - auditá
      - código sin usar
      - código duplicado
---

# Desarrollo Backend — Buenas Prácticas del Equipo (.NET 10)

Convenciones **obligatorias** para APIs ASP.NET Core (.NET 10) y reglas de cómo trabaja el agente. Orden: reglas, modo de operación. Stack en §0; detalle en `references/`. Graphify no tiene paso de arranque (ver abajo).

> **Regla maestra**: si .NET 10 tiene una forma moderna y segura (primary constructors, records, `IExceptionHandler`, `ProblemDetails`, Options con `ValidateOnStart`, typed `HttpClient`, `CancellationToken`, `CommandDefinition` de Dapper), **siempre usarla**. La forma legacy solo por interoperabilidad con código existente, justificada en el PR.

> **Alcance de la skill**:
> - Las referencias son **convenciones con ejemplos**, no el código del proyecto. Nunca describir la app con los ejemplos: responder solo con lo que existe en el repo (`archivo:línea`); si no está, decirlo.
> - Las reglas aplican al código que se escribe o modifica. Nombres y APIs de paquetes externos (NuGet públicos, `Corp.*` del feed privado) no se juzgan ni se renombran.
> - `Corp` es un **placeholder** del prefijo de la empresa (`Corp.*`, `ICorpLoggerHandler`, `ICorpAuthHttpService`), igual que `MainDb`. En el repo, usar los nombres reales.
> - La skill no es motivo para negarse. Hacer lo pedido con las convenciones; si hay un enfoque mejor, proponerlo en una línea y el usuario decide. Única excepción: seguridad (§11).
> - Deuda técnica conocida (§12) **no se repite** en código nuevo ni se arregla fuera de alcance: se reporta en una línea.
> - **El repo manda sobre la forma.** Si el repo ya resuelve algo de otra manera (Minimal APIs, sin mediator, sin FluentValidation, sin `IExceptionHandler` propio, fakes en vez de Moq, otro naming de tests, otro esquema de auth, otra carpeta de docs), se sigue su patrón y no se introduce el de la skill. Ni el código ni sus comentarios citan la skill (`§6`, "según la skill"): el motivo se escribe con palabras propias. Las reglas de abajo son la forma por defecto en repos nuevos o que ya la usan. La seguridad no baja nunca: un endpoint nuevo queda al menos tan protegido como sus vecinos. En una auditoría, una convención de la skill que el repo no usa se reporta como mejora (BAJO), no como bug.
> - **Pedido de solo lectura** (pregunta, explicación, revisión o auditoría "solo reportá"): no editar, no instalar, no escribir archivos. Del Paso 0 queda solo `graphify query` si el grafo existe (sin grafo, `grep`); `.gitignore`, herramientas o skills que falten se reportan en una línea; `dotnet list package` con `--no-restore`, solo en una revisión o auditoría (si falla por falta de restore: versiones de los `.csproj` y avisar; en una pregunta o explicación `dotnet list package` no corre, ni se cargan skills externas de §14.9 salvo `security-audit` en modo guía (y `security-and-hardening` para el STRIDE) si la pregunta es de seguridad); lo que pediría tocar `.editorconfig` se revisa a mano.
> - **Repo con front y back** (también se activa `desarrollo-buenas-practicas`): cada skill rige sus archivos (esta, `.cs`, `.sql`, `appsettings`, pipelines); el Paso 0 y lo de "una vez por sesión" corren una sola vez.

> **Simplicidad**: la solución más simple que resuelve lo pedido. Sin abstracciones, capas, genéricos, interfaces de un solo uso (salvo repositorios y clientes externos, que llevan interfaz por convención), patrones ni paquetes "por si acaso": se abstrae recién al segundo uso. Nada de Repository genérico, AutoMapper, MediatR, `Result<T>` ni buses nuevos si el repo no los usa (§13.7.1). En un repo nuevo: la estructura de 4 proyectos de §1 y el mediator mínimo de §4 sí se crean (son la forma por defecto); se borra lo de la plantilla de `dotnet new` (WeatherForecast, `UnitTest1`, comentarios de ejemplo); sin campos ni servicios que el pedido no nombra (fechas de auditoría, `TimeProvider`); comentarios en el idioma de los mensajes.

---

### Graphify (sin paso de arranque)

No hay comando al empezar ni al cerrar la tarea. El grafo (`graphify-out/graph.json`) lo mantiene el hook git
`post-commit` que deja el instalador; `graphify update .` se corre **solo justo antes de un `graphify query`**,
y ese query es raro (ver abajo). Medido: `graphify update .` sin cambios tarda 0,7 s en 584 nodos, 1 s en 1.247
y 17,4 s en 12.598; correrlo al arrancar y tras cada edición gastaba casi un minuto por tarea en un repo grande
para un grafo que casi nunca se consulta.

**Durante la tarea**: buscar por nombre (símbolo, archivo, texto literal) con `grep` / `Glob`, directo. `graphify
query` solo para una pregunta de flujo sin ningún nombre conocido: antes `graphify update .`, después el query
con `--budget 800`; si devuelve nodos sin relación, `grep`. Medido en §14.5: `grep -l` costó de 10 a 120 veces
menos que una consulta al grafo, también en un repo de 12.600 nodos. Si `graphify update .` falla (`command not
found`, `Rebuild failed`, `worker failed`, `Nothing to update or rebuild failed` aunque el exit code sea 0):
**avisar** con el comando, el error exacto y la causa probable (§14.5 "Si algo falla"); nunca seguir en silencio.

---

### Las reglas que más se violan (leer siempre)

1. **Controllers delgados.** Action = recibir el request, `await mediator.Send(request, cancellationToken)`, mapear a `ActionResult`. Nunca lógica de negocio, SQL, `try/catch` ni validación en el controller: no se testea con el handler y duplica reglas. [03](./references/03-controllers.md).
2. **`CancellationToken` de punta a punta.** Todo action lo recibe y lo pasa a `mediator.Send`, handler, repositorio (`CommandDefinition(..., cancellationToken: ...)`) y `HttpClient`. Nunca `CancellationToken.None` salvo en background sin request. [03](./references/03-controllers.md), [05](./references/05-data-access-dapper.md).
3. **Nunca SQL concatenado con input.** Siempre parámetros (`@param` + objeto anónimo / `DynamicParameters`, o `FromSql` interpolado en EF) o `Dapper.SqlBuilder` / `Where` compuesto para filtros dinámicos. `ORDER BY` / columnas dinámicas solo desde whitelist. [05](./references/05-data-access-dapper.md), [11](./references/11-security.md).
4. **Validar antes de tocar datos.** Todo request de escritura tiene `AbstractValidator<TRequest>` en `Dtos/<Feature>Dtos/Validators/`; el handler llama `Guard.AgainstInvalidSpecification(validator, request)` como primera línea (con `cancellationToken` si el Guard del repo lo recibe; el del equipo no, §12). Mensajes en `Domain/Structs/ErrorMessage.cs`, nunca literales sueltos. [06](./references/06-validation.md).
5. **Errores con excepciones tipadas, respuesta `ProblemDetails`.** Lanzar `SystemValidationException` / `NotFoundException` / `CommandException` / `QueryException` / `ExternalApiException`; su `IExceptionHandler` arma el `ProblemDetails` y loguea. Nunca `BadRequest("texto")`, nunca `catch` vacío, nunca `ex.Message` / stack trace al cliente. [07](./references/07-errors-responses.md).
6. **Transacción solo vía `IUnitOfWork`.** Multi-tabla con Dapper: `BeginTransaction` → repos de comando → `Commit`, con `Rollback` garantizado; con EF, un solo `SaveChangesAsync` (§15.5). Nunca `SqlConnection` / `SqlTransaction` a mano en un handler. [05](./references/05-data-access-dapper.md).
7. **Nunca secretos en código ni en `appsettings*.json`.** `appsettings` guarda el **nombre** del secreto; el valor sale de Key Vault (`configuration[secretName]`); en un ambiente sin Key Vault, de variables de entorno (§8). Nunca loguear tokens, connection strings, CBU/CVU completos ni PII. [08](./references/08-configuration-di-secrets.md), [11](./references/11-security.md).
8. **Nunca archivos monolíticos ni capas cruzadas.** Una clase por archivo (archivo = clase). Máximo: controller 150 líneas, handler 150, repositorio 250, clase 300, método 40. Dependencias hacia adentro: Api → Application → Domain; Infrastructure implementa interfaces de Application; Domain no referencia otros proyectos (§1.4). [01](./references/01-solution-structure.md), [02](./references/02-csharp-design.md).

---

### Modo de operación del agente

Rige toda la sesión desde que la skill se carga. Para sesiones que no tocan .NET: archivos puente en el repo (`--bridge`: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`).

0. **Adaptarse al agente y modelos en uso.** Detectar el agente y los modelos disponibles. Nombres concretos (Opus, Sonnet, Haiku, `/compact`, `AskUserQuestion`, `SendMessage`, `Agent`) son **ejemplos**: traducir al equivalente; si no hay, fallback documentado. Cambia la sintaxis, no la regla. §14.7.
1. **Caveman siempre, conciso y corto.** Todo lo que emite la skill, también reportes de subagentes. Sin relleno ni cortesías. Una línea de estado por fase o paso largo. Reporte final: qué cambió, qué falló y qué decide el usuario; linkear archivos, no repetirlos. Términos técnicos, código y errores exactos. Nunca omitir negaciones. Prosa normal: advertencias de seguridad, acciones irreversibles, pasos cuyo orden la compresión haría ambiguo, cuando el usuario pide aclaración, y en código, commits, PRs y docs. §14.1.
2. **Librerías: preguntar antes de investigar.** Primero otra sesión/agente abierto (Claude Code: `ListAgents` + `SendMessage`) → código del repo que ya la usa → MCP de docs → XML docs en `~/.nuget/packages` → web (Microsoft Learn, repo oficial). `Corp.*` no tiene doc pública: sin MCP ni web; si no alcanza, preguntar al usuario. §14.2.
3. **El modelo seleccionado orquesta, decide y siempre revisa; delega solo si ahorra tokens.** Delegar búsquedas/lecturas grandes (3+ archivos, logs de build, `dotnet test`, docs) y ediciones mecánicas en 8+ archivos a `investigador`, `ejecutor-backend`, `revisor-checklist-backend` (en 3 archivos delegar costó 38% más, §14.3.4). Regla práctica: delegar si lo que habría que leer es 3 veces o más lo que hace falta saber. Solo por un motivo nombrado (exploración grande, escritores en paralelo, respaldo de contexto, verificador de tarea de riesgo alto o de diff grande (3+ archivos) contra el checklist); ante la duda, lo hace el orquestador. 5+ unidades independientes en todo el codebase: proponer `/batch <instrucción>`. Contexto compartido en `tasks/brief-<tarea>.md`, con solo las reglas compactas que aplican. El ejecutor no adivina: si se traba devuelve `NECESITA_ADVISOR: <duda>`. El orquestador interviene tras la orientación, cuando el ejecutor se traba y antes de dar por terminado; advisor nativo: el instalador configura `fable` (nivel superior a Sonnet y Opus; no si la sesión ya es Fable), consultarlo solo en esos mismos momentos, nunca en pasos mecánicos; `/advisor off` lo quita. §14.3.
4. **Preguntar todo antes de empezar.** En tareas no triviales, juntar las dudas que cambian el resultado (contrato del endpoint, rol, tabla/SP, cache sí/no) y preguntarlas de una vez, con opciones y una recomendada (Claude Code: `AskUserQuestion`). No preguntar lo que resuelve el repo (§13.6). Sin usuario que responda (ejecución desatendida): tomar la opción recomendada y listarla como supuesto en el reporte. Tarea **chica** si se retoma con el pedido + `git diff` (directo); **grande** si no (`tasks/todo.md` con L1 literal, Specs, Tasks con riesgo y Log; tarea por tarea; commits de ~400 líneas). Revisión según riesgo trivial / medio / alto (§13.2, §13.3).
5. **Autocompactar.** Al cerrar fase o antes de una tarea nueva: estado en `tasks/todo.md` y proponer compactar con foco (Claude Code: `/compact Conservar: decisiones, archivos tocados, pendientes`; el agente no puede correrlo solo). Tarea nueva sin relación: proponer `/clear`. Nunca con un cambio a medio aplicar ni con pregunta pendiente. §14.4.
6. **Graphify sin ceremonia.** Sin paso de arranque ni de cierre: el hook git actualiza el grafo en cada commit. Buscar por nombre con `grep` / `Glob`; `graphify query` solo para preguntas de flujo sin nombre conocido, con `graphify update .` justo antes. §14.5.
7. **Herramientas del agente, siempre.** ponytail (código mínimo; `ponytail-review` sobre el diff en todo cambio no trivial, §13.3); agent-skills por fase; en cada área, además de estas reglas, la skill externa que le toca según la tabla de [§14.9](./references/14-agent-efficiency.md#149-skills-externas-por-área) (gana la regla del repo); claude-code-setup en repos sin setup. Si falta una, instalarla y avisar en una línea. §14.8.
8. **Seguridad siempre (Red + Blue Team).** Todo cambio pasa §11.1 antes de entregarse; riesgo alto suma revisión ofensiva profunda (§13.3). Nunca desactivar protecciones (validación de token, roles, TLS, parametrización). Nunca secretos en código ni en `appsettings*.json`. Toda vulnerabilidad se reporta, aunque esté fuera de alcance. "Auditá" a secas o pedido de seguridad ("auditá la seguridad", "¿es segura la app?", "pentest"): auditoría completa red + blue + network de §11.6, corrigiendo lo que esté en alcance. Pregunta sobre algo concreto ("¿es seguro X?") o pedido de solo lectura: solo reporte con fix propuesto y cobertura de la parte preguntada (sus áreas de la tabla), `security-audit` en modo guía, `claude-security` (escaneo multiagente, caro) solo con pedido explícito o si el usuario acepta su costo, también en la auditoría completa (§11.6 paso 5). **Auditoría de dependencias siempre**: una vez por sesión, en la primera tarea no trivial, tras cada cambio de paquetes y antes de entregar si se tocaron paquetes; reportar todo hallazgo (§11.4). [11](./references/11-security.md).
9. **Archivos de IA en `.gitignore`.** Al empezar en un proyecto, verificar que excluya todo lo de IA y agentes (`.claude/`, `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `graphify-out/`, `tasks/todo.md`, etc.) y agregar lo que falte en la primera tarea no trivial (tarea trivial: avisar en una línea). Preguntar antes de `git rm --cached`. §13.9.
10. **Auditar = control de calidad completo.** Todo pedido de auditoría (solución completa, proyecto, feature o diff; sin alcance, la solución completa) revisa calidad, legibilidad y mantenimiento, escalabilidad, eficiencia, código duplicado y sin uso, e instrucciones de agentes con `/claude-api prompt-audit` (§13.10). Cada candidato verificado contra uso dinámico (assembly scanning, reflexión, mapeo por nombre); reporte con cobertura por área y `archivo:línea`. Corrige en tandas chicas sin cambiar comportamiento y con `dotnet test` en verde: borra lo sin uso, unifica duplicados, optimiza; pregunta antes solo contratos públicos, esquema o refactors grandes. "Auditá" a secas suma la auditoría de seguridad completa de §11.6 (regla 8); solo seguridad corre solo §11.6; solo calidad ("optimizá", "limpiá") suma la seguridad base (§11.1, §11.4).
11. **Ciclo de trabajo.** Supuestos tomados sin preguntar: en una línea. Cada task con criterio de hecho ejecutable antes de programarla; dos fuentes que se contradicen se muestran y se pregunta, nunca se promedian; lo que responde un comando no lo responde el modelo; el reporte da tests pasados / fallados / salteados; warnings y tests se juzgan por fallas nuevas; 3 intentos fallidos sobre el mismo error = parar y reportar el bloqueo; al retomar, `Estado` de `tasks/todo.md` contra `git log` y `dotnet build` (§13.2, §13.3, §13.6, §13.7). El reporte final lista las decisiones que el pedido no fijaba y qué cubrió y qué no cada chequeo en verde. Toda corrección del usuario se registra en `tasks/lessons.md`, que se lee al arrancar (§13.8). Antes del reporte final de un cambio no trivial: la revisión de su riesgo (`ponytail-review` como mínimo; riesgo alto, como auth, pipeline de `Program.cs`, SQL DDL o `.csproj`: la fila completa de §13.3) y la skill de §14.9 del área; lo que se salteó se dice.

`§14.x` está en [14-agent-efficiency.md](./references/14-agent-efficiency.md); cada `§N.x`, en `references/NN-*.md`. Leer solo la sección necesaria.

---

## 0. Stack y supuestos del proyecto

- **.NET 10 LTS** (`net10.0`), C# 14, `Nullable` e `ImplicitUsings` habilitados en todos los proyectos. Paquetes `Microsoft.*` (`Extensions`, `AspNetCore`, `EntityFrameworkCore`) en 10.x, alineados con el TFM.
  - Repo en `net8.0`: seguir su TFM y paquetes 8.x. Migrar de TFM solo con pedido explícito (cambio de proyecto, no de feature). Sin features de C# 13/14 sobre `net8.0`.
- **ASP.NET Core Web API** con controllers (`ControllerBase` + `[ApiController]`). No introducir Minimal APIs en un repo con controllers; si el repo ya usa Minimal APIs, seguir su forma ("El repo manda sobre la forma").
- **Versionado por URL**: `Asp.Versioning.Mvc` (+ `.ApiExplorer` con `SubstituteApiVersionInUrl = true` para que el OpenAPI muestre `v1`; con la versión en la URL, `AssumeDefaultVersionWhenUnspecified` no aplica; con `Microsoft.AspNetCore.OpenApi`, `Asp.Versioning.OpenApi` + `MapOpenApi().WithDocumentPerVersion()`) → `api/v{version:apiVersion}/[controller]/[action]`, default `1.0`.
- **Mediator propio** (`Application/Mediator`: `IMediator`, `IRequest<T>`, `IRequestHandler<TRequest,T>`). **No** MediatR.
- **FluentValidation 12** (`AddValidatorsFromAssembly`, invocado vía `Guard`). Cultura `es`.
- **Dapper** + `Microsoft.Data.SqlClient` + `Dapper.SqlBuilder` sobre SQL Server por defecto. **EF Core 10** solo en repos que ya tienen `DbContext`. No migrar de uno a otro ni mezclarlos en un feature sin pedido.
- **Cache**: `IMemoryCache` vía `ICacheService`; Redis (`StackExchangeRedis`) opcional por flag. Decorators con **Scrutor**.
- **HTTP saliente**: typed clients (`AddHttpClient<IX, X>`) + **Polly** (`RetryPolicy`) + `Corp.Extensions.HttpClient`.
- **Config y secretos**: `appsettings.{Env}.json` + **Azure Key Vault** (`Azure.Extensions.AspNetCore.Configuration.Secrets`).
- **Observabilidad**: `Corp.Artifact.Observability` (`ICorpLoggerHandler`) + OpenTelemetry. **No** Serilog.
- **Auth**: token corporativo validado por `ValidateTokenFilter` (`ICorpAuthHttpService.IsValidAsync`) + `[RoleAuthorization(Roles.X)]` por action.
- **OpenAPI**: `Microsoft.AspNetCore.OpenApi` (`AddOpenApi` / `MapOpenApi`, OpenAPI 3.1) + Swagger UI, solo fuera de Producción. Swashbuckle solo donde ya existe.
- **Tests**: xUnit + Moq + `Assert` nativo; E2E con `WebApplicationFactory<Program>`. CI corre solo `UnitTest` (§10.2).
- **CI/CD**: Azure DevOps (`*-<Proyecto>.yml` por ambiente): restore feed privado, dependency-check, SonarCloud, build, test con coverage, artifact zip. Sin Docker.

---

## Índice de referencias

Leer solo la referencia (y la sección `§N.x`) que corresponde a la tarea.

| Archivo | Temas | Cuándo leerlo |
| :--- | :--- | :--- |
| [01-solution-structure.md](./references/01-solution-structure.md) | Capas, ubicación, naming, límites de tamaño. | Al crear archivos o carpetas, o si algo supera el límite de líneas. |
| [02-csharp-design.md](./references/02-csharp-design.md) | Records, nullable, async, concurrencia (I/O vs CPU, `WhenAll` con tope), UTC, `decimal`. | Al escribir cualquier código C#. |
| [03-controllers.md](./references/03-controllers.md) | Rutas, roles, `[ProducesResponseType]`, verbos e idempotencia (`Idempotency-Key`), códigos. | Al crear o modificar un endpoint. |
| [04-mediator-handlers.md](./references/04-mediator-handlers.md) | Request `record`, handler `internal`, `null` → 204. | Al crear o modificar un caso de uso. |
| [05-data-access-dapper.md](./references/05-data-access-dapper.md) | `UnitOfWork`, SQL parametrizado, `SqlBuilder`, SP, bulk, cache, consultas lentas: plan e índices (§5.4). | Al tocar repositorios, SQL, transacciones o cache, o ante una consulta lenta. |
| [06-validation.md](./references/06-validation.md) | `AbstractValidator`, reutilizables, paginado, fechas. | Al crear o modificar un request de entrada. |
| [07-errors-responses.md](./references/07-errors-responses.md) | Excepciones, `ProblemDetails`, `PagedResponse<T>`. | Al manejar errores o definir respuestas. |
| [08-configuration-di-secrets.md](./references/08-configuration-di-secrets.md) | Options, secretos, DI, lifetimes, flags. | Al tocar `Program.cs`, `appsettings` o DI. |
| [09-http-integrations.md](./references/09-http-integrations.md) | Typed `HttpClient`, timeout, Polly, certificados. | Al integrar un sistema externo. |
| [10-logging-tests.md](./references/10-logging-tests.md) | Logging (logger corporativo o `ILogger` + `[LoggerMessage]`), qué no se loguea, liveness / readiness, xUnit + Moq, E2E, pruebas de carga (§10.3). | Al loguear, escribir tests, verificar una tarea o afirmar rendimiento. |
| [11-security.md](./references/11-security.md) | Red/Blue Team, OWASP API, dependencias, auditoría completa (§11.6), JWT, policies, CORS, rate limiting, IdP propio, LDAP y migración de auth (§11.7). | Siempre: todo cambio y code review; §11.6 si se pide seguridad a secas. |
| [12-tech-debt.md](./references/12-tech-debt.md) | Patrones existentes que no se copian ni se arreglan sin pedido. | Al tocar código existente. |
| [13-workflow-orchestration.md](./references/13-workflow-orchestration.md) | Plan, verificación, commits, alcance, preguntas, sobreingeniería, lecciones, `.gitignore`, auditoría de código sin usar y duplicado (§13.10), gotchas de build y entorno (§13.11). | En toda tarea no trivial y en todo pedido de auditoría. |
| [14-agent-efficiency.md](./references/14-agent-efficiency.md) | Caveman, librerías, subagentes, advisor, compactar, graphify (fallos), agente, herramientas, skills externas por área (§14.9). | Cuando una regla del modo de operación remite a una §14.x: leer solo esa sección. |
| [15-data-access-ef-core.md](./references/15-data-access-ef-core.md) | `DbContext`, `AsNoTracking`, N+1, `FromSql`, migraciones. | Al tocar datos en un repo con EF Core. |
| [16-signalr-hubs.md](./references/16-signalr-hubs.md) | Hub delgado, `IHubContext` tras commit, auth, grupos (BOLA), IIS. | Al crear o tocar un hub o eventos en tiempo real. |
| [17-contrato-openapi.md](./references/17-contrato-openapi.md) | Respuestas tipadas, `operationId`, enums, fechas, cambios aditivos, deploy con pestañas abiertas (`426` + `X-App-Version`, §17.12). | Solo si la API ya expone OpenAPI/Swagger: al crear, cambiar o versionar un endpoint; §17.12 en todo deploy que cambie el contrato. |
| [18-stored-procedures-sql.md](./references/18-stored-procedures-sql.md) | SP con Dapper/ADO.NET, T-SQL seguro, TVP, permisos. | Solo si el proyecto ya usa stored procedures o ADO.NET crudo. |
| [19-migracion-dotnet.md](./references/19-migracion-dotnet.md) | Inventario, orden, `Startup` → `Program`, Newtonsoft, qué hacer si falla. | Solo si el usuario pide subir el target framework a net10. |
| [20-librerias-nuget-ci.md](./references/20-librerias-nuget-ci.md) | Paquete NuGet, Azure DevOps YAML, Dockerfile. | Solo si el repo publica un paquete NuGet o tiene pipelines/Dockerfile. |
| [checklists.md](./references/checklists.md) | Do & Don't; código, seguridad, proceso. | Antes de entregar código o al revisar un PR. |

---

## Antes de entregar

Releer el diff como un revisor que no vio la tarea: los errores que quedan suelen estar en lo que nadie pidió mirar.

1. **Alcance.** Nada que el pedido no nombre (campos, headers, configuración, refactors de al lado): cada agregado es código que alguien mantiene. Si cambia el contrato con el front, se documenta donde el repo documenta la integración y se avisa (§17.8).
2. **Corrección.** Casos borde y de error recorridos. Todo "chequear y después hacer" sobre estado compartido (contadores, saldos, estados) es atómico (lock, transacción o `UPDATE ... WHERE`): dos pedidos a la vez pasan juntos el chequeo. Ningún `catch` traga en silencio: se loguea con contexto (aunque después se reintente) o se deja subir, porque un error invisible no se arregla nunca. La garantía va en el código, no en un comportamiento del SO (que Windows no deje borrar un archivo abierto, por ejemplo): en otro entorno desaparece.
3. **Seguridad.** §11.1 sobre lo tocado; riesgo alto, la fila completa de §13.3. Auth incluye PIN, contraseñas, OTP y sesiones; borrar datos incluye archivos del usuario. En riesgo alto (lo decide qué toca, no el tamaño del diff: 4 archivos que borran archivos del usuario son riesgo alto), la revisión es parte de terminar, no un extra ni algo que se ahorra: cargar `security-audit` en modo guía (una skill, barata) y pasar `revisor-checklist-backend` (auth, JWT, OIDC o CORS: también `revisor-auth`); si el agente no puede lanzar subagentes, recorrer [checklists.md](./references/checklists.md) completo. Lo que marquen (MEDIO o más) se corrige antes del reporte; sin esa revisión, el reporte lo dice como pendiente bloqueante.
4. **Escalabilidad.** Estado en memoria del proceso (`static`, `ConcurrentDictionary`, `IMemoryCache` como fuente de verdad) solo si la app corre en una instancia, dicho como supuesto; listas paginadas; trabajo pesado fuera del request.
5. **Legibilidad.** Nombres del dominio, métodos cortos con una responsabilidad, el estilo de los archivos vecinos; sin comentarios que repiten el código ni código muerto.
6. **Tests.** Prueban comportamiento y cada caso de error con su campo y mensaje exactos (§10.2). Con estado compartido, un test con pedidos en paralelo. Aislados: carpetas temporales y reloj propios, nunca rutas o datos reales de la app.

Después, [checklists.md](./references/checklists.md): los bloques que toca el cambio (empieza con el Do & Don't).
