# Changelog

Cambios de la skill `desarrollo-backend-buenas-practicas` y del instalador `skills-backend-mrydex`.
Para actualizar en un proyecto: `npx github:MRydex/skills-backend-mrydex`.

## [Unreleased]

### Quitado

- Headroom. Medido en 14.558 requests (oct-nov 2026, suscripción): ahorró 1,52% de los tokens de entrada; a cambio el
  proxy se colgaba sin aviso, la tarea de Windows entraba en loop de reinicios (`[winerror 10048]`) y el hook
  `PreToolUse` sumaba hasta 45 s por comando. El instalador ya no lo instala ni lo configura; si quedó de una
  versión anterior, quita `env.ANTHROPIC_BASE_URL` (`http://127.0.0.1:8787`) y los hooks `headroom init hook ensure`
  de `~/.claude/settings.json`. Para el resto (tarea `headroom-init-user-health`, variables de usuario `HEADROOM_*`):
  `headroom install remove --profile init-user` y `headroom unwrap claude`. `14` §14.8 documenta la medición.

### Agregado

- `14` §14.3.1 effort antes que modelo (Anthropic, nov 2026): arrancar en effort medio, autoverificación → un nivel
  de effort → modelo siguiente en effort más bajo; tareas verificables en `low` con reintento en `high` solo de lo
  que falló. §14.3.4 medición real 2 (sesión Fable 5.1): `Explore` de fábrica corre en Opus ($0.10 por búsqueda)
  contra `Explore` propio en Haiku ($0.001); `general-purpose` hereda la sesión ($0.90 la corrida) contra
  `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` ($0.15); mismo resultado en las 6 corridas. §14.4 cambio de modelo solo en
  un corte natural con `/compact` (caché y razonamiento no se heredan hacia abajo). §14.7 fila para el dial de
  esfuerzo.
- Instalador (Claude Code): subagente `Explore` propio en Haiku con `effort: low` (reemplaza al de fábrica) y
  `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` en `~/.claude/settings.json` si no estaba.

### Cambiado

- Instalador: el advisor ya no se configura por defecto (Anthropic, nov 2026: ningún pareo superó claramente al
  ejecutor solo; el equipo midió 10x con un advisor del mismo nivel). `--advisor fable|opus` lo activa, `--advisor
  off` quita el que haya. §14.3.4, §14.3.5, README (sección nueva "Modelos: qué corre dónde": qué modelo corre cada
  cosa, qué pasa con sesión Fable / Opus / Sonnet, cuándo cambiar effort o modelo, cuándo prender el advisor) y
  `templates/CLAUDE.md` actualizados.

- `17` §17.12 deploy con pestañas abiertas: §17.8 vale dentro de la misma versión (lo no aditivo va al deploy
  siguiente); `426 Upgrade Required` como `ProblemDetails` con `X-App-Version` y `Front:VersionMinima` en Options
  (`IOptionsMonitor`, sin cabecera no bloquea, CORS); reciclado del app pool; SignalR no avisa deploys (§16.1).
  Checklists e índice enlazan. Contraparte del front: skill `desarrollo-buenas-practicas` §10.14.
- Headroom vuelve solo si se cae: en Windows la tarea oculta lo revisa cada 2 min (antes 5), dentro
  de los ~3 min que Claude Code reintenta. README: qué hacer si sigue caído; el aviso del hook da el
  comando según el sistema.

### Seguridad

- Instalador: `-t` solo borra una instalación propia (`name:` de la skill en `SKILL.md`); el reintento de caveman
  solo corre `skills add JuliusBrussee/caveman`; `--doctor` sugiere `npx -y github:MRydex/...` (el paquete no está en npm);
  el `.bak` de `settings.json` guarda el original de la corrida; permisos de graphify solo para `query`, `update`,
  `explain` y `path` (se quita el `graphify:*` de versiones previas); ruta `C:\Windows` corregida.
- `guard-secrets`: también NotebookEdit; en Markdown, solo formatos inconfundibles (clave privada, AWS, GitHub, Slack,
  Anthropic, Stripe, Google); reglas nuevas para JWT literal, firma SAS y `KEY=valor` en `.env` y similares.
- `session-start`: un `tasks/lessons.md` versionado en el repo no se carga solo (puede traer instrucciones de un tercero);
  para compartir lecciones de equipo, llevarlas a `CLAUDE.md` / `AGENTS.md`.
