## Checklists de verificación y code review

Los usa el orquestador antes de entregar y el subagente `revisor-checklist-backend` sobre el diff.
Cada bloque remite a su referencia. Revisar solo los bloques que toca el cambio; seguridad y proceso, siempre.

### Verificación rápida (Do & Don't)

```csharp
// ❌ Lógica en controller, sin token, SQL concatenado, error como texto, conexión a mano
[HttpGet]
public async Task<IActionResult> GetItem(string code)
{
    using var cn = new SqlConnection("Server=...;Password=...");
    var item = await cn.QueryFirstOrDefaultAsync<Item>($"SELECT * FROM Item WHERE Code = '{code}'");
    if (item == null) return BadRequest("No existe el ítem");
    return Ok(item);
}

// ✅ Controller delgado + handler + repo parametrizado + excepción tipada
[HttpGet]
[RoleAuthorization(Roles.ItemRead)]
[ProducesResponseType(typeof(ItemResponse), StatusCodes.Status200OK)]
public async Task<ActionResult<ItemResponse>> GetItem([FromQuery] GetItemRequest request, CancellationToken cancellationToken)
    => Ok(await mediator.Send(request, cancellationToken));

internal class GetItemHandler(IValidator<GetItemRequest> validator, IItemQueryRepository itemQueryRepository)
    : IRequestHandler<GetItemRequest, ItemResponse>
{
    public async Task<ItemResponse> Handle(GetItemRequest request, CancellationToken cancellationToken)
    {
        await Guard.AgainstInvalidSpecification(validator, request);
        return await itemQueryRepository.GetByCodeAsync(request.Code, cancellationToken)
            ?? throw new NotFoundException(ErrorMessage.ItemNotFound);
    }
}

// Repo: const sql con columnas explícitas + CommandDefinition
const string sql = "SELECT Code, Name, IsActive FROM dbo.Item WHERE Code = @Code;";
return await dbSession.Connection.QueryFirstOrDefaultAsync<ItemResponse>(
    new CommandDefinition(sql, new { Code = code }, cancellationToken: cancellationToken));
```

### Estructura y C# ([01](./01-solution-structure.md), [02](./02-csharp-design.md))

- [ ] Una clase por archivo, archivo = nombre de la clase, carpeta = namespace.
- [ ] Límites de tamaño: controller y handler 150 líneas, repositorio 250, clase 300, método 40.
- [ ] Capas respetadas: Api → Application → Domain; Infrastructure implementa interfaces de Application.
- [ ] Primary constructors; requests y responses inmutables como `record`.
- [ ] Contrato con el front: `<Accion><Entidad>Request` lo que entra, `<Entidad>Response` lo que sale, mismo nombre en TypeScript; sin sufijo `Dto`; proyección directa al `Response`, sin AutoMapper. (§1.2)
- [ ] Sin `.Result` / `.Wait()` / `GetAwaiter().GetResult()` / `async void`; métodos async con sufijo `Async`.
- [ ] Sin `!` para callar nullable; sin warnings nuevos en build.
- [ ] Importes en `decimal`; fechas en UTC o `DateTimeOffset`.

### Controller ([03](./03-controllers.md))

- [ ] `[RoleAuthorization]` con el rol mínimo en cada action.
- [ ] `[ProducesResponseType]` con los tipos reales.
- [ ] `CancellationToken` recibido y pasado a `mediator.Send`.
- [ ] Sin lógica, SQL, `try/catch` ni validación.
- [ ] Endpoint nuevo documentado en `Documentacion/<Feature>/`.

### Handler ([04](./04-mediator-handlers.md), [06](./06-validation.md))

- [ ] Request `record : IRequest<T>` con su validador; mensajes de `ErrorMessage`.
- [ ] Handler `internal`; primera línea `Guard.AgainstInvalidSpecification`.
- [ ] No llama a otro handler ni a `mediator.Send`.
- [ ] Paginado con `PageSize` máximo; rangos de fechas validados.

### Datos y cache ([05](./05-data-access-dapper.md))

- [ ] SQL en `const`, parametrizado, esquema y columnas explícitas, sin `SELECT *`.
- [ ] `CommandDefinition` con `transaction:` y `cancellationToken:`.
- [ ] Escrituras multi-sentencia vía `IUnitOfWork` con `Rollback` garantizado.
- [ ] `SqlException` 2627/2601 → `SystemValidationException`; resto → `CommandException` / `QueryException` sin datos sensibles.
- [ ] Cache: decorator + clave en `CacheKey` + invalidación en la escritura.
- [ ] Script SQL idempotente y con rollback si cambia la base.

### EF Core / LINQ ([15](./15-data-access-ef-core.md))

- [ ] Lecturas con `AsNoTracking()` + `Select` al `Response`; métodos async con `CancellationToken`.
- [ ] `IQueryable` no sale del repositorio; sin N+1 ni `AsEnumerable()` antes del filtro.
- [ ] SQL a mano con `FromSql` / `SqlQuery` interpolado; nunca `FromSqlRaw` concatenado.
- [ ] Un `SaveChangesAsync` por handler vía `IUnitOfWork`; masivos con `ExecuteUpdateAsync` / `ExecuteDeleteAsync`.
- [ ] Sin `dbContext.Update(request)`; `DbUpdateException` / concurrencia mapeadas a excepciones tipadas.
- [ ] Migración con script `--idempotent` en el PR; nada de `Database.Migrate()` al arrancar.

