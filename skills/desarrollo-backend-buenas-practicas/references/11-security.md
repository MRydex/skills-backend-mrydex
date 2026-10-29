## 11. Seguridad (Red Team / Blue Team)

Revisión Red Team, reglas fijas, Blue Team y auditoría de dependencias. Leer en todo cambio antes de entregar. §11.6: auditoría completa red + blue + network con todo "auditá" a secas o pedido de seguridad.

### 11.1 Revisión Red Team de cada cambio (obligatoria antes de entregar)

Preguntarse como atacante, para cada endpoint o cambio:

1. **Autorización (API1/API5 BOLA/BFLA)**: ¿tiene `[RoleAuthorization]` (en hubs, `[Authorize(Roles)]`, §16.4) con el rol mínimo? ¿El usuario puede pedir datos de otro banco/entidad cambiando un id? Filtrar siempre por la entidad del token, no por la del request. **Quién actúa sale solo del token**: nunca de un campo del body (`requestUser`), de la query (`?user=`) ni de la ruta (`/{username}`).
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
- CORS: orígenes explícitos desde config por ambiente. **Nunca** `SetIsOriginAllowed(_ => true)` / `AllowAnyOrigin` junto con `AllowCredentials` en código nuevo.
- Cabeceras de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP mínima para Swagger) registradas en el pipeline.
- Swagger deshabilitado en Producción.
- HSTS (`UseHsts`, 365 días) fuera de Development.
- Aprobaciones (maker-checker): quien crea un registro no lo aprueba. Comparar el usuario del token con el creador en el handler y lanzar la excepción 403 del repo (`ClaimException` o `ForbiddenException`).
- Input del usuario dentro de HTML (mails, plantillas): `HtmlEncoder.Default.Encode(...)` antes de interpolar.
- Token del header: `AuthenticationHeaderValue.TryParse`, no `Replace("Bearer ", "")`.
- Rate limiting (`AddRateLimiter`) en endpoints públicos o costosos (bulk, reportes).
- 401 y 403 con `ProblemDetails`, mensajes genéricos (no revelar si el usuario existe).
- Dependencias: dependency-check y SonarCloud del pipeline en verde. Hallazgo crítico/alto ⇒ se resuelve o se documenta excepción en el PR.
- **El agente no lee secretos.** En Claude Code el instalador agrega a `permissions.deny` (solo si el
  usuario no tiene su propia lista): `~/.ssh/**`, `~/.aws/credentials`, `.env`, `.env.*`, `*.pem`,
  `*.key`, `*.pfx` y `secrets/**`. Bloquea Read/Edit/Write, no `cat` por Bash: nunca leer esos
  archivos por otra vía. Si una tarea necesita un valor, pedírselo al usuario o usar un placeholder.
  Los valores de `dotnet user-secrets` y de Key Vault también se piden al usuario: el agente no los lee.

### 11.3 Blue Team

- Todo error 5xx y todo 401/403 queda logueado con `traceId`, usuario y endpoint (sin datos sensibles).
- Health check (`Echo/HealthCheck`) sin datos internos en la respuesta.
- Ante vulnerabilidad encontrada: reportarla al usuario en prosa normal, con `archivo:línea`, impacto y fix propuesto, aunque esté fuera del alcance.

### 11.4 Auditoría de dependencias (siempre, no solo en CI)

El agente audita los paquetes NuGet por su cuenta. No espera al dependency-check del pipeline ni a que se lo pidan.

**Cuándo:**
- Al empezar a trabajar en un proyecto, junto al Paso 0 (graphify).
- Después de cualquier cambio en un `*.csproj`, `Directory.Packages.props` o `packages.lock.json`: paquete nuevo, actualización o borrado.
- Antes de dar por terminada una tarea que tocó dependencias.

**Cómo** (desde la carpeta de la `.sln`; necesita `dotnet restore` previo y acceso al feed privado):

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
- **Transitivo vulnerable**: proponer fijar la versión segura como referencia directa (o en `Directory.Packages.props`), sin aplicarlo sin aprobación.
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
- **Auditoría completa (solo si el usuario la pide):** "security audit this codebase", pen test o reporte. Es cara (varios subagentes): no lanzarla sin pedido.
- **Salida de la auditoría completa:** por defecto en `~/security-audit-skill/<repo>/run-<N>`, fuera del repo. Nunca commitear los reportes.

**Qué hacer con el resultado:** igual que §11.3. Cada hallazgo con `archivo:línea`, severidad, impacto y fix propuesto. Crítico/alto bloquea la entrega.

Si la skill no está instalada, decirlo y seguir con la checklist de §11.1. Nunca dar la revisión por hecha con la skill si no se cargó.

### 11.6 Pedido de seguridad (auditoría completa red + blue + network)

