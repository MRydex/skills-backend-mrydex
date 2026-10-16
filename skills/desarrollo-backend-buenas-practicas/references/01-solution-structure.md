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
│   └── Program.cs               # termina con `public partial class Program { }` (E2E)
├── <Application>/
│   ├── Configuration/           # Guard, ApplicationConfiguration + IValidateOptions
│   ├── Dtos/<Feature>Dtos/      # <Accion><Entidad>Request (record) y <Entidad>Response
│   │   └── Validators/          # AbstractValidator<TRequest>
│   ├── Exceptions/              # excepciones + Handlers/ + Helpers/ + Resources/ExceptionMessages.resx
│   ├── Interfaces/              # IUnitOfWork, ICacheService, clientes externos
│   ├── Mediator/
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
| Repositorio | `Infrastructure/DapperRepositories/<Feature>Repositories/` | `internal` |
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
- **Dentro del límite no se divide**: nada de extraer métodos o clases de 5 líneas usadas una vez.
