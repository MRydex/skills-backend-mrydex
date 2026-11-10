## 17. Contrato OpenAPI

Respuestas tipadas, errores, enums, fechas y cambios compatibles del documento OpenAPI. Leer al crear, modificar o versionar un endpoint, o al tocar la configuración de OpenAPI.

**Cuándo aplica**: la API ya expone OpenAPI (`Microsoft.AspNetCore.OpenApi` con `AddOpenApi` / `MapOpenApi`, o Swashbuckle donde ya existe) o el usuario lo pide. Si el proyecto no lo usa, no lo agregues. No cambies de librería (Swashbuckle ↔ `Microsoft.AspNetCore.OpenApi`) salvo pedido explícito: es un cambio de proyecto, no de feature. Lo básico de controllers y `[ProducesResponseType]` está en §3; acá va el contrato completo.

> El documento OpenAPI **es** el contrato con el front. Lo que sale en el JSON generado es lo que el cliente consume, no lo que el C# "quiso decir".

### 17.1 Registro mínimo (.NET 10)

```csharp
builder.Services.AddOpenApi();            // OpenAPI 3.1 por defecto

var app = builder.Build();

if (!app.Environment.IsProduction())      // la condición que el repo ya usa (§0: puede incluir QA/Test); nunca en Producción
{
    app.MapOpenApi();                     // /openapi/v1.json
    // UI (Swagger UI, Scalar...) solo acá, con la librería que el repo ya usa
}
```

- Con Swashbuckle ya instalado: `AddSwaggerGen` / `UseSwagger` / `UseSwaggerUI` igual, con la misma condición de ambiente (documento en `/swagger/v1/swagger.json`). No migrar.
- Con versionado por URL (§0, `Asp.Versioning.Mvc`): un documento por versión (`AddOpenApi("v1")`, `AddOpenApi("v2")`), no uno mezclado.
- Un endpoint que debe quedar fuera del documento: `[ApiExplorerSettings(IgnoreApi = true)]` (controllers) o `.ExcludeFromDescription()` (minimal API).

### 17.2 Respuestas declaradas

Todo action declara **todas** las respuestas que puede devolver, con el tipo real. Un `200` sin tipo genera `object` en el cliente del front.

```csharp
[HttpGet("{id:int}", Name = "GetItem")]
[ProducesResponseType<ItemResponse>(StatusCodes.Status200OK)]
[ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
public async Task<ActionResult<ItemResponse>> GetItem(int id, CancellationToken cancellationToken)
    => Ok(await mediator.Send(new GetItemRequest(id), cancellationToken));
```

- Atributo genérico `[ProducesResponseType<T>(status)]` (desde .NET 7) en código nuevo; en un controller existente, la forma que ya usa (`typeof(T)`, §3).
- Los 400 / 401 / 403 / 500 comunes van a nivel de clase (§3); en el action, solo los propios (`404`, `409`, `201`, `204`).
- `204` sin tipo: `[ProducesResponseType(StatusCodes.Status204NoContent)]`. Vale para listados vacíos (§3, §4).
- En minimal APIs (solo donde el repo ya las usa): `TypedResults` y `Results<Ok<ItemResponse>, NotFound<ProblemDetails>>` como tipo de retorno; el documento sale solo, sin atributos.
- Descargas (PDF, Excel): `[Produces("application/pdf")]` para que no figure como JSON.

### 17.3 Errores como `ProblemDetails`

- Todo error documentado es `ProblemDetails` (§7): mismo formato en `400`, `401`, `403`, `404`, `409`, `5xx`. No documentar un `string` ni un objeto propio de error.
- Validación (400): `ValidationProblemDetails` si el repo la devuelve así; si no, `ProblemDetails`. El documento coincide con lo que realmente responde el `IExceptionHandler`.
- Cada excepción nueva con handler (§7) suma su código al `[ProducesResponseType]` de los actions que la lanzan.

### 17.4 `operationId` estable

El `operationId` es el nombre del método en el cliente generado del front. Cambiarlo rompe al front aunque el JSON no cambie.

