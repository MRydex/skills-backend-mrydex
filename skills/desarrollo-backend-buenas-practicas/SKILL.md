---
name: desarrollo-backend-buenas-practicas
version: 1.3.0
description: >
  Convenciones oficiales del equipo para APIs backend .NET 10 (ASP.NET Core) con Clean Architecture (Api / Application / Domain / Infrastructure), con seguridad por defecto (Red Team / Blue Team, OWASP Top 10 y OWASP API Top 10): controllers delgados versionados por URL, mediator propio (IRequest / IRequestHandler), requests como records, primary constructors, FluentValidation con Guard, excepciones tipadas + IExceptionHandler + ProblemDetails, Dapper con SQL parametrizado, DbSession / UnitOfWork para transacciones, repositorios Command / Query separados, cache por decorator (Scrutor, IMemoryCache / Redis), typed HttpClient con Polly, Options pattern con ValidateOnStart, secretos en Azure Key Vault, observabilidad corporativa, CancellationToken de punta a punta, tests xUnit + Moq, pipelines Azure DevOps con SonarCloud. Usar siempre, antes de la primera herramienta, ante cualquier pedido en un proyecto backend .NET (repos con *.sln / *.csproj / Program.cs): preguntas, explicaciones, revisión, depuración o cambios en C#, SQL, appsettings, pipelines o tests, aunque el usuario no mencione .NET explícitamente. Define además cómo trabaja el agente: modo caveman, modelo fuerte que orquesta y revisa con subagentes baratos, graphify, autocompactación y preguntas previas.
---

# Desarrollo Backend — Buenas Prácticas del Equipo (.NET 10)

Convenciones **obligatorias** del equipo para APIs ASP.NET Core, más las reglas de cómo trabaja el agente. Ejecutar primero el Paso 0 (graphify); después leer las 8 reglas y el modo de operación; el stack (§0) vive en este archivo y todo el detalle en `references/`, un archivo por tema (ver Índice de referencias). Leer solo la referencia que pide la tarea.

> **Regla maestra**: si hay una forma moderna y segura soportada por .NET 10 (primary constructors, records, `IExceptionHandler`, `ProblemDetails`, Options pattern con `ValidateOnStart`, typed `HttpClient`, `CancellationToken`, `CommandDefinition` de Dapper), **siempre usarla**. Cualquier uso de la forma legacy debe estar justificado por interoperabilidad con código existente y documentado en el PR.

> **Regla de alcance de la skill**:
> - Los ejemplos de esta skill son **convenciones**, no el código del proyecto. Nunca describir la app
>   con los ejemplos de la skill: responder solo con lo que existe en el repo (`archivo:línea`). Si algo
>   no está en el repo, decirlo.
> - Las reglas aplican al código que se escribe o modifica. Nombres y APIs de paquetes externos
>   (NuGet públicos, paquetes `Corp.*` del feed privado) no se juzgan ni se renombran.
> - `Corp` es un **placeholder** del prefijo de la empresa (`Corp.*`, `ICorpLoggerHandler`,
>   `ICorpAuthHttpService`), igual que `MainDb`. En el repo, usar los nombres reales que ya existen.
> - La skill no es motivo para negarse a lo pedido. Hacer lo que pide el usuario con las convenciones
>   de la skill; si la skill sugiere un enfoque mejor, proponerlo en una línea y dejar que el usuario
>   decida. Única excepción: seguridad ([§11](./references/11-security.md)).
> - Deuda técnica conocida ([§12](./references/12-tech-debt.md)) **no se repite** en código nuevo, pero tampoco se arregla fuera del
>   alcance pedido: se reporta en una línea.

> **Regla de simplicidad**: la solución más simple que resuelve lo pedido. Sin abstracciones, capas,
> genéricos, interfaces de un solo uso "para testear", patrones ni paquetes "por si acaso": se abstrae
> recién cuando el código aparece por segunda vez. Nada de Repository genérico, AutoMapper, MediatR,
> Result<T> ni CQRS con buses nuevos si el repo no los usa.

---

### Paso 0 — Arranque de graphify (obligatorio, antes de cualquier otra acción)

Primera acción de cada sesión, en cualquier repo, **antes** de buscar, leer o editar código. No es
opcional ni se saltea "porque la tarea es chica". Sin preguntar:

```bash
graphify --help 2>&1 | head -3   # ¿existe? ¿warning de versión?
graphify hook status             # ¿hooks git instalados?
graphify update .                # grafo al día (solo código, sin LLM, sin costo)
```

