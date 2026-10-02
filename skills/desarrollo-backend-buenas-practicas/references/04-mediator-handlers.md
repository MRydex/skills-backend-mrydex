## 4. Mediator y handlers

Requests, handlers y uso del mediator del equipo. Leer al crear o modificar un caso de uso.

```csharp
// Application/Dtos/BankDtos/CreateBankRequest.cs
public record CreateBankRequest(string Code, string Name, IEnumerable<int> Services) : IRequest<EmptyResult>;

// Application/Services/BankHandlers/CreateBankHandler.cs
internal class CreateBankHandler(
    IValidator<CreateBankRequest> validator,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateBankRequest, EmptyResult>
{
    public async Task<EmptyResult> Handle(CreateBankRequest request, CancellationToken cancellationToken)
    {
        await Guard.AgainstInvalidSpecification(validator, request);

        unitOfWork.BeginTransaction();
        try
        {
            await unitOfWork.BankCommandRepository.CreateAsync(request.Code, request.Name, cancellationToken);
            await unitOfWork.BankServiceCommandRepository.CreateManyAsync(request.Code, request.Services, cancellationToken);
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
