## 5. Acceso a datos (Dapper)

Conexiones, transacciones, SQL con Dapper y cache por decorator. Leer al tocar repositorios, SQL o cache.

### 5.1 Conexiones y transacciones

- `DapperContext` (singleton) crea conexiones por base (ej. `MainDb`, `LogsDb`). `DbSession` (scoped) abre la conexión del request. `UnitOfWork` (scoped) expone los repos de comando y la transacción.
- Escrituras: siempre por `IUnitOfWork` y dentro de `BeginTransaction` / `Commit` / `Rollback` si tocan más de una sentencia (en async: `BeginTransactionAsync` / `CommitAsync` / `RollbackAsync`, [04](./04-mediator-handlers.md)).
- **Sin I/O externo dentro de una transacción abierta**: ni `HttpClient`, ni colas, ni mails, ni `Task.Delay`. La transacción retiene locks y una conexión del pool todo ese tiempo; una API lenta de terceros se convierte en bloqueos y agotamiento del pool. Se llama antes de abrirla o después del `Commit`.
- Pool: cada conexión abierta sale del pool de `SqlClient` (`Max Pool Size` = 100 por defecto, **por instancia de la API**). Con 100 requests esperando algo con la conexión abierta, el 101 falla con `Timeout expired ... obtaining a connection from the pool`. Por eso: abrir tarde (justo antes de la primera consulta), cerrar pronto, nada lento con la conexión abierta. Subir `Max Pool Size` no arregla una conexión retenida de más; instancias × pool tienen que entrar en las conexiones que acepta el servidor. Cuándo abre `DbSession` depende del repo (no se define acá): mirarlo antes de agregar trabajo lento al handler.
- Lecturas: repos de query inyectados directo en el handler. Código nuevo usa `DbSession`; si hace falta otra base, `using var connection = context.CreateConnectionX();`. Nunca dejar una conexión sin `using`.
- Aislamiento por defecto `ReadCommitted`. Cambiarlo es decisión explícita.
- **Rol de runtime sin DDL**: la app conecta con un rol que solo hace DML; las migraciones corren con otro rol. Nunca con el dueño de la base ni con un rol que pueda `CREATE` / `ALTER` (en PostgreSQL es el prerrequisito de varios CVE, §11.8). En un repo que ya conecta con el dueño se reporta y se propone el script; no se cambian permisos sin pedido.

  ```sql
  -- PostgreSQL
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;
  REVOKE TEMPORARY ON DATABASE app FROM PUBLIC;
  GRANT USAGE ON SCHEMA public TO app_runtime;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
  ```

### 5.2 SQL

**Primero, lo que ya hay.** Si el repo ya tiene su forma de ejecutar SQL o SPs (helper, repositorio
base, wrapper de SPs), el código nuevo la usa aunque esta sección lo haría distinto (§13.5). Lo de
abajo aplica cuando no hay precedente. Excepción: lo que concatena input o no parametriza no se
copia: se reporta (§11.3). Con EF Core, el equivalente de esta sección es §15.4.

```csharp
internal class ItemCommandRepository(DbSession dbSession) : IItemCommandRepository
{
    public async Task CreateAsync(string code, string name, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO dbo.Item (Code, Name, CreatedAt)
            VALUES (@Code, @Name, SYSUTCDATETIME());
            """;
        var parameters = new { Code = code, Name = name };

        try
        {
            await dbSession.Connection.ExecuteAsync(new CommandDefinition(
                sql, parameters, transaction: dbSession.Transaction, cancellationToken: cancellationToken));
        }
        catch (SqlException ex) when (ex.Number is 2627 or 2601)
        {
            throw new SystemValidationException(ErrorMessage.ItemAlreadyExists);
        }
        catch (SqlException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new CommandException(ErrorMessage.CommandFailure, ex, parameters);
        }
    }
}
```

