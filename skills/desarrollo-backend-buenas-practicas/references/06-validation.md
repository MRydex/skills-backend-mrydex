## 6. Validación

Validadores FluentValidation y qué se valida dónde. Leer al crear o modificar un request de entrada.
Repo nuevo con nullable: `SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true` en `AddControllers`,
si no el `[Required]` implícito de `[ApiController]` responde antes que FluentValidation y con otro mensaje.
Textos libres (nombre, email): el handler guarda y filtra con `Trim()`, salvo que el repo no normalice (el repo manda); el validador mide el largo sin espacios de borde.

```csharp
public class CreateItemValidator : AbstractValidator<CreateItemRequest>
{
    public CreateItemValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage(ErrorMessage.ItemCodeRequired)
            .Length(3).WithMessage(ErrorMessage.ItemCodeLength);
        RuleFor(x => x.Name).NotEmpty().WithMessage(ErrorMessage.ItemNameRequired)
            .MaximumLength(100);
        // Cascade(Stop): si es null, no corren las reglas siguientes que lo desreferencian (NRE = 500)
        RuleFor(x => x.Services).Cascade(CascadeMode.Stop).NotEmpty().WithMessage(ErrorMessage.ItemServicesRequired);
    }
}
```

- Todo request con input de usuario tiene validador. Sin data annotations en requests (en Options se permiten, §8).
- Validar forma (requerido, largo, formato, rango, enum válido) en el validador; reglas que necesitan la base, en el handler con `SystemValidationException`.
- CBU/CVU, CUIT, montos y fechas: validadores reutilizables en `Domain/Validators/`.
- Paginado: `PageSize` con máximo (ej. 100) siempre. Nunca listados sin límite.
- Rangos de fechas: `desde <= hasta` y ventana máxima.
- Mensajes por defecto en español: `ValidatorOptions.Global.LanguageManager.Culture = new CultureInfo("es");` una vez, al registrar FluentValidation.
- Chequeo contra un servicio externo (captcha, existencia en otro sistema): `MustAsync` con la interfaz del cliente inyectada en el constructor del validador. El handler lo ejecuta con `Guard`, igual que el resto.
- `Regex` siempre con timeout (`new Regex(pattern, RegexOptions.None, TimeSpan.FromMilliseconds(200))` o `[GeneratedRegex(..., matchTimeoutMilliseconds: 200)]`): sin timeout, un input armado cuelga el request (ReDoS).
