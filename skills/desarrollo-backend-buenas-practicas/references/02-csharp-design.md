## 2. C# y diseño

Reglas de lenguaje C# 12 y diseño de clases. Leer al escribir cualquier código C#.

- **Primary constructors** para inyección en controllers, handlers, repositorios y servicios: `internal class CreateBankHandler(IValidator<CreateBankRequest> validator, IUnitOfWork unitOfWork) : IRequestHandler<...>`.
- **Records** para requests y DTOs inmutables; `class` para entidades y DTOs con setters requeridos por Dapper.
- **Nullable de verdad**: sin `!` para callar warnings; validar o modelar como `T?`. Sin warnings nuevos en build.
- `async`/`await` en toda la cadena. **Nunca** `.Result`, `.Wait()`, `GetAwaiter().GetResult()` ni `async void`.
- Sin `async`/`await` de paso: si el método solo devuelve la `Task` de otro (decorator passthrough), retornarla directo.
- `ConfigureAwait(false)` no se usa en código de aplicación ASP.NET Core (no hay `SynchronizationContext`); no agregarlo.
- Colecciones de entrada como `IEnumerable<T>` / `IReadOnlyList<T>`; salida materializada (`ToList()`), nunca `IEnumerable` diferido sobre una conexión abierta.
- `DateTime`: guardar y comparar en UTC o con `DateTimeOffset`; serializar ISO 8601. Sin `DateTime.Now` en lógica (inyectar `TimeProvider` si hace falta testear tiempo).
- Dinero e importes: `decimal`, nunca `double`.
- `GlobalUsings.cs` por proyecto para usings transversales (FluentValidation, Dapper, Domain.*). No duplicar usings en cada archivo.
- Sin código comentado, sin `TODO` sin ticket, sin `#region` dentro de métodos. `#region` solo para agrupar registros en DI.
