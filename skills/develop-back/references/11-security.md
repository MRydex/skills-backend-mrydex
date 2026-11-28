## 11. Seguridad (Red Team / Blue Team)

Revisión Red Team, reglas fijas, Blue Team y auditoría de dependencias. Leer en todo cambio antes de entregar. §11.6: auditoría completa red + blue + network con todo "auditá" a secas o pedido de seguridad.

### 11.1 Revisión Red Team de cada cambio (obligatoria antes de entregar)

Preguntarse como atacante, para cada endpoint o cambio:

1. **Autorización (API1/API5 BOLA/BFLA)**: ¿tiene `[RoleAuthorization]` (en hubs, `[Authorize(Roles)]`, §16.4) con el rol mínimo? ¿El usuario puede pedir datos de otra entidad o tenant cambiando un id? Filtrar siempre por la entidad del token, no por la del request. **Quién actúa sale solo del token**: nunca de un campo del body (`requestUser`), de la query (`?user=`) ni de la ruta (`/{username}`).
2. **Inyección (A05)**: ¿algún input llega a SQL, a `ORDER BY`, a un path, a un header o a una URL saliente sin parametrizar / whitelist? ¿Cada `string` de texto libre tiene `MaximumLength` + `SinCodigo()` y los de formato conocido `Matches` (§6.1)? Sin eso, un `<img onerror=...>` guardado corre en el navegador de quien lo lea (XSS almacenado).
3. **Mass assignment (API3)**: ¿el request expone campos que el usuario no debería setear (estado, auditoría, ids internos)? Un campo que el DTO no tiene se ignora en silencio: en una API nueva, `UnmappedMemberHandling.Disallow` lo rechaza con 400 (§6).
4. **Consumo de recursos (API4)**: ¿hay paginado con máximo, límites de tamaño en uploads/bulk, timeouts en HTTP saliente?
5. **Exposición de datos (A01/API3)**: ¿la respuesta devuelve más campos de los necesarios? ¿Errores con stack trace, SQL o datos internos?
6. **SSRF (API7)**: ¿alguna URL saliente se arma con input del usuario? Solo `BaseAddress` de config.
7. **Secretos y PII (A02/A09)**: ¿algo sensible en código, `appsettings`, logs o mensajes de excepción?
8. **Supply chain (A03)**: ¿paquete nuevo? Justificarlo, versión fija, feed oficial, sin vulnerabilidades conocidas (`dotnet list package --vulnerable`).

### 11.2 Reglas fijas

- Nunca desactivar `ValidateTokenFilter`, roles, validación de certificados ni `HttpsRedirection` / HSTS.
- JWT con `AddJwtBearer`: `ValidateIssuer`, `ValidateAudience`, `ValidateLifetime` y
  `ValidateIssuerSigningKey` en `true`. **Nunca `ValidateAudience = false`**: acepta el token de
  cualquier cliente del mismo IdP. Cada audiencia legítima va en `ValidAudiences` desde
  config (ej. la del API de la app que embebe un microfrontend y le reenvía su token).
- APIs con autorización de ASP.NET (`AddJwtBearer` + `AddAuthorization`, no `ValidateTokenFilter`).
  `[RoleAuthorization]` por action (§3) sigue igual (repo sin la librería Corp: `AddJwtBearer` con las validaciones de §11.2 + `[Authorize(Roles = Roles.X)]`); estas dos reglas suman una red debajo:
  - Deny by default: `options.FallbackPolicy` = la policy de la app (usuario autenticado con el rol de
    la app), así un endpoint sin atributo no queda abierto. Anónimo solo con `[AllowAnonymous]`
    explícito y documentado en el PR (§3).
  - Clientes M2M (client credentials, cuenta de servicio): entran solo a endpoints marcados con un
    atributo propio (`[AllowM2m]`), resuelto en el `AuthorizationHandler` de la policy global con
    `endpoint.Metadata.GetMetadata<AllowM2mAttribute>()`. Un `[Authorize(Roles = ...)]` en el endpoint
    se suma con AND a la policy global: no sirve para abrirlo a otro rol; el OR vive en el handler.
    Rol M2M sobre un endpoint no marcado ⇒ denegar y `LogWarning` con usuario y endpoint. Probar con
    un token real de la cuenta de servicio.
- Autorización a nivel objeto (API1/BOLA, §11.1 punto 1): **todo camino** que expone o modifica un
  recurso (detalle, listado, descarga/PDF, acciones, respuesta de una escritura) pasa por el mismo
  chequeo de permisos. Olvidar uno expone datos en silencio.
- CORS: orígenes explícitos desde config por ambiente. **Nunca** `SetIsOriginAllowed(_ => true)` / `AllowAnyOrigin` junto con `AllowCredentials` en código nuevo. CORS no se aplica al handshake de WebSocket / SignalR: ahí se valida el header `Origin` contra la misma lista (§16.5).
- Cabeceras de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP: `default-src 'none'; frame-ancestors 'none'` en la API y una más abierta solo en la ruta de Swagger) registradas en el pipeline antes de `UseExceptionHandler` (o en `Response.OnStarting`) para que los errores también las lleven; HSTS con `MaxAge` de 365 días.
- Swagger deshabilitado en Producción.
- HSTS (`UseHsts`, 365 días) fuera de Development.
- HSTS nuevo en un dominio: `max-age` corto primero (300 s) y subir a 365 días al confirmar que todo responde por HTTPS. Un valor largo mal puesto deja el sitio inaccesible hasta que vence.
- Si la API emite una cookie de sesión o de refresh: `HttpOnly; Secure; SameSite=Lax` (o `Strict`) y nombre con prefijo `__Host-` (el navegador solo la acepta con `Secure`, `Path=/` y sin `Domain`: un subdominio no puede pisarla). Con subdominios compartidos, `__Secure-`.
- Logout: además de invalidar la sesión en el servidor, la respuesta lleva `Clear-Site-Data: "cookies", "storage", "cache"`, que borra en el navegador lo que el front pudo dejar.
- `Cross-Origin-Resource-Policy: same-origin` en las respuestas de la API: no afecta a los `fetch` con CORS del front y evita que otro sitio las embeba con `<img>` o `<script>`.
- Si el front reporta violaciones de CSP (`report-to`): un endpoint que las recibe, con rate limiting y sin guardar query strings ni datos personales. La cabecera `Reporting-Endpoints` la manda el servidor que sirve el front.
- Aprobaciones (maker-checker): quien crea un registro no lo aprueba. Comparar el usuario del token con el creador en el handler y lanzar la excepción 403 del repo (`ClaimException` o `ForbiddenException`).
- Input del usuario dentro de HTML (mails, plantillas): `HtmlEncoder.Default.Encode(...)` antes de interpolar.
- Token del header: `AuthenticationHeaderValue.TryParse`, no `Replace("Bearer ", "")`.
- Rate limiting (`AddRateLimiter`, nativo) en endpoints públicos o costosos (bulk, reportes, listados): partición por
  usuario (`sub`) y por IP sin usuario, ventana deslizante, 429 con `ProblemDetails` y `Retry-After`, `UseRateLimiter`
  después de `UseAuthorization`. Con varias instancias, el contador en memoria se multiplica: gateway o Redis.
