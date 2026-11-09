## 18. Stored procedures y SQL directo

Llamada a SP con Dapper y ADO.NET, scripts versionados, T-SQL seguro y permisos mínimos. Leer al crear o llamar un stored procedure, o al tocar código ADO.NET existente.

**Cuándo aplica**: el proyecto ya usa stored procedures o ADO.NET crudo (`SqlConnection` / `SqlCommand`), o el usuario pide un SP. Si el proyecto no los usa, no los agregues: el acceso a datos nuevo sigue §5 (Dapper con SQL inline) o §15 (EF Core). Con SPs ya presentes, el código nuevo usa la forma del repo (§5.2, §13.5); no migres SP a inline ni al revés sin pedido.

### 18.1 Llamar un SP con Dapper

```csharp
internal class OrderQueryRepository(DbSession dbSession) : IOrderQueryRepository
{
    public async Task<OrderResponse?> GetByCodeAsync(string code, CancellationToken cancellationToken)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@Code", code, DbType.AnsiString, size: 22);

        return await dbSession.Connection.QueryFirstOrDefaultAsync<OrderResponse>(
            new CommandDefinition(
                "dbo.Order_GetByCode",
                parameters,
                transaction: dbSession.Transaction,
                commandType: CommandType.StoredProcedure,
                cancellationToken: cancellationToken));
    }
}
```

- `commandType: CommandType.StoredProcedure` y nombre con esquema (`dbo.Order_GetByCode`). Nunca `EXEC dbo.X @a, @b` armado en un string.
- `CommandDefinition` con `transaction:` y `cancellationToken:` igual que el SQL inline (§5.2).
- **`DynamicParameters` con `DbType` y `size` explícitos** en strings y decimales (`DbType.AnsiString` para `varchar`, `DbType.String` para `nvarchar`). Un `string` sin tipo viaja como `nvarchar(4000)`: si la columna es `varchar` fuerza conversión implícita y scan de índice (§5.2, `DbString`).
- `decimal`: `parameters.Add("@Amount", amount, DbType.Decimal, precision: 18, scale: 2)`.
- Nombre de SP y parámetros: constantes del repositorio, nunca de input del usuario.

### 18.2 Parámetros de salida, return y varios resultados

```csharp
var parameters = new DynamicParameters();
parameters.Add("@Code", code, DbType.AnsiString, size: 22);
parameters.Add("@NewId", dbType: DbType.Int32, direction: ParameterDirection.Output);
parameters.Add("@Result", dbType: DbType.Int32, direction: ParameterDirection.ReturnValue);

await dbSession.Connection.ExecuteAsync(new CommandDefinition(
    "dbo.Order_Create", parameters, dbSession.Transaction,
    commandType: CommandType.StoredProcedure, cancellationToken: cancellationToken));

var newId = parameters.Get<int>("@NewId");
var result = parameters.Get<int>("@Result");   // RETURN del SP
```

- Los valores de salida se leen **después** de que termina el `ExecuteAsync`.
- `RETURN` del SP es solo un código entero; los datos salen por `SELECT` o `OUTPUT`. No usar `RETURN` para devolver ids o importes.
- Varios `SELECT` en un SP: `QueryMultipleAsync`, leyendo cada resultado en el orden en que el SP los devuelve.

```csharp
await using var grid = await dbSession.Connection.QueryMultipleAsync(new CommandDefinition(
    "dbo.Order_GetDetail", new { OrderId = id }, dbSession.Transaction,
    commandType: CommandType.StoredProcedure, cancellationToken: cancellationToken));

var header = await grid.ReadFirstOrDefaultAsync<OrderHeaderResponse>();
var lines = (await grid.ReadAsync<OrderLineResponse>()).ToList();
```

- El orden y las columnas de cada resultado son contrato entre el SP y el repositorio: cambiar uno sin el otro rompe en runtime. Cambios de SP y de repositorio van en el mismo PR.
- Errores: igual que §5.2 (`SqlException 2627/2601` → `SystemValidationException`; cancelación sin mapear; resto → `CommandException` / `QueryException` sin datos sensibles).

