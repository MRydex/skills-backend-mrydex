## 3. Controllers

Forma de los controllers, rutas, roles y códigos de respuesta. Leer al crear o modificar un endpoint.

```csharp
[ApiController]
[Route("api/v{version:apiVersion}/[controller]/[action]")]
[ApiVersion("1.0")]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status500InternalServerError)]
public class BankController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [RoleAuthorization(Roles.BankAdmin)]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<ActionResult> CreateBank(CreateBankRequest request, CancellationToken cancellationToken)
    {
        await mediator.Send(request, cancellationToken);
        return CreatedAtAction(null, new { code = request.Code }, null);
    }

    [HttpGet]
    [RoleAuthorization(Roles.BankRead)]
    [ProducesResponseType(typeof(PagedResponse<BankDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<ActionResult<PagedResponse<BankDto>>> GetBanks([FromQuery] GetBanksRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(request, cancellationToken);
        return result is null ? NoContent() : Ok(result);
    }
}
```

- Base `ControllerBase`. Atributos de clase: `[ApiController]`, `[Route(...)]`, `[ApiVersion]`, `[ProducesResponseType]` de 401/400/500.
- Ruta por `[action]`: el nombre del action = nombre del request sin `Request` (`CreateBank` ↔ `CreateBankRequest`).
- **Todo action lleva `[RoleAuthorization(...)]`** con roles de `Domain/Structs/Roles.cs`. Endpoint anónimo = decisión explícita, documentada en el PR (único caso hoy: health check).
- Retorno `Task<ActionResult<T>>` / `Task<ActionResult>`. Códigos: `200 Ok`, `201 CreatedAtAction`, `204 NoContent`. Errores **solo** por excepción → `ProblemDetails`.
- `[ProducesResponseType]` por action con el tipo real: Swagger es el contrato con el frontend.
- Verbos: `GET` lectura, `POST` alta, `PUT` reemplazo, `PATCH` cambio parcial, `DELETE` baja. Nunca `GET` con efectos.
- Query complejas: `[FromQuery]` sobre el request record. Body: sin atributo (inferido por `[ApiController]`).
- Endpoint nuevo ⇒ su `.md` en `Documentacion/<Feature>/`.