- Skill: el plugin `claude-security` (multiagente, caro) solo con pedido explícito o costo aceptado, también en la
  auditoría completa; si falta una skill externa se instala solo esa, no el instalador entero; `revisor-auth` en los
  cambios de auth.

### Instalador

- Hooks de Claude Code `guard-secrets` (compartido con la skill de frontend) y `format-dotnet`.
- Subagentes `migrador-dotnet`, `auditor-sql`, `generador-tests-backend`, `operador-pipeline`,
  `auditor-contrato-api` y `revisor-auth` (los dos últimos, compartidos con la skill de frontend).

### Skill

- §14.9 skills externas por área: cada área (endpoints, tests, bugs, rendimiento, seguridad, migración,
  CI, git...) nombra la skill externa que la acompaña y la regla del repo que gana si chocan. Regla 7
  de SKILL.md, templates y bloque global apuntan a §14.9. Índice: 14 ya no es lectura "siempre".
- Subagentes: los que citan la skill reciben dónde buscarla; el bloque global nombra la skill en cada §;
  `generador-tests-backend` frena tras 3 intentos con el mismo test rojo; `operador-pipeline` en nivel ejecutor.
- Repo con front y back: cada skill rige sus archivos y el Paso 0 corre una vez (también en `desarrollo-buenas-practicas`).
  §14.9 suma `ponytail-debt` en auditorías y limpieza; `ponytail-help` / `ponytail-gain` solo las pide el usuario.
  Gentleman-Skills revisado y no instalado: sus skills de Angular contradicen esta y no trae .NET (motivo en `bin/cli.js`).
- Seguridad: "¿es seguro X?" es pregunta de solo lectura; cabeceras de seguridad antes de `UseExceptionHandler`
  y HSTS de 365 días; `dotnet list package` sin restore cae a leer los `.csproj`.
- `ConflictException` (409) para estado ya aplicado; `PATCH` para cambios de estado; endpoint gemelo de uno ya
  protegido sin `security-audit`; OpenAPI antes/después solo si el cambio no es aditivo; trim según el repo.
- Rate limiting nativo por usuario / IP con 429 + `Retry-After`; §14.9 nombra su skill. Cierre de un cambio de
  riesgo alto: la fila completa de §13.3.
- Límite de intentos de un secreto: clave por lo que guarda el secreto e intento reservado bajo lock antes de probarlo.
  Un `code` o campo nuevo en un error es contrato: se documenta y se avisa al front.
- "Antes de entregar" en SKILL.md: autorevisión de 6 puntos (alcance, corrección con atomicidad y sin `catch`
  que trague, seguridad, escalabilidad, legibilidad, tests en paralelo y aislados); PIN, contraseñas y sesiones
  cuentan como auth y la revisión de riesgo alto es parte de terminar (sin subagentes: `checklists.md` completo;
  sin revisión, pendiente bloqueante en el reporte); lo que marque el revisor (MEDIO o más) se corrige antes de
  entregar. El `catch` que reintenta también loguea, y la garantía va en el código, no en un comportamiento del SO.
- Repo nuevo: estructura de 4 proyectos y mediator mínimo, sin restos de la plantilla de `dotnet new` ni
  campos o servicios no pedidos; CSP estricta en la API (abierta solo en Swagger); en modificar o borrar,
  404 antes que reglas contra otros datos; tests de error con campo y mensaje exactos.

- Nuevas referencias, aplicables solo si el proyecto ya usa esa tecnología o el usuario lo pide:
  `17-contrato-openapi.md`, `18-stored-procedures-sql.md`, `19-migracion-dotnet.md` y
  `20-librerias-nuget-ci.md`. `11-security.md` §11.7: JWT, policies, CORS, IdP propio, LDAP y
  migración de auth legacy. `12-tech-debt.md`: librerías de mapeo existentes.

- `02-csharp-design.md`: `BannedApiAnalyzers` + `BannedSymbols.txt` con `RS0030` en `error` para
  convertir reglas "nunca X" en error de compilación; colisión de nombre con namespace (`CS0118`);
  ciclos de DI.
- `03-controllers.md`: comparar `swagger.json` antes y después al tocar un endpoint.
- `08-configuration-di-secrets.md`: variables de entorno con `__` como única excepción a Key Vault
  en ambientes que no lo tienen (on-prem/IIS) y fail-fast que nombra la variable que falta.
- `09-http-integrations.md` y `07-errors-responses.md`: status de `ExternalApiException` según la
  falla del downstream (503 / 504 / 502).
