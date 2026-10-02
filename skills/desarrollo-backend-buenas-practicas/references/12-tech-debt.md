## 12. Deuda técnica conocida (no repetir, no arreglar sin pedido)

Patrones del repo de referencia que el código nuevo no copia. Leer al tocar código existente.

Patrones frecuentes en los repos existentes del equipo. Código nuevo **no** los copia; arreglarlos solo si el usuario lo pide o si la tarea ya toca esa línea, avisando en una línea.

- Controllers sin `CancellationToken` y `mediator.Send(request)` sin token.
- `Mediator` resuelve handlers por reflexión en cada request e invoca `Handle` por string.
- `Guard.AgainstInvalidSpecification` devuelve solo el primer error y no recibe `CancellationToken`.
- `UnitOfWork` con `BeginTransaction` / `Commit` / `Rollback` sincrónicos.
- Query repos que mezclan `DbSession` y `context.CreateConnection...`.
- `ServerCertificateCustomValidationCallback => true` en clientes HTTP de Infrastructure.
- CORS con cualquier origen + credenciales; `CustomSecurityHeaderMiddleware` existe pero no está registrado.
- `configuration.GetValue<>` directo en DI y filtros en vez de Options.
- Paquetes `Microsoft.Extensions.*` 9.x/10.x sobre `net8.0`.
- Constantes en `struct` en vez de `static class`; typos en nombres de métodos, clases y carpetas.
- `ConfigureAwait(false)` aislado en algunos clientes; `async/await` innecesario en passthrough de decorators.
- Claves de `appsettings` con espacios o typos.