### 18.3 ADO.NET existente

**Cuándo aplica**: repos con `SqlCommand` a mano. No lo reescribas a Dapper fuera de alcance (§13.5); si lo tocás, dejalo correcto.

```csharp
await using var connection = new SqlConnection(connectionString);
await connection.OpenAsync(cancellationToken);

await using var command = new SqlCommand("dbo.Order_GetByCode", connection)
{
    CommandType = CommandType.StoredProcedure,
    CommandTimeout = 30
};
command.Parameters.Add(new SqlParameter("@Code", SqlDbType.VarChar, 22) { Value = code });

await using var reader = await command.ExecuteReaderAsync(cancellationToken);
while (await reader.ReadAsync(cancellationToken)) { /* mapear explícito */ }
```

- `await using` en `SqlConnection`, `SqlCommand` y `SqlDataReader`. Nunca una conexión sin liberar.
- **`SqlParameter` tipado** (`SqlDbType`, tamaño, precisión). Nunca `Parameters.AddWithValue`: infiere el tipo del valor, genera conversiones implícitas y planes de ejecución distintos por largo del string.
- Valor opcional: `Value = (object?)x ?? DBNull.Value`.
- Métodos async con `CancellationToken` en `OpenAsync`, `ExecuteReaderAsync`, `ExecuteNonQueryAsync` y `ReadAsync`. Sin `.Result` ni `.Wait()` (§2).
- La connection string viene de config / Key Vault (§8), nunca literal en el código.

### 18.4 Scripts de SP en el repo

- Cada SP es un `.sql` versionado en el repo (ej. `db/procedures/dbo.Order_GetByCode.sql`), un SP por archivo, nombre del archivo = nombre del objeto. Si el repo ya tiene otra carpeta, se usa esa.
- **`CREATE OR ALTER PROCEDURE`**: el script es idempotente, se puede correr dos veces. Cambios de tabla o índice, con `IF NOT EXISTS` (§5.2).
- El PR incluye el script de rollback (el SP anterior) cuando cambia la base (§5.2, §13.3: DDL es riesgo alto).
- Nada de ejecutar scripts de DDL desde la app al arrancar.
- Convención de nombre: la que ya usa la base (`Entidad_Accion`, `usp_...`). Sin el prefijo `sp_`: SQL Server lo busca primero en `master`.

### 18.5 T-SQL seguro dentro del SP

```sql
CREATE OR ALTER PROCEDURE dbo.Order_Create
    @Code   VARCHAR(22),
    @Amount DECIMAL(18, 2),
    @NewId  INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.[Order] (Code, Amount, CreatedAt)
        VALUES (@Code, @Amount, SYSUTCDATETIME());

        SET @NewId = SCOPE_IDENTITY();

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;   -- relanza el error original, con su número
    END CATCH
END;
```

- `SET NOCOUNT ON`: sin el mensaje de filas afectadas por cada sentencia.
- `SET XACT_ABORT ON`: un error de runtime aborta y revierte la transacción; imprescindible si el SP abre una.
- `TRY / CATCH` con `ROLLBACK` condicionado a `@@TRANCOUNT > 0` y **`THROW`** (no `RAISERROR`, no tragarse el error). Así los números 2627/2601 llegan al repositorio (§5.2).
- Si el SP corre dentro de la transacción del `IUnitOfWork` (§5.1), no abre la suya: chequear `@@TRANCOUNT` o dejar que la maneje la capa de aplicación, pero no mezclar los dos modelos sin decidirlo.
- Esquema y columnas explícitos, sin `SELECT *`. Fechas en UTC (`SYSUTCDATETIME()`).
- Autorización a nivel objeto: el SP filtra por la entidad / usuario que recibe del token (§11.1 punto 1), no confía en un id que llega solo del request.

### 18.6 SQL dinámico

- **Nunca** concatenar input en un string SQL, ni en C# ni dentro del SP (`'SELECT ... WHERE X = ''' + @x + ''''`).
- Si el SP necesita SQL dinámico (filtros opcionales, columna de orden): `sp_executesql` con parámetros tipados.

