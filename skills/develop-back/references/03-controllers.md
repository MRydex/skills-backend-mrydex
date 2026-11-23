## 3. Controllers

Forma de los controllers, rutas, roles y códigos de respuesta. Leer al crear o modificar un endpoint.

```csharp
[ApiController]
[Route("api/v{version:apiVersion}/[controller]/[action]")]
[ApiVersion("1.0")]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
public class ItemController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [RoleAuthorization(Roles.ItemAdmin)]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<ActionResult> CreateItem(CreateItemRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(request, cancellationToken);
        return CreatedAtAction(nameof(GetItem), new { code = request.Code }, null);
    }

    [HttpGet]
    [RoleAuthorization(Roles.ItemRead)]
    [ProducesResponseType(typeof(ItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ItemResponse>> GetItem([FromQuery] GetItemRequest request, CancellationToken cancellationToken)
        => Ok(await mediator.Send(request, cancellationToken));

    [HttpGet]
    [RoleAuthorization(Roles.ItemRead)]
    [ProducesResponseType(typeof(PagedResponse<ItemResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult<PagedResponse<ItemResponse>>> GetItems([FromQuery] GetItemsRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(request, cancellationToken);
        return result is null ? NoContent() : Ok(result);
    }
}
```

- Base `ControllerBase`. Atributos de clase: `[ApiController]`, `[Route(...)]`, `[ApiVersion]`, `[ProducesResponseType]` de 401/403/400/500.
- Ruta por `[action]`: el nombre del action = nombre del request sin `Request` (`CreateItem` ↔ `CreateItemRequest`).
- Prefijo de ruta: el que ya usa la API (`api/v{version:apiVersion}/...` o `v{version:apiVersion}/...`). No cambiarlo en una API existente: rompe al frontend. Si el pedido fija una ruta literal (`/api/usuarios`) que difiere de la convención versionada, gana el pedido y el reporte lo dice.
- Versión nueva de un endpoint: carpeta `Controllers/V2/`, request y handler con sufijo `V2` (`GetItemsRequestV2`, `GetItemsV2Handler`). La V1 queda intacta.
- **Todo action lleva `[RoleAuthorization(...)]`** con roles de `Domain/Structs/Roles.cs`. Endpoint anónimo = decisión explícita, documentada en el PR (único caso hoy: health check). Sin la librería Corp: `[Authorize(Roles = Roles.X)]` (§11.2). Si el repo usa otro esquema de auth, el del repo, y el endpoint nuevo nunca queda menos protegido que sus vecinos.
- Retorno `Task<ActionResult<T>>` / `Task<ActionResult>`. Códigos: `200 Ok`, `201 CreatedAtAction` (apuntando al GET del recurso creado: `CreatedAtAction(nameof(GetItem), ...)`; con `null` el `Location` queda apuntando al mismo POST), `204 NoContent` en listados vacíos, `404` por `NotFoundException` en un recurso puntual (§4). Errores **solo** por excepción → `ProblemDetails`.
- `[ProducesResponseType]` por action con el tipo real: Swagger es el contrato con el frontend.
- Endpoint tocado en un refactor ⇒ comparar `swagger.json` antes y después: rutas, verbos, nombres y
  casing de propiedades, nulabilidad. La forma del JSON no cambia sin coordinar con el front, y un
  campo que pasa de `null` a ausente (o al revés) también rompe.
