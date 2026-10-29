---
name: desarrollo-backend-buenas-practicas
description: >
  Convenciones del equipo para APIs backend .NET 10 (ASP.NET Core, Clean Architecture, mediator propio, FluentValidation, ProblemDetails, Dapper / EF Core, Key Vault, seguridad OWASP, xUnit + Moq, Azure DevOps con SonarCloud) y forma de trabajar del agente (caveman, graphify, subagentes). Usar siempre, antes de la primera herramienta, en cualquier repo con *.sln, *.csproj o Program.cs, para cualquier pedido: preguntas, explicaciones, revisión, depuración, refactor o cambios, aunque no mencione .NET. Incluye pedidos sobre endpoints, controllers, handlers, validación o errores; acceso a datos (SQL, stored procedures, transacciones, cache); contrato con el front (Request / Response, mapeo, paginado); configuración (appsettings, Options, secretos); integraciones (HttpClient, Polly); logging, tests o pipelines; seguridad de la API ("auditá la seguridad", "¿es seguro?"); y auditorías ("auditá", "optimizá", "limpiá"): calidad, eficiencia, código duplicado y sin uso.
metadata:
  version: 1.14.3
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

Convenciones **obligatorias** para APIs ASP.NET Core (.NET 10) y reglas de cómo trabaja el agente. Orden: Paso 0 (graphify), reglas, modo de operación. Stack en §0; detalle en `references/`.

> **Regla maestra**: si .NET 10 tiene una forma moderna y segura (primary constructors, records, `IExceptionHandler`, `ProblemDetails`, Options con `ValidateOnStart`, typed `HttpClient`, `CancellationToken`, `CommandDefinition` de Dapper), **siempre usarla**. La forma legacy solo por interoperabilidad con código existente, justificada en el PR.

> **Alcance de la skill**:
> - Las referencias son **convenciones con ejemplos**, no el código del proyecto. Nunca describir la app con los ejemplos: responder solo con lo que existe en el repo (`archivo:línea`); si no está, decirlo.
> - Las reglas aplican al código que se escribe o modifica. Nombres y APIs de paquetes externos (NuGet públicos, `Corp.*` del feed privado) no se juzgan ni se renombran.
> - `Corp` es un **placeholder** del prefijo de la empresa (`Corp.*`, `ICorpLoggerHandler`, `ICorpAuthHttpService`), igual que `MainDb`. En el repo, usar los nombres reales.
> - La skill no es motivo para negarse. Hacer lo pedido con las convenciones; si hay un enfoque mejor, proponerlo en una línea y el usuario decide. Única excepción: seguridad (§11).
> - Deuda técnica conocida (§12) **no se repite** en código nuevo ni se arregla fuera de alcance: se reporta en una línea.

> **Simplicidad**: la solución más simple que resuelve lo pedido. Sin abstracciones, capas, genéricos, interfaces de un solo uso, patrones ni paquetes "por si acaso": se abstrae recién al segundo uso. Nada de Repository genérico, AutoMapper, MediatR, `Result<T>` ni buses nuevos si el repo no los usa (§13.7.1).

---

### Paso 0 — Arranque de graphify (obligatorio, antes de cualquier otra acción)

Primera acción de cada sesión, en cualquier repo, antes de buscar, leer o editar, también en tareas chicas (una consulta al grafo cuesta menos que leer los archivos que reemplaza). Sin preguntar:

```bash
graphify --help 2>&1 | head -3   # ¿existe? ¿warning de versión?
graphify hook status             # ¿hooks git instalados?
graphify update .                # grafo al día (solo código, sin LLM, sin costo)
```

- Falta el CLI → `pip install graphifyy && graphify install`. `warning: skill is from graphify X, package is Y` → `pip install --upgrade graphifyy && graphify install`. Hooks sin instalar → `graphify hook install` + `graphify <agente> install`. Sin grafo → `/graphify .`. Resto de casos y causas conocidas: §14.5 paso 6.
- `graphify update .` puede salir con 0 y haber fallado: si dice `Rebuild failed`, `worker failed` o `Nothing to update or rebuild failed`, es fallo.
- **Si algo falla: siempre avisar** con el comando, el error exacto y la causa probable. Nunca seguir en silencio. Recién después, búsqueda normal. Vale también al actualizar al final (§14.5 paso 5).
- Con el instalador ya está hecho: el chequeo igual se corre. Después: agregar al `.gitignore` lo que creó graphify (§13.9) y avisar en una línea (`graphify OK: N nodos`).

