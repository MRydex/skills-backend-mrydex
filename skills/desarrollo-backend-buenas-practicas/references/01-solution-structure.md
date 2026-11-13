## 1. Estructura de la solución

Dónde va cada archivo, naming y límites de tamaño. Leer al crear archivos o carpetas, o cuando algo supera el límite de líneas.

```
<Solucion>/
├── <Api>/                       # Host ASP.NET Core
│   ├── Attributes/              # RoleAuthorizationAttribute
│   ├── Configurations/          # clases de config del host
│   ├── Controllers/V1/          # un controller por recurso
│   ├── Extensions/              # AddKeyVault, AddObservability, ConfigureSwagger, ConfigureVersioning
│   ├── Filters/                 # ValidateTokenFilter, LoggerFilter
│   ├── Middlewares/
│   ├── GlobalUsings.cs
│   └── Program.cs               # en net8: termina con `public partial class Program { }` (E2E); en net10 ya es público
├── <Application>/
│   ├── Configuration/           # Guard, ApplicationConfiguration + IValidateOptions
│   ├── Dtos/<Feature>Dtos/      # <Accion><Entidad>Request (record) y <Entidad>Response
│   │   └── Validators/          # AbstractValidator<TRequest>
│   ├── Exceptions/              # excepciones + Handlers/ + Helpers/ + Resources/ExceptionMessages.resx
│   ├── Interfaces/              # IUnitOfWork, ICacheService, clientes externos
│   ├── Mediator/                # IMediator + DefaultMediator (no una clase `Mediator`: CS0118, §2)
│   ├── Services/<Feature>Handlers/
│   │   └── Interfaces/          # I<Feature>CommandRepository / I<Feature>QueryRepository
│   └── ApplicationDependency.cs # AddApplicationServices
├── <Domain>/                    # sin dependencias
│   ├── Entities/ Enums/ Interfaces/ Models/ Validators/
│   └── Structs/                 # Roles, ErrorMessage, SuccessMessage, CacheKey (constantes)
├── <Infrastructure>/
│   ├── Cache/                   # CacheService, RedisConfiguration
│   ├── Clients/<Sistema>/       # typed HttpClients + RetryPolicy
│   ├── DapperRepositories/
│   │   ├── Configuration/       # DapperContext, DbSession, UnitOfWork
│   │   └── <Feature>Repositories/
│   └── InfrastructureDependency.cs
├── Documentacion/<Feature>/<Endpoint>.md
└── Tests/
    ├── <X>.UnitTest/<Feature>/
    └── <X>.E2ETest/<Feature>/ + Configuration/
```

### 1.1 Dónde va cada cosa

| Qué | Dónde | Visibilidad |
| :--- | :--- | :--- |
| Request de entrada (`<Accion>Request : IRequest<T>`) | `Application/Dtos/<Feature>Dtos/` | `public record` |
| Response de salida (`<Entidad>Response`) | `Application/Dtos/<Feature>Dtos/` | `public class` o `record` |
| Validador | `Application/Dtos/<Feature>Dtos/Validators/<Accion>Validator.cs` | `public` |
| Handler | `Application/Services/<Feature>Handlers/<Accion>Handler.cs` | `internal` |
| Interfaz de repositorio | `Application/Services/<Feature>Handlers/Interfaces/` | `public` |
| Repositorio | `Infrastructure/DapperRepositories/<Feature>Repositories/` (en memoria: `InMemoryRepositories/`; EF: §15) | `internal` |
| Entidad de tabla | `Domain/Entities/` | `public class` |
| Constantes (roles, mensajes, claves de cache) | `Domain/Structs/` | `public const string` |
| Cliente HTTP externo | interfaz en `Application/Interfaces/`, impl en `Infrastructure/Clients/<Sistema>/` | `internal` impl |
| Documentación del endpoint | `Documentacion/<Feature>/<Accion>.md` | — |

### 1.2 Naming

- Archivo = nombre de la clase. Una clase/record/interfaz por archivo.
- Handlers: `<Verbo><Entidad>Handler` (`CreateItemHandler`, `GetItemsHandler`). Request homónimo: `CreateItemRequest`.
- **Contrato con el front: `Request` lo que entra, `Response` lo que sale**, con el mismo nombre en C#
  y en TypeScript (skill de frontend §2.11), así un mismo `grep` encuentra el tipo en los dos lados.
  - Entrada: `<Accion><Entidad>Request` → `CreateItemRequest`, `GetItemsRequest`.
  - Salida: `<Entidad>Response` → `ItemResponse`. Si una operación devuelve otra forma, le pone su
    acción: `CreateItemResponse`. Paginado: `PagedResponse<ItemResponse>`.
  - Nunca sufijo `Dto`, `Model` ni `ViewModel` en el contrato: el sufijo dice la dirección.
- **Mapeo explícito, sin AutoMapper.** La entidad de `Domain` no sale de `Application`.
  - Proyectar directo al `Response` en la consulta: Dapper con columnas = propiedades
    (`QueryAsync<ItemResponse>`), EF con `.Select(x => new ItemResponse(...))` (§15).
  - Si la misma proyección aparece por segunda vez, un método estático en el `Response`:
    `ItemResponse.From(item)`. No clases `Mapper` ni `Helpers` genéricos.