- `10-logging-tests.md`: tests de caracterización antes de refactorizar una regla; builder de escenarios.
- `11-security.md` §11.2: en APIs con `AddAuthorization`, `FallbackPolicy` deny-by-default y acceso
  M2M por atributo resuelto en el handler de la policy global (`[RoleAuthorization]` sigue igual); todo camino a un recurso por el mismo chequeo de permisos (BOLA).
- `13-workflow-orchestration.md`: decir qué no se probó; refactor sin cambiar reglas de negocio;
  §13.11 gotchas de build y entorno (dll bloqueada, `$(SolutionDir)`, `.sqlproj`, IIS 500.30, CRLF).
- `15-data-access-ef-core.md`: `DbConnectionInterceptor` para `sp_set_session_context` con los
  cuatro overrides sync/async y options por base.
- `checklists.md`: ítems de lo anterior.
- `05` §5.2 y `15` §15.4: el código nuevo usa la forma de ejecutar SQL que el repo ya tiene. §15.4
  reescrita como equivalente EF de §5.2 (texto, parámetros tipados, `SqlQuery<Response>`, composición,
  SPs con salida, transacción, bulk, timeout, errores).
- Corregido: el ejemplo de §15.4 componía `SingleAsync` sobre un `EXEC` (SQL inválido); los ejemplos de
  §5.2/§15.4 atrapaban `Exception` o tenían un `catch (OperationCanceledException)` muerto.
- Consistencia entre archivos: Key Vault o variables de entorno (SKILL y templates); transacción con
  EF en la regla 6; límite de método 40 en SKILL y templates; orden de consulta de librerías igual a
  §14.2; "audit this" en templates igual a §13.10; 204 solo para listados (recurso puntual ⇒ 404); 403
  en los `ProducesResponseType` de clase; data annotations permitidas en Options; dependencias de
  Domain/Application en §1.4; §12 aclara que `Mediator` / `Guard` / `UnitOfWork` del repo se usan;
  `tasks/*.md` no se versionan; tabla de cobertura de auditoría permitida en el reporte; tests de
  integración EF fuera de CI; índice de §13 y referencias §1.1/§1 corregidas; hub SignalR sin `!`
  ni literales y su implementación en Api.
- `09`: `Microsoft.Extensions.Http.Resilience` en repos nuevos; Polly donde ya existe.
- `03`: `CreatedAtAction` apunta al GET del recurso creado (antes `null`: `Location` al mismo POST).

## [1.16.0] - 2026-11-02

### Skill

- `01-solution-structure.md` §1.4: dependencias entre capas de Clean Architecture (qué proyecto
  referencia a cuál). `13-workflow-orchestration.md` y `checklists.md` apuntan a §1.4.

## [1.15.0] - 2026-10-29

### Instalador

- uv se instala desde el binario de la última versión publicada, verificado con el `sha256.sum`
  del mismo release antes de copiarlo a `~/.local/bin`; ya no `irm | iex` ni `curl | sh`. Solo usa
  Node (sin curl, wget ni tar del sistema) y cubre Windows, macOS y Linux en todas las
  arquitecturas que publica uv (x64, arm64, 32 bits, ARM, riscv64, ppc64le, s390x).
- `engines.node >= 18` en `package.json` (usa `fetch`).
- `~/.claude/settings.json` y el bloque de `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` se escriben con
  copia `.bak` y reemplazo atómico; un corte a mitad ya no deja el archivo roto.

## [1.14.3] - 2026-10-29

### Instalador

- `-t <ruta>` ya no borra una carpeta con contenido que no es una instalación de la skill (ej. `-t .`).
- `--bridge` no pisa un `CLAUDE.md`, `AGENTS.md` o `.cursorrules` propio del proyecto.
- El bloque de `~/.claude/CLAUDE.md` con un marcador sin su par no se toca (antes podía borrar texto).
- README: árbol de referencias completo.

## [1.14.2] - 2026-10-29

### Skill `desarrollo-backend-buenas-practicas`

- Auditoría de calidad (§13.10, regla 10): suma las áreas Legibilidad y mantenimiento (CA1502 y
  CA1506 en el `.editorconfig`), Escalabilidad e Instrucciones de agentes (`/doctor prompt-audit`:
  reglas para modelos viejos, referencias rotas, contradicciones, `CLAUDE.md` de más de 200
  líneas). Eficiencia prioriza por impacto medido: sin micro-optimizaciones que empeoren la
  legibilidad.
- Chequeo antes de entregar (§13.7.1): forma más simple, aprobaría un staff engineer, qué se
  rompe primero y `tasks/lessons.md` actualizado.