- Endpoints caros (reportes, bulk, exportaciones): además de la ventana por usuario, un límite de **concurrencia** con cola
  corta (`AddConcurrencyLimiter`, de `Microsoft.AspNetCore.RateLimiting`) para que no se ejecuten más de N a la vez y no
  agoten el pool de conexiones. El límite es por instancia; lo que excede permisos y cola recibe `429` sin esperar:

  ```csharp
  builder.Services.AddRateLimiter(o =>
  {
      o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
      o.AddConcurrencyLimiter("reportes", c =>
      {
          c.PermitLimit = 4;                                   // ejecutándose a la vez
          c.QueueLimit = 10;                                   // esperando; el resto, 429
          c.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
      });
  });
  // en el action: [EnableRateLimiting("reportes")]
  ```
- Límite de intentos de un secreto (PIN, contraseña, OTP): la clave es lo que guarda el secreto (cuenta, token), no algo
  derivado (un certificado del token); el intento se reserva **antes** de probarlo, de forma atómica **en la base**, y se
  libera si fue correcto, así N pedidos concurrentes no pasan juntos el chequeo. Un `lock` en el proceso no sirve: con
  dos instancias cada una cuenta aparte y el límite se multiplica. Un solo `UPDATE` hace el chequeo y la reserva; las
  filas afectadas dicen si hubo lugar (`0` ⇒ bloqueado: `429` o el error de login genérico). Test con pedidos en paralelo
  (50 pedidos con `Max = 5`: pasan exactamente 5; con "leer y después escribir" pasaron 23):

  ```sql
  UPDATE dbo.IntentosPin
  SET Intentos = CASE WHEN UltimoIntento < DATEADD(MINUTE, -@VentanaMin, SYSUTCDATETIME()) THEN 1 ELSE Intentos + 1 END,
      UltimoIntento = SYSUTCDATETIME()
  WHERE CuentaId = @CuentaId
    AND (Intentos < @Max OR UltimoIntento < DATEADD(MINUTE, -@VentanaMin, SYSUTCDATETIME()));
  -- filas afectadas = 1: intento reservado, probar el PIN. = 0: bloqueado, no se prueba.
  -- PIN correcto: UPDATE ... SET Intentos = 0 WHERE CuentaId = @CuentaId
  ```

  La fila de `IntentosPin` se crea junto con la cuenta (con `Intentos = 0`); `Max` y `VentanaMin` salen de Options (§8).
- Subidas de archivos, tres límites, cada uno donde corresponde. (1) `Limits.MaxRequestBodySize` de Kestrel bajo para
  toda la API (el default es ~30 MB) y `[RequestSizeLimit(n)]` solo en el endpoint que de verdad recibe más;
  `[DisableRequestSizeLimit]` no se usa. (2) `[RequestFormLimits(MultipartBodyLengthLimit = n)]` en el endpoint multipart
  (con ese límite menor al del body, el pedido llega y responde `400`). (3) El archivo se copia con `CopyToAsync` a disco o
  storage; nunca `MemoryStream`, `ReadAllBytes` ni `ToArray()` del archivo entero: con 20 subidas a la vez la memoria se
  multiplica. En IIS, `maxAllowedContentLength` (`requestFiltering`) corta antes que Kestrel (también 30 MB por defecto).
  Tipo por el contenido, no por la extensión, y nombre propio en disco (nunca el del cliente): `offensive-file-upload`.

  ```csharp
  builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 1_000_000);      // toda la API: 1 MB

  [HttpPost]
  [RequestSizeLimit(10_000_000)]                                                       // este endpoint: 10 MB
  [RequestFormLimits(MultipartBodyLengthLimit = 10_000_000)]
  public async Task<ActionResult> UploadDocument(IFormFile archivo, CancellationToken cancellationToken)
  {
      await using var destino = File.Create(Path.Combine(carpeta, $"{Guid.NewGuid():N}.bin"));
      await archivo.CopyToAsync(destino, cancellationToken);                           // sin cargarlo entero en memoria
      return Created();
  }
  ```
- 401 y 403 con `ProblemDetails`, mensajes genéricos (no revelar si el usuario existe). Un cliente de API no recibe una redirección al login: con auth por cookie, .NET 10 ya responde 401/403 en los endpoints que reconoce como API (`[ApiController]`, Minimal API que lee o escribe JSON, `TypedResults`, SignalR); en el resto y en `net8.0`, configurarlo en los eventos de la cookie.
- Dependencias: dependency-check y SonarCloud del pipeline en verde. Hallazgo crítico/alto ⇒ se resuelve o se documenta excepción en el PR.
- **El agente no lee secretos.** En Claude Code el instalador suma a `permissions.deny`, sin quitar las
  reglas del usuario: `~/.ssh/**`, `~/.aws/credentials`, `.env`, `.env.*`, `*.pem`,
  `*.key`, `*.pfx` y `secrets/**`. Bloquea Read/Edit/Write, no `cat` por Bash: nunca leer esos
  archivos por otra vía. Si una tarea necesita un valor, pedírselo al usuario o usar un placeholder.
  Los valores de `dotnet user-secrets` y de Key Vault también se piden al usuario: el agente no los lee.

### 11.3 Blue Team

- Todo error 5xx y todo 401/403 queda logueado con `traceId`, usuario (claim `sub` / `oid`, nunca nombre ni mail) y endpoint (sin datos sensibles).
- .NET 10 publica métricas de autenticación (duración, challenge, forbid, sign-in / sign-out), de autorización y del meter `Microsoft.AspNetCore.Identity`: si el repo ya exporta métricas (OpenTelemetry), alertar sobre picos de challenge y forbid.
- Health check (`Echo/HealthCheck`) sin datos internos en la respuesta.
- Ante vulnerabilidad encontrada: reportarla al usuario en prosa normal, con `archivo:línea`, impacto y fix propuesto, aunque esté fuera del alcance.

### 11.4 Auditoría de dependencias (siempre, no solo en CI)

El agente audita los paquetes NuGet por su cuenta. No espera al dependency-check del pipeline ni a que se lo pidan.