- Verbos: `GET` lectura, `POST` alta, `PUT` reemplazo, `PATCH` cambio parcial o de estado (reactivar, aprobar), `DELETE` baja. Nunca `GET` con efectos.
- Idempotencia por verbo: `GET` y `DELETE` siempre (borrar lo ya borrado no es error de contrato: documentar si devuelve `204` o `404`). `PUT` reemplaza el recurso entero: lo que el cliente no manda se pisa. `PATCH` cambia solo lo enviado; diseñarlo idempotente ("estado = X", nunca "incrementar"). `POST` no lo es: si el cliente puede reintentar (timeout, red) y un duplicado hace daño (pagos, pedidos, transferencias), el alta acepta el header `Idempotency-Key` (detalle abajo). Solo los idempotentes se reintentan ([09](./09-http-integrations.md)).
- **`Idempotency-Key`** (solo en altas donde un duplicado hace daño; no en todo `POST`). Contrato con el front: header `Idempotency-Key` con un UUID que el front genera **una vez por intención del usuario** y repite en cada reintento de esa misma intención (otra intención, otra key). Backend: la key se **reserva de forma atómica con el `INSERT`**, no con un `SELECT` previo (dos `POST` simultáneos con la misma key: la restricción `UNIQUE` deja ganar a uno):

  ```sql
  CREATE TABLE dbo.IdempotencyKey (
      UserId nvarchar(64) NOT NULL, [Key] uniqueidentifier NOT NULL, BodyHash binary(32) NOT NULL,
      Estado tinyint NOT NULL,                                   -- 0 en curso, 1 terminada
      StatusCode int NULL, ResponseBody nvarchar(max) NULL,
      CreatedAt datetime2 NOT NULL, ExpiresAt datetime2 NOT NULL,
      CONSTRAINT UQ_IdempotencyKey UNIQUE (UserId, [Key]));
  ```

  ```csharp
  try
  {
      await connection.ExecuteAsync("""
          INSERT INTO dbo.IdempotencyKey (UserId, [Key], BodyHash, Estado, CreatedAt, ExpiresAt)
          VALUES (@UserId, @Key, @BodyHash, 0, SYSUTCDATETIME(), DATEADD(HOUR, 24, SYSUTCDATETIME()))
          """, new { UserId = userId, Key = key, BodyHash = SHA256.HashData(body) });
      // ganó: ejecutar la operación y después UPDATE ... SET Estado = 1, StatusCode, ResponseBody
  }
  catch (SqlException e) when (e.Number is 2627 or 2601)          // UNIQUE violada: otro la reservó antes
  {
      // leer la fila (UserId, Key) y decidir según la tabla de abajo
  }
  ```

  | Caso | Respuesta |
  | :--- | :--- |
  | Key nueva | Ejecuta, guarda `StatusCode` y `ResponseBody`, `Estado = 1` |
  | Misma key, `Estado = 0` (todavía en curso) | `ConflictException` ⇒ `409` (el front avisa que sigue en curso; el usuario reintenta) |
  | Misma key, `Estado = 1`, mismo `BodyHash` | La respuesta guardada, mismo status y body, sin ejecutar de nuevo |
  | Misma key, otro `BodyHash` | `SystemValidationException` ⇒ `400` (la key se reusó para otra intención; el status de validación del equipo es `400`, [07](./07-errors-responses.md)) |

  La key se acota por `UserId` del token (nunca global: otro usuario podría pisarla). `BodyHash` incluye el método y la ruta además del body: la misma key en otro endpoint no devuelve la respuesta del primero. `ResponseBody` queda guardado en claro hasta que vence: si la respuesta trae datos sensibles, se guarda solo el id del recurso creado y la respuesta se rearma. Vencimiento: `ExpiresAt` (24 h) y un job que borra `WHERE ExpiresAt < SYSUTCDATETIME()`. Si el proceso cae con la reserva en curso, la fila queda en `Estado = 0`: pasado un tiempo mayor al timeout máximo de la operación (si no, la primera instancia puede seguir viva y se ejecuta dos veces) se retoma con `UPDATE ... SET CreatedAt = SYSUTCDATETIME() WHERE UserId = @UserId AND [Key] = @Key AND Estado = 0 AND CreatedAt < @Limite` y filas afectadas = 1 (solo una instancia la toma). Si la operación falla sin efecto, borrar la reserva para que el reintento pueda ejecutar.
- Query complejas: `[FromQuery]` sobre el request record. Body: sin atributo (inferido por `[ApiController]`).
- Método HTTP `QUERY` (RFC 10008, junio 2026): lectura como `GET` (segura, idempotente) con los filtros en el body,
  para búsquedas que no entran en la URL. **Todavía no es el default del equipo.** .NET 10 trae `HttpMethods.Query` y
  `HttpMethod.Query`, pero no `[HttpQuery]` ni `MapQuery` (se declara con `[AcceptVerbs("QUERY")]` o `MapMethods`), y
  el OpenAPI generado no incluye esos endpoints, así que el contrato con el front ([17](./17-contrato-openapi.md)) no
  los ve. Usarlo solo con pedido explícito y después de verificar que IIS, el proxy y CORS dejan pasar el verbo
  (`Access-Control-Allow-Methods: QUERY`); documentar el endpoint a mano. Si no, `GET` + `[FromQuery]`, o `POST`
  cuando los filtros no entran en la URL.
- Endpoint nuevo ⇒ su `.md` en la carpeta de docs que el repo ya usa (`Documentacion/<Feature>/` por defecto). Si el repo no documenta endpoints (o es nuevo y el usuario no lo pidió), no se crea la carpeta: alcanza con el OpenAPI.
