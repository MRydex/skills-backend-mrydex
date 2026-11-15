## 19. Migración de .NET (target framework → net10.0)

Inventario, orden, estrategia, cambios de hosting, serialización y routing, y qué hacer si algo falla. Leer solo cuando el usuario pide subir el target framework.

**Cuándo aplica**: **solo** cuando el usuario pide explícitamente migrar el `TargetFramework` (por ejemplo `netcoreapp2.2`, `netcoreapp3.1`, `net5.0`, `net6.0`, `net8.0` → `net10.0`). Nunca como parte de otra tarea ni "ya que estoy" (§0, §13.5): un repo en otro TFM sigue su TFM y sus paquetes. Si el proyecto no pidió migración, no la propongas más que en una línea. Es riesgo alto (§13.3): cambia `.csproj` y el pipeline de `Program.cs`.

### 19.1 Inventario antes de tocar nada

1. Rama aparte y árbol limpio. `dotnet build` y `dotnet test` en **verde antes** de empezar: si ya está roto, se reporta, no se mezcla con la migración.
2. Listar el TFM de cada proyecto:

```bash
grep -rn --include=*.csproj -E "TargetFramework|PackageReference" .
```

3. Armar el grafo de dependencias entre proyectos (`ProjectReference`) y la lista de paquetes con `dotnet list package --outdated` y `dotnet list package --deprecated`.
4. Revisar `global.json` (SDK fijado), `Dockerfile` (imagen base) y el pipeline (`UseDotNet@2`, `version:`): hay que moverlos a 10.x en el mismo cambio (§20).
5. Paquetes del feed privado (`Corp.*`): confirmar con el usuario que hay una versión compatible con `net10.0` o `netstandard2.0`. Sin esa versión no se migra ese proyecto.
6. Escribir el plan en `tasks/todo.md` (§13.2): un proyecto por tarea, con riesgo y orden.

### 19.2 Orden y estrategia

- **Orden**: proyectos hoja primero (los que no dependen de otros: Domain, utilidades), después los que dependen de ellos, y por último el Api y el proyecto de tests. Un proyecto en `net10.0` puede referenciar uno `netstandard2.0` / `net8.0`, pero no al revés.
- **Salto directo vs por escalones.** Recomendado: ir **directo a `net10.0` por proyecto**, pero leyendo la guía de breaking changes de **cada versión intermedia** (de `netcoreapp2.2` a 10 pasás por 3.x, 5, 6, 7, 8, 9 y 10; Microsoft Learn: "Breaking changes in .NET"). Escalones intermedios solo si el salto directo no compila y no se entiende por qué.
- **Una migración por commit** (§13.4): un proyecto o una familia de paquetes por commit, con build y test verdes. No mezclar con refactors, renombres, cambios de formato ni features.
- `global.json` con el SDK 10 (`"version": "10.0.100", "rollForward": "latestFeature"`) si el repo ya fija el SDK; si no lo tiene, no lo agregues.
- **Central Package Management** (`Directory.Packages.props`) solo si el repo ya lo usa o el usuario lo pide. Si existe, las versiones se suben ahí, no en cada `.csproj`.
- `.csproj` estilo SDK: si es el formato antiguo (`<Project ToolsVersion=...>`), convertirlo es un paso aparte antes de cambiar el TFM.

### 19.3 Paquetes

- `<TargetFramework>net10.0</TargetFramework>` en cada `.csproj` y los `Microsoft.*` (`Extensions`, `AspNetCore`, `EntityFrameworkCore`) en **10.x**, alineados con el TFM (§0, §12: mezcla de mayores es deuda conocida).
- Subir de a una familia: primero `Microsoft.*`, build; después EF Core, build; después terceros (Dapper, FluentValidation, Polly, Scrutor...), build. Cada una con su commit.
- Los paquetes de terceros se suben a la última versión estable que soporta `net10.0`; cambios mayores (FluentValidation, Polly, Swashbuckle) se leen en su guía de migración antes de subir.
- `Microsoft.AspNetCore.App` como `PackageReference` (2.x) → `<FrameworkReference Include="Microsoft.AspNetCore.App" />` o `Sdk="Microsoft.NET.Sdk.Web"`; el metapaquete ya no se referencia.
- Paquetes sin versión para `net10.0` y sin reemplazo: parar y consultar (§13.6). No copiar su código al repo sin acordarlo.
- Terminada la migración: auditoría de dependencias completa (§11.4).

### 19.4 `Startup.cs` → `Program.cs` (hosting mínimo)