**El nombre de un paquete no se escribe de memoria.** Antes de un `dotnet add package <paquete>` propuesto por el agente: `dotnet package search <paquete> --exact-match --verbosity detailed` (o su página en nuget.org) y confirmar que es el paquete buscado (owner y repo esperados). Un nombre inventado por el modelo puede no existir o estar registrado por un atacante. Lo mismo vale para versiones y flags: se leen del `*.csproj`, `Directory.Packages.props` o la doc, no se suponen. Tampoco se agrega un paquete por un nombre sugerido en un README, un tutorial o código generado por IA sin esa búsqueda.

**Un paquete nuevo es código que puede correr en el build.** Además del owner y el repo: confirmar que el contenido del `.nupkg` coincide con el repo enlazado (en `Sicoob.Sdk`, mayo 2026, no coincidía), y revisar antes de agregarlo todo paquete que trae `build/*.props`, `build/*.targets` o analyzers: se ejecutan al compilar. Campañas de 2026 contra .NET: paquetes que roban datos de ASP.NET Identity (`NCryptYo`, `DOMOAuth2_`, `IRAOAuth2.0`, `SimpleWriter_`), certificados PFX (`Sicoob.Sdk`) y 13 paquetes `WinUI.*` / analyzers de MSBuild repartidos como falsas pruebas técnicas laborales (Socket, 23/11/2026): un `build/*.targets` del paquete ejecuta una DLL después de cada compilación, sin correr la app. Un `.targets` de un paquete desconocido con `<Exec>` o descargas (`DownloadFile`): no se agrega. Para mirarlo sin restaurar: `unzip -p <paquete>.nupkg 'build/*' 'buildTransitive/*' | grep -nE '<Exec|DownloadFile|<UsingTask'`.

**Una prueba técnica o un repo ajeno es código no confiable.** Compilar ya ejecuta código: antes de `dotnet restore` o `dotnet build`, leer `NuGet.config` (feeds), buscar `RestoreAdditionalProjectSources` y `<Exec` en `*.csproj`, `*.props` y `*.targets`, y desconfiar de ejecutables con nombre de proyecto (en esa campaña, `lib/env/axios.csproj`). Se compila en una VM o contenedor descartable, sin credenciales ni secretos del equipo. Si ya se compiló en una máquina con credenciales: aislarla, rotar los secretos desde otro equipo y buscar los indicadores del aviso (en esa campaña: `%LOCALAPPDATA%\osk\OskSupport.dll` y `%TEMP%\Launcher.exe`).

**Cuándo:**
- Al empezar a trabajar en un proyecto.
- Después de cualquier cambio en un `*.csproj`, `Directory.Packages.props` o `packages.lock.json`: paquete nuevo, actualización o borrado.
- Antes de dar por terminada una tarea que tocó dependencias.

**Cómo** (desde la carpeta de la `.sln`; necesita `dotnet restore` previo y acceso al feed privado; en un pedido de solo lectura, con `--no-restore` para no escribir `obj/`, y si falla por falta de restore, se reporta):

```bash
dotnet list package --vulnerable --include-transitive   # vulnerabilidades conocidas (GitHub Advisory DB)
dotnet list package --deprecated                        # paquetes deprecados
dotnet list package --outdated                          # informativo: no actualizar sin pedido
dotnet nuget why <Paquete>                              # quién trae un transitivo vulnerable
```

Se mira la columna *Resolved* (la versión que quedó), no la pedida. Después, cruzar con los mínimos de §11.8.

**Auditoría en el build (NuGet Audit).** En proyectos con TFM `net10.0` o superior, `NuGetAuditMode` es `all` por defecto (audita transitivos) y el
*package pruning* saca del grafo lo que el runtime ya provee (menos falsos positivos). En `net8.0` / `net9.0` se pone
explícito. Repo nuevo o con pedido (en uno existente se propone: el lock file cambia el restore de todo el equipo):

```xml
<!-- Directory.Build.props -->
<PropertyGroup>
  <NuGetAuditMode>all</NuGetAuditMode>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  <RestoreLockedMode Condition="'$(ContinuousIntegrationBuild)' == 'true'">true</RestoreLockedMode>
  <!-- NU1903 = alta, NU1904 = crítica -->
  <WarningsAsErrors>$(WarningsAsErrors);NU1903;NU1904</WarningsAsErrors>
</PropertyGroup>
```

Nunca `<NuGetAudit>false</NuGetAudit>`. `NuGetAuditSuppress` solo con el advisory justificado en el PR y avisado al usuario.

**Qué hacer con el resultado:**
- **Reportar siempre**, aunque la tarea no haya tocado dependencias. Una línea por hallazgo: severidad, paquete, versión, si es directo o transitivo y la versión con fix.
- **`High` / `Critical`**: avisar antes de entregar. Bloquea la entrega igual que en el pipeline.
- **Corregir siempre que haya vulnerabilidades**, con el árbol de git limpio, subiendo a la versión con fix dentro de la misma mayor. Después, `dotnet build` + `dotnet test` de UnitTest y la auditoría de nuevo para confirmar que no quedó nada.
- **Nunca subir una versión mayor sin preguntar** (ni `Microsoft.Extensions.*` por encima del TFM, `SKILL.md` §0): trae cambios que rompen.
- **Transitivo vulnerable**: fijar la versión segura como referencia directa (o en `Directory.Packages.props`). Se anota en el reporte con el motivo (CVE o aviso) y se quita cuando el paquete padre ya trae la versión corregida.
- **Sin fix disponible**: reportarlo y proponer una salida (reemplazar el paquete o quitarlo si .NET lo resuelve), sin aplicarla sin aprobación.
- **Runtime fuera de soporte**: `dotnet list package` no lo avisa. Un `TargetFramework` `net8.0` o `net9.0` (fin de soporte: 10/11/2026) o anterior no recibe parches de seguridad: reportarlo como hallazgo `High` y proponer migrar a `net10.0` ([19](./19-migracion-dotnet.md)), sin migrar sin pedido.
- **Runtime sin el último parche**: tampoco lo avisa. Comparar `dotnet --list-runtimes` y la imagen base del `Dockerfile` con el mínimo de §11.8. Self-contained y contenedores no se arreglan actualizando el servidor: se reconstruyen y se redespliegan.
- **`Microsoft.Data.SqlClient` con versión explícita** en `Directory.Packages.props` (o como referencia directa), en o sobre el mínimo de §11.8: no confiar en la versión transitiva de EF Core. Sin autenticación Entra ID, preferir la línea 7.x (el paquete core ya no trae dependencias de Entra ID); pasar de 6.1 a 7.x es versión mayor: leer sus breaking changes y preguntar antes.
  - En 7.x los paquetes hermanos (`Microsoft.Data.SqlClient.Extensions.Azure`, `.Extensions.Abstractions`, `.AlwaysEncrypted.AzureKeyVaultProvider`, `.Internal.Logging`) comparten número de versión con el driver: se suben todos juntos. Mezclar versiones rompe al restaurar o en runtime.
  - Desde 7.1.2 / 7.0.4 / 6.1.8 `HostNameInCertificate` se valida estricto: el valor reemplaza al nombre del servidor en la validación del certificado, y uno que no figura en el certificado falla en el handshake TLS aunque el nombre del servidor coincida. Tras actualizar el driver, probar la conexión en un entorno con TLS real. Si falla por nombre de certificado: poner un nombre que figure en el certificado, o quitar la clave si el nombre del servidor ya coincide. Nunca taparlo con `TrustServerCertificate=True` (apaga la validación del certificado).