**Durante la tarea**: la primera búsqueda sobre el código es `graphify query`, antes de `grep`, `Glob` o leer archivos. Excepción: el usuario nombró el archivo y la línea exactos.

---

### Las reglas que más se violan (leer siempre)

1. **Controllers delgados.** Action = recibir el request, `await mediator.Send(request, cancellationToken)`, mapear a `ActionResult`. Nunca lógica de negocio, SQL, `try/catch` ni validación en el controller: no se testea con el handler y duplica reglas. [03](./references/03-controllers.md).
2. **`CancellationToken` de punta a punta.** Todo action lo recibe y lo pasa a `mediator.Send`, handler, repositorio (`CommandDefinition(..., cancellationToken: ...)`) y `HttpClient`. Nunca `CancellationToken.None` salvo en background sin request. [03](./references/03-controllers.md), [05](./references/05-data-access-dapper.md).
3. **Nunca SQL concatenado con input.** Siempre parámetros (`@param` + objeto anónimo / `DynamicParameters`, o `FromSql` interpolado en EF) o `Dapper.SqlBuilder` / `Where` compuesto para filtros dinámicos. `ORDER BY` / columnas dinámicas solo desde whitelist. [05](./references/05-data-access-dapper.md), [11](./references/11-security.md).
4. **Validar antes de tocar datos.** Todo request de escritura tiene `AbstractValidator<TRequest>` en `Dtos/<Feature>Dtos/Validators/`; el handler llama `Guard.AgainstInvalidSpecification(validator, request)` como primera línea. Mensajes en `Domain/Structs/ErrorMessage.cs`, nunca literales sueltos. [06](./references/06-validation.md).
5. **Errores con excepciones tipadas, respuesta `ProblemDetails`.** Lanzar `SystemValidationException` / `NotFoundException` / `CommandException` / `QueryException` / `ExternalApiException`; su `IExceptionHandler` arma el `ProblemDetails` y loguea. Nunca `BadRequest("texto")`, nunca `catch` vacío, nunca `ex.Message` / stack trace al cliente. [07](./references/07-errors-responses.md).
6. **Transacción solo vía `IUnitOfWork`.** Multi-tabla: `BeginTransaction` → repos de comando → `Commit`, con `Rollback` garantizado. Nunca `SqlConnection` / `SqlTransaction` a mano en un handler. [05](./references/05-data-access-dapper.md).
7. **Nunca secretos en código ni en `appsettings*.json`.** `appsettings` guarda el **nombre** del secreto; el valor sale de Key Vault (`configuration[secretName]`). Nunca loguear tokens, connection strings, CBU/CVU completos ni PII. [08](./references/08-configuration-di-secrets.md), [11](./references/11-security.md).
8. **Nunca archivos monolíticos ni capas cruzadas.** Una clase por archivo (archivo = clase). Máximo: controller 150 líneas, handler 150, repositorio 250, clase 300. Dependencias hacia adentro: Api → Application → Domain; Infrastructure implementa interfaces de Application; Domain no referencia nada. [01](./references/01-solution-structure.md), [02](./references/02-csharp-design.md).

---

### Modo de operación del agente