§11.1–11.4 cubren **cada cambio**. Esta auditoría corre con todo pedido de auditoría a secas
("auditá", "auditá la API"), junto con la pasada de calidad de §13.10, y sola cuando el pedido es solo
de seguridad ("auditá la seguridad", "¿es seguro?", "pentest", "hardening"). El alcance es **todo el código tocado o el que se indique**, no solo el
último diff. Para el equipo la seguridad es prioridad: se revisan **todas las áreas**, ninguna se
saltea en silencio, y la profundidad de cada una la decide el agente según lo que encuentra.

1. **Delimitar el alcance.** Sin alcance en el pedido, todo el repo, sin preguntar; si no, lo indicado: el diff actual, una feature, un
   proyecto de la solución o todo el repo.
2. **Orientar con graphify** (`graphify query`) para ubicar controllers, handlers, repositorios, SQL,
   auth, uploads, `HttpClient` salientes y límites de confianza. Una sola pasada alimenta a todas las
   herramientas. Alcance feature o repo: modelo de amenazas primero
   (`performing-threat-modeling-with-owasp-threat-dragon`) para ordenar qué se ataca.
3. **Revisión base de todas las áreas.** Recorrer la tabla de abajo completa. Cada área termina en
   uno de tres estados: **OK** (con la evidencia, `archivo:línea`), **hallazgo** o **N/A** (con el
   motivo: "no hay uploads en el alcance"). Incluye §11.1 (Red Team), §11.2–11.3 (reglas fijas y
   Blue Team) y `dotnet list package --vulnerable --include-transitive` (§11.4).
4. **Profundizar donde haga falta.** Por cada área, invocar su herramienta profunda (tabla) cuando se
   da **cualquiera** de estas condiciones:
   - la revisión base encontró un hallazgo o una señal dudosa;
   - el área es sensible: auth, tokens, pagos, datos personales, uploads, permisos por usuario;
   - el alcance es una feature completa o todo el repo.

   Un área N/A no se profundiza. Solo sobre el código propio o entornos autorizados.
5. **Auditoría general** (alcance feature o repo): correr además la skill `security-audit`
   (Cloudflare, §11.5) y el plugin `claude-security` (Anthropic), que buscan lo que la tabla no
   anticipa. Ambos verifican cada hallazgo antes de reportarlo. En un diff chico no: alcanza con los
   pasos 3–4.
6. **Priorizar** por riesgo (crítico → bajo), mapeado a OWASP API Top 10. Una línea por hallazgo:
   archivo, línea, riesgo, fix propuesto. Triage de hallazgos dudosos o de scanners:
   `performing-web-application-vulnerability-triage`. Redacción: `offensive-reporting`.
7. **Corregir.** Lo que está dentro del alcance se corrige; crítico/alto bloquea la entrega. Lo que
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
| Proxy, IIS y cabeceras HTTP | §11.2 | `offensive-request-smuggling`, `performing-security-headers-audit`, `testing-for-host-header-injection`, `performing-web-cache-poisoning-attack`, `security-audit` |
| TLS y certificados (network) | §11.2 (HSTS, `HttpsRedirection`, solo TLS 1.2/1.3 en Kestrel/IIS, validación de certificados en `HttpClient` sin `ServerCertificateCustomValidationCallback` que devuelva `true`) | `performing-ssl-tls-security-assessment`, `configuring-tls-1-3-for-secure-communications`, `offensive-tls-attacks` |
| Superficie expuesta (network) | Swagger en producción, health check con datos internos, endpoints internos publicados, puertos y bindings extra, ambientes de prueba públicos | `scanning-network-with-nmap-advanced`, `offensive-network-attacks` |
| Servicio a servicio (network) | §9: llamadas internas autenticadas (token de cliente o mTLS), sin confiar en la red interna | `implementing-mtls-for-zero-trust-services` |
| Azure (network) | Key Vault, SQL y Storage sin acceso público innecesario (firewall, private endpoints), restricciones de acceso del App Service, identidad administrada con permisos mínimos | `offensive-cloud` |
| SignalR / WebSocket | §16: `wss://`, origen validado, token en la conexión, autorización por grupo | `testing-websocket-api-security`, `exploiting-websocket-vulnerabilities` |
| CORS | §11.2 | `testing-cors-misconfiguration` |
| Secretos y PII | §8, §11.1 | `implementing-secret-scanning-with-gitleaks` |
| Errores y `ProblemDetails` (sin filtrar datos internos) | §7, §11.2 | `security-audit` |
| Dependencias NuGet y supply chain | §11.4 | `offensive-dependency-confusion`, `offensive-supply-chain`, `generating-and-analyzing-sboms` |
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
ubicó graphify. Si el alcance es grande, delegar el barrido por área a subagentes en paralelo (§14.3);
la priorización, la corrección y la decisión final quedan en el modelo principal. Si falta una skill
de la tabla, instalarla (`npx github:MRydex/skills-backend-mrydex`) y avisar en una línea; si no se puede, hacer
esa área con la revisión base y decirlo en el reporte de cobertura.