- Si el comando falla (feed privado sin credenciales, restore roto), decirlo con el error exacto. Nunca dar la auditoría por hecha.

**Lo que `dotnet list package` no ve: Zero Wire (Cloudflare Radar).** Feed público y gratis de avisos sobre
vulnerabilidades críticas en software expuesto a internet: runtimes, servidores, sistema operativo, proxies y librerías
muy usadas. Cada aviso dice qué está afectado, si ya se explota y a qué versión actualizar. Complementa a
`dotnet list package --vulnerable`, no lo reemplaza: son pocos avisos, solo los graves.

- **Cuándo** (bajo demanda, una lectura por pedido; nunca en un hook ni en una tarea programada):
  - auditoría de seguridad (§11.6 paso 3);
  - antes de subir el target framework ([19](./19-migracion-dotnet.md));
  - al crear o cambiar la imagen base de un `Dockerfile` ([20](./20-librerias-nuget-ci.md) §20.6).
- **Cómo:** leer solo título, link y resumen de cada aviso (unos 3 KB). El feed entero pesa unos 130 KB por el
  detalle en `<content:encoded>`: no leerlo completo. Abrir el `<link>` solo del aviso que coincide.
  ```bash
  node -e "fetch('https://radar.cloudflare.com/zero-wire/rss').then(r=>r.text()).then(x=>{for(const i of x.split('<item>').slice(1))console.log(['title','link','description'].map(t=>(i.match(new RegExp('<'+t+'>([^]*?)</'+t+'>'))||[])[1]).join(' | '))})"
  ```
  Solo se descarga el feed: no mandar afuera la lista de paquetes ni el nombre del proyecto.
- **Contra qué cruzarlo:** `TargetFramework` y runtime de .NET / ASP.NET Core, Kestrel, IIS y `http.sys`; imagen base
  del `Dockerfile` (Alpine, Debian, OpenSSL, OpenSSH); `PackageReference` directos; proxy o balanceador delante de la
  API, si el repo lo declara.
- **Resultado:** reportar solo las coincidencias, una línea cada una: aviso, componente afectado en el repo
  (`archivo:línea`), versión con fix y link. Sin coincidencias, una línea: "Zero Wire: sin avisos que apliquen
  (leído el <fecha>)". Una coincidencia se trata como `High` / `Critical` (bloquea la entrega). Lo que el repo no
  declara (versión del sistema o del proxy en el servidor) se anota como "no verificable desde el repo".
- Si el feed no responde, decirlo con el error exacto y seguir. Nunca darlo por leído.

### 11.5 Skill `security-audit` (Cloudflare)

