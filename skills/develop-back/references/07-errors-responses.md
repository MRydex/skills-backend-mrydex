## 7. Errores y respuestas

Excepciones tipadas, `IExceptionHandler` y `ProblemDetails`. Leer al manejar errores o definir respuestas.

- Excepciones de `Application/Exceptions`: `SystemValidationException` (400), `NotFoundException` (404), `ConflictException` (409: el recurso ya está en el estado pedido o hubo un conflicto de concurrencia; un duplicado es validación, 400), `LoginException` / `ClaimException` (401/403), `ExternalApiException` (502/503/504 según la falla, §9), `CommandException` / `QueryException` (500), `KeyVaultException` (500).
- Cada excepción tiene su `IExceptionHandler` en `Exceptions/Handlers/`, registrado con `AddExceptionHandler<T>()` en orden de lo específico a lo general; `UnhandledExceptionHandler` último.
- Respuesta de error: `ProblemDetails` (`type` RFC 9110, `title`/`detail` desde `ExceptionMessages.resx` si el repo lo tiene (repo nuevo: `Domain/Structs/ErrorMessage.cs`), `status`, `traceId`). Mismo formato siempre: el frontend depende de él.
- Excepción nueva ⇒ clase + handler + mensaje (entrada `.resx` o `ErrorMessage.cs`, según el repo). Un `code` o campo nuevo en el error es contrato: se documenta donde el repo documenta la integración y se avisa al front (§17.8). No agregar `catch` en controllers ni filtros para mapear errores.
- Éxito: endpoint nuevo devuelve el `Response` directo (`ItemResponse`, §1.2), sin envelope `{ success, data }`. Listas paginadas: `PagedResponse<T>`. Una API que ya responde con envelope lo mantiene en sus endpoints, nuevos incluidos: cambiarlo rompe a los clientes. El front soporta las dos formas (skill de frontend §2.11).
- Nunca usar excepciones para flujo normal (ej. "no hay datos" en una búsqueda ⇒ lista vacía / `204`, no excepción).