**Cuándo aplica**: el repo usa `Startup.cs` / `WebHost.CreateDefaultBuilder`. Es un cambio **separado** de subir el TFM, en dos pasos y commits propios:

1. `WebHost` / `WebHostBuilder` están marcados obsoletos en .NET 10 (el compilador avisa; leer el mensaje y el breaking change de ASP.NET Core 10). Paso intermedio que conserva `Startup`: `Host.CreateDefaultBuilder(args).ConfigureWebHostDefaults(web => web.UseStartup<Startup>())`.
2. Después, hosting mínimo (abajo).

```csharp
// Program.cs (hosting mínimo)
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddControllers();

var app = builder.Build();

app.UseExceptionHandler();
app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

- `ConfigureServices(IServiceCollection)` → `builder.Services...`; `Configure(IApplicationBuilder, IWebHostEnvironment)` → `app...`. **El orden del pipeline se conserva exacto**: moverlo cambia comportamiento (auth antes de routing, CORS, exception handler).
- `IHostingEnvironment` / `IApplicationLifetime` (obsoletos) → `IWebHostEnvironment` / `IHostApplicationLifetime`. El ambiente por `IHostEnvironment` (§8).
- Extension methods por capa (`AddApplicationServices`, etc., §8) no cambian: se llaman igual.
- Tests con `WebApplicationFactory<Program>`: en net10 el SDK genera `public partial class Program`, no hace falta declararlo; en net8 agregalo (`public partial class Program { }`) solo si los tests lo necesitan.
- Un repo que ya es mínimo en `net8.0` no necesita este paso.

### 19.5 Serialización: Newtonsoft vs System.Text.Json

- Desde ASP.NET Core 3.0 el default es `System.Text.Json`. Un repo que viene de 2.x usa Newtonsoft por defecto; al migrar el comportamiento del JSON cambia.
- **Si el contrato con el front depende de Newtonsoft** (atributos `[JsonProperty]`, `JsonConverter` propios, `JObject`, `null` y fechas con su formato), mantenelo: `builder.Services.AddControllers().AddNewtonsoftJson()` (paquete `Microsoft.AspNetCore.Mvc.NewtonsoftJson` 10.x). Sacarlo es otra tarea, con pedido (§12).
- Si migrás a `System.Text.Json`, diferencias que rompen contratos:
  - Property names: MVC usa `JsonSerializerDefaults.Web` (camelCase, insensible a mayúsculas al deserializar). Un `JsonSerializer` usado fuera de MVC es sensible a mayúsculas y no cambia el casing.
  - Enums: número por defecto en ambos; strings solo con `JsonStringEnumConverter` (§17.5).
  - `null` en el request: `JsonIgnoreCondition`, `required` y nulabilidad actúan distinto (§17.5).
  - Fechas: ISO 8601 estricto; formatos propios necesitan un `JsonConverter`.
  - Campos privados, `JObject` / `dynamic`, ciclos de referencia y comentarios o comas finales en el JSON: no andan igual (`ReferenceHandler`, `JsonNode`).
- Verificar con el documento OpenAPI antes/después y un test de contrato sobre los endpoints principales (§17.8).

### 19.6 Cambios por salto de versión que más rompen

| Origen → destino | Qué mirar |
| :--- | :--- |
| 2.x → 3.x | Endpoint routing (`UseMvc` → `UseRouting` + `UseAuthorization` + `MapControllers`), `AddMvc` → `AddControllers`, Newtonsoft ya no es default, `Microsoft.AspNetCore.App` como `FrameworkReference`, `IHostingEnvironment` obsoleto. |
| 3.x → 5 / 6 | Hosting mínimo (opcional), nullable habilitado por plantilla (warnings nuevos), `Startup` sigue andando. |
| 6 → 8 | Cambios de `HttpClient`, de EF Core (traducciones de LINQ), `System.Text.Json` más estricto. |
| 8 → 9 / 10 | APIs marcadas `[Obsolete]` que pasan a error, cambios en OpenAPI (`AddOpenApi`), EF Core 10, versión de C# por defecto. |
| Cualquiera | Consultar "Breaking changes in .NET N" y "Breaking changes in ASP.NET Core N" de **cada** versión que se atraviesa. |

- Con el endpoint routing de 3.x, el orden `UseRouting` → `UseCors` → `UseAuthentication` → `UseAuthorization` → `UseEndpoints` / `MapControllers` es obligatorio.
- Las APIs obsoletas se reemplazan por la que indica el mensaje del compilador (`CS0618`): no se suprime la advertencia para "que compile" (§13.7).
- Código nuevo de la migración usa lo moderno (§0 regla maestra) solo donde la migración ya obliga a tocar esa línea; el resto, intacto (§13.5).

### 19.6.1 Ejemplo de `.csproj` antes y después

```xml
<!-- Antes: netcoreapp2.2 -->
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>netcoreapp2.2</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.App" />
    <PackageReference Include="Newtonsoft.Json" Version="12.0.3" />
  </ItemGroup>
