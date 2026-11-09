## 2. C# y diseño

Reglas de lenguaje C# 14 y diseño de clases. Leer al escribir cualquier código C#.

- **Primary constructors** para inyección en controllers, handlers, repositorios y servicios: `internal class CreateItemHandler(IValidator<CreateItemRequest> validator, IUnitOfWork unitOfWork) : IRequestHandler<...>`.
- **Records** para requests y responses inmutables; `class` para entidades y responses con setters requeridos por Dapper.
- **Nullable de verdad**: sin `!` para callar warnings (en tests, `null!` para probar un input nulo sí); validar o modelar como `T?`. Sin warnings nuevos en build.
- `async`/`await` en toda la cadena. **Nunca** `.Result`, `.Wait()`, `GetAwaiter().GetResult()` ni `async void`.
- Sin `async`/`await` de paso: si el método solo devuelve la `Task` de otro (decorator passthrough), retornarla directo.
- `ConfigureAwait(false)` no se usa en código de aplicación ASP.NET Core (no hay `SynchronizationContext`); no agregarlo.
- Antes de paralelizar: ¿la tarea espera I/O o calcula CPU? I/O (HTTP, base): `await`; si son independientes, `Task.WhenAll` con tope de concurrencia (`SemaphoreSlim`, o `Parallel.ForEachAsync` con `MaxDegreeOfParallelism`), nunca 1000 tareas a la vez contra un recurso limitado. CPU: `Parallel.ForEachAsync` acotado a los núcleos, solo con medición. Nunca `Task.Run` en controllers o handlers "para no bloquear": en ASP.NET Core solo mueve el trabajo de un hilo del pool a otro.
- Una `DbConnection`, un `DbContext` o el `UnitOfWork` no se comparten entre tareas concurrentes: una conexión por tarea, o secuencial.
- Búsquedas repetidas dentro de un loop (`First` / `Any` / `Contains` sobre otra lista): `Dictionary` / `HashSet` armado antes del loop, no O(n²) ([15](./15-data-access-ef-core.md) §15.8; vale sin EF).
- Colecciones de entrada como `IEnumerable<T>` / `IReadOnlyList<T>`; salida materializada (`ToList()`), nunca `IEnumerable` diferido sobre una conexión abierta.
- `DateTime`: guardar y comparar en UTC o con `DateTimeOffset`; serializar ISO 8601. Sin `DateTime.Now` en lógica (inyectar `TimeProvider` si hace falta testear tiempo).
- Dinero e importes: `decimal`, nunca `double`.
- `GlobalUsings.cs` por proyecto para usings transversales (FluentValidation, Dapper, Domain.*). No duplicar usings en cada archivo.
- **C# 13/14** (solo sobre `net10.0`; en repos `net8.0` no se usan):
  - `field` en propiedades con lógica en el setter, en vez de un campo de respaldo explícito: `public string Code { get; set => field = value.Trim(); }`.
  - Asignación null-condicional `customer?.Order = order;` en vez de `if (customer is not null)`.
  - `System.Threading.Lock` en vez de `lock (new object())` para exclusión mutua.
  - `params ReadOnlySpan<T>` / `params IEnumerable<T>` en vez de `params T[]` en métodos nuevos.
  - Bloques `extension(...)` solo donde el repo ya usa métodos de extensión para ese tipo. No convertir los existentes.
- Un tipo no se llama igual que un segmento de su namespace (`Infrastructure.Orders.Order`): dentro de
  ese namespace el nombre corto resuelve al namespace (`CS0118`). En un repo que ya lo tiene, calificar
  el tipo entero (`Domain.Orders.Entities.Order`).
- Ciclos de DI: repositorios no dependen de services ni de chequeos de permisos; eso evita la mayoría.
  Si un puerto nuevo cierra un ciclo, va en una interfaz aparte en vez de agrandar la existente.
- **Regla "nunca uses X" que importa ⇒ error de compilación**, no solo texto: `BannedApiAnalyzers` +
  `BannedSymbols.txt` + `RS0030` en `error`. Va en `Directory.Build.props`, condicionado a `.csproj`
  (los `.sqlproj` no soportan analizadores Roslyn):

  ```xml
  <ItemGroup Condition="'$(MSBuildProjectExtension)' == '.csproj'">
    <PackageReference Include="Microsoft.CodeAnalysis.BannedApiAnalyzers" Version="3.3.4" PrivateAssets="all" />
    <AdditionalFiles Include="$(MSBuildThisFileDirectory)BannedSymbols.txt" />
  </ItemGroup>
  ```

  `.editorconfig`: `[*.cs]` + `dotnet_diagnostic.RS0030.severity = error`. `BannedSymbols.txt`, una
  línea por símbolo con la alternativa en el mensaje (`T:` tipo, `M:` método, `P:` propiedad):

  ```text
  P:System.DateTime.Now;Usar TimeProvider (§2)
  M:System.Net.Http.HttpClient.#ctor;Usar un typed client (§9)
  ```

  Agregar entradas solo para lo que el repo ya rompió o lo que deja un agujero de seguridad; con CPM,
  la versión va en `Directory.Packages.props`.
- Sin código comentado, sin `TODO` sin ticket, sin `#region` dentro de métodos. `#region` solo para agrupar registros en DI.