### Errores, config e integraciones ([07](./07-errors-responses.md), [08](./08-configuration-di-secrets.md), [09](./09-http-integrations.md))

- [ ] Errores solo por excepción tipada → `ProblemDetails`; excepción nueva con handler y entrada `.resx`.
- [ ] Config por Options con `ValidateOnStart`; secretos solo en Key Vault.
- [ ] Lifetimes correctos; nada `Scoped` dentro de un `Singleton`.
- [ ] HTTP saliente por typed client, con timeout y retry solo en transitorios idempotentes.

### Logging y tests ([10](./10-logging-tests.md))

- [ ] Nada sensible en logs (tokens, connection strings, CBU/CVU/CUIT completos, PII).
- [ ] Handler nuevo o modificado con tests del camino feliz y de sus errores; bug corregido con test que lo reproduce.
- [ ] Naming `<Metodo>_When<Condicion>_Should<Resultado>`, estructura AAA.
- [ ] `dotnet build` limpio; desde riesgo medio, `dotnet test` de UnitTest verde (o se dijo por qué no se corrió) (§13.3).

### Seguridad ([11](./11-security.md), [12](./12-tech-debt.md))

- [ ] Revisión Red Team §11.1 hecha sobre cada endpoint o cambio.
- [ ] Si aplica §11.5, cambio revisado con `security-audit` en modo guía, o avisado que no está instalada.
- [ ] Auditoría de dependencias §11.4 corrida después del último cambio de paquetes; hallazgos reportados.
- [ ] Ninguna protección desactivada (token, roles, TLS, CORS, cabeceras).
- [ ] JWT con audiencia validada contra `ValidAudiences` explícitas, nunca `ValidateAudience = false`. (§11.2)
- [ ] Quién actúa sale solo del token, nunca del body, la query ni la ruta. (§11.1)
- [ ] Deuda de §12 no copiada en código nuevo.
- [ ] Vulnerabilidades encontradas reportadas en prosa normal, aunque estén fuera del alcance.

### Tiempo real / SignalR ([16](./16-signalr-hubs.md))

- [ ] `Hub<TClient>` con `[Authorize]` (roles con `[Authorize(Roles/Policy)]`, no `[RoleAuthorization]`), sin estado en campos ni lógica de negocio. (§16.2, §16.4)
- [ ] Identidad desde claims, nunca desde query string; `access_token` leído solo para `/api/hubs`. (§16.4)
- [ ] Cada `UnirseA...` autoriza contra la base. (§16.4)
- [ ] Eventos publicados con `IHubContext` tipado detrás de una interfaz de Application, después del commit. (§16.3)
- [ ] `KeepAliveInterval` / `ClientTimeoutInterval` desde Options y coordinados con el front; `EnableDetailedErrors` solo en Development. (§16.5)
- [ ] Gateway y middleware sin loguear `QueryString`; hubs excluidos de middleware que toca el body. (§16.6)

### Proceso del agente ([13](./13-workflow-orchestration.md), [14](./14-agent-efficiency.md))

- [ ] Paso 0 hecho; exploración empezó con `graphify query`; `graphify update .` al final (§14.5).
- [ ] Código existente y sus usos leídos antes de editar (§13.1).
- [ ] Tarea clasificada chica/grande; la grande tiene `tasks/todo.md` con L1, Specs, Tasks y Log (§13.2).
- [ ] Revisión según el riesgo del cambio (trivial / medio / alto) (§13.3).
- [ ] Dudas que cambian el resultado preguntadas juntas, antes de empezar, con opción recomendada (§13.6).
- [ ] Sin ampliar alcance: deuda de §12 reportada, no arreglada sin pedido (§13.5).
- [ ] Sin sobreingeniería: cada clase, método y parámetro nuevo tiene un uso hoy (§13.7.1).
- [ ] Delegación solo si ahorra tokens (3+ archivos a leer, 8+ a editar) (§14.3.4).
- [ ] Todo resultado de un ejecutor revisado por el orquestador antes de entregarlo (§14.3.5).
- [ ] Estado en `tasks/todo.md` y compactación propuesta al cerrar cada fase (§14.4).
- [ ] Corrección del usuario registrada en `tasks/lessons.md` (§13.8).
- [ ] Respuestas en caveman (salvo excepciones de seguridad y artefactos persistidos); reporte final corto: qué cambió, qué falló y qué decide el usuario, con links `archivo:línea` (§14.1).
- [ ] `ponytail-review` corrido sobre el diff si el cambio no es trivial (§13.3); herramienta del agente que faltaba instalada y avisada en una línea (§14.8).
- [ ] `.gitignore` cubre archivos de IA y `graphify-out/` (§13.9).