| Resultado | Acción |
| :--- | :--- |
| `command not found` | `pip install graphifyy && graphify install` (`--platform <agente>` fuera de Claude Code) |
| `warning: skill is from graphify X, package is Y` | `pip install --upgrade graphifyy && graphify install` |
| `post-commit: not installed` | `graphify hook install` |
| `graphify update .` falla porque no hay grafo | `/graphify .` dentro del asistente (build completo) |
| La salida dice `Rebuild failed`, `worker failed` o `Nothing to update or rebuild failed` | Falló aunque el exit code sea 0. Ver "Si algo falla" |

El instalador (`npx github:MRydex/skills-backend-mrydex` dentro del repo) ya deja hechos estos pasos para
todos los agentes, con Claude Code en modo estricto. El Paso 0 se corre igual en cada sesión.

Después: agregar al `.gitignore` lo que haya creado graphify (`graphify-out/`, `.gitattributes` si lo
generó) y avisar en una línea (`graphify OK: vX, N nodos`).

**Si algo falla**: **siempre avisar al usuario** con el comando, el error exacto y la causa probable.
Nunca seguir en silencio. Causas conocidas:

- Sin Python/pip → instalar Python 3.10+ y repetir el Paso 0.
- `[Errno 2] No such file or directory` en `graphify-out/cache` (Windows) → ruta demasiado larga
  (MAX_PATH). Proponer ruta corta o `LongPathsEnabled` (requiere admin). El usuario decide.
- Sin repo git → no hay hooks: el grafo se actualiza solo con `graphify update .` manual.

**Durante la tarea**: la primera búsqueda sobre el código es siempre `graphify query "<pregunta>"`.
`grep`, `Glob` o leer archivos para explorar sin consulta previa al grafo es una violación de la skill.
Única excepción: el usuario nombró el archivo y la línea exactos. **Después de editar cualquier
archivo**: `graphify update .` antes de la respuesta final.

---

### Las 8 reglas que más se violan (leer siempre)

1. **Controllers delgados.** Un action = recibir el request, `await mediator.Send(request, cancellationToken)` y mapear a `ActionResult`. Nunca lógica de negocio, SQL, `try/catch` ni validación en el controller. Por qué: la lógica en el controller no se testea con el handler y duplica reglas. Ver [§3](./references/03-controllers.md).
2. **`CancellationToken` de punta a punta.** Todo action recibe `CancellationToken cancellationToken` y lo pasa a `mediator.Send`, handler, repositorio (`CommandDefinition(..., cancellationToken: ...)`) y `HttpClient`. Nunca `CancellationToken.None` salvo en background sin request. Ver [§3](./references/03-controllers.md) y [§5](./references/05-data-access-dapper.md).
3. **Nunca SQL concatenado con input.** Siempre parámetros (`@param` + objeto anónimo / `DynamicParameters`, o `FromSql` interpolado en EF) o `Dapper.SqlBuilder` / `Where` compuesto para filtros dinámicos. `ORDER BY` / nombres de columna dinámicos solo desde una whitelist. Ver [§5](./references/05-data-access-dapper.md) y [§11](./references/11-security.md).
4. **Validar antes de tocar datos.** Todo request de escritura tiene su `AbstractValidator<TRequest>` en `Dtos/<Feature>Dtos/Validators/` y el handler llama `Guard.AgainstInvalidSpecification(validator, request)` como primera línea. Mensajes en `Domain/Structs/ErrorMessage.cs`, nunca literales sueltos. Ver [§6](./references/06-validation.md).
5. **Errores con excepciones tipadas, respuesta con `ProblemDetails`.** Lanzar `SystemValidationException` / `NotFoundException` / `CommandException` / `QueryException` / `ExternalApiException`; el `IExceptionHandler` correspondiente arma el `ProblemDetails` y loguea. Nunca devolver `BadRequest("texto")`, nunca `catch` vacío, nunca exponer `ex.Message` / stack trace al cliente. Ver [§7](./references/07-errors-responses.md).
6. **Transacción solo vía `IUnitOfWork`.** Escrituras multi-tabla: `BeginTransaction` → repos de comando → `Commit`, con `Rollback` garantizado. Nunca abrir `SqlConnection` / `SqlTransaction` a mano en un handler. Ver [§5](./references/05-data-access-dapper.md).
7. **Nunca secretos en código ni en `appsettings*.json`.** `appsettings` guarda el **nombre** del secreto; el valor sale de Azure Key Vault (`configuration[secretName]`). Nunca loguear tokens, connection strings, CBU/CVU completos ni PII. Ver [§8](./references/08-configuration-di-secrets.md) y [§11](./references/11-security.md).
8. **Nunca archivos monolíticos ni capas cruzadas.** Una clase por archivo (archivo = nombre de la clase). Máximo: controller 150 líneas, handler 150, repositorio 250, clase cualquiera 300. Dependencias solo hacia adentro: Api → Application → Domain; Infrastructure implementa interfaces de Application. Domain no referencia nada. Ver [§1](./references/01-solution-structure.md) y [§2](./references/02-csharp-design.md).

