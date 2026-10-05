## 15. Acceso a datos con Entity Framework Core y LINQ

`DbContext`, entidades y configuración, consultas LINQ, escrituras, transacciones, migraciones y
errores con EF Core. Leer al tocar repositorios, consultas o migraciones en un repo que usa EF Core.

**Cuándo aplica.** Dapper es el default del equipo ([05-data-access-dapper.md](./05-data-access-dapper.md)).
EF Core se usa **solo** en repos o bounded contexts que ya lo usan (hay un `DbContext` en
Infrastructure). No migrar de Dapper a EF ni al revés sin pedido. No mezclar los dos en el mismo
repositorio de un feature; si un caso puntual necesita SQL a mano dentro de un repo EF, usar
`FromSql` / `SqlQuery` (§15.4) o Dapper sobre la conexión del mismo `DbContext`, documentado en el PR.

Las reglas de la skill no cambian con EF: controllers delgados, handlers `internal`, validación con
`Guard`, excepciones tipadas, `CancellationToken` de punta a punta y repositorios Command / Query.

Índice: [15.1](#151-versión-y-registro) Versión y registro ·
[15.2](#152-entidades-y-configuración) Entidades y configuración ·
[15.3](#153-consultas-linq) Consultas LINQ ·
[15.4](#154-sql-a-mano-con-ef) SQL a mano ·
[15.5](#155-escrituras-y-transacciones) Escrituras y transacciones ·
[15.6](#156-errores-y-concurrencia) Errores y concurrencia ·
[15.7](#157-migraciones) Migraciones ·
[15.8](#158-linq-en-memoria) LINQ en memoria ·
[15.9](#159-tests) Tests.

### 15.1 Versión y registro

- **EF Core 10** (`Microsoft.EntityFrameworkCore.SqlServer` 10.x) sobre `net10.0`. En repos que
  siguen en `net8.0`: EF Core 8.x, sin subir de versión mayor sin decisión explícita (`SKILL.md` §0).
- EF Core 10 (solo sobre `net10.0`): `LeftJoin` / `RightJoin` en LINQ en vez de
  `GroupJoin` + `SelectMany` + `DefaultIfEmpty`; `ExecuteUpdateAsync` acepta un lambda común (setters
  condicionales sin armar expresiones); filtros de consulta con nombre (`HasQueryFilter("Nombre", ...)`)
  para desactivar uno solo con `IgnoreQueryFilters(["Nombre"])`.
- `DbContext` en `Infrastructure/Persistence/<Nombre>DbContext.cs`, `internal`, con primary
  constructor (`(DbContextOptions<XDbContext> options) : DbContext(options)`).
- Registro en `InfrastructureDependency.cs` con `AddDbContext<XDbContext>` (lifetime `Scoped`).
  Connection string por nombre desde Key Vault ([08](./08-configuration-di-secrets.md)). Nunca en
  `OnConfiguring`.
- `EnableRetryOnFailure()` del proveedor SQL Server para errores transitorios. Con retry activo, las
  transacciones explícitas van dentro de `Database.CreateExecutionStrategy().ExecuteAsync(...)`.
- `EnableSensitiveDataLogging()` y `EnableDetailedErrors()` **solo** en Development. Nunca en otros
  ambientes: loguean valores de parámetros (§11).
- Sin lazy loading (`UseLazyLoadingProxies` prohibido): genera N+1 invisibles.
- `DbContext` nunca se inyecta en controllers ni en handlers: solo en repositorios y en `UnitOfWork`.

### 15.2 Entidades y configuración

```csharp
// Domain/Entities/Bank.cs
public class Bank
{
    public int Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }
    public byte[] RowVersion { get; private set; } = [];
}

// Infrastructure/Persistence/Configurations/BankConfiguration.cs
internal class BankConfiguration : IEntityTypeConfiguration<Bank>
{
    public void Configure(EntityTypeBuilder<Bank> builder)
    {
        builder.ToTable("Bank", "dbo");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(3).IsUnicode(false).IsRequired();
        builder.HasIndex(x => x.Code).IsUnique();
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.Property(x => x.RowVersion).IsRowVersion();
    }
}
```

- Entidades en `Domain/Entities/` sin atributos de EF ni referencias a EF. El mapeo vive en
  `Infrastructure/Persistence/Configurations/`, una `IEntityTypeConfiguration<T>` por entidad,
  cargadas con `modelBuilder.ApplyConfigurationsFromAssembly(...)`.
- Fluent API, no data annotations de mapeo. Esquema explícito (`dbo`), largo y `IsUnicode` en todo
  string (evita `nvarchar(max)` y conversiones implícitas en índices). `decimal` con
  `HasPrecision(p, s)` siempre.
- Las entidades no salen del repositorio hacia el controller: el handler devuelve DTOs ([04](./04-mediator-handlers.md)).
- Enums: `HasConversion<string>()` solo si la columna ya es texto; si no, el valor numérico.

### 15.3 Consultas LINQ

```csharp
internal class BankQueryRepository(AppDbContext dbContext) : IBankQueryRepository
{
    public Task<BankDto?> GetByCodeAsync(string code, CancellationToken cancellationToken) =>
        dbContext.Banks
            .AsNoTracking()
            .Where(x => x.Code == code)
            .Select(x => new BankDto(x.Code, x.Name, x.IsActive))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<PagedResponse<BankDto>> GetPageAsync(GetBanksRequest request, CancellationToken cancellationToken)
    {
        var query = dbContext.Banks.AsNoTracking();
        if (request.IsActive is not null)
            query = query.Where(x => x.IsActive == request.IsActive);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(x => x.Code)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(x => new BankDto(x.Code, x.Name, x.IsActive))
            .ToListAsync(cancellationToken);

        return new PagedResponse<BankDto>(items, total, request.Page, request.PageSize);
    }
}
```

- Lecturas **siempre** con `AsNoTracking()` y proyección con `Select` al DTO. Nunca traer la entidad
  entera para usar dos columnas.
- Siempre la variante async con `CancellationToken` (`ToListAsync`, `FirstOrDefaultAsync`,
  `AnyAsync`, `CountAsync`). Nunca `ToList()` / `First()` sincrónicos sobre un `IQueryable`.
- `IQueryable` **no sale** del repositorio. La interfaz devuelve `Task<T>`, `Task<List<T>>` o
  `Task<PagedResponse<T>>`, ya materializado.
- Filtros dinámicos componiendo `Where` sobre el `IQueryable`. Orden dinámico solo desde una
  whitelist (`switch` sobre un enum → `OrderBy` con la columna), nunca con el nombre de columna del
  request (§11).
- Paginado siempre con `OrderBy` estable + `Skip` / `Take` y `PageSize` máximo ([06](./06-validation.md)).
- Existencia con `AnyAsync`, no `CountAsync() > 0` ni `FirstOrDefaultAsync() != null`.
- **N+1 prohibido**: nada de consultas dentro de un `foreach`. Usar `Select` con navegaciones
  (EF arma el join), `Include` solo cuando se necesita la entidad para modificarla, y `Contains`
  sobre una lista de ids (`ids.Contains(x.Id)`) para lotes.
- Varias colecciones incluidas en la misma consulta ⇒ `AsSplitQuery()` para evitar el producto
  cartesiano.
- Cuidado con la evaluación en cliente: métodos propios dentro de `Where` / `Select` no se traducen.
  Si EF lanza `could not be translated`, reescribir la consulta; nunca `AsEnumerable()` antes del
  filtro para "arreglarlo" (trae la tabla entera a memoria).
- Consultas de solo lectura caras y repetidas: cache por decorator igual que en Dapper
  ([05](./05-data-access-dapper.md) §5.3).
- Revisar el SQL generado en consultas no triviales (`ToQueryString()` en Development o el log de EF).

### 15.4 SQL a mano con EF

```csharp
// ✅ Interpolación parametrizada: EF convierte {code} en @p0
var bank = await dbContext.Banks
    .FromSql($"SELECT Id, Code, Name, IsActive, RowVersion FROM dbo.Bank WHERE Code = {code}")
    .AsNoTracking()
    .FirstOrDefaultAsync(cancellationToken);

// ✅ SP o escalares
var total = await dbContext.Database
    .SqlQuery<int>($"EXEC dbo.GetBankCount @IsActive = {isActive}")
    .SingleAsync(cancellationToken);

// ❌ Inyección SQL: concatenación o FromSqlRaw con texto armado
dbContext.Banks.FromSqlRaw("SELECT * FROM dbo.Bank WHERE Code = '" + code + "'");
```

- `FromSql` / `SqlQuery` / `ExecuteSql` con **string interpolado** (parametriza solo).
  `FromSqlRaw` / `ExecuteSqlRaw` solo con texto constante y `SqlParameter` explícitos. Nunca
  concatenar input (§11).
- Stored procedures existentes se siguen usando con `SqlQuery` / `ExecuteSql`. No reescribir un SP
  como LINQ sin pedido.

### 15.5 Escrituras y transacciones

```csharp
internal class CreateBankHandler(IValidator<CreateBankRequest> validator, IUnitOfWork unitOfWork)
    : IRequestHandler<CreateBankRequest, EmptyResult>
{
    public async Task<EmptyResult> Handle(CreateBankRequest request, CancellationToken cancellationToken)
    {
        await Guard.AgainstInvalidSpecification(validator, request);

        unitOfWork.BankCommandRepository.Add(Bank.Create(request.Code, request.Name));
        await unitOfWork.SaveChangesAsync(cancellationToken);   // una transacción implícita
        return new EmptyResult();
    }
}
```

- `IUnitOfWork` envuelve el `DbContext`: expone los repos de comando y `SaveChangesAsync`. Los repos
  de comando **no** llaman a `SaveChangesAsync`; lo hace el handler una sola vez al final.
- Un `SaveChangesAsync` ya es atómico. Transacción explícita (`BeginTransactionAsync` /
  `CommitAsync`) solo si hay varios `SaveChangesAsync` o SQL a mano en el medio, dentro de la
  execution strategy (§15.1).
- Updates y deletes masivos con `ExecuteUpdateAsync` / `ExecuteDeleteAsync` (una sentencia, sin
  cargar entidades). Nunca un loop que carga, modifica y guarda fila por fila. Ojo: no pasan por el
  change tracker ni disparan la invalidación de cache: invalidar a mano.
- Altas masivas grandes (miles de filas): `AddRange` + un `SaveChangesAsync`; más que eso,
  `SqlBulkCopy` como en Dapper ([05](./05-data-access-dapper.md)).
- Update de una entidad: cargarla con tracking (sin `AsNoTracking`), modificar con métodos de la
  entidad, `SaveChangesAsync`. Nunca `dbContext.Update(entidadDelRequest)`: es mass assignment
  (API3, §11.1).
- Auditoría (`CreatedAt`, `UpdatedBy`): en `SaveChangesAsync` del contexto o un interceptor, con
  `TimeProvider`. No en cada handler.

### 15.6 Errores y concurrencia

- `DbUpdateException` con `SqlException` 2627/2601 interna (duplicado) ⇒ `SystemValidationException`.
- `DbUpdateConcurrencyException` (columna `RowVersion`) ⇒ `SystemValidationException` con mensaje de
  "el registro fue modificado por otro usuario". Tablas editables por varios usuarios llevan
  `RowVersion`.
- `OperationCanceledException` ⇒ relanzar. Resto ⇒ `CommandException` / `QueryException` con
  parámetros **sin datos sensibles** ([07](./07-errors-responses.md)).
- El mapeo de excepciones de EF vive en el repositorio o en el `UnitOfWork`, nunca en el handler ni
  en el controller.

### 15.7 Migraciones

- Migraciones en el proyecto Infrastructure (`Persistence/Migrations/`), nombre descriptivo
  (`AddBankRowVersion`). Una migración por cambio lógico.
- **Nunca** `Database.Migrate()` / `EnsureCreated()` al arrancar la app. Se despliegan como script:
  `dotnet ef migrations script --idempotent` adjunto al PR, igual que los `.sql` de Dapper.
- Revisar el SQL generado antes de commitear: renombres que EF interpreta como drop + add pierden
  datos. Migración destructiva (drop de columna o tabla) ⇒ preguntar antes (§13.6).
- Rollback: `Down()` implementado y probado, o script de vuelta en el PR.
- Base sin migraciones de EF (tablas creadas por scripts): modelo con `ToTable` y sin migraciones,
  scripts `.sql` como en Dapper. No introducir migraciones sobre una base existente sin pedido.

### 15.8 LINQ en memoria

Aplica a cualquier colección, con EF o sin EF.

- Materializar una sola vez (`ToList()`) si se va a recorrer más de una vez. Nunca enumerar dos
  veces un `IEnumerable` diferido.
- `Any()` para existencia, no `Count() > 0`. `FirstOrDefault` / `SingleOrDefault` según la regla de
  negocio: `Single` si más de uno es un error.
- Búsquedas repetidas dentro de un loop ⇒ `ToDictionary` / `ToLookup` / `HashSet` antes del loop,
  no `Where` / `First` en cada vuelta (O(n²)).
- Sin efectos secundarios dentro de `Select` / `Where`. Para eso, `foreach`.
- Consultas largas: un operador por línea. Si una cadena LINQ no se entiende de un vistazo, partirla
  en variables con nombre, no en métodos de una línea usados una vez (§13.7.1).

### 15.9 Tests

- Handlers: mockear las interfaces de repositorio y `IUnitOfWork` con Moq, igual que con Dapper
  ([10](./10-logging-tests.md) §10.2). No mockear `DbContext` ni `DbSet`.
- Consultas LINQ no triviales de un repositorio: test de integración contra SQL Server real
  (contenedor o base de test), no con el proveedor `InMemory` (no traduce SQL ni respeta
  restricciones). Si no hay base de test disponible, decirlo y verificar con `ToQueryString()`.