</Project>

<!-- Después: net10.0 -->
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <!-- Microsoft.AspNetCore.App ya viene con el SDK Web: se quita la PackageReference -->
    <PackageReference Include="Microsoft.AspNetCore.Mvc.NewtonsoftJson" Version="10.0.0" />
  </ItemGroup>
</Project>
```

- Habilitar `Nullable` e `ImplicitUsings` (§0) en una migración genera muchos warnings: hacelo en un commit **aparte**, después de que todo compile y pase los tests, y solo si el usuario lo pidió. No es parte de subir el TFM.
- Versión exacta, no comodines (§11.1 punto 8); usá la última 10.x estable disponible, `10.0.0` es ilustrativa.
- EF Core: cambiar de EF Core 2.x/3.x a 10 modifica el SQL generado y el tracking; revisar §15 y correr los tests de repositorios contra una base real antes de dar el paso por terminado.

### 19.7 Verificación por paso

Por cada proyecto o familia de paquetes migrada:

1. `dotnet restore` y `dotnet build` sin errores y **sin warnings nuevos** (los obsoletos se anotan, no se tapan).
2. `dotnet test` de los tests del proyecto y de los que lo referencian, en verde (§13.3).
3. Cuando el Api ya compila: levantarla y probar los endpoints principales con un token real, o decir que no se pudo (§13.3).
4. Commit del paso (§13.4) con mensaje del tipo `chore(deps): net6.0 -> net10.0 en Corp.Domain`.
5. Al cerrar: `dotnet list package --vulnerable` y `--deprecated`, y el feed Zero Wire contra el runtime nuevo (§11.4), `Dockerfile` y pipeline en 10.x (§20), y `tasks/todo.md` actualizado.

### 19.8 Qué hacer si falla

| Falla | Qué hacer |
| :--- | :--- |
| Un paquete no tiene versión para `net10.0` | Buscar versión nueva o reemplazo oficial; si no hay, parar y consultar. No bajar el TFM del proyecto ni copiar el código sin acordarlo. |
| Errores de compilación por API obsoleta o eliminada | Leer el breaking change de esa versión y usar el reemplazo documentado. Nunca `#pragma warning disable` masivo. |
| Tests que pasaban y ahora fallan | Revertir el último commit, aislar el cambio (paquete, TFM o código) y volver a subir de a una pieza. El test no se borra ni se relaja (§13.3). |
| El JSON de un endpoint cambió | Casi siempre Newtonsoft ↔ System.Text.Json: mantener `AddNewtonsoftJson` o corregir el converter (§19.5). Comparar OpenAPI (§17.8). |
| 404 / 401 / CORS tras pasar a endpoint routing | Orden del pipeline (§19.6). Restaurar el orden original antes de depurar otra cosa. |
| Una dependencia interna (`Corp.*`) no carga | Confirmar con el usuario la versión compatible del feed privado. Sin ella, ese proyecto queda en su TFM (multi-target con `<TargetFrameworks>` solo si hace falta y el usuario lo aprueba). |
| Falla solo en el pipeline | Comparar SDK del pipeline vs local (`UseDotNet@2`, `global.json`, imagen de Docker, §20). |
| No se entiende el origen del error | Volver al último commit verde y repetir con un salto más chico. Si sigue trabado: `NECESITA_ADVISOR` / consultar al usuario con el error exacto. |

### 19.9 Checklist de migración

- [ ] Pedida explícitamente por el usuario; hecha en rama aparte, build y tests verdes antes de empezar.
- [ ] Inventario de TFM y paquetes; orden hojas primero; plan en `tasks/todo.md`.
- [ ] Un commit por paso; sin refactors ni cambios de formato mezclados.
- [ ] `Microsoft.*` en 10.x alineados al TFM; terceros revisados contra su guía.
- [ ] Newtonsoft conservado si el contrato depende de él; contrato verificado antes y después.
- [ ] Orden del pipeline de `Program.cs` conservado.
- [ ] `Dockerfile`, `global.json` y pipeline en 10.x (si existen).
- [ ] Auditoría de dependencias §11.4 corrida al final.