- Bug con evidencia: directo a reproducir y a la causa raíz, sin pedir guía (§13.6).
- Lecciones con línea `Chequeo` para detectar el error antes (§13.8).

### Instalador

- `readClaudeSettings` único para leer `~/.claude/settings.json` (antes, 5 copias). `--doctor`
  ya no falla y los permisos de graphify ya no rompen la instalación si el archivo contiene `null`
  o un array.

## [1.14.1] - 2026-10-29

### Skill `desarrollo-backend-buenas-practicas`

- Auditar = control de calidad completo (§13.10, regla 10): calidad, eficiencia, dependencias,
  código duplicado y sin uso, con tabla de cobertura por área, candidatos verificados contra uso
  dinámico y correcciones en tandas con `dotnet test` en verde.
- "Auditá" a secas corre además la auditoría de seguridad completa (§11.6); solo seguridad corre
  solo §11.6; solo calidad suma la seguridad base.
- Auditoría de seguridad red + blue + network (§11.6): modelo de amenazas, TLS, superficie expuesta,
  servicio a servicio (mTLS), Azure, SignalR, rate limiting y logs; pruebas en vivo solo contra hosts
  autorizados.
- Auditoría de dependencias en la auditoría: corrige vulnerabilidades y reverifica con build, tests y
  la auditoría de nuevo (§11.4, §13.10).
- Unicidad garantizada por el índice `UNIQUE`, no por un chequeo previo (§5.2, §15.6).

### Instalador

- Skills de network y Blue Team (TLS, cabeceras, host header, cache poisoning, WebSocket, nmap,
  rate limiting, mTLS, logs, threat modeling) y `offensive-tls-attacks`, `offensive-network-attacks`,
  `offensive-cloud`.

## [1.14.0] - 2026-10-28

Actualizacion de version

### Skill `desarrollo-backend-buenas-practicas`

- Seguridad (§11.1, §11.2): quién actúa sale solo del token (nunca del body, la query ni la ruta); JWT
  con issuer, audiencia, vencimiento y clave de firma validados, `ValidAudiences` explícitas (incluida
  la del token que reenvía la app que embebe un microfrontend), nunca `ValidateAudience = false`.
- Hubs (§16.4): misma validación del token; audiencia de la app que embebe el microfrontend.
- Checklist de seguridad al día.

## [1.13.0] - 2026-10-27

Primera versión publicada con historial unificado.

### Skill `desarrollo-backend-buenas-practicas`

- `SKILL.md` liviano: Paso 0 (graphify), reglas que más se violan, modo de operación del agente,
  stack e índice de referencias.
- APIs .NET 10 LTS (C# 14) con Clean Architecture; repos en `net8.0` mantienen su TFM.
- Referencias `01`–`16` y `checklists.md`: estructura de la solución, diseño en C#, controllers,
  mediator y handlers, Dapper, validación con FluentValidation, errores con ProblemDetails,
  configuración y secretos, integraciones HTTP con Polly, logging y tests (xUnit + Moq), seguridad
  OWASP, deuda técnica, flujo de trabajo, eficiencia del agente, EF Core 10 y hubs de SignalR.
- Revisión según riesgo (trivial / medio / alto), auditoría de seguridad por áreas (§11.6) y
  auditoría de dependencias (`dotnet list package --vulnerable --include-transitive`).
- Delegación a subagentes solo cuando baja el total de tokens; compactar propuesto al ~30%.

### Instalador

- `npx github:MRydex/skills-backend-mrydex`: skill global (Claude Code, Codex, Antigravity) y en el
  repo; archivos puente `CLAUDE.md`, `AGENTS.md` y `.cursorrules`; entradas de IA en `.gitignore`.
- Graphify (CLI, integración por agente, modo estricto en Claude Code, hooks git y primer grafo), uv
  sin admin cuando falta Python, caveman, subagentes y bloque global en `CLAUDE.md` / `AGENTS.md` /
  `GEMINI.md`.
- Herramientas del agente: Headroom, plugins `claude-code-setup` y `claude-security`, MCP `context7`,
  `permissions.deny` de secretos, skills externas (`security-audit`, ponytail, agent-skills, skills
  de seguridad por área).
- Volver a correrlo actualiza todo lo que instala.
- `--doctor` (chequeo de solo lectura) y `--dry-run`.

### Seguridad

- El instalador no escribe a través de symlinks ni junctions dentro del repo.