```csharp
[HttpPost(Name = "CreateItem")]                           // controllers
public async Task<ActionResult<ItemResponse>> CreateItem(CreateItemRequest request, CancellationToken cancellationToken) { ... }

app.MapGet("/items/{id}", GetItem).WithName("GetItem");   // minimal API
// o [EndpointName("GetItem")] sobre el método
```

- Nombre = `<Accion><Entidad>` (igual que el request, §3 y §1.2), único en toda la API y por versión (`GetItemsV2`, §3).
- Renombrar un action o un método **no** debe cambiar el `operationId`: fijalo explícito en endpoints que el front ya consume. Endpoint existente sin nombre fijo: no lo toques, avisá.

### 17.5 Enums, nullables y tipos

- **Enums como string** si el front los espera así: `JsonStringEnumConverter` registrado una sola vez (`AddControllers().AddJsonOptions(...)` o `ConfigureHttpJsonOptions`). El documento muestra `enum: ["Active", "Blocked"]` y no `integer`. Coordiná con el front **antes** de cambiar el formato de un enum existente: pasar de número a string rompe el cliente.
- Un enum que viaja como número nunca se renumera ni se reordena. Valores nuevos solo al final.
- **Nullable reference types** (`Nullable` habilitado, §0): `string?` sale como `nullable` en el schema. La nulabilidad **no** marca un campo como requerido: el schema lo marca requerido solo con `required` (C# 11), `[Required]` o `[JsonRequired]`. Qué es obligatorio lo define el validador (§6) y el tipo (records posicionales, §4); si el front necesita `required` en el schema, usá uno de esos tres, solo si el repo ya los usa. Con Swashbuckle, tratar el `string` no nullable como requerido exige `NonNullableReferenceTypesAsRequired()`.
- Un campo que pasa de nullable a no nullable (o al revés) es cambio de contrato (§17.8).
- `decimal` para importes (§2): el schema lo muestra como `number`; si el front necesita escala o moneda, dejala en el comentario XML.
- Sin tipos anónimos, `object` ni `dynamic` en respuestas: el schema queda vacío.

### 17.6 Fechas

La forma de la fecha es parte del contrato y se **acuerda con el front**; no se decide solo del lado del API.

| Contrato | Tipo en C# | Cómo viaja | Notas |
| :--- | :--- | :--- | :--- |
| Instante absoluto (default) | `DateTimeOffset` o `DateTime` UTC | ISO 8601 con offset / `Z` (`2026-05-01T14:30:00Z`) | Lo de §2. El front convierte a zona local al mostrar. |
| Fecha de calendario (sin hora) | `DateOnly` | `2026-05-01` | Vencimientos, nacimientos. No usar `DateTime` a medianoche. |
| Fecha local sin zona | `DateTime` con `Kind=Unspecified` | `2026-05-01T00:00:00` | Solo si el contrato ya es así. |

- Fecha local sin zona: el front necesita su interceptor de fechas locales (skill de frontend). Con instantes UTC y `DateOnly` no hace falta y estorba. No mezclar los dos criterios en una misma API.
- `DateTime.Now` sin `TimeProvider` queda prohibido en lógica (§2).
- Rangos (`From` / `To`): validar `From <= To` (§6) y documentar si el límite superior es inclusivo.
- Cambiar el criterio de fechas de un endpoint existente es cambio de contrato (§17.8).

### 17.7 Paginado y comentarios

- Forma única de listas paginadas: `PagedResponse<T>` (§7), con `PageSize` máximo (§6). Un endpoint nuevo no inventa otra forma (`items` / `total` / `results`). Si el repo ya usa otra, se sigue esa (§13.5).
- Comentarios XML (`/// <summary>`): con `GenerateDocumentationFile` en el `.csproj`, `Microsoft.AspNetCore.OpenApi` los toma para `description` de operaciones y schemas. Solo si el repo ya los usa; no los agregues en bloque a código existente.
- Ejemplos y descripciones sin datos reales ni internos (§11.1 punto 5): ni nombres de clientes, ni IDs, ni hosts.

### 17.8 Cambios compatibles y breaking changes

**Solo cambios aditivos** sobre una versión publicada. Todo lo que no sea aditivo va en una versión nueva (§3: `Controllers/V2/`, requests y handlers con sufijo `V2`), con la V1 intacta.

| Cambio | ¿Compatible? |
| :--- | :--- |
| Endpoint nuevo | Sí |
| Campo nuevo **opcional** en el request | Sí |
| Campo nuevo en el response | Sí (el front debe ignorar lo desconocido) |
| Valor nuevo al final de un enum | Depende: rompe a un cliente que valida el enum de forma cerrada. Avisar. |
| Quitar o renombrar campo, ruta, verbo o `operationId` | No |
| Campo opcional que pasa a obligatorio | No |
| Cambiar tipo, formato de fecha o casing de un campo | No |
| `null` ↔ ausente en un campo | No |
| Cambiar el código de estado de un caso (`200` → `204`) | No |
| Endurecer una validación (rango más chico, regex más estricta) | No para quien manda esos valores hoy |

Antes de tocar un endpoint existente:

1. Exportar el documento **antes** (`curl http://localhost:<puerto>/openapi/v1.json > before.json`; con Swashbuckle, `/swagger/v1/swagger.json`) y **después**; comparar rutas, verbos, `operationId`, schemas, `required`, nulabilidad y enums (§3). Cambio solo aditivo según la tabla (campo opcional, endpoint nuevo): alcanza el documento después, sin levantar la API dos veces.
2. Cualquier diferencia no aditiva: parar, avisar al usuario y proponer versión nueva.
3. Si cambia algo de enums, fechas o nulabilidad, confirmarlo con el front.
4. Documentar el endpoint en `Documentacion/<Feature>/` si el repo documenta endpoints (§3).

### 17.9 Seguridad del documento y de la UI

- El documento y la UI solo fuera de Producción (con la condición que el repo ya usa, §0), o detrás de autenticación (§11.2, §11.6 superficie expuesta). Nunca públicos en Producción.
- OAuth en la UI: flujo **authorization code con PKCE**, `client_id` público y **sin `client_secret`** en la UI ni en la config versionada. Redirect URI exacta de la UI registrada en el IdP.
- El documento no expone endpoints internos ni de operación que no deban conocerse: excluirlos (§17.1).
- Sin credenciales, tokens ni connection strings en ejemplos ni en `servers`.

### 17.10 Deprecar y retirar

- Endpoint que se reemplaza por una versión nueva: marcarlo `[Obsolete]` (o `.WithMetadata(new ObsoleteAttribute())`); el documento lo muestra con `deprecated: true` y el front lo ve en su cliente.
- No retirar la versión vieja hasta confirmar con el front (y con logs de uso, §11.3) que nadie la llama. Retirar es un cambio no compatible (§17.8) y va en su propio PR.
- Dejar en la `description` del endpoint viejo a qué versión se pasa y desde cuándo.
- Comunicar la fecha de retiro por el canal que use el equipo; el API no responde `410` sin acuerdo previo.

### 17.11 Clientes TypeScript generados

**Cuándo aplica**: solo si el equipo ya genera el cliente del front desde el documento (NSwag, `openapi-typescript`, etc.). Si el front escribe sus modelos a mano, no lo propongas.

- El generador depende de `operationId`, `required`, nulabilidad y enums: por eso §17.4, §17.5 y §17.8 son estrictos.
- El cliente se regenera en el repo del front con el documento de la versión publicada; el API no commitea código generado del front.
- Nombres de schema = nombres de `Request` / `Response` (§1.2). Dos clases con el mismo nombre en distinto namespace hacen que el generador produzca `ItemResponse2`: evitalo.

### 17.12 Despliegue con pestañas abiertas (front viejo contra API nueva)

El front se actualiza con Service Worker y pregunta antes de recargar (skill `desarrollo-buenas-practicas`
§10.14): después de un deploy conviven, durante horas, pestañas con la versión vieja del front y la API
nueva. La API tiene que servir a las dos.

- **§17.8 aplica también dentro de la misma versión de la API.** Un campo que el front viejo manda sigue
  aceptándose; un campo nuevo del response lo ignora. Quitar un campo, endurecer una validación o cambiar
  un código de estado se hace **en el deploy siguiente**, cuando ya nadie tiene la versión vieja abierta
  (logs de uso, §11.3).
- Si el cambio no puede ser aditivo y no hay versión nueva (§3 `V2`): la API responde
  **`426 Upgrade Required`** como `ProblemDetails`. El front manda su versión en la cabecera
  `X-App-Version` en cada request y trata el `426` como recarga obligatoria. **Sin cabecera no se
  bloquea**: Swagger, tests, jobs y otros clientes no la mandan.

```csharp
// Options (§8): "Front": { "VersionMinima": "1.41.0" }; null o ausente = no se exige
public sealed class FrontOptions
{
    public const string Seccion = "Front";
    public string? VersionMinima { get; init; }
}

public sealed class VersionFrontMiddleware(RequestDelegate next, IOptionsMonitor<FrontOptions> options)
{
    private const string Cabecera = "X-App-Version";

    public async Task InvokeAsync(HttpContext context)
    {
        if (Version.TryParse(options.CurrentValue.VersionMinima, out var minima)
            && context.Request.Headers.TryGetValue(Cabecera, out var valor)
            && Version.TryParse(valor, out var version)
            && version < minima)
        {
            await Results.Problem(
                    statusCode: StatusCodes.Status426UpgradeRequired,
                    title: "Versión de la aplicación desactualizada",
                    detail: $"Se requiere la versión {minima} o superior. Recargá la aplicación.")
                .ExecuteAsync(context);
            return;
        }

        await next(context);
    }
}

// Program.cs: después de UseExceptionHandler y antes de MapControllers
app.UseMiddleware<VersionFrontMiddleware>();
```

- `IOptionsMonitor`: subir `VersionMinima` en `appsettings.<Ambiente>.json` o en la configuración del
  app pool (§8) corta a los clientes viejos sin redeploy. Bajarla a `null` lo apaga.
- `Version.TryParse` acepta `1.41.0`; un valor que no parsea (prerelease, basura) no bloquea.
- CORS (§11.7): `X-App-Version` es una cabecera custom, el preflight tiene que permitirla
  (`WithHeaders("Content-Type", "Authorization", "X-App-Version")`). Mismo origen (API como
  sub-aplicación de IIS): nada que hacer.
- OpenAPI: declarar el `426` solo si el repo ya documenta respuestas globales; no agregarlo action por action.
- **Reciclado del app pool** en cada deploy: corta requests en vuelo y los sockets de SignalR. El front
  reintenta y reconecta solo (skill front §5 y §16.6). En el back: `IHostApplicationLifetime.ApplicationStopping`
  para terminar trabajo en curso (hosted services que estén corriendo), y no deshabilitar el *overlapped recycle* de IIS.
- **SignalR no es el mecanismo de aviso de deploy** (§16.1): el front verifica versión al reconectar.
  Un evento `RecargaObligatoria` desde un endpoint de operación (rol admin, §11) solo si el equipo lo pide.

### 17.13 Checklist de contrato

- [ ] Todas las respuestas del action declaradas con tipo real; errores como `ProblemDetails`.
- [ ] `operationId` fijo y único en endpoints consumidos por el front.
- [ ] Enums, nulabilidad, `required` y fechas coinciden con lo acordado con el front.
- [ ] Cambio solo aditivo; si no, versión nueva con la anterior intacta.
- [ ] Documento comparado antes y después sin diferencias no aditivas.
- [ ] UI y documento solo fuera de Producción o con auth; PKCE sin secreto.
- [ ] Endpoint reemplazado marcado `deprecated` y no retirado hasta confirmar que nadie lo usa (§17.10).
- [ ] Cambio no aditivo sin versión nueva: recién en el deploy siguiente, o `426` con `X-App-Version` y `VersionMinima` en Options; sin cabecera no bloquea (§17.12).
