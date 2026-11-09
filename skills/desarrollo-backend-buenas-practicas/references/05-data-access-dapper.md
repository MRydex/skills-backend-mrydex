## 5. Acceso a datos (Dapper)

Conexiones, transacciones, SQL con Dapper y cache por decorator. Leer al tocar repositorios, SQL o cache.

### 5.1 Conexiones y transacciones

- `DapperContext` (singleton) crea conexiones por base (ej. `MainDb`, `LogsDb`). `DbSession` (scoped) abre la conexión del request. `UnitOfWork` (scoped) expone los repos de comando y la transacción.
- Escrituras: siempre por `IUnitOfWork` y dentro de `BeginTransaction` / `Commit` / `Rollback` si tocan más de una sentencia.
- Lecturas: repos de query inyectados directo en el handler. Código nuevo usa `DbSession`; si hace falta otra base, `using var connection = context.CreateConnectionX();`. Nunca dejar una conexión sin `using`.
- Aislamiento por defecto `ReadCommitted`. Cambiarlo es decisión explícita.

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
- Siempre `CommandDefinition` con `transaction:` y `cancellationToken:`.
- Parámetros: objeto anónimo o `DynamicParameters`. Strings con tipo/largo cuando el índice importa: `new DbString { Value = x, IsAnsi = true, Length = 22 }` (evita conversiones implícitas y scans).
- Filtros dinámicos y paginado: `Dapper.SqlBuilder` (`/**where**/`, `/**orderby**/`) con `OFFSET ... FETCH`. Orden dinámico solo desde whitelist de columnas.
- Stored procedures: `commandType: CommandType.StoredProcedure`, parámetros con nombre. Se usan cuando la lógica ya vive en la base; no migrar SP a inline ni al revés sin pedido.
- Bulk: `IN @Ids` de Dapper hasta ~1000 valores; más que eso, TVP o `SqlBulkCopy`. Nunca un `ExecuteAsync` por fila en loop.
- Unicidad: la garantía es el índice `UNIQUE` en la base. Un "¿ya existe?" previo (validador o handler) no la da: dos requests simultáneos pasan los dos el chequeo. Ese chequeo es opcional (mensaje más claro); el `INSERT` siempre maneja el duplicado.
- Errores: `SqlException 2627/2601` (duplicado) ⇒ `SystemValidationException`; cancelación ⇒ sube sin mapear (`when (!cancellationToken.IsCancellationRequested)`: SqlClient puede reportarla como `SqlException`); resto ⇒ `CommandException` / `QueryException` con parámetros **sin datos sensibles**. Atrapar `SqlException`, no `Exception`, y pasar la original como inner: `throw new QueryException(ErrorMessage.QueryFailure, ex, parameters);`.
- Scripts de base (tablas, índices, SP) en el PR como `.sql` idempotente (`IF NOT EXISTS`) y con rollback.

### 5.3 Cache

- Lecturas cacheadas = decorator: `<Entidad>CachedQueryRepository : I<Entidad>QueryRepository` registrado con `services.Decorate<IX, XCached>()` (Scrutor). El handler no sabe que hay cache.
- Claves en `Domain/Structs/CacheKey.cs`. Toda escritura que afecta datos cacheados invalida la clave en su `Cached<X>CommandRepository`.
- Entradas de `IMemoryCache` siempre con `Size` y expiración (`SizeLimit` configurado). Nunca cachear datos por usuario sin la identidad en la clave.
- Redis solo si el flag `EnableRedisCache:IsEnable` está activo; el código no debe asumirlo.

### 5.4 Consultas lentas: primero el plan, después el índice

- Una consulta lenta casi siempre es un índice que falta, no "la base". Antes de subir `commandTimeout`, agregar cache o reescribir la query: plan de ejecución real (`SET STATISTICS IO, TIME ON` + "Include Actual Execution Plan") sobre datos de volumen realista.
- Señales: `Table Scan` / `Clustered Index Scan` sobre una tabla grande para devolver pocas filas; `Key Lookup` repetido (candidato a `INCLUDE`); warning de conversión implícita (tipo o largo del parámetro distinto al de la columna: `DbString` arriba, §15); `Sort` caro por un `ORDER BY` sin índice.
- Índice nuevo: columnas de `WHERE` / `JOIN` primero (igualdad antes que rango), después `ORDER BY`; `INCLUDE` para las que solo van en el `SELECT`. `sys.dm_db_missing_index_details` es una pista, no una orden: validar contra el plan.
- No indexar "por las dudas": cada índice encarece `INSERT` / `UPDATE` / `DELETE`. El PR justifica el índice con lecturas lógicas antes / después, y va como script `.sql` idempotente (§5.2).
- Borrados o cargas masivas sobre tablas muy indexadas: por lotes (`DELETE TOP (n)` en loop) o por partición, nunca una sola transacción gigante.
- Vale igual con EF Core (§15): el SQL que genera se analiza con el mismo plan.
