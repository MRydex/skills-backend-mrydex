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
- Prefijo de ruta: el que ya usa la API (`api/v{version:apiVersion}/...` o `v{version:apiVersion}/...`). No cambiarlo en una API existente: rompe al frontend.
- Versión nueva de un endpoint: carpeta `Controllers/V2/`, request y handler con sufijo `V2` (`GetItemsRequestV2`, `GetItemsV2Handler`). La V1 queda intacta.
- **Todo action lleva `[RoleAuthorization(...)]`** con roles de `Domain/Structs/Roles.cs`. Endpoint anónimo = decisión explícita, documentada en el PR (único caso hoy: health check). Sin la librería Corp: `[Authorize(Roles = Roles.X)]` (§11.2). Si el repo usa otro esquema de auth, el del repo, y el endpoint nuevo nunca queda menos protegido que sus vecinos.
- Retorno `Task<ActionResult<T>>` / `Task<ActionResult>`. Códigos: `200 Ok`, `201 CreatedAtAction` (apuntando al GET del recurso creado: `CreatedAtAction(nameof(GetItem), ...)`; con `null` el `Location` queda apuntando al mismo POST), `204 NoContent` en listados vacíos, `404` por `NotFoundException` en un recurso puntual (§4). Errores **solo** por excepción → `ProblemDetails`.
- `[ProducesResponseType]` por action con el tipo real: Swagger es el contrato con el frontend.
- Endpoint tocado en un refactor ⇒ comparar `swagger.json` antes y después: rutas, verbos, nombres y
  casing de propiedades, nulabilidad. La forma del JSON no cambia sin coordinar con el front, y un
  campo que pasa de `null` a ausente (o al revés) también rompe.
- Verbos: `GET` lectura, `POST` alta, `PUT` reemplazo, `PATCH` cambio parcial o de estado (reactivar, aprobar), `DELETE` baja. Nunca `GET` con efectos.
- Idempotencia por verbo: `GET` y `DELETE` siempre (borrar lo ya borrado no es error de contrato: documentar si devuelve `204` o `404`). `PUT` reemplaza el recurso entero: lo que el cliente no manda se pisa. `PATCH` cambia solo lo enviado; diseñarlo idempotente ("estado = X", nunca "incrementar"). `POST` no lo es: si el cliente puede reintentar (timeout, red), aceptar header `Idempotency-Key`, guardar key + respuesta con TTL y devolver la misma respuesta ante repetición. Solo los idempotentes se reintentan ([09](./09-http-integrations.md)).
- Query complejas: `[FromQuery]` sobre el request record. Body: sin atributo (inferido por `[ApiController]`).
- Endpoint nuevo ⇒ su `.md` en la carpeta de docs que el repo ya usa (`Documentacion/<Feature>/` por defecto). Si el repo no documenta endpoints (o es nuevo y el usuario no lo pidió), no se crea la carpeta: alcanza con el OpenAPI.