Revisión de seguridad con la skill [`security-audit`](https://github.com/cloudflare/security-audit-skill). El instalador la deja global.

**Instalación a mano** (si falta o falló):

```bash
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit --global
```

**Cuándo usarla:**
- **Modo guía:** en cambios de riesgo medio o alto (§13.3) que tocan endpoints nuevos, auth, SQL, uploads, HTTP saliente o secretos, cargar la skill y revisar el cambio con ella.
- **Auditoría completa (solo si el usuario la pide):** "security audit this codebase", pen test, reporte, o un pedido de seguridad con alcance feature o repo (§11.6 paso 5). Es cara (varios subagentes): no lanzarla sin pedido.
- **Salida de la auditoría completa:** por defecto en `~/security-audit-skill/<repo>/run-<N>`, fuera del repo. Nunca commitear los reportes.

**Qué hacer con el resultado:** igual que §11.3. Cada hallazgo con `archivo:línea`, severidad, impacto y fix propuesto. Crítico/alto bloquea la entrega.

Si la skill no está instalada, decirlo y seguir con la checklist de §11.1. Nunca dar la revisión por hecha con la skill si no se cargó.

### 11.6 Pedido de seguridad (auditoría completa red + blue + network)

§11.1–11.4 cubren **cada cambio**. Esta auditoría corre con todo pedido de auditoría a secas
("auditá", "auditá la API"), junto con la pasada de calidad de §13.10, y sola cuando el pedido es solo
de seguridad ("auditá la seguridad", "¿es segura la app?", "pentest", "hardening"). El alcance es **todo el código tocado o el que se indique**, no solo el
último diff. Para el equipo la seguridad es prioridad: se revisan **todas las áreas**, ninguna se
saltea en silencio, y la profundidad de cada una la decide el agente según lo que encuentra.

1. **Delimitar el alcance.** Sin alcance en el pedido, todo el repo, sin preguntar; si no, lo indicado: el diff actual, una feature, un
   proyecto de la solución o todo el repo.
2. **Orientar con `grep -rl`** (`graphify query` solo sin nombre conocido) para ubicar controllers, handlers, repositorios, SQL,
   auth, uploads, `HttpClient` salientes y límites de confianza. Una sola pasada alimenta a todas las
   herramientas. Alcance feature o repo: modelo de amenazas primero
   (`performing-threat-modeling-with-owasp-threat-dragon`) para ordenar qué se ataca. En una pregunta
   o un pedido de solo lectura, STRIDE inline (`security-and-hardening`; una línea por amenaza: dónde, control o hueco), sin Threat Dragon (genera archivos). Pregunta sobre una parte (por ejemplo, el manejo de errores): sin modelo de amenazas. Alcance sin superficie
   (sin entradas, HTTP ni auth): sin modelo de amenazas.
3. **Revisión base de todas las áreas.** Recorrer la tabla de abajo completa. Cada área termina en
   uno de tres estados: **OK** (con la evidencia, `archivo:línea`), **hallazgo** o **N/A** (con el
   motivo: "no hay uploads en el alcance"). Las áreas ausentes del alcance (sin SQL, sin JWT, sin SignalR)
   se cierran juntas como N/A con un `grep` o `graphify query` que lo pruebe. Incluye §11.1 (Red Team), §11.2–11.3 (reglas fijas y
   Blue Team), `dotnet list package --vulnerable --include-transitive` y el feed Zero Wire (§11.4).
4. **Profundizar donde haga falta.** Por cada área, invocar su herramienta profunda (tabla) cuando se
   da **cualquiera** de estas condiciones:
   - la revisión base encontró un hallazgo o una señal dudosa;
   - el área es sensible: auth, tokens, pagos, datos personales, uploads, permisos por usuario;
   - el alcance es una feature completa o todo el repo (en solo lectura, solo las áreas sensibles o con hallazgo).

   Un área N/A no se profundiza. Solo sobre el código propio o entornos autorizados.
5. **Auditoría general** (auditoría pedida de una feature o del repo; una pregunta como "¿es seguro X?"
   usa `security-audit` en modo guía, sin este paso): correr además la skill `security-audit`
   (Cloudflare, §11.5), que busca lo que la tabla no anticipa y verifica cada hallazgo antes de
   reportarlo. El plugin `claude-security` (Anthropic, escaneo multiagente que gasta muchos tokens) solo con pedido explícito o si el usuario acepta su costo cuando se le ofrece en una línea; si no, se anota en la cobertura. En solo lectura, además, que acepte que escriba su reporte fuera del repo. En un diff chico no: alcanza con los
   pasos 3–4.
6. **Priorizar** por riesgo (crítico → bajo), mapeado a OWASP API Top 10. Una línea por hallazgo:
   archivo, línea, riesgo, fix propuesto. Triage de hallazgos dudosos o de scanners:
   `performing-web-application-vulnerability-triage`. Redacción: `offensive-reporting`.
7. **Corregir.** Si el pedido es una pregunta o de solo lectura ("¿es seguro?", "solo revisá"), se
   reporta con el fix propuesto, sin editar (§13.1). Si no, lo que está dentro del alcance se corrige; crítico/alto bloquea la entrega. Lo que
   queda fuera del alcance se reporta y se pregunta antes de tocarlo (§11.3). Nunca desactivar una
   protección para "arreglar".
8. **Reverificar.** Tras cada fix, `dotnet build` + `dotnet test` de UnitTest.
9. **Reporte de cobertura.** Además de los hallazgos, una tabla con cada área, su estado
   (OK / hallazgo / N/A) y la herramienta usada. Así se ve qué se revisó y qué no aplicaba.

| Área | Revisión base | Herramienta profunda |
| :--- | :--- | :--- |
| Autorización / BOLA / BFLA (API1, API5) | §11.1 | `offensive-idor`, `offensive-business-logic` |
| Autenticación, tokens y JWT (API2) | §11.1, §11.2 | `offensive-jwt`, `testing-for-json-web-token-vulnerabilities`, `implementing-jwt-signing-and-verification` |
| OAuth2 / OIDC | §11.1 | `offensive-oauth`, `configuring-oauth2-authorization-flow`, `performing-oauth-scope-minimization-review` |
| Inyección SQL (Dapper, `FromSql`) | §11.1, §5 | `offensive-sqli` |
| Mass assignment y exposición de datos (API3) | §11.1 | `offensive-api-security`, `testing-api-security-with-owasp-top-10` |
| Consumo de recursos y rate limiting (API4) | §11.1, §11.2 | `offensive-race-condition`, `offensive-parameter-pollution`, `performing-api-rate-limiting-bypass`, `implementing-api-rate-limiting-and-throttling` |
| SSRF y `HttpClient` saliente (API7) | §11.1, §9 | `offensive-ssrf` |
| XML, deserialización y plantillas | §11.1 | `offensive-xxe`, `offensive-deserialization`, `offensive-ssti` |
| Uploads | §11.1 | `offensive-file-upload` |
| Redirects | §11.1 | `offensive-open-redirect` |
| GraphQL | §11.1 | `offensive-graphql` |
| Proxy, IIS y cabeceras HTTP | §11.2 | `offensive-request-smuggling`, `performing-security-headers-audit`, `performing-clickjacking-attack-test`, `testing-for-host-header-injection`, `performing-web-cache-poisoning-attack`, `security-audit` |
| TLS y certificados (network) | §11.2 (HSTS, `HttpsRedirection`, solo TLS 1.2/1.3 en Kestrel/IIS, validación de certificados en `HttpClient` sin `ServerCertificateCustomValidationCallback` que devuelva `true`) | `performing-ssl-tls-security-assessment`, `configuring-tls-1-3-for-secure-communications`, `offensive-tls-attacks` |
| Superficie expuesta (network) | Swagger en producción, health check con datos internos, endpoints internos publicados, puertos y bindings extra, ambientes de prueba públicos | `scanning-network-with-nmap-advanced`, `offensive-network-attacks` |
| Servicio a servicio (network) | §9 (tokens de servicio, certificados): llamadas internas autenticadas, sin confiar en la red interna | `implementing-mtls-for-zero-trust-services` |
| Azure (network) | Key Vault, SQL y Storage sin acceso público innecesario (firewall, private endpoints), restricciones de acceso del App Service, identidad administrada con permisos mínimos | `offensive-cloud` |
| SignalR / WebSocket | §16: solo HTTPS/`wss://` (§11.2), origen validado, token en la conexión, autorización por grupo | `testing-websocket-api-security`, `exploiting-websocket-vulnerabilities` |
| CORS y CSRF | §11.2 | `testing-cors-misconfiguration`; `performing-csrf-attack-simulation` si la auth es por cookie |
| Secretos y PII | §8, §11.1 | `implementing-secret-scanning-with-gitleaks` |
| Errores y `ProblemDetails` (sin filtrar datos internos) | §7, §11.2 | `security-audit` |
| Dependencias NuGet y supply chain | §11.4 | `offensive-dependency-confusion`, `offensive-supply-chain`, `generating-and-analyzing-sboms`; `detecting-malicious-npm-packages`, `detecting-typosquatting-packages-in-npm-pypi` si el repo trae tooling npm o pip |
| Logging y respuesta (Blue Team) | §11.3, §10 | `analyzing-web-server-logs-for-intrusion`, `implementing-api-abuse-detection-with-rate-limiting`, `security-audit` |

**Barrido de inyección SQL** (revisión base del área, sobre el alcance):

```bash
rg -n 'FromSqlRaw\(|ExecuteSqlRaw\(|SqlQueryRaw\(' --glob '*.cs'                      # cada uso: texto constante + SqlParameter
rg -n '(Query|QueryAsync|Execute|ExecuteAsync|QueryFirstOrDefaultAsync)(<[^>]+>)?\(\$"' --glob '*.cs'   # Dapper con string interpolado = inyección
rg -n 'ORDER BY \{|ORDER BY "\s*\+' --glob '*.cs'                                     # ORDER BY solo desde whitelist
```

**Pruebas en vivo (network).** Escaneo de puertos, evaluación TLS y cabeceras contra un host real son
acciones hacia afuera. Solo contra hosts propios y autorizados. Es lo único que la auditoría
pregunta (el alcance no): host y ambiente, una sola vez y al empezar; producción solo con OK
explícito. Mientras no hay respuesta, se avanza con la revisión de
código. Sin URL disponible, revisar la
configuración (`Program.cs`, Kestrel, `web.config`, IaC del pipeline) y marcar el área como "sin
prueba en vivo" en la cobertura.

**Eficiencia sin perder cobertura:** la revisión base de todas las áreas es obligatoria; lo que se
dosifica es la profundidad. No releer lo mismo para cada skill: pasarles los `archivo:línea` que ya
ubicó el `grep`. Si el alcance es grande, delegar el barrido por área a subagentes en paralelo (§14.3);
la priorización, la corrección y la decisión final quedan en el modelo principal. Si falta una skill
de la tabla, instalar solo esa skill (`npx -y skills add <owner/repo> --global --yes --skill <nombre>`: las `offensive-*` vienen de `SnailSploit/claude-red`, las de AppSec de `mukul975/Anthropic-Cybersecurity-Skills`, `security-audit` de `cloudflare/security-audit-skill`) y avisar en una línea (solo lectura: solo avisar); si no se puede, hacer
esa área con la revisión base y decirlo en el reporte de cobertura.

### 11.7 Autenticación y autorización: detalle

Amplía §11.2 (JWT, policy global, M2M, CORS); no lo repite. Leer al tocar `AddJwtBearer`, policies, CORS, un IdP propio, LDAP o la migración de un esquema de auth.

**Validación del JWT bearer** (cuando el repo usa `AddJwtBearer`; las cuatro validaciones en `true` ya están en §11.2):

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var auth = builder.Configuration.GetSection("Auth").Get<AuthOptions>()!;
        options.Authority = auth.Authority;                // https://idp.example.com
        options.MapInboundClaims = false;                  // solo en API nueva; en una existente, ver abajo
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = auth.Issuer,
            ValidateAudience = true,
            ValidAudiences = auth.Audiences,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(30),          // el default es 5 min
            NameClaimType = "name",                        // solo junto con MapInboundClaims = false
            RoleClaimType = "role"                         // idem (Entra ID: "roles"); con el mapeo por defecto no se tocan
        };
    });