---

### Modo de operación del agente

Rige durante toda la sesión desde que la skill se carga.

0. **Adaptarse al agente y a los modelos en uso.** Todo nombre concreto (Opus, Sonnet, Haiku, `/compact`, `AskUserQuestion`, `SendMessage`, `Agent`) es un **ejemplo**: traducirlo al equivalente del agente en uso. Las reglas no cambian; cambia la sintaxis. Ver [14-agent-efficiency.md](./references/14-agent-efficiency.md) §14.7.
1. **Responder en modo caveman, siempre, conciso y corto.** Frases cortas, sin relleno ni cortesías, sin narrar tool calls. Reporte final: máximo ~8 viñetas; linkear archivos en vez de repetirlos. Términos técnicos, código y errores exactos. Nunca omitir negaciones. Prosa normal solo en advertencias de seguridad, acciones irreversibles, código, commits, PRs y docs.
2. **Librerías: preguntar antes de investigar.** Paquetes `Corp.*` del feed privado: primero otra sesión/agente abierto que los conozca (`ListAgents` + `SendMessage`), después el código que ya los usa en el repo, después los XML docs del paquete en `~/.nuget/packages`, último la web. NuGet públicos: MCP de docs → Microsoft Learn → web. Ver §14.2.
3. **El modelo seleccionado orquesta; delega solo si ahorra tokens.** Delegar búsquedas y lecturas grandes (3+ archivos, logs de build, salida de `dotnet test`, docs) y ediciones mecánicas en 8+ archivos a subagentes baratos. Tareas chicas, decisiones y revisión final: las hace el orquestador. Regla práctica: si lo que habría que leer es 3 veces o más lo que hace falta saber, delegar. Subagentes del instalador: `investigador`, `ejecutor-backend`, `revisor-checklist-backend`. Contexto compartido en `tasks/brief-<tarea>.md`. El ejecutor no adivina: si se traba devuelve `NECESITA_ADVISOR: <duda>`. Cambios grandes y paralelizables en todo el repo: `/batch` en Claude Code (§14.3.4.1). Ver §14.3.
4. **Preguntar todo antes de empezar.** En tareas no triviales, juntar todas las dudas que cambian el resultado (contrato del endpoint, rol requerido, tabla/SP destino, cache sí/no) y preguntarlas de una vez, con opciones y una recomendada. No preguntar lo que se resuelve leyendo el repo. Ver [13-workflow-orchestration.md](./references/13-workflow-orchestration.md) §13.6.
5. **Autocompactar el contexto.** Al cerrar cada fase: estado en `tasks/todo.md` y `/compact Conservar: decisiones, archivos tocados, pendientes`. Nunca con un cambio a medio aplicar ni con una pregunta pendiente. Ver §14.4.
6. **Graphify primero.** Paso 0 al empezar. `graphify query` antes de `grep` o leer archivos. `graphify update .` después de editar y antes de compactar. Ver §14.5.
7. **Seguridad siempre (Red Team + Blue Team).** Todo cambio pasa la revisión de [§11.1](./references/11-security.md) antes de entregarse. Nunca desactivar protecciones (validación de token, roles, validación TLS, parametrización). Toda vulnerabilidad encontrada se reporta, aunque esté fuera del alcance. **Auditoría de dependencias siempre** (§11.4): al empezar en un proyecto, después de cada cambio de paquetes y antes de entregar.
8. **Archivos de IA en `.gitignore`.** Verificar que `.gitignore` excluya `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `graphify-out/`, `tasks/todo.md`, `tasks/lessons.md`. Agregar lo que falte. Preguntar antes de `git rm --cached`. Ver §13.9.

Cada `§N.x` vive en `references/NN-*.md` (ver Índice de referencias): leer solo la sección que hace falta.

---

## 0. Stack y supuestos del proyecto

- **.NET 10 LTS** (`net10.0`), C# 14, `Nullable` y `ImplicitUsings` habilitados en todos los proyectos.
  - Paquetes `Microsoft.*` (`Extensions`, `AspNetCore`, `EntityFrameworkCore`) en 10.x, alineados con el TFM.
  - Repo todavía en `net8.0`: seguir su TFM y sus paquetes 8.x. Migrar de TFM solo con pedido explícito
    (es un cambio de proyecto, no de feature). Las features de C# 13/14 no se usan sobre `net8.0`.
- **ASP.NET Core Web API** con controllers (`ControllerBase` + `[ApiController]`). Sin Minimal APIs en proyectos existentes.
- **Versionado por URL**: `Asp.Versioning.Mvc` → `api/v{version:apiVersion}/[controller]/[action]`, default `1.0`.
- **Mediator propio** (`Application/Mediator`: `IMediator`, `IRequest<T>`, `IRequestHandler<TRequest,T>`). **No** MediatR.
- **FluentValidation 12** (validadores registrados con `AddValidatorsFromAssembly`, invocados vía `Guard`). Cultura `es`.
- **Dapper** + `Microsoft.Data.SqlClient` + `Dapper.SqlBuilder` sobre SQL Server por defecto ([§5](./references/05-data-access-dapper.md)). **EF Core 10** solo en repos que ya tienen un `DbContext` ([§15](./references/15-data-access-ef-core.md)). No migrar de uno a otro ni mezclarlos en un feature sin pedido.
- **Cache**: `IMemoryCache` vía `ICacheService`; Redis (`StackExchangeRedis`) opcional por flag de config. Decorators con **Scrutor**.
- **HTTP saliente**: typed clients (`AddHttpClient<IX, X>`) + **Polly** (`RetryPolicy`) + `Corp.Extensions.HttpClient`.
- **Config y secretos**: `appsettings.{Env}.json` + **Azure Key Vault** (`Azure.Extensions.AspNetCore.Configuration.Secrets`).
- **Observabilidad**: `Corp.Artifact.Observability` (`ICorpLoggerHandler`) + OpenTelemetry. **No** Serilog.
- **Auth**: token corporativo validado por `ValidateTokenFilter` (`ICorpAuthHttpService.IsValidAsync`) + `[RoleAuthorization(Roles.X)]` por action.
- **OpenAPI**: `Microsoft.AspNetCore.OpenApi` (`AddOpenApi` / `MapOpenApi`, OpenAPI 3.1) + Swagger UI, solo fuera de Producción. Swashbuckle solo en repos que ya lo usan.
- **Tests**: xUnit + Moq + `Assert` nativo; E2E con `WebApplicationFactory<Program>`. CI corre solo `UnitTest`.
- **CI/CD**: Azure DevOps (`*-<Proyecto>.yml` por ambiente): restore feed privado, dependency-check, SonarCloud, build, test con coverage, artifact zip. Sin Docker.

---

## Índice de referencias (progressive disclosure)

| Archivo | Qué cubre | Cuándo leerlo |
| :--- | :--- | :--- |
| [01-solution-structure.md](./references/01-solution-structure.md) | Árbol de la solución por capas, dónde va cada cosa, naming, una clase por archivo, límites de tamaño y cuándo dividir. | Al crear archivos o carpetas, o cuando algo supera el límite de líneas. |
| [02-csharp-design.md](./references/02-csharp-design.md) | Primary constructors, records, nullable, async sin bloqueos, colecciones, fechas UTC, `decimal`, `GlobalUsings`. | Al escribir cualquier código C#. |
| [03-controllers.md](./references/03-controllers.md) | Atributos de clase, rutas por `[action]`, `[RoleAuthorization]`, `[ProducesResponseType]`, verbos y códigos de respuesta. | Al crear o modificar un endpoint. |
| [04-mediator-handlers.md](./references/04-mediator-handlers.md) | Request `record : IRequest<T>`, handler `internal`, `EmptyResult`, `null` → 204, lógica compartida en servicios. | Al crear o modificar un caso de uso. |
| [05-data-access-dapper.md](./references/05-data-access-dapper.md) | `DapperContext` / `DbSession` / `UnitOfWork`, SQL `const` parametrizado, `CommandDefinition`, `SqlBuilder`, SP, bulk, errores SQL, cache por decorator. | Al tocar repositorios, SQL, transacciones o cache. |
| [15-data-access-ef-core.md](./references/15-data-access-ef-core.md) | Cuándo usar EF, `DbContext` y Fluent API, LINQ con `AsNoTracking` + proyección, N+1, `FromSql` seguro, `SaveChangesAsync` vía `IUnitOfWork`, `ExecuteUpdate`, concurrencia, migraciones idempotentes, LINQ en memoria. | Al tocar datos en un repo con EF Core. |
| [06-validation.md](./references/06-validation.md) | `AbstractValidator<TRequest>`, forma vs reglas de base, validadores reutilizables, paginado y rangos de fechas. | Al crear o modificar un request de entrada. |
| [07-errors-responses.md](./references/07-errors-responses.md) | Excepciones tipadas, `IExceptionHandler` por excepción, `ProblemDetails`, éxito sin envelope, `PagedResponse<T>`. | Al manejar errores o definir respuestas. |
| [08-configuration-di-secrets.md](./references/08-configuration-di-secrets.md) | Options con `ValidateOnStart`, `appsettings` con nombres de secretos, DI por capa, lifetimes, feature flags. | Al tocar `Program.cs`, `appsettings` o registros de DI. |
| [09-http-integrations.md](./references/09-http-integrations.md) | Typed `HttpClient`, timeout, Polly solo para transitorios, `ExternalApiException`, tokens de servicio, certificados. | Al integrar un sistema externo. |
| [10-logging-tests.md](./references/10-logging-tests.md) | `ICorpLoggerHandler`, qué nunca se loguea, `traceId`; tests xUnit + Moq, naming, AAA, E2E, verificación final. | Al loguear, escribir tests o verificar una tarea. |
| [11-security.md](./references/11-security.md) | Revisión Red Team (OWASP API Top 10), reglas fijas (CORS, cabeceras, Swagger, rate limiting), Blue Team, auditoría de dependencias, skill `security-audit` de Cloudflare. | En todo cambio, antes de entregar. |
| [12-tech-debt.md](./references/12-tech-debt.md) | Patrones de los repos existentes que el código nuevo no copia ni arregla sin pedido. | Al tocar código existente. |
| [13-workflow-orchestration.md](./references/13-workflow-orchestration.md) | Explorar antes de editar, plan en `tasks/todo.md`, verificación, commits chicos, alcance, preguntas, sin sobreingeniería, lecciones, `.gitignore` de IA. | En toda tarea no trivial. |
| [14-agent-efficiency.md](./references/14-agent-efficiency.md) | Caveman, consulta de librerías, orquestador + subagentes (advisor), autocompactación, graphify, adaptación al agente. | Al delegar, compactar, integrar graphify o trabajar con otro agente. |
| [checklists.md](./references/checklists.md) | Checklists de código, seguridad y proceso del agente. | Antes de entregar y al revisar un diff. |

Grupos: **código** 01–05 y 15 (EF Core) · **contrato de la API** 06–07 · **infraestructura** 08–10 · **seguridad y deuda** 11–12 · **proceso del agente** 13–14.

---

## Verificación rápida (Do & Don't)

```csharp
// ❌ Lógica en controller, sin token, SQL concatenado, error como texto, conexión a mano
[HttpGet]
public async Task<IActionResult> GetBank(string code)
{
    using var cn = new SqlConnection("Server=...;Password=...");
    var bank = await cn.QueryFirstOrDefaultAsync<Bank>($"SELECT * FROM Bank WHERE Code = '{code}'");
    if (bank == null) return BadRequest("No existe el banco");
    return Ok(bank);
}

