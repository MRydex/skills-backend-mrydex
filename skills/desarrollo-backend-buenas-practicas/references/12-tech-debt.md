## 12. Deuda técnica conocida (no repetir, no arreglar sin pedido)

Patrones del repo de referencia que el código nuevo no copia. Leer al tocar código existente.

Patrones frecuentes en los repos existentes del equipo. Código nuevo **no** los copia; arreglarlos solo si el usuario lo pide o si la tarea ya toca esa línea, avisando en una línea.

- Controllers sin `CancellationToken` y `mediator.Send(request)` sin token.
- `Mediator` resuelve handlers por reflexión en cada request e invoca `Handle` por string.
- `Guard.AgainstInvalidSpecification` devuelve solo el primer error y no recibe `CancellationToken`.
- `UnitOfWork` con `BeginTransaction` / `Commit` / `Rollback` sincrónicos.
- Query repos que mezclan `DbSession` y `context.CreateConnection...`.
- `ServerCertificateCustomValidationCallback => true` en clientes HTTP de Infrastructure.
- Hubs `[AllowAnonymous]` que identifican al usuario por `?username=` en la query; gateways que loguean `Path + QueryString` (§16).
- CORS con cualquier origen + credenciales; `CustomSecurityHeaderMiddleware` existe pero no está registrado.
- `configuration.GetValue<>` directo en DI y filtros en vez de Options.
- Paquetes `Microsoft.Extensions.*` de una versión mayor distinta al TFM (ej. 9.x/10.x sobre `net8.0`).
- Constantes en `struct` en vez de `static class`; typos en nombres de métodos, clases y carpetas.
- `ConfigureAwait(false)` aislado en algunos clientes; `async/await` innecesario en passthrough de decorators.
- Claves de `appsettings` con espacios o typos.
- MediatR y AutoMapper en repos legacy: se respetan en ese repo, no se agregan a uno nuevo.
- Validación con `new XValidator().Validate(request)` dentro del handler en vez de `IValidator<T>` inyectado + `Guard`.
- Constructores clásicos con campos `_x` mezclados con primary constructors; requests `class` con `init` en vez de `record`.
- `ProblemDetails` propio que duplica el de ASP.NET; `WebExceptionPresenter` por reflexión en vez de `IExceptionHandler`.
- Ambiente por clave propia (`AppConfiguration:Environment == "DEV"`) en vez de `IHostEnvironment`.
- `Newtonsoft.Json` junto a `System.Text.Json`.
- `SmtpClient` sin `using` y HTML del mail con input del usuario sin encode.
- `connection.BeginTransaction()` manual en repos en vez de `UnitOfWork`.
- Query inline con `QueryAsync(sql, params)` sin `CommandDefinition`, `CancellationToken` ni timeout; `catch (Exception)` genérico en repos.
- `KeyVault:ClientSecret` o connection strings en `appsettings.json` versionado.
- Registros duplicados en DI.