```

- Con `Authority`, las claves de firma se descargan del IdP (metadata OIDC) y rotan solas; sin `Authority`, la clave sale de Key Vault (§8), nunca del código.
- **`ClockSkew` chico** (30 s a 1 min): el default de 5 minutos extiende la vida real de cada token.
- **`MapInboundClaims`**: por defecto el handler renombra claims (`sub` → `ClaimTypes.NameIdentifier`, `role` → `ClaimTypes.Role`). Con `MapInboundClaims = false` los nombres son los del token y `NameClaimType` / `RoleClaimType` deben apuntar a ellos. **No lo cambies en una API que ya anda** sin revisar cada `User.FindFirst(...)`, `[Authorize(Roles)]` y policy: cambia los nombres de todos los claims.
- El algoritmo de firma no se fija desde el token (`alg: none` rechazado por defecto); no relajar `ValidAlgorithms`.

**Autorización con `AddAuthorization`** (la policy global de §11.2 y, solo si el repo ya autoriza por policies, policies por scope o rol):

```csharp
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .RequireRole("<rol de la app>")      // la policy de la app, como en §11.2
        .Build())
    .AddPolicy("items:read",  p => p.RequireAssertion(ctx =>
        (ctx.User.FindFirst("scope")?.Value ?? ctx.User.FindFirst("scp")?.Value
            ?? ctx.User.FindFirst("http://schemas.microsoft.com/identity/claims/scope")?.Value ?? "")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries).Contains("items.read")))
    .AddPolicy("items:write", p => p.RequireRole("ItemWriter"));
```

- **Repo sin autenticación configurada** (sin IdP, authority ni audience): no inventar un esquema JWT ni dejar `[Authorize]` sin esquema (responde 500). El endpoint va con `[AllowAnonymous]` explícito y se reporta como pendiente bloqueante antes de cualquier entorno real, más si expone datos personales.
- **`FallbackPolicy` deny-by-default** (§11.2): un endpoint sin atributo exige usuario autenticado con el rol de la app (repo nuevo sin rol de app definido: solo autenticado); el anónimo es `[AllowAnonymous]` explícito.
- **`[Authorize(Policy = ...)]` por endpoint solo en repos que ya autorizan por policies.** Si el repo usa `[RoleAuthorization]` (con `ValidateTokenFilter` o con `AddJwtBearer` + `AddAuthorization`), el control por action sigue como en §3 y §11.2; no agregues policies por endpoint encima. En un repo por policies: una por scope o rol en cada endpoint (`[Authorize(Policy = "items:read")]`), con el mínimo necesario. Los nombres de scopes y roles, en `Domain/Structs/Roles.cs` o constantes, no literales sueltos (§3).
- Scope (`scope` / `scp`; con el mapeo por defecto, `scp` llega como `http://schemas.microsoft.com/identity/claims/scope`, por eso la assertion lee los tres) viene como string separado por espacios: se parte (`RequireAssertion` como arriba o un `AuthorizationHandler`); `RequireClaim("scope", "x")` falla con más de un scope.
- Endpoint nuevo: en un repo por policies, sin policy ni `[AllowAnonymous]` no se entrega; en un repo con `[RoleAuthorization]`, sin ese atributo (o `[AllowAnonymous]` documentado) no se entrega (§3).
- **CORS**: `WithOrigins(config.Origins)` con orígenes exactos por ambiente; métodos y cabeceras listados; `AllowCredentials` solo con origen explícito (§11.2). `UseCors` va entre `UseRouting` y `UseAuthentication`.

**Cuándo aplica — IdP propio (ej. OpenIddict)**: solo si el proyecto ya tiene un IdP propio o el usuario lo pide. Si no, no lo agregues; usá el IdP existente.

