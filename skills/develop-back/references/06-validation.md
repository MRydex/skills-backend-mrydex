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
- Una sola fuente de validación. `AddValidation()` de .NET 10 (`Microsoft.Extensions.Validation`, DataAnnotations por source generator) aplica a Minimal APIs, no a MVC: con controllers + FluentValidation no cambia nada. Repo con Minimal APIs que ya valida con DataAnnotations: `builder.Services.AddValidation()`, llamado en cada ensamblado que define endpoints (el generador solo ve los tipos del suyo). No mezclarlo con FluentValidation en el mismo endpoint ni reemplazar uno por otro sin pedido.
- Campos desconocidos en el JSON: ni FluentValidation ni `AddValidation()` los detectan (`System.Text.Json` los ignora). En una API nueva, `UnmappedMemberHandling = Disallow` para que un campo inesperado dé 400; en una API existente cambia el contrato: coordinar antes con el front (§17.8).

  ```csharp
  builder.Services.AddControllers().AddJsonOptions(o =>
      o.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow);
  builder.Services.ConfigureHttpJsonOptions(o =>      // solo si el repo tiene Minimal APIs
      o.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow);
  ```
- Validar forma (requerido, largo, formato, rango, enum válido) en el validador; reglas que necesitan la base, en el handler con `SystemValidationException`.
- CBU/CVU, CUIT, montos y fechas: validadores reutilizables en `Domain/Validators/`.
- Paginado: `PageSize` con máximo (ej. 100) siempre. Nunca listados sin límite.
- Rangos de fechas: `desde <= hasta` y ventana máxima.
- Mensajes por defecto en español: `ValidatorOptions.Global.LanguageManager.Culture = new CultureInfo("es");` una vez, al registrar FluentValidation.
- Chequeo contra un servicio externo (captcha, existencia en otro sistema): `MustAsync` con la interfaz del cliente inyectada en el constructor del validador. El handler lo ejecuta con `Guard`, igual que el resto.
- `Regex` siempre con timeout (`new Regex(pattern, RegexOptions.None, TimeSpan.FromMilliseconds(200))` o `[GeneratedRegex(..., matchTimeoutMilliseconds: 200)]`): sin timeout, un input armado cuelga el request (ReDoS).
- **Ningún `string` de entrada acepta etiquetas ni código** (§6.1). Formato conocido: `Matches` con los caracteres permitidos. Texto libre: `MaximumLength` + `SinCodigo()`.

### 6.1 Texto libre sin etiquetas ni código

El validador del front se salta con una llamada directa a la API: la regla que cuenta es esta. Aplica a todo
`string` que escribe una persona (body, query, ruta, mensaje de hub), no solo a los que hoy se muestran en pantalla.

- **Campo con formato conocido** (nombre, documento, teléfono, código): `Matches` con la lista de caracteres
  **permitidos**.
- **Texto libre** (observaciones, descripción, comentario, búsqueda): `MaximumLength` + `SinCodigo()`. Siempre los dos.
- **Rechazar con 400, nunca limpiar.** Borrar `<script>` en silencio deja armar `<scr<script>ipt>` y cambia el
  dato sin avisar.
- **No codificar al guardar** (`&lt;` en la base): se guarda el texto tal cual, con parámetros. Se codifica al
  mostrar: el front con interpolación; el backend con `HtmlEncoder.Default.Encode(...)` si lo mete en HTML (mails,
  plantillas, PDF; §11.2).
- La regla es la misma que `sinCodigo` del front (mismo patrón, mismos casos de prueba): si cambia en un lado, cambia
  en el otro.
- **Texto de usuario en columnas y parámetros `nvarchar`.** En `varchar`, SQL Server reemplaza lo que no entra en la
  página de códigos por el carácter ASCII parecido: `〈script〉` queda `<script>`, `<ıframe` queda `<iframe`,
  `onerror≤x` queda `onerror=x` (verificado en SQL Server con `Modern_Spanish_CI_AS`). El validador ve el texto antes
  de esa conversión. Columna `varchar` existente que recibe texto libre: se reporta y se propone pasarla a `nvarchar`
  (no se migra sin pedido).
- Un campo que **necesita** marcado (editor enriquecido) no usa `SinCodigo()`: se limpia con el paquete
  `HtmlSanitizer` (lista de etiquetas permitidas), nunca con una regex propia. Lista propia y corta, con las cuatro
  propiedades declaradas: los valores por defecto permiten `<form>`, `<input>` y `style`, y sin `UriAttributes` un
  `href="javascript:..."` pasa aunque `AllowedSchemes` no lo incluya.

```csharp
// Editor enriquecido: se guarda el resultado de Sanitize, no lo que llegó
private static readonly HtmlSanitizer Sanitizador = new(new HtmlSanitizerOptions
{
    AllowedTags = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { "p", "br", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h2", "h3", "blockquote", "a" },
    AllowedAttributes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "href" },
    UriAttributes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "href" },
    AllowedSchemes = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "https", "mailto" },
});
```