Rige toda la sesión desde que la skill se carga. Para sesiones que no tocan .NET: archivos puente en el repo (`--bridge`: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`).

0. **Adaptarse al agente y modelos en uso.** Detectar el agente y los modelos disponibles. Nombres concretos (Opus, Sonnet, Haiku, `/compact`, `AskUserQuestion`, `SendMessage`, `Agent`) son **ejemplos**: traducir al equivalente; si no hay, fallback documentado. Cambia la sintaxis, no la regla. §14.7.
1. **Caveman siempre, conciso y corto.** Todo lo que emite la skill, también reportes de subagentes. Sin relleno ni cortesías. Una línea de estado por fase o paso largo. Reporte final: qué cambió, qué falló y qué decide el usuario; linkear archivos, no repetirlos. Términos técnicos, código y errores exactos. Nunca omitir negaciones. Prosa normal: advertencias de seguridad, acciones irreversibles, pasos cuyo orden la compresión haría ambiguo, cuando el usuario pide aclaración, y en código, commits, PRs y docs. §14.1.
2. **Librerías: preguntar antes de investigar.** `Corp.*`: otra sesión/agente abierto (Claude Code: `ListAgents` + `SendMessage`) → código del repo que ya los usa → XML docs en `~/.nuget/packages` → web. NuGet públicos: MCP de docs → Microsoft Learn → web. §14.2.
3. **El modelo seleccionado orquesta, decide y siempre revisa; delega solo si ahorra tokens.** Delegar búsquedas/lecturas grandes (3+ archivos, logs de build, `dotnet test`, docs) y ediciones mecánicas en 8+ archivos a `investigador`, `ejecutor-backend`, `revisor-checklist-backend` (en 3 archivos delegar costó 38% más, §14.3.4). Regla práctica: delegar si lo que habría que leer es 3 veces o más lo que hace falta saber. Solo por un motivo nombrado (exploración grande, escritores en paralelo, respaldo de contexto, verificador de tarea de riesgo alto); ante la duda, lo hace el orquestador. 5+ unidades independientes en todo el codebase: proponer `/batch <instrucción>`. Contexto compartido en `tasks/brief-<tarea>.md`, con solo las reglas compactas que aplican. El ejecutor no adivina: si se traba devuelve `NECESITA_ADVISOR: <duda>`. El orquestador interviene tras la orientación, cuando el ejecutor se traba y antes de dar por terminado; con advisor nativo activo (`/advisor opus`), consultarlo en esos mismos momentos. §14.3.
4. **Preguntar todo antes de empezar.** En tareas no triviales, juntar las dudas que cambian el resultado (contrato del endpoint, rol, tabla/SP, cache sí/no) y preguntarlas de una vez, con opciones y una recomendada (Claude Code: `AskUserQuestion`). No preguntar lo que resuelve el repo (§13.6). Pedido de solo lectura: no editar. Tarea **chica** si se retoma con el pedido + `git diff` (directo); **grande** si no (`tasks/todo.md` con L1 literal, Specs, Tasks con riesgo y Log; tarea por tarea; commits de ~400 líneas). Revisión según riesgo trivial / medio / alto (§13.2, §13.3).
5. **Autocompactar.** Al cerrar fase o antes de una tarea nueva: estado en `tasks/todo.md` y proponer compactar con foco (Claude Code: `/compact Conservar: decisiones, archivos tocados, pendientes`; el agente no puede correrlo solo). Nunca con un cambio a medio aplicar ni con pregunta pendiente. §14.4.
6. **Graphify primero.** Paso 0 al empezar cada sesión. Toda pregunta sobre el código: `graphify query` antes de `grep` o leer. Tras editar (antes de la respuesta final) o antes de compactar: `graphify update .` (sin LLM). §14.5.
7. **Herramientas del agente, siempre.** ponytail (código mínimo; `ponytail-review` sobre el diff en todo cambio no trivial, §13.3); agent-skills por fase; claude-code-setup en repos sin setup; Headroom: hook `SessionStart` en Claude Code, `headroom wrap <agente>` en otros. Si falta una, instalarla y avisar en una línea. §14.8.
8. **Seguridad siempre (Red + Blue Team).** Todo cambio pasa §11.1 antes de entregarse; riesgo alto suma revisión ofensiva profunda (§13.3). Nunca desactivar protecciones (validación de token, roles, TLS, parametrización). Nunca secretos en código ni en `appsettings*.json`. Toda vulnerabilidad se reporta, aunque esté fuera de alcance. "Auditá" a secas o pedido de seguridad ("auditá la seguridad", "¿es seguro?", "pentest"): auditoría completa red + blue + network de §11.6 (modelo de amenazas, todas las áreas, TLS, superficie expuesta, Azure y SignalR, skills por área `offensive-*` y Anthropic-Cybersecurity-Skills, `security-audit` + `claude-security`, priorizar por OWASP, corregir lo que esté en alcance, cobertura reportada). **Auditoría de dependencias siempre**: al empezar en un proyecto, tras cada cambio de paquetes y antes de entregar si se tocaron paquetes; reportar todo hallazgo (§11.4). [11](./references/11-security.md).
9. **Archivos de IA en `.gitignore`.** Al empezar en un proyecto, verificar que excluya todo lo de IA y agentes (`.claude/`, `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `graphify-out/`, `tasks/todo.md`, etc.) y agregar lo que falte. Preguntar antes de `git rm --cached`. §13.9.
10. **Auditar = control de calidad completo.** Todo pedido de auditoría (solución completa, proyecto, feature o diff; sin alcance, la solución completa) revisa calidad, legibilidad y mantenimiento, escalabilidad, eficiencia, código duplicado y sin uso, e instrucciones de agentes con `/doctor prompt-audit` (§13.10). Cada candidato verificado contra uso dinámico (assembly scanning, reflexión, mapeo por nombre); reporte con cobertura por área y `archivo:línea`. Corrige en tandas chicas sin cambiar comportamiento y con `dotnet test` en verde: borra lo sin uso, unifica duplicados, optimiza; pregunta antes solo contratos públicos, esquema o refactors grandes. "Auditá" a secas suma la auditoría de seguridad completa de §11.6 (regla 8); solo seguridad corre solo §11.6; solo calidad ("optimizá", "limpiá") suma la seguridad base (§11.1, §11.4).

