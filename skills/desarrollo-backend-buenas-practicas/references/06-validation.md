## 6. Validación

Validadores FluentValidation y qué se valida dónde. Leer al crear o modificar un request de entrada.

```csharp
public class CreateItemValidator : AbstractValidator<CreateItemRequest>
{
    public CreateItemValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage(ErrorMessage.ItemCodeRequired)
            .Length(3).WithMessage(ErrorMessage.ItemCodeLength);
        RuleFor(x => x.Name).NotEmpty().WithMessage(ErrorMessage.ItemNameRequired)
            .MaximumLength(100);
        RuleFor(x => x.Services).NotEmpty().WithMessage(ErrorMessage.ItemServicesRequired);
    }
}
```

- Todo request con input de usuario tiene validador. Sin data annotations.
- Validar forma (requerido, largo, formato, rango, enum válido) en el validador; reglas que necesitan la base, en el handler con `SystemValidationException`.
- CBU/CVU, CUIT, montos y fechas: validadores reutilizables en `Domain/Validators/`.
- Paginado: `PageSize` con máximo (ej. 100) siempre. Nunca listados sin límite.
- Rangos de fechas: `desde <= hasta` y ventana máxima.