```csharp
// Domain/Validators/TextoSeguro.cs
public static class TextoSeguro
{
    private const RegexOptions Opciones = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;
    private static readonly TimeSpan Tope = TimeSpan.FromMilliseconds(200);

    // Atributos que ejecutan o cargan algo. `on` + 3 letras o más: el evento más corto es `oncut`, y deja pasar "ONG =".
    private const string Atributo = "on[a-z]{3,}|style|src|srcset|srcdoc|href|xlink:href|formaction|action|background|poster";

    // Entidades que, decodificadas dos veces, vuelven a ser `<`, `"`, `:` y compañía.
    private const string Entidad = "lt|gt|quot|amp|apos|colon|tab|newline|lpar|rpar|equals|sol|bsol|grave|num|semi|nbsp";

    // Un carácter fuera del plano básico son dos `char` en .NET (par de surrogates).
    private const string Astral = @"[\uD800-\uDBFF][\uDC00-\uDFFF]";

    // 1) etiqueta: `<` o `</` + letra, `<!`, `<?`. `\u3008` (〈): SQL Server lo guarda como `<` en una columna `varchar`.
    // 2) atributo suelto que rompe otro atributo: `" onerror=`, `' style=`, ` src=`.
    // 3) entidad HTML: `&#60;`, `&lt;`, `&colon;`.
    private static readonly Regex Marcado = new(
        @"[<\u3008]/?(?:\p{L}|" + Astral + @")|[<\u3008][!?]"
        + @"|(?:^|[ \t\n\r\f""'`/])(?:" + Atributo + @")[ \t\n\r\f]*="
        + @"|&(?:#[0-9x]|(?:" + Entidad + @");)",
        Opciones, Tope);

    // URL que ejecuta, al inicio del texto o de un valor. Se busca sin TAB ni saltos: el navegador los ignora en `java\nscript:`.
    private static readonly Regex Esquema = new(
        @"(?:^|[""'`=(]) *(?:(?:javascript|vbscript) *:|data *: *(?:text|image|application)/)", Opciones, Tope);

    // Caracteres de control (menos TAB, LF y CR), los que invierten el sentido del texto y los no válidos.
    private static readonly Regex Control = new(
        @"[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFE\uFFFF]", RegexOptions.None, Tope);

    // 30 marcas combinantes seguidas: nadie lo escribe, y normalizarlas cuesta tiempo cuadrático (16 s con 200.000).
    // `Normalize` no tiene timeout: este corte va antes.
    private static readonly Regex Apilado = new(@"(?:\p{M}|" + Astral + @"){30,}", RegexOptions.None, Tope);

    public static bool TieneCodigo(string? texto)
    {
        if (string.IsNullOrEmpty(texto)) return false;
        try
        {
            if (Control.IsMatch(texto) || Apilado.IsMatch(texto)) return true;
            // FormKC: `＜script＞` (ancho completo) pasa a `<script>` antes de comparar
            var plano = texto.Normalize(NormalizationForm.FormKC);
            return Marcado.IsMatch(plano)
                || Esquema.IsMatch(plano.Replace("\t", "").Replace("\n", "").Replace("\r", ""));
        }
        catch (Exception ex) when (ex is ArgumentException or RegexMatchTimeoutException)
        {
            return true; // Unicode inválido (surrogate suelto) o texto que agota el timeout: se rechaza
        }
    }

    public static IRuleBuilderOptions<T, string?> SinCodigo<T>(this IRuleBuilder<T, string?> regla) =>
        regla.Must(texto => !TieneCodigo(texto)).WithMessage(ErrorMessage.TextoConCodigo);
}
```

```csharp
// `\z`, no `$`: en .NET `$` también acepta un salto de línea al final. Regex con timeout (regla de arriba).
private static readonly Regex NombrePersona = new(@"^[\p{L}\p{M}' .-]+\z", RegexOptions.None, TimeSpan.FromMilliseconds(200));

RuleFor(x => x.Nombre).NotEmpty().MaximumLength(80).Matches(NombrePersona);
RuleFor(x => x.Observaciones).NotEmpty().MaximumLength(2000).SinCodigo();
RuleFor(x => x.Referencia).MaximumLength(200).SinCodigo(); // opcional: null pasa
```

Qué pasa y qué no (probado contra 100 ataques y 68 textos normales, con la misma respuesta que el front en 40.000
entradas generadas):

- Pasan: `a < b`, `precio <= 100`, `me gusta <3`, `Tom & Jerry`, `ONG = organización`,
  `Curso de JavaScript: avanzado`, URLs con `?a=1&b=2`, emojis, acentos y saltos de línea.
- Se rechazan aunque no sean un ataque: `a <b` y `<sin datos>` (`<` pegado a una letra), `online=si` al inicio o
  después de un espacio, `precio&nbsp;final`, y texto con marcas de dirección (hebreo o árabe pegado con U+202A a
  U+202E).
- No lo cubre, a propósito: texto codificado (`%3Cscript%3E`, `\u003cscript\u003e`), inerte salvo que otra capa lo decodifique dos
  veces. Por eso nunca `WebUtility.HtmlDecode` / `UrlDecode` sobre un dato ya validado.
- Un campo donde el usuario escribe código a propósito (un snippet, una fórmula) no lleva `SinCodigo()`: lleva
  `MaximumLength` y se devuelve solo como JSON.
- `Normalize` no tiene timeout y con miles de marcas combinantes seguidas tarda segundos: el corte `Apilado` va
  antes y no se quita. `MaximumLength` no alcanza como defensa: FluentValidation corre todas las reglas de la cadena.
- **No editar el patrón a mano en un solo lado.** Un cambio se prueba con los mismos casos en el front y en el
  backend; un patrón "más simple" suele reabrir una evasión (`java\nscript:`, `" style=`, `&colon;`).