```sql
DECLARE @sql NVARCHAR(MAX) = N'SELECT Code, Amount FROM dbo.[Order] WHERE 1 = 1';
IF @Code IS NOT NULL SET @sql += N' AND Code = @Code';

EXEC sys.sp_executesql @sql, N'@Code VARCHAR(22)', @Code = @Code;
```

- Identificadores dinámicos (tabla, columna de `ORDER BY`): **whitelist** primero y `QUOTENAME(@col)` al armar; el nombre no se parametriza. Columna que no está en la lista ⇒ error, no se ejecuta (§5.2).
- Las condiciones opcionales de un SP muchas veces se resuelven sin SQL dinámico (`WHERE (@Code IS NULL OR Code = @Code) OPTION (RECOMPILE)`): preferir esa forma si el costo es aceptable.

### 18.7 Table-valued parameters en vez de N llamadas

Nunca un `ExecuteAsync` por fila en un loop (§5.2). Para lotes, un **TVP**:

```sql
CREATE TYPE dbo.OrderLineType AS TABLE (ProductCode VARCHAR(22) NOT NULL, Quantity INT NOT NULL);
```

```csharp
var table = new DataTable();
table.Columns.Add("ProductCode", typeof(string));
table.Columns.Add("Quantity", typeof(int));
foreach (var line in lines) table.Rows.Add(line.ProductCode, line.Quantity);

var parameters = new DynamicParameters();
parameters.Add("@OrderId", orderId, DbType.Int32);
parameters.Add("@Lines", table.AsTableValuedParameter("dbo.OrderLineType"));
```

- El tipo (`CREATE TYPE`) se versiona junto al SP. Cambiarlo exige recrear los SPs que lo usan: coordinar en el mismo script.
- Límite de tamaño del lote (`Max...` en el validador, §6): un TVP sin tope es consumo de recursos (§11.1 punto 4).
- Más de unas miles de filas, `SqlBulkCopy` (§5.2: pasado el tope de `IN @Ids`, TVP o `SqlBulkCopy`).

### 18.8 Timeouts, transacciones y permisos

- **`commandTimeout`** explícito en SPs largos (reportes, procesos) y definido en config, no mágico. El default de 30 s no se sube "para que ande": primero se mira el plan de ejecución.
- Varios SP en una misma operación de negocio: una sola transacción vía `IUnitOfWork` (§5.1); cada SP recibe `transaction: dbSession.Transaction`. Un SP que abre su propia transacción y hace `ROLLBACK` revierte también la del `IUnitOfWork`.
- **Mínimo privilegio**: el usuario de la app con `GRANT EXECUTE ON dbo.Order_Create TO [AppRole]` por SP, o por esquema (`GRANT EXECUTE ON SCHEMA::app`). Sin `db_owner`, sin `db_datareader` / `db_datawriter` globales si todo pasa por SPs. Los grants van en el mismo script que el SP.
- Sin `EXECUTE AS OWNER` salvo necesidad documentada en el PR (es escalada de privilegios, §11.6).
- SP que accede a otra base o a un linked server: documentarlo y revisarlo como riesgo alto (§13.3).

### 18.9 Checklist de SPs

- [ ] `CommandType.StoredProcedure`, nombre con esquema, parámetros tipados (`DbType` / `SqlDbType` con tamaño).
- [ ] Sin `AddWithValue`, sin `EXEC` concatenado, sin SQL dinámico por concatenación.
- [ ] `await using` en ADO.NET; `CommandDefinition` con transacción y token en Dapper.
- [ ] Script `.sql` en el repo con `CREATE OR ALTER`, idempotente, con rollback en el PR.
- [ ] `SET NOCOUNT ON`, `SET XACT_ABORT ON`, `TRY / CATCH` con `THROW`.
- [ ] Lotes con TVP o `SqlBulkCopy`, con tope; nunca un SP por fila en loop.
- [ ] `GRANT EXECUTE` mínimo en el mismo script; sin `db_owner`.
- [ ] Cambio de columnas o resultados del SP y su repositorio en el mismo PR.
