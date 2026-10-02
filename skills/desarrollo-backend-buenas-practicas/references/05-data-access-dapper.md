## 5. Acceso a datos (Dapper)

Conexiones, transacciones, SQL con Dapper y cache por decorator. Leer al tocar repositorios, SQL o cache.

### 5.1 Conexiones y transacciones

- `DapperContext` (singleton) crea conexiones por base (ej. `MainDb`, `LogsDb`). `DbSession` (scoped) abre la conexión del request. `UnitOfWork` (scoped) expone los repos de comando y la transacción.
- Escrituras: siempre por `IUnitOfWork` y dentro de `BeginTransaction` / `Commit` / `Rollback` si tocan más de una sentencia.
- Lecturas: repos de query inyectados directo en el handler. Código nuevo usa `DbSession`; si hace falta otra base, `using var connection = context.CreateConnectionX();`. Nunca dejar una conexión sin `using`.
- Aislamiento por defecto `ReadCommitted`. Cambiarlo es decisión explícita.

### 5.2 SQL

```csharp
internal class BankCommandRepository(DbSession dbSession) : IBankCommandRepository
{
    public async Task CreateAsync(string code, string name, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO dbo.Bank (Code, Name, CreatedAt)
            VALUES (@Code, @Name, SYSUTCDATETIME());
            """;
        var parameters = new { Code = code, Name = name };

        try
        {
            await dbSession.Connection.ExecuteAsync(new CommandDefinition(
                sql, parameters, transaction: dbSession.Transaction, cancellationToken: cancellationToken));
        }
        catch (SqlException ex) when (ex.Number == 2627)
        {
            throw new SystemValidationException(ErrorMessage.BankAlreadyExists);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
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
- Errores: `SqlException 2627/2601` (duplicado) ⇒ `SystemValidationException`; `OperationCanceledException` ⇒ relanzar; resto ⇒ `CommandException` / `QueryException` con parámetros **sin datos sensibles**.
- Scripts de base (tablas, índices, SP) en el PR como `.sql` idempotente (`IF NOT EXISTS`) y con rollback.

### 5.3 Cache

- Lecturas cacheadas = decorator: `<Entidad>CachedQueryRepository : I<Entidad>QueryRepository` registrado con `services.Decorate<IX, XCached>()` (Scrutor). El handler no sabe que hay cache.
- Claves en `Domain/Structs/CacheKey.cs`. Toda escritura que afecta datos cacheados invalida la clave en su `Cached<X>CommandRepository`.
- Entradas de `IMemoryCache` siempre con `Size` y expiración (`SizeLimit` configurado). Nunca cachear datos por usuario sin la identidad en la clave.
- Redis solo si el flag `EnableRedisCache:IsEnable` está activo; el código no debe asumirlo.