`§14.x` está en [14-agent-efficiency.md](./references/14-agent-efficiency.md); cada `§N.x`, en `references/NN-*.md`. Leer solo la sección necesaria.

---

## 0. Stack y supuestos del proyecto

- **.NET 10 LTS** (`net10.0`), C# 14, `Nullable` e `ImplicitUsings` habilitados en todos los proyectos. Paquetes `Microsoft.*` (`Extensions`, `AspNetCore`, `EntityFrameworkCore`) en 10.x, alineados con el TFM.
  - Repo en `net8.0`: seguir su TFM y paquetes 8.x. Migrar de TFM solo con pedido explícito (cambio de proyecto, no de feature). Sin features de C# 13/14 sobre `net8.0`.
- **ASP.NET Core Web API** con controllers (`ControllerBase` + `[ApiController]`). Sin Minimal APIs en proyectos existentes.
- **Versionado por URL**: `Asp.Versioning.Mvc` → `api/v{version:apiVersion}/[controller]/[action]`, default `1.0`.
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
| [02-csharp-design.md](./references/02-csharp-design.md) | Records, nullable, async, UTC, `decimal`. | Al escribir cualquier código C#. |
| [03-controllers.md](./references/03-controllers.md) | Rutas, roles, `[ProducesResponseType]`, verbos, códigos. | Al crear o modificar un endpoint. |
| [04-mediator-handlers.md](./references/04-mediator-handlers.md) | Request `record`, handler `internal`, `null` → 204. | Al crear o modificar un caso de uso. |
| [05-data-access-dapper.md](./references/05-data-access-dapper.md) | `UnitOfWork`, SQL parametrizado, `SqlBuilder`, SP, bulk, cache. | Al tocar repositorios, SQL, transacciones o cache. |
| [06-validation.md](./references/06-validation.md) | `AbstractValidator`, reutilizables, paginado, fechas. | Al crear o modificar un request de entrada. |
| [07-errors-responses.md](./references/07-errors-responses.md) | Excepciones, `ProblemDetails`, `PagedResponse<T>`. | Al manejar errores o definir respuestas. |
| [08-configuration-di-secrets.md](./references/08-configuration-di-secrets.md) | Options, secretos, DI, lifetimes, flags. | Al tocar `Program.cs`, `appsettings` o DI. |
| [09-http-integrations.md](./references/09-http-integrations.md) | Typed `HttpClient`, timeout, Polly, certificados. | Al integrar un sistema externo. |
| [10-logging-tests.md](./references/10-logging-tests.md) | Logging, qué no se loguea, xUnit + Moq, E2E. | Al loguear, escribir tests o verificar una tarea. |
| [11-security.md](./references/11-security.md) | Red/Blue Team, OWASP API, dependencias, auditoría completa (§11.6). | Siempre: todo cambio y code review; §11.6 si se pide seguridad a secas. |
| [12-tech-debt.md](./references/12-tech-debt.md) | Patrones existentes que no se copian ni se arreglan sin pedido. | Al tocar código existente. |
| [13-workflow-orchestration.md](./references/13-workflow-orchestration.md) | Plan, verificación, commits, alcance, preguntas, sobreingeniería, lecciones, `.gitignore`, auditoría de código sin usar y duplicado (§13.10). | En toda tarea no trivial y en todo pedido de auditoría. |
| [14-agent-efficiency.md](./references/14-agent-efficiency.md) | Caveman, librerías, subagentes, advisor, compactar, graphify (fallos), agente, herramientas. | Siempre: cómo responde el agente y reparte el trabajo. |
| [15-data-access-ef-core.md](./references/15-data-access-ef-core.md) | `DbContext`, `AsNoTracking`, N+1, `FromSql`, migraciones. | Al tocar datos en un repo con EF Core. |
| [16-signalr-hubs.md](./references/16-signalr-hubs.md) | Hub delgado, `IHubContext` tras commit, auth, grupos (BOLA), IIS. | Al crear o tocar un hub o eventos en tiempo real. |
| [checklists.md](./references/checklists.md) | Do & Don't; código, seguridad, proceso. | Antes de entregar código o al revisar un PR. |

---

## Antes de entregar

Recorrer [checklists.md](./references/checklists.md) (empieza con el Do & Don't): código, seguridad y proceso del agente.
