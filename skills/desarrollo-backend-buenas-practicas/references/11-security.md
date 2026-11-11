## 11. Seguridad (Red Team / Blue Team)

Revisión Red Team, reglas fijas, Blue Team y auditoría de dependencias. Leer en todo cambio antes de entregar. §11.6: auditoría completa red + blue + network con todo "auditá" a secas o pedido de seguridad.

### 11.1 Revisión Red Team de cada cambio (obligatoria antes de entregar)

Preguntarse como atacante, para cada endpoint o cambio:

1. **Autorización (API1/API5 BOLA/BFLA)**: ¿tiene `[RoleAuthorization]` (en hubs, `[Authorize(Roles)]`, §16.4) con el rol mínimo? ¿El usuario puede pedir datos de otra entidad o tenant cambiando un id? Filtrar siempre por la entidad del token, no por la del request. **Quién actúa sale solo del token**: nunca de un campo del body (`requestUser`), de la query (`?user=`) ni de la ruta (`/{username}`).
2. **Inyección (A05)**: ¿algún input llega a SQL, a `ORDER BY`, a un path, a un header o a una URL saliente sin parametrizar / whitelist?
3. **Mass assignment (API3)**: ¿el request expone campos que el usuario no debería setear (estado, auditoría, ids internos)?
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
- CORS: orígenes explícitos desde config por ambiente. **Nunca** `SetIsOriginAllowed(_ => true)` / `AllowAnyOrigin` junto con `AllowCredentials` en código nuevo.
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
- Límite de intentos de un secreto (PIN, contraseña, OTP): la clave es lo que guarda el secreto (cuenta, token), no algo
  derivado (un certificado del token); el intento se reserva bajo lock **antes** de probarlo y se libera si fue correcto,
  así N pedidos concurrentes no pasan juntos el chequeo; test con pedidos en paralelo.
- 401 y 403 con `ProblemDetails`, mensajes genéricos (no revelar si el usuario existe).
- Dependencias: dependency-check y SonarCloud del pipeline en verde. Hallazgo crítico/alto ⇒ se resuelve o se documenta excepción en el PR.
- **El agente no lee secretos.** En Claude Code el instalador suma a `permissions.deny`, sin quitar las
  reglas del usuario: `~/.ssh/**`, `~/.aws/credentials`, `.env`, `.env.*`, `*.pem`,
  `*.key`, `*.pfx` y `secrets/**`. Bloquea Read/Edit/Write, no `cat` por Bash: nunca leer esos
  archivos por otra vía. Si una tarea necesita un valor, pedírselo al usuario o usar un placeholder.
  Los valores de `dotnet user-secrets` y de Key Vault también se piden al usuario: el agente no los lee.

### 11.3 Blue Team

- Todo error 5xx y todo 401/403 queda logueado con `traceId`, usuario (claim `sub` / `oid`, nunca nombre ni mail) y endpoint (sin datos sensibles).
- Health check (`Echo/HealthCheck`) sin datos internos en la respuesta.
- Ante vulnerabilidad encontrada: reportarla al usuario en prosa normal, con `archivo:línea`, impacto y fix propuesto, aunque esté fuera del alcance.

### 11.4 Auditoría de dependencias (siempre, no solo en CI)

El agente audita los paquetes NuGet por su cuenta. No espera al dependency-check del pipeline ni a que se lo pidan.

**Cuándo:**
- Al empezar a trabajar en un proyecto.
- Después de cualquier cambio en un `*.csproj`, `Directory.Packages.props` o `packages.lock.json`: paquete nuevo, actualización o borrado.
- Antes de dar por terminada una tarea que tocó dependencias.

**Cómo** (desde la carpeta de la `.sln`; necesita `dotnet restore` previo y acceso al feed privado; en un pedido de solo lectura, con `--no-restore` para no escribir `obj/`, y si falla por falta de restore, se reporta):

```bash
dotnet list package --vulnerable --include-transitive   # vulnerabilidades conocidas (GitHub Advisory DB)
dotnet list package --deprecated                        # paquetes deprecados
dotnet list package --outdated                          # informativo: no actualizar sin pedido
```

**Qué hacer con el resultado:**
- **Reportar siempre**, aunque la tarea no haya tocado dependencias. Una línea por hallazgo: severidad, paquete, versión, si es directo o transitivo y la versión con fix.
- **`High` / `Critical`**: avisar antes de entregar. Bloquea la entrega igual que en el pipeline.
- **Corregir** subiendo la versión, solo si la tarea toca dependencias o el usuario lo pide (todo pedido de auditoría cuenta, §13.10). Después, `dotnet build` + `dotnet test` de UnitTest y la auditoría de nuevo para confirmar que no quedó nada.
- **Nunca subir una versión mayor sin preguntar** (ni `Microsoft.Extensions.*` por encima del TFM, `SKILL.md` §0): trae cambios que rompen.
- **Transitivo vulnerable**: fijar la versión segura como referencia directa (o en `Directory.Packages.props`) si la tarea toca dependencias o es una auditoría (§13.10); si no, proponerlo sin aplicar.
- **Sin fix disponible**: reportarlo y proponer una salida (reemplazar el paquete o quitarlo si .NET lo resuelve), sin aplicarla sin aprobación.
- Si el comando falla (feed privado sin credenciales, restore roto), decirlo con el error exacto. Nunca dar la auditoría por hecha.

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
   Blue Team) y `dotnet list package --vulnerable --include-transitive` (§11.4).
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

**Cuándo aplica — LDAP / Active Directory**: solo si el proyecto ya autentica o consulta contra LDAP / AD.

- **LDAPS** (636, o StartTLS) con validación del certificado del servidor (`LdapSessionOptions.VerifyServerCertificate` de `System.DirectoryServices.Protocols`; un callback que devuelve siempre `true` está prohibido, §11.6); nunca LDAP en claro.
- **Escapar los valores en los filtros** (LDAP injection): un `userName` en `(&(uid=...))` sin escapar permite filtros arbitrarios. Escapar `\ * ( ) \0` según RFC 4515, o armar el filtro con la API que lo hace; nunca interpolar el input directo.
- **Cuenta de bind**: usuario de solo lectura con el mínimo permiso; su contraseña en Key Vault (§8), jamás en `appsettings` ni en el código ni en logs.
- Mensajes de login genéricos (no revelar si el usuario existe) y límite de intentos (§11.2, rate limiting).
- Preferir bind del usuario (validar su contraseña con su propio bind) a comparar hashes.

**Migrar auth legada a OIDC** (de un token propio, `ValidateTokenFilter` o cookies a un IdP OIDC): solo con pedido, y es riesgo alto (§13.3).

1. **En paralelo**: los dos esquemas registrados y un *policy scheme* (`AddPolicyScheme`, `ForwardDefaultSelector`) que elige por el token de cada request (por ejemplo, por `iss` o por el formato).
2. Las policies y roles de la app aceptan identidades de ambos esquemas; los claims del esquema nuevo se mapean a los que la app ya consume.
3. **Corte**: cuando todos los clientes usan el esquema nuevo (verificado con logs, §11.3), el selector apunta solo al nuevo.
4. **Retiro**: se elimina el esquema viejo, su filtro, sus claves y su configuración, en un commit aparte. Es la **única excepción** a "nunca desactivar `ValidateTokenFilter`" (§11.2): solo con pedido explícito del usuario y después del corte verificado.
5. Durante la convivencia ninguno de los dos esquemas relaja validaciones (§11.2); tests con un token real de cada uno.