- SQL en `const string` con raw string literal (`"""`), esquema explícito (`dbo.`), columnas explícitas (nunca `SELECT *`).
- Siempre `CommandDefinition` con `transaction:` y `cancellationToken:`. `commandTimeout:` explícito (segundos, de Options, §8) en lo que puede tardar (reportes, procesos, lotes): el default es 30 s y no se sube "para que ande" (§5.4).
- Parámetros: objeto anónimo o `DynamicParameters`. Strings con tipo/largo cuando el índice importa: `new DbString { Value = x, IsAnsi = true, Length = 22 }` (evita conversiones implícitas y scans).
- Filtros dinámicos y paginado: `Dapper.SqlBuilder` (`/**where**/`, `/**orderby**/`) con `OFFSET ... FETCH`. Orden dinámico solo desde whitelist de columnas.
- Paginado por keyset (solo con pedido explícito o problema medido en tabla grande, ver [15](./15-data-access-ef-core.md) §15.3): `WHERE (CreatedAt > @LastCreatedAt OR (CreatedAt = @LastCreatedAt AND Id > @LastId)) ORDER BY CreatedAt, Id OFFSET 0 ROWS FETCH NEXT @PageSize ROWS ONLY`, con índice sobre `(CreatedAt, Id)`. SQL Server no soporta `(a, b) > (@a, @b)`.
- Stored procedures: `commandType: CommandType.StoredProcedure`, parámetros con nombre. Se usan cuando la lógica ya vive en la base; no migrar SP a inline ni al revés sin pedido.
- Bulk: `IN @Ids` de Dapper hasta ~1000 valores; más que eso, TVP o `SqlBulkCopy`. Nunca un `ExecuteAsync` por fila en loop.
- Unicidad: la garantía es el índice `UNIQUE` en la base. Un "¿ya existe?" previo (validador o handler) no la da: dos requests simultáneos pasan los dos el chequeo. Ese chequeo es opcional (mensaje más claro); el `INSERT` siempre maneja el duplicado.
- Errores: `SqlException 2627/2601` (duplicado) ⇒ `SystemValidationException`; cancelación ⇒ sube sin mapear (`when (!cancellationToken.IsCancellationRequested)`: SqlClient puede reportarla como `SqlException`); deadlock (`1205`) ⇒ se reintenta o termina en `ConflictException` (§5.5); timeout (`-2`) ⇒ `CommandException` / `QueryException` (500), sin reintento automático (repetir una consulta que ya no da abasto la empeora: se mira el plan, §5.4); resto ⇒ `CommandException` / `QueryException` con parámetros **sin datos sensibles**. Atrapar `SqlException`, no `Exception`, y pasar la original como inner: `throw new QueryException(ErrorMessage.QueryFailure, ex, parameters);`.
- Scripts de base (tablas, índices, SP) en el PR como `.sql` idempotente (`IF NOT EXISTS`) y con rollback.
- Dapper.AOT: solo con Native AOT o un problema de arranque medido; en ese caso, con su analyzer (Dapper.Advisor). Las llamadas con `CommandDefinition` (regla de arriba) corren por Dapper clásico y no generan código AOT (DapperAOT issue #173): medir antes de prometer el beneficio. Un `TypeHandler` propio se ignora en la llamada interceptada: probar el parámetro.

### 5.3 Cache

- Lecturas cacheadas = decorator: `<Entidad>CachedQueryRepository : I<Entidad>QueryRepository` registrado con `services.Decorate<IX, XCached>()` (Scrutor). El handler no sabe que hay cache.
- Claves en `Domain/Structs/CacheKey.cs`. Toda escritura que afecta datos cacheados invalida la clave en su `Cached<X>CommandRepository`.
- Entradas de `IMemoryCache` siempre con `Size` y expiración (`SizeLimit` configurado). Nunca cachear datos por usuario sin la identidad en la clave.
- `IMemoryCache` es **por instancia**: con varias instancias de la API, invalidar en una escritura no limpia las otras. Esas siguen sirviendo el dato viejo hasta que expire. Dato que no tolera quedar viejo ⇒ no se cachea en memoria; el resto, TTL corto (segundos o pocos minutos) o caché distribuida.
- Stampede: al expirar una clave, N requests simultáneos recalculan lo mismo y golpean la base a la vez. En `net10.0`, `HybridCache` (`Microsoft.Extensions.Caching.Hybrid` 10.x): `GetOrCreateAsync` ejecuta la carga una sola vez por clave y el resto espera ese resultado. En `net8.0`, `SemaphoreSlim` con doble chequeo (claves acotadas; no una por usuario):

```csharp
// net10.0
var items = await hybridCache.GetOrCreateAsync(CacheKey.Items,
    async token => await inner.GetAllAsync(token), cancellationToken: cancellationToken);

// net8.0: IMemoryCache + SemaphoreSlim (gate: campo estático del decorator)
if (cache.TryGetValue(CacheKey.Items, out List<ItemResponse>? cached)) return cached!;
await gate.WaitAsync(cancellationToken);
try
{
    if (cache.TryGetValue(CacheKey.Items, out cached)) return cached!;
    var items = await inner.GetAllAsync(cancellationToken);
    cache.Set(CacheKey.Items, items, new MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1) });
    return items;
}
finally { gate.Release(); }
```

  `HybridCache.RemoveAsync(key)` limpia la caché distribuida (L2) y la memoria local, no la memoria de las otras instancias: mismo TTL corto.
- `HybridCache` en un servicio nuevo de `net10.0` sin precedente: expiración local (L1) menor que la distribuida (L2) y tags para invalidar por grupo. Dato por usuario o tenant: la identidad va en la clave, igual que con `IMemoryCache`. No mezclar `IMemoryCache` a mano y `HybridCache` para la misma entidad.

```csharp
var item = await hybridCache.GetOrCreateAsync(
    $"item:{tenantId}:{id}",
    async token => await inner.GetByIdAsync(id, token),
    new HybridCacheEntryOptions { Expiration = TimeSpan.FromMinutes(10), LocalCacheExpiration = TimeSpan.FromMinutes(2) },
    tags: [$"item:{id}"],
    cancellationToken: cancellationToken);

await hybridCache.RemoveByTagAsync($"item:{id}", cancellationToken);   // en la escritura
```

- Redis solo si el flag `EnableRedisCache:IsEnable` está activo; el código no debe asumirlo.

### 5.4 Consultas lentas: primero el plan, después el índice

- Una consulta lenta casi siempre es un índice que falta, no "la base". Antes de subir `commandTimeout`, agregar cache o reescribir la query: plan de ejecución real (`SET STATISTICS IO, TIME ON` + "Include Actual Execution Plan") sobre datos de volumen realista.
- Señales: `Table Scan` / `Clustered Index Scan` sobre una tabla grande para devolver pocas filas; `Key Lookup` repetido (candidato a `INCLUDE`); warning de conversión implícita (tipo o largo del parámetro distinto al de la columna: `DbString` arriba, §15); `Sort` caro por un `ORDER BY` sin índice.
- Índice nuevo: columnas de `WHERE` / `JOIN` primero (igualdad antes que rango), después `ORDER BY`; `INCLUDE` para las que solo van en el `SELECT`. `sys.dm_db_missing_index_details` es una pista, no una orden: validar contra el plan.
- Las columnas de `INCLUDE` no ordenan: solo evitan el lookup. Si falta una sola columna de la proyección, el lookup vuelve: el índice se valida contra la proyección exacta de la consulta (`Select` mínimo, §15.3), y un `SELECT *` rompe el cubrimiento. Un índice cubriente por cada consulta es un olor: se cubre la consulta medida, no todas.

  ```sql
  -- SQL Server
  CREATE NONCLUSTERED INDEX IX_Orders_CustomerId_OrderDate
      ON dbo.Orders (CustomerId, OrderDate) INCLUDE (TotalAmount, Status);

  -- PostgreSQL (>= 11)
  CREATE INDEX ix_orders_customer_id_order_date
      ON orders (customer_id, order_date) INCLUDE (total_amount, status);
  ```
- No indexar "por las dudas": cada índice encarece `INSERT` / `UPDATE` / `DELETE`. El PR justifica el índice con lecturas lógicas antes / después, y va como script `.sql` idempotente (§5.2).
- PostgreSQL 18, solo en repos que ya lo usan: tras migrar, re-evaluar los índices multicolumna con `EXPLAIN (ANALYZE)` (*skip scan* puede volver innecesario un índice extra; el plan ya muestra buffers y lookups), sin borrar ninguno sin medir en carga real. PK nueva en un esquema que ya usa UUID: `uuidv7()` (ordenado por tiempo), no UUID aleatorio. Autenticación SCRAM: `md5` está deprecado.
- PostgreSQL 19 (GA 19/11/2026): `INSERT ... ON CONFLICT DO SELECT`, `REPACK` y `pg_plan_advice` solo con `SHOW server_version` ≥ 19 confirmado en el entorno y soporte del driver verificado en la doc de Npgsql. En un repo que no declara la versión del servidor sigue valiendo el patrón de PG 15 a 18 (`ON CONFLICT (...) DO UPDATE ... RETURNING`, `VACUUM FULL` / `CLUSTER`).
- Borrados o cargas masivas sobre tablas muy indexadas: por lotes (`DELETE TOP (n)` en loop) o por partición, nunca una sola transacción gigante.
- Vale igual con EF Core (§15): el SQL que genera se analiza con el mismo plan.

### 5.5 Concurrencia (muchos requests, varias instancias)

Los requests corren en paralelo y la API puede tener varias instancias: nada que se "lee, calcula en C# y guarda" o "verifica y después escribe" es seguro. La garantía vive en la base (índice único, `UPDATE` condicional, lock), no en el código ni en una variable de la instancia.

- **Lost update (editar sobre una versión vieja)**: las tablas editables por varios usuarios llevan `RowVersion ROWVERSION NOT NULL`. Contrato con el front: el `Response` devuelve `rowVersion` (base64 de la columna), el `Request` de `PUT` / `PATCH` lo devuelve en el body, y si no coincide la API responde **409** (`ConflictException`). El `UPDATE` compara contra el valor que mandó el cliente, nunca contra uno releído en el handler (ese siempre coincide). El validador rechaza un base64 inválido (400).

```csharp
const string sql = """
    UPDATE dbo.Item SET Name = @Name
    WHERE Id = @Id AND RowVersion = @RowVersion;
    """;
var rows = await dbSession.Connection.ExecuteAsync(new CommandDefinition(
    sql, new { Id = id, Name = name, RowVersion = Convert.FromBase64String(rowVersion) },
    transaction: dbSession.Transaction, cancellationToken: cancellationToken));

if (rows == 0)   // 0 filas: no existe o cambió
{
    var exists = await dbSession.Connection.QueryFirstOrDefaultAsync<int?>(new CommandDefinition(
        "SELECT 1 FROM dbo.Item WHERE Id = @Id", new { Id = id },
        transaction: dbSession.Transaction, cancellationToken: cancellationToken));
    throw exists is null ? new NotFoundException(ErrorMessage.ItemNotFound) : new ConflictException(ErrorMessage.ItemModified);
}
```

- **Contadores, stock, saldos**: una sentencia atómica y mirar las filas afectadas. Nunca leer, calcular en C# y guardar (en una prueba con 50 pedidos simultáneos sobre 20 unidades, ese patrón vendió los 50). En EF Core, `ExecuteUpdateAsync` ([15](./15-data-access-ef-core.md) §15.5).

```csharp
const string sql = "UPDATE dbo.Stock SET Qty = Qty - @N WHERE Id = @Id AND Qty >= @N;";
var rows = await dbSession.Connection.ExecuteAsync(new CommandDefinition(
    sql, new { Id = id, N = quantity }, transaction: dbSession.Transaction, cancellationToken: cancellationToken));
if (rows == 0) throw new SystemValidationException(ErrorMessage.InsufficientStock);
```

- **Numeradores**: `SEQUENCE` (`SELECT NEXT VALUE FOR dbo.OrderNumber;`) o `IDENTITY`. Nunca `SELECT MAX(Number) + 1`: dos requests leen el mismo máximo. Pueden quedar huecos (un rollback no devuelve el número); si la numeración tiene que ser sin huecos, se decide con el usuario.
- **Upsert**: `MERGE` solo con `WITH (HOLDLOCK)` en la tabla destino. La alternativa es `UPDATE` y, si afectó 0 filas, `INSERT` con índice único y, ante `2627` / `2601`, volver al `UPDATE`.

```sql
MERGE dbo.StockSku WITH (HOLDLOCK) AS t
USING (VALUES (@Sku, @Qty)) AS s (Sku, Qty) ON t.Sku = s.Sku
WHEN MATCHED THEN UPDATE SET Qty = t.Qty + s.Qty
WHEN NOT MATCHED THEN INSERT (Sku, Qty) VALUES (s.Sku, s.Qty);
```

- **"Verifico y después escribo"** que un índice único no puede garantizar (ej. superposición de reservas): dentro de la transacción, `SELECT ... WITH (UPDLOCK, HOLDLOCK)` sobre las columnas del filtro, con índice sobre ellas (sin índice escanea la tabla y los requests se pisan hasta dar deadlock `1205`), o `sp_getapplock` con una clave de negocio y `@LockOwner = 'Transaction'` (se libera en el `Commit` / `Rollback`). Un retorno `< 0` es que no consiguió el lock: error, no seguir.

```sql
EXEC @Result = sys.sp_getapplock @Resource = @Key, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
IF @Result < 0 THROW 50001, 'No se pudo obtener el lock.', 1;
```

- **Deadlock (`1205`)**: la base elige una víctima y revierte su transacción entera. Si la operación completa se puede repetir (idempotente, o todo lo hecho quedó revertido), se reintenta **el bloque transaccional entero**, 2 o 3 veces con espera creciente y jitter; nunca un comando suelto dentro de una transacción abierta. Agotados los intentos, `ConflictException` (409). Si no se puede repetir, no se reintenta y el `1205` también termina en 409. El reintento va en el handler, alrededor de la transacción; los repos siguen mapeando como en §5.2 (el `1205` llega como `CommandException` con la `SqlException` de inner):

```csharp
for (var attempt = 1; ; attempt++)
{
    try
    {
        await ExecuteInTransactionAsync(cancellationToken);   // BeginTransactionAsync ... CommitAsync / RollbackAsync
        break;
    }
    catch (CommandException ex) when (ex.InnerException is SqlException { Number: 1205 })
    {
        if (attempt >= 3) throw new ConflictException(ErrorMessage.ConcurrentOperation);
        await Task.Delay(TimeSpan.FromMilliseconds(100 * attempt + Random.Shared.Next(50)), cancellationToken);
    }
}
```

- **Transacciones cortas**: solo las sentencias que tienen que ser atómicas. Los procesos grandes, por lotes (`DELETE TOP (n)`, §5.4), una transacción por lote: miles de locks de fila escalan a un lock de tabla (*lock escalation*) y bloquean a todos los demás. `READ_COMMITTED_SNAPSHOT` (las lecturas no esperan a las escrituras) es una decisión de la base, no del agente: se propone, no se activa desde la app ni desde un script de la feature.
- **SQL Server 2025, optimized locking**: viene apagado y se habilita por base. Igual que RCSI, se **propone** en el PR (RCSI + ADR + `OPTIMIZED_LOCKING`) y lo decide el dueño de la base. Sin RCSI no rinde completo (*lock after qualification*), y código que depende del orden estricto de las transacciones puede cambiar de comportamiento: probar con pedidos concurrentes. Los hints `UPDLOCK` / `HOLDLOCK` y todo `MERGE` se respetan, pero ese statement pierde *lock after qualification*: los patrones de arriba siguen siendo correctos y se dejan solo donde la lógica los necesita. Antes de asumir cómo bloquea la base, mirar qué tiene activo:

```sql
SELECT name, is_read_committed_snapshot_on, is_accelerated_database_recovery_on, is_optimized_locking_on
FROM sys.databases WHERE name = DB_NAME();
```

- **Exports y listados grandes**: no cargar todo en memoria (`QueryAsync` bufferea todo). `QueryUnbufferedAsync<T>` de Dapper devuelve `IAsyncEnumerable<T>` y se escribe a la respuesta a medida que llega (en EF Core, `AsAsyncEnumerable()`, §15.3). Mantiene la conexión abierta mientras el cliente lee: sin transacción alrededor, con `commandTimeout` y un tope de filas acordado.
