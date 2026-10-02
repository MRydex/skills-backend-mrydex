## 7. Errores y respuestas

Excepciones tipadas, `IExceptionHandler` y `ProblemDetails`. Leer al manejar errores o definir respuestas.

- Excepciones de `Application/Exceptions`: `SystemValidationException` (400), `NotFoundException` (404), `LoginException` / `ClaimException` (401/403), `ExternalApiException` (502/500), `CommandException` / `QueryException` (500), `KeyVaultException` (500).
- Cada excepción tiene su `IExceptionHandler` en `Exceptions/Handlers/`, registrado con `AddExceptionHandler<T>()` en orden de lo específico a lo general; `UnhandledExceptionHandler` último.
- Respuesta de error: `ProblemDetails` (`type` RFC 9110, `title`/`detail` desde `ExceptionMessages.resx`, `status`, `traceId`). Mismo formato siempre: el frontend depende de él.
- Excepción nueva ⇒ clase + handler + entrada `.resx`. No agregar `catch` en controllers ni filtros para mapear errores.
- Éxito: DTO directo, sin envelope `{ success, data }`. Listas paginadas: `PagedResponse<T>`.
- Nunca usar excepciones para flujo normal (ej. "no hay datos" en una búsqueda ⇒ lista vacía / `204`, no excepción).