- **PKCE obligatorio** (`RequireProofKeyForCodeExchange`) para clientes públicos (SPA, móvil); sin implicit flow ni password flow.
- **Redirect URIs exactas** registradas por cliente (sin comodines ni coincidencia por prefijo); `post_logout_redirect_uris` también.
- Clientes públicos sin `client_secret`; clientes confidenciales (M2M) con el secreto en Key Vault (§8).
- Scopes mínimos por cliente; tokens de acceso de vida corta, refresh con rotación. Claves de firma y cifrado en Key Vault o certificado, no efímeras en producción.
- **Refresh token con rotación y varias pestañas.** Contrato con el front: el refresh token rota en cada uso. Dos
  pestañas que refrescan a la vez mandan el mismo token: una gana y la otra llega con un token ya rotado, que no es
  un robo. Reglas:
  - La revocación vive en **una fila por familia** (`FamiliaToken.RevocadaEn`) y cada uso de un token la consulta en el
    mismo `UPDATE`. Así revocar es una sola escritura atómica, y un token insertado justo mientras se revoca (logout o
    reuso cruzado con una rotación) nace muerto: no hay orden de llegada que deje un token vivo en una familia revocada.
  - La rotación es atómica: el `UPDATE` de abajo con `OUTPUT` (1 fila: ganó; 0 filas: ya estaba usado, vencido o
    revocado). Nunca "leer y después marcar". El token nuevo se inserta en la misma transacción.
  - Ventana de gracia corta (segundos) para el token recién usado: se emite otro token **de la misma familia** (se guardan
    solo hashes, no se puede devolver "el mismo" par). Lleva **tope de reemisiones por token**, contado en la base con
    otro `UPDATE` atómico; sin tope, cada pedido dentro de la ventana fabrica un token vivo más. Pasado el tope dentro
    de la ventana: `401` sin revocar (no es prueba de robo).
  - Fuera de la ventana, un token ya usado es **reuso**: se revoca la familia, se loguea `LogWarning` con usuario y
    familia, y la respuesta es `401`. La ventana no se alarga para "tolerar" más: debilita la detección de robo.
  - El logout revoca la familia con el mismo `UPDATE`. `auth/refresh` y `auth/logout` se autentican solo con la cookie:
    validan el header `Origin` contra los orígenes permitidos (otro sitio no lee la respuesta, pero puede forzar
    rotaciones o cerrar la sesión) y la cookie va con `SameSite=Strict`.
  - Con OpenIddict la gracia ya viene como `SetRefreshTokenReuseLeeway(TimeSpan)`: no se reimplementa.
  - Tests: N refrescos en paralelo del mismo token (uno rota, `@Tope` caen en gracia, el resto `401`, la familia sigue
    viva); reuso fuera de la ventana (familia revocada y el token nuevo deja de servir); logout cruzado con rotaciones
    (ningún token queda usable).

  ```sql
  -- 1. Rotar. 1 fila: insertar el token nuevo de esa familia en la misma transacción.
  UPDATE t SET UsadoEn = SYSUTCDATETIME()
  OUTPUT inserted.FamiliaId
  FROM dbo.RefreshToken t
  JOIN dbo.FamiliaToken f ON f.Id = t.FamiliaId AND f.RevocadaEn IS NULL
  WHERE t.TokenHash = @Hash AND t.UsadoEn IS NULL AND t.ExpiraEn > SYSUTCDATETIME();

  -- 2. Si rotar dio 0 filas: gracia. 1 fila: insertar otro token de la familia.
  UPDATE t SET Reemisiones = Reemisiones + 1
  OUTPUT inserted.FamiliaId
  FROM dbo.RefreshToken t
  JOIN dbo.FamiliaToken f ON f.Id = t.FamiliaId AND f.RevocadaEn IS NULL
  WHERE t.TokenHash = @Hash AND t.Reemisiones < @Tope
    AND t.UsadoEn >= DATEADD(SECOND, -@GraciaSeg, SYSUTCDATETIME());

  -- 3. Si también dio 0 filas: leer el token. Usado hace más de @GraciaSeg => reuso: revocar. Si no => 401.
  UPDATE dbo.FamiliaToken SET RevocadaEn = SYSUTCDATETIME() WHERE Id = @Familia AND RevocadaEn IS NULL;
  ```

**Cuándo aplica — LDAP / Active Directory**: solo si el proyecto ya autentica o consulta contra LDAP / AD.

- **LDAPS** (636, o StartTLS) con validación del certificado del servidor (`LdapSessionOptions.VerifyServerCertificate` de `System.DirectoryServices.Protocols`; un callback que devuelve siempre `true` está prohibido, §11.6); nunca LDAP en claro.
- **Escapar los valores en los filtros** (LDAP injection): un `userName` en `(&(uid=...))` sin escapar permite filtros arbitrarios. Escapar `\ * ( ) \0` según RFC 4515, o armar el filtro con la API que lo hace; nunca interpolar el input directo.
- **Cuenta de bind**: usuario de solo lectura con el mínimo permiso; su contraseña en Key Vault (§8), jamás en `appsettings` ni en el código ni en logs.
- Mensajes de login genéricos (no revelar si el usuario existe) y límite de intentos (§11.2, rate limiting).
- Preferir bind del usuario (validar su contraseña con su propio bind) a comparar hashes.
- **Consulta LDAP por request, bajo carga**: timeout explícito (`LdapConnection.Timeout`, `LdapSessionOptions.SendTimeout`
  y `SearchRequest.TimeLimit`) y tope de conexiones simultáneas con un `SemaphoreSlim` singleton: sin tope, 500 logins a la vez
  abren 500 conexiones y bloquean 500 hilos (`SendRequest` es sincrónico). Si no hay lugar en pocos segundos, `503` rápido con
  `ExternalApiException` en vez de encolar sin fin. La conexión se abre y se cierra con `using`; nunca queda en un campo compartido.

  ```csharp
  // singleton: private readonly SemaphoreSlim slots = new(10);
  if (!await slots.WaitAsync(TimeSpan.FromSeconds(2), cancellationToken))
      throw new ExternalApiException(/* LDAP, 503 */);
  try
  {
      using var connection = new LdapConnection(identifier) { Timeout = TimeSpan.FromSeconds(5) };
      // LDAPS + bind del usuario + búsqueda con TimeLimit
  }
  finally { slots.Release(); }
  ```

**Migrar auth legada a OIDC** (de un token propio, `ValidateTokenFilter` o cookies a un IdP OIDC): solo con pedido, y es riesgo alto (§13.3).

1. **En paralelo**: los dos esquemas registrados y un *policy scheme* (`AddPolicyScheme`, `ForwardDefaultSelector`) que elige por el token de cada request (por ejemplo, por `iss` o por el formato).
2. Las policies y roles de la app aceptan identidades de ambos esquemas; los claims del esquema nuevo se mapean a los que la app ya consume.
3. **Corte**: cuando todos los clientes usan el esquema nuevo (verificado con logs, §11.3), el selector apunta solo al nuevo.
4. **Retiro**: se elimina el esquema viejo, su filtro, sus claves y su configuración, en un commit aparte. Es la **única excepción** a "nunca desactivar `ValidateTokenFilter`" (§11.2): solo con pedido explícito del usuario y después del corte verificado.
5. Durante la convivencia ninguno de los dos esquemas relaja validaciones (§11.2); tests con un token real de cada uno.