- Repositorios: `<Entidad>CommandRepository` (escrituras) / `<Entidad>QueryRepository` (lecturas) / `<Entidad>Cached<Command|Query>Repository` (decorator).
- Métodos asincrónicos **siempre** con sufijo `Async`. Interfaces con prefijo `I`.
- Carpetas en plural y consistentes con el namespace (`ThresholdRepositories` → namespace `...ThresholdRepositories`).
- Código (tipos, métodos, variables) en **inglés**. Mensajes al usuario en **español** desde `ErrorMessage` / `SuccessMessage` / `.resx`.
- Constantes nuevas: `public static class` (no `struct`). Las `struct` existentes se dejan.

### 1.3 Límites de tamaño y cuándo dividir

- Controller 150 líneas, handler 150, repositorio 250, cualquier clase 300, método 40.
- Si un handler pasa el límite: extraer servicio de dominio en `Services/<Feature>Handlers/` con su interfaz.
- Si un repositorio pasa el límite: partir por agregado o por Command/Query. Nunca "Helpers" genéricos.
- Minimal APIs: un `Map<Feature>Endpoints` con lambdas largos se divide pasando cada lambda largo a un
  método estático con nombre en la misma clase; los de una línea quedan inline.
- **Dentro del límite no se divide**: nada de extraer métodos o clases de 5 líneas usadas una vez.

### 1.4 Dependencias entre capas (Clean Architecture)

Las referencias entre proyectos (`<ProjectReference>`) van hacia adentro, nunca al revés:

| Proyecto | Referencia a | No referencia a |
| :--- | :--- | :--- |
| `Domain` | ningún proyecto; solo paquetes sin infraestructura (ej. FluentValidation para `Validators/`) | ningún otro proyecto, Dapper, EF Core, ASP.NET Core |
| `Application` | `Domain`; de ASP.NET Core solo lo que piden `Exceptions/Handlers` (`IExceptionHandler`, `ProblemDetails`) | `Infrastructure`, `Api`, resto de ASP.NET Core (controllers, `HttpContext`), Dapper, EF Core, SignalR, Redis |
| `Infrastructure` | `Application`, `Domain` | `Api` |
| `Api` | `Application`, `Infrastructure` (solo para registrar DI en `Program.cs`) | — |

- La interfaz vive en `Application` (`I<Feature>QueryRepository`, `ICacheService`, cliente externo); la implementación `internal` en `Infrastructure`.
- Si `Application` necesita algo de `Infrastructure`, se mueve la interfaz a `Application`, no se agrega la referencia.
- Controllers y filtros de `Api` no usan tipos de `Infrastructure`: hablan con `Application` vía mediator.
- Cada capa registra sus servicios en su `*Dependency.cs`; `Program.cs` solo los llama.
- No se crean proyectos ni capas nuevas (`Shared`, `Common`, `Core`) sin pedido explícito. Excepción: armar la estructura de §1 en un repo nuevo.

### 1.5 Qué forma usar: la de §1 (por defecto) u Onion

Se decide una sola vez, al crear el repo o el módulo, según para qué se usa. Los 4 proyectos, el mediator,
los controllers, la validación y los errores son los mismos en las dos: cambia dónde viven las reglas de
negocio y las interfaces de repositorio.

| Tipo de uso | Forma |
| :--- | :--- |
| API sobre datos: ABM, consultas, stored procedures, integraciones. Las reglas son validaciones del request. | La de §1 (por defecto) |
| Dominio con reglas propias: invariantes, estados y transiciones, cálculos que cruzan varias entidades. | Onion |
| Las mismas reglas las usa más de un host (API + worker, consola, Functions). | Onion |
| Repo que ya existe. | La que ya tiene |

- **Repo existente**: manda lo que hay. Es Onion si las interfaces de repositorio están en `Domain` o existe
  `Domain/Services/`. No se migra de una forma a la otra sin pedido explícito, ni se mezclan en una misma feature.
- **Repo nuevo y el pedido no alcanza para decidir**: la de §1, y avisar en una línea que se eligió por defecto.
- No se pasa a Onion "por si el dominio crece": se pasa cuando aparece la primera regla que no es validación del request.

Qué cambia en Onion respecto de §1 a §1.4:

| Qué | En §1 | En Onion |
| :--- | :--- | :--- |
| Regla de negocio | Handler | Entidad (métodos que cuidan sus invariantes) o `Domain/Services/` si cruza entidades |
| Entidad | Clase de tabla, solo propiedades | Con comportamiento; `private set` y métodos con nombre del negocio |
| Interfaz de repositorio de escritura | `Application/Services/<Feature>Handlers/Interfaces/` | `Domain/Interfaces/`; recibe y devuelve entidades |
| Interfaz de repositorio de lectura que proyecta a `Response` | `Application/Services/<Feature>Handlers/Interfaces/` | Igual: `Domain` no conoce los `Response` |
| Handler | Valida, aplica la regla, persiste | Valida, carga la entidad, llama a su método o al servicio de dominio, persiste |
| Tests unitarios | Del handler con mocks | De la entidad y del servicio de dominio sin mocks; del handler con mocks |

- Las dependencias de §1.4 no cambian: `Domain` sigue sin referenciar proyectos y sin Dapper, EF Core ni ASP.NET Core.
  `Infrastructure` implementa interfaces de `Domain` y de `Application`.
- `Domain/Services/` lleva solo reglas: sin acceso a datos directo, sin `HttpClient`, sin logging. Si necesita
  datos, los recibe por parámetro o por una interfaz de `Domain/Interfaces/`.
- Interfaces de cache, clientes externos e `IUnitOfWork` quedan en `Application/Interfaces/`.
