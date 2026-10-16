## 4. Mediator y handlers

Requests, handlers y uso del mediator del equipo. Leer al crear o modificar un caso de uso.

```csharp
// Application/Dtos/ItemDtos/CreateItemRequest.cs
public record CreateItemRequest(string Code, string Name, IEnumerable<int> Services) : IRequest<EmptyResult>;

// Application/Services/ItemHandlers/CreateItemHandler.cs
internal class CreateItemHandler(
    IValidator<CreateItemRequest> validator,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateItemRequest, EmptyResult>
{
    public async Task<EmptyResult> Handle(CreateItemRequest request, CancellationToken cancellationToken)
    {
        await Guard.AgainstInvalidSpecification(validator, request);

        unitOfWork.BeginTransaction();
        try
        {
            await unitOfWork.ItemCommandRepository.CreateAsync(request.Code, request.Name, cancellationToken);
            await unitOfWork.ItemServiceCommandRepository.CreateManyAsync(request.Code, request.Services, cancellationToken);
            unitOfWork.Commit();
        }
        catch
        {
            unitOfWork.Rollback();
            throw;
        }

        return new EmptyResult();
    }
}
```

- Un handler por caso de uso. El handler orquesta: valida, llama repos/clientes, arma la respuesta. Sin SQL ni `HttpClient` directo.
- Handlers `internal`; el mediator los resuelve por reflexión con `ActivatorUtilities` (no se registran en DI). Dependencias del handler sí deben estar registradas.
- Sin resultado ⇒ `IRequest<EmptyResult>`. Lectura vacía ⇒ devolver `null` y el controller responde `204`.
- Un handler **no** llama a otro handler ni a `mediator.Send`. Lógica compartida ⇒ servicio en `Services/<Feature>Handlers/` con interfaz.
- "No existe" ⇒ `throw new NotFoundException(ErrorMessage.X)`. Regla de negocio violada ⇒ `SystemValidationException`.
