## Checklists de verificación y code review

Los usa el orquestador antes de entregar y el subagente `revisor-checklist-backend` sobre el diff.
Cada bloque remite a su referencia. Revisar solo los bloques que toca el cambio; seguridad y proceso, siempre.

### Estructura y C# ([01](./01-solution-structure.md), [02](./02-csharp-design.md))

- [ ] Una clase por archivo, archivo = nombre de la clase, carpeta = namespace.
- [ ] Límites de tamaño: controller y handler 150 líneas, repositorio 250, clase 300, método 40.
- [ ] Capas respetadas: Api → Application → Domain; Infrastructure implementa interfaces de Application.
- [ ] Primary constructors; requests y DTOs inmutables como `record`.
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

- [ ] Lecturas con `AsNoTracking()` + `Select` al DTO; métodos async con `CancellationToken`.
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
- [ ] `dotnet build` limpio + `dotnet test` de UnitTest verde (o se dijo por qué no se corrió).

### Seguridad ([11](./11-security.md), [12](./12-tech-debt.md))

- [ ] Revisión Red Team §11.1 hecha sobre cada endpoint o cambio.
- [ ] Cambio revisado con la skill `security-audit` en modo guía (§11.5), o avisado que no está instalada.
- [ ] Auditoría de dependencias §11.4 corrida después del último cambio de paquetes; hallazgos reportados.
- [ ] Ninguna protección desactivada (token, roles, TLS, CORS, cabeceras).
- [ ] Deuda de §12 no copiada en código nuevo.
- [ ] Vulnerabilidades encontradas reportadas en prosa normal, aunque estén fuera del alcance.

### Proceso del agente ([13](./13-workflow-orchestration.md), [14](./14-agent-efficiency.md))

- [ ] Paso 0 hecho; exploración empezó con `graphify query`; `graphify update .` al final (§14.5).
- [ ] Código existente y sus usos leídos antes de editar (§13.1).
- [ ] Tarea de 3+ pasos con plan previo en `tasks/todo.md` (§13.2).
- [ ] Dudas que cambian el resultado preguntadas juntas, antes de empezar, con opción recomendada (§13.6).
- [ ] Sin ampliar alcance: deuda de §12 reportada, no arreglada sin pedido (§13.5).
- [ ] Sin sobreingeniería: cada clase, método y parámetro nuevo tiene un uso hoy (§13.7.1).
- [ ] Delegación solo si ahorra tokens (3+ archivos a leer, 8+ a editar) (§14.3.4).
- [ ] Todo resultado de un ejecutor revisado por el modelo fuerte antes de entregarlo (§14.3.5).
- [ ] Estado en `tasks/todo.md` y contexto compactado al cerrar cada fase (§14.4).
- [ ] Corrección del usuario registrada en `tasks/lessons.md` (§13.8).
- [ ] Respuestas en caveman, reporte final ≤ ~8 viñetas con links `archivo:línea` (§14.1).
- [ ] `.gitignore` cubre archivos de IA y `graphify-out/` (§13.9).
