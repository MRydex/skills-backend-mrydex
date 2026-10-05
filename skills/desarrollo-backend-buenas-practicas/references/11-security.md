## 11. Seguridad (Red Team / Blue Team)

Revisión Red Team, reglas fijas, Blue Team y auditoría de dependencias. Leer en todo cambio antes de entregar.

### 11.1 Revisión Red Team de cada cambio (obligatoria antes de entregar)

Preguntarse como atacante, para cada endpoint o cambio:

1. **Autorización (API1/API5 BOLA/BFLA)**: ¿tiene `[RoleAuthorization]` con el rol mínimo? ¿El usuario puede pedir datos de otro banco/entidad cambiando un id? Filtrar siempre por la entidad del token, no por la del request.
2. **Inyección (A05)**: ¿algún input llega a SQL, a `ORDER BY`, a un path, a un header o a una URL saliente sin parametrizar / whitelist?
3. **Mass assignment (API3)**: ¿el request expone campos que el usuario no debería setear (estado, auditoría, ids internos)?
4. **Consumo de recursos (API4)**: ¿hay paginado con máximo, límites de tamaño en uploads/bulk, timeouts en HTTP saliente?
5. **Exposición de datos (A01/API3)**: ¿la respuesta devuelve más campos de los necesarios? ¿Errores con stack trace, SQL o datos internos?
6. **SSRF (API7)**: ¿alguna URL saliente se arma con input del usuario? Solo `BaseAddress` de config.
7. **Secretos y PII (A02/A09)**: ¿algo sensible en código, `appsettings`, logs o mensajes de excepción?
8. **Supply chain (A03)**: ¿paquete nuevo? Justificarlo, versión fija, feed oficial, sin vulnerabilidades conocidas (`dotnet list package --vulnerable`).

### 11.2 Reglas fijas

- Nunca desactivar `ValidateTokenFilter`, roles, validación de certificados ni `HttpsRedirection` / HSTS.
- CORS: orígenes explícitos desde config por ambiente. **Nunca** `SetIsOriginAllowed(_ => true)` / `AllowAnyOrigin` junto con `AllowCredentials` en código nuevo.
- Cabeceras de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP mínima para Swagger) registradas en el pipeline.
- Swagger deshabilitado en Producción.
- Rate limiting (`AddRateLimiter`) en endpoints públicos o costosos (bulk, reportes).
- 401 y 403 con `ProblemDetails`, mensajes genéricos (no revelar si el usuario existe).
- Dependencias: dependency-check y SonarCloud del pipeline en verde. Hallazgo crítico/alto ⇒ se resuelve o se documenta excepción en el PR.

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
- **Corregir** subiendo la versión, solo si la tarea toca dependencias o el usuario lo pide. Después, `dotnet build` + `dotnet test` de UnitTest.
- **Nunca subir una versión mayor sin preguntar** (ni `Microsoft.Extensions.*` por encima del TFM, `SKILL.md` §0): trae cambios que rompen.
- **Transitivo vulnerable**: proponer fijar la versión segura como referencia directa (o en `Directory.Packages.props`), sin aplicarlo sin aprobación.
- **Sin fix disponible**: reportarlo y proponer una salida (reemplazar el paquete o quitarlo si .NET lo resuelve), sin aplicarla sin aprobación.
- Si el comando falla (feed privado sin credenciales, restore roto), decirlo con el error exacto. Nunca dar la auditoría por hecha.

### 11.5 Skill `security-audit` (Cloudflare)

Revisión de seguridad con la skill [`security-audit`](https://github.com/cloudflare/security-audit-skill). El instalador la deja global (`--no-security-audit` para omitirla).

**Instalación a mano** (si falta o falló):

```bash
npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit --global
```

**Cuándo usarla:**
- **Modo guía (siempre):** en la revisión Red Team de §11.1, cargar la skill y revisar el cambio con ella. Endpoints nuevos, auth, SQL, uploads, HTTP saliente o manejo de secretos.
- **Auditoría completa (solo si el usuario la pide):** "security audit this codebase", pen test o reporte. Es cara (varios subagentes): no lanzarla sin pedido.
- **Salida de la auditoría completa:** por defecto en `~/security-audit-skill/<repo>/run-<N>`, fuera del repo. Nunca commitear los reportes.

**Qué hacer con el resultado:** igual que §11.3. Cada hallazgo con `archivo:línea`, severidad, impacto y fix propuesto. Crítico/alto bloquea la entrega.

Si la skill no está instalada, decirlo y seguir con la checklist de §11.1. Nunca dar la revisión por hecha con la skill si no se cargó.