// ✅ Controller delgado + handler + repo parametrizado + excepción tipada
[HttpGet]
[RoleAuthorization(Roles.BankRead)]
[ProducesResponseType(typeof(BankDto), StatusCodes.Status200OK)]
public async Task<ActionResult<BankDto>> GetBank([FromQuery] GetBankRequest request, CancellationToken cancellationToken)
    => Ok(await mediator.Send(request, cancellationToken));

internal class GetBankHandler(IValidator<GetBankRequest> validator, IBankQueryRepository bankQueryRepository)
    : IRequestHandler<GetBankRequest, BankDto>
{
    public async Task<BankDto> Handle(GetBankRequest request, CancellationToken cancellationToken)
    {
        await Guard.AgainstInvalidSpecification(validator, request);
        return await bankQueryRepository.GetByCodeAsync(request.Code, cancellationToken)
            ?? throw new NotFoundException(ErrorMessage.BankNotFound);
    }
}

// Repo: const sql con columnas explícitas + CommandDefinition
const string sql = "SELECT Code, Name, IsActive FROM dbo.Bank WHERE Code = @Code;";
return await dbSession.Connection.QueryFirstOrDefaultAsync<BankDto>(
    new CommandDefinition(sql, new { Code = code }, cancellationToken: cancellationToken));
```

---

## Antes de entregar

Recorrer [checklists.md](./references/checklists.md): código, seguridad y proceso del agente.