### 11.8 Avisos de seguridad vigentes (mínimos con parche)

Repasado el 2026-11-27 (`FUENTES.md`). Es un piso, no la lista completa: la auditoría de §11.4 manda. Una versión por
debajo de un mínimo que aplica al repo es hallazgo `High` (bloquea la entrega). Actualizar el servidor no alcanza para
apps self-contained ni contenedores: rebuild y redeploy.

**Runtime de ASP.NET Core: 10.0.15 o superior** (servicing del 10/11/2026; 11.0.0 en .NET 11). 8.0.34 y 9.0.23 son los
últimos parches de 8.x y 9.x: desde esa fecha no reciben más.

| Aviso | Afecta a | Qué hacer |
| :--- | :--- | :--- |
| CVE-2026-114146 (crítico, elevación de privilegios por autorización incorrecta) | ASP.NET Core 8 a 11 y `Microsoft.AspNetCore.Http.Connections` | Runtime al mínimo; `Http.Connections` 1.2.14 o superior si se referencia directo. Sin workaround. |
| CVE-2026-114147 (DoS) | Hubs con backplane Redis: `Microsoft.AspNetCore.SignalR.StackExchangeRedis` | Actualizar runtime **y** paquete (§16.6). |
| CVE-2026-118747 (DoS) | Paquete `System.Formats.Cbor` | El runtime no alcanza: actualizar el paquete (8.0.2, 9.0.24, 10.0.15 u 11.0.0 según la línea). |
| CVE-2026-118741 y CVE-2026-70175 (elevación de privilegios; las fuentes de Microsoft no coinciden en cuál de los dos identifica el aviso, se tratan igual) | Código scaffoldeado de ASP.NET Core Identity (8, 9, 10) | Actualizar SDK, templates y herramientas de scaffolding (`dotnet-scaffold` 20.3.0; `CodeGenerators.Mvc` / `CodeGeneration.Design` 8.0.24, 9.0.13 o 10.0.3) **y corregir el código ya generado**: actualizar no lo repara. En `ForgotPassword` y `ResendEmailConfirmation` (y sus equivalentes Blazor) el mail se envía a `UserManager.GetEmailAsync(user)`, no a `Input.Email`. |
| CVE-2026-114157 (bypass) | Kestrel con transporte Named Pipes | Solo si se usa ese transporte; runtime al mínimo. |
| CVE-2026-114154 (DoS) | `Microsoft.AspNetCore.Server.HttpSys` 2.3.10 a 2.3.13 | 2.3.14; runtime al mínimo. |
| CVE-2026-62903 (bypass de autenticación por repetición, MITM) | `Microsoft.Data.SqlClient` | Corregido en 6.1.7, 7.0.3 y 7.1.0. Piso: el último parche de la línea, 6.1.8, 7.0.4 o 7.1.2 (13/11/2026: además cierran la conexión física ante respuestas malformadas, aíslan las sesiones de enclave y suben dependencias por CVE-2026-84008). Al subir, ver `HostNameInCertificate` y paquetes hermanos en §11.4. 5.x y anteriores: migrar a una línea soportada. Según el aviso puede exponer claves de Always Encrypted con secure enclaves: si se usan, prioridad máxima. El parche del motor SQL Server es aparte. |
| CVE-2026-84008 (DoS, CPU cuadrática sin autenticación en `SignedCms.CheckSignature`) | Paquete `System.Security.Cryptography.Pkcs`: quien valida CMS / PKCS#7 o SAML (firma digital), o lo trae transitivo | 8.0.2, 9.0.21 o 10.0.13 según la línea; revisar con `dotnet list package --include-transitive`. Defensa en profundidad: límite de tamaño a la entrada no confiable antes de `CheckSignature`. |
| CVE-2026-56170 (DoS) | Hubs de SignalR con *stateful reconnect* (.NET 8, 9, 10) | Versión del aviso; no habilitarlo sin necesidad (§16.5). |
| CVE-2026-45591 (DoS) | `Microsoft.AspNetCore.SignalR.Protocols.MessagePack` | Runtime al mínimo y, si se usa ese protocolo, también el paquete. |
| CVE-2024-32655 (inyección SQL por tamaño de mensaje del protocolo) | `Npgsql` | 8.0.3 o superior (7.0.7, 6.0.11, 5.0.18, 4.1.13, 4.0.14 en sus líneas). Parametrizar no lo evita. |

El resto de los avisos de noviembre de 2026 del runtime y de ASP.NET Core quedan cubiertos con el runtime al mínimo:
CVE-2026-105544 y CVE-2026-114155 (elevación de privilegios), CVE-2026-109475 y CVE-2026-114149 (DoS)
y CVE-2026-109476 (divulgación de información). Severidad y versión corregida de cada uno: `release-notes/10.0/cve.md`
del repo `dotnet/core`. Al anotar el piso en un reporte o un PR se escribe la versión y el CVE, no "parche de noviembre".

**Servidor PostgreSQL: 18.7, 17.12, 16.16 o 15.20 como mínimo** (12/11/2026: 52 CVE, entre ellos CVE-2026-6460,
ejecución de código por *type confusion* tras `ALTER ... SET DATA TYPE`). PostgreSQL 14 llegó a fin de vida (14.25 es
la última): se reporta como fuera de soporte y se propone el upgrade de mayor, sin hacerlo sin pedido. El agente no
parchea servidores: reporta la versión (`SHOW server_version`) como hallazgo `High` y lista lo que sigue.

- El parche menor es solo binario (sin `pg_upgrade`), pero no termina ahí. Pasos posteriores de las release notes:
  reindexar los índices B-tree sobre `bpchar` sin longitud y los GiST con `gist_trgm_ops` (los GIN, si hay sospecha de
  corrupción); nuevo full backup como base de los incrementales; revisar constraints `NOT NULL NO INHERIT` inválidos
  en tablas particionadas:

  ```sql
  SELECT conrelid::regclass, conname FROM pg_constraint
  WHERE contype = 'n' AND connoinherit
    AND conrelid IN (SELECT oid FROM pg_class WHERE relkind = 'p');
  ```
- CVE-2026-6460 y CVE-2026-6467 necesitan un rol que pueda crear objetos: el rol con el que conecta la app no tiene
  DDL (§5.1). Es endurecimiento, no reemplaza el parche.
