# Changelog

Cambios de la skill `develop-back` (antes `desarrollo-backend-buenas-practicas`) y del instalador `skills-backend-mrydex`.
Para actualizar en un proyecto: `npx github:MRydex/skills-backend-mrydex`.

## [Unreleased]

### Agregado

- `07`: los errores de binding (`?page=abc`) salen con el mismo `ProblemDetails` que una validación propia, con
  `InvalidModelStateResponseFactory`. Probado en una API .NET 10.
- `11` §11.2: qué hacer en un repo sin autenticación configurada: `[AllowAnonymous]` explícito y pendiente
  bloqueante, sin inventar un esquema JWT. Los dos puntos salen de una prueba de punta a punta de la skill.
- `SKILL.md` §0 y `11` §11.4: `net8.0` y `net9.0` quedaron fuera de soporte el 10/11/2026. Un repo en ese
  `TargetFramework` se reporta como hallazgo de seguridad y se propone migrar a `net10.0`, sin migrar sin pedido.
  .NET 11 salió ese día como STS: el objetivo de la skill sigue siendo .NET 10 LTS.
- `11` §11.4: el nombre de un paquete NuGet no se escribe de memoria. Antes de un `dotnet add package <paquete>`
  propuesto por el agente se corre `dotnet package search <paquete> --exact-match` y se confirma owner y repo.
  Versiones y flags se leen del proyecto o de la doc. Sale del repaso de drona23/claude-token-efficient (fila nueva
  en `FUENTES.md`); el resto de ese repo ya estaba cubierto o no aplica.

### Cambiado

- `11` §11.4 y templates: con vulnerabilidades de `dotnet list package --vulnerable` se corrige siempre, no solo
  cuando la tarea toca dependencias: subir a la versión con fix dentro de la misma mayor y fijar el transitivo
  vulnerable como referencia directa o en `Directory.Packages.props`. Versión mayor se sigue preguntando antes.
- `06` §6.1: el ejemplo de texto codificado que `SinCodigo()` no cubre decía `<`; ahora `\u003cscript\u003e`.

### Corregido

- `14`: el índice enlazaba §14.5 con un ancla vieja.

Revisión de concurrencia de toda la skill: ejemplos que fallaban con muchos requests a la vez o con varias instancias.

- `11` §11.2 y `SKILL.md` ("Antes de entregar" 2): el límite de intentos de PIN / OTP se reserva de forma atómica en la
  base (`UPDATE ... WHERE Intentos < @Max` y filas afectadas), no con un `lock` en proceso: con 2 instancias el `lock`
  multiplica el límite. `lock` queda solo para una instancia, dicho como supuesto.
- `15` §15.6 y `07`: `DbUpdateConcurrencyException` va a `ConflictException` (409); antes 15 decía 400 y 07 decía 409.
- `15` §15.2, §15.3 y §15.5: la `RowVersion` viaja al cliente (`rowVersion` base64 en el Response) y vuelve en el PUT /
  PATCH; el update fija `OriginalValue`. Sin eso EF compara contra la versión recién leída y el cambio del otro usuario
  se pierde. Mismo contrato en la skill de frontend.
- `04`: ejemplo de transacción async (`BeginTransactionAsync` / `CommitAsync` / `RollbackAsync`).
- `09`: backoff con jitter y `Retry-After` con tope; timeout por intento, distinto de `HttpClient.Timeout`, que cuenta
  todos los reintentos juntos. El handler estándar ignora `HttpClient.Timeout` y reintenta `POST` salvo
  `DisableForUnsafeHttpMethods()`.
- `18` §18.5: el SP abre transacción solo si `@@TRANCOUNT = 0` y hace `ROLLBACK` solo de la que abrió, con `XACT_STATE()`.
- `05` §5.2: deadlock (1205) y timeout (-2) en el mapeo de errores; `commandTimeout:` explícito (también `18` §18.8).

### Agregado

- `06` §6.1 (nueva): ningún `string` de entrada acepta etiquetas ni código. Extensión `SinCodigo()` de FluentValidation
  para texto libre (etiquetas, atributos sueltos como `" onerror=` o `" style=`, `javascript:` y `data:` al inicio de
  un valor, entidades, caracteres de control, Unicode inválido y marcas combinantes apiladas, que cuelgan `Normalize`),
  misma regla que `sinCodigo` del front. Se rechaza con 400, no se limpia ni se codifica al guardar. `11` §11.1 y
  checklists lo suman. Texto de usuario en `nvarchar` (en `varchar` SQL Server convierte `〈` en `<`), `HtmlSanitizer`
  con lista propia y `UriAttributes` para el editor enriquecido, y `\z` en vez de `$` en los patrones de formato.
- `05` §5.5 (nueva): concurrencia con Dapper. `UPDATE ... WHERE RowVersion` con 409, contadores y stock con `UPDATE`
  atómico, numeradores con `SEQUENCE`, upsert con `HOLDLOCK`, `UPDLOCK` / `sp_getapplock`, reintento de deadlock,
  transacciones cortas y export sin buffer. `15` §15.5: lo mismo con `ExecuteUpdateAsync` y `AsAsyncEnumerable`.
- `05` §5.1 y §5.3: sin I/O externo dentro de una transacción abierta, nota del pool de conexiones; `IMemoryCache` es
  por instancia y lleva protección de stampede (`HybridCache` en net10, `SemaphoreSlim` en net8).
- `03`: `Idempotency-Key` con reserva atómica (`UNIQUE (UserId, Key)`, `INSERT` primero), 409 si sigue en curso,
  respuesta guardada si terminó, 400 si cambió el body, vencimiento. Mismo contrato en la skill de frontend.
- `11` §11.7: refresh token con rotación atómica, ventana corta de gracia para dos pestañas a la vez y revocación de
  la familia ante reuso fuera de la ventana. LDAP con timeouts y tope de conexiones simultáneas.
- `11` §11.2: límite de concurrencia con cola (`AddConcurrencyLimiter`) para endpoints caros; subidas con límites de
  tamaño por endpoint y copia en streaming.
- `08`: trabajo en segundo plano y varias instancias. Scope por iteración, `Channel<T>` en vez de fire-and-forget,
  `Parallel.ForEachAsync` con scope por ítem, jobs que toman su trabajo de forma atómica.
- `02`: estado compartido en el proceso (`ConcurrentDictionary` con `Lazy`, `Random.Shared`); `Lock` protege un solo
  proceso.
- Notas: `16` §16.3 (outbox para eventos que no pueden perderse), `10` §10.1 (logging bajo carga), `15` §15.3 (total y
  página sin snapshot).

## [1.33.4] - 2026-11-19

### Agregado

- `20` §20.7: cambiar la URL de actualizaciones de una app de escritorio sin reinstalar. Versión puente publicada
  en el feed viejo con la URL nueva, feed viejo vivo semanas, y alternativas (DNS o redirección, override por
  equipo, nombre estable). Solo aplica a apps con actualización automática que leen la URL de su configuración.
  El checklist pasa a §20.8.

## [1.33.2] - 2026-11-16

### Agregado

- `15` §15.3, `05` y `17` §17.7: paginado por keyset (seek) para tablas grandes con páginas profundas, scroll
  infinito o export por lotes. Solo con pedido explícito o problema medido; el default sigue siendo
  `Skip` / `Take` con `PagedResponse<T>`.

## [1.33.0] - 2026-11-15

### Agregado

- Instalador: `--no-external` instala solo la skill, sus subagentes y hooks; saltea caveman, las skills externas y
  los plugins de Claude Code.
- Instalador (Claude Code): `~/.claude/settings.json` recibe `skillListingBudgetFraction: 0.025` y las skills que
  instala el paquete quedan en `skillOverrides` como `name-only`. Con el presupuesto por defecto, el listado de
  skills se cortaba y 77 quedaban sin descripción. Medido con una consulta por skill: 99/99 bien elegidas con 45.900
  tokens de prompt, contra 60.600 con las descripciones completas. No pisa valores que ya estén puestos; una skill
  vuelve a mostrar su descripción con `"on"` en su entrada de `skillOverrides`.
- Instalador: las skills externas que `skills add` saltea por no tener frontmatter (10 de `SnailSploit/claude-red`)
  se copian igual, con un frontmatter mínimo. Antes salía con 0 y no quedaban instaladas.
- Instalador: las skills externas que su autor marcó solo para uso manual (`disable-model-invocation: true`) quedan
  habilitadas para que el agente las cargue solo.
- `SKILL.md` regla 9: listados paginados con `PageSize` máximo, `OrderBy` estable antes de `Skip` / `Take`, y
  listado vacío ⇒ `204 NoContent` con su `[ProducesResponseType]`. Ya estaba en `03`, `04`, `06` y `15`, pero sin
  leer la referencia se cumplía poco. Medido en 3 tareas reales: el `204` pasó de 1 de 3 a 3 de 3.

### Corregido

- Instalador: `--target` o `--agent` sin valor (seguido de otra opción) ahora da error en vez de tomar la opción
  como valor; un agente desconocido se rechaza con la lista de los válidos.
- Instalador: instalar sobre la carpeta de la propia skill (origen igual a destino) se saltea con un aviso en vez de
  borrarla.
- Instalador: cada comando externo tiene un tope de 10 minutos; uno colgado ya no deja la instalación esperando
  para siempre.
- Instalador: con los dos paquetes instalados, la sección de Graphify quedaba duplicada en el bloque global
  (`~/.claude/CLAUDE.md` y equivalentes). Ahora la escribe uno solo.
- Instalador: la copia `.bak` de un archivo de agente se crea solo si no existe, así una segunda instalación no
  pisa el respaldo del original.
- `--doctor`: daba falsa alarma por el hook `SessionStart` cuando lo había registrado el paquete hermano, y no
  avisaba si quedaba la carpeta de la skill con el nombre viejo.
- Hook `guard-secrets`: una contraseña o API key literal en archivos de test (`*.spec.ts`, `*Tests.cs`, `tests/`,
  `fixtures/`) ya no bloquea; son datos de ejemplo. En la regla del token de `.npmrc`, un valor con `(` o `[` se
  toma como código y no como secreto.
- Hook `SessionStart`: un error interno ya no muestra el hook como roto al abrir la sesión.
- Hook `format-dotnet`: la copia temporal de la versión de `HEAD` quedaba junto al archivo y un `dotnet build` en
  paralelo la compilaba (`CS0101`, clase duplicada). Ahora va en una subcarpeta oculta, que MSBuild ignora.

### Cambiado

- `SKILL.md`: sale la sección "Graphify (sin paso de arranque)", que repetía la regla 6 del modo de operación y
  `14` §14.5. La regla 6 suma qué hacer si `graphify update .` falla.
- `SKILL.md` regla 7: `ponytail-review` se carga en la misma tanda de llamadas que el build final. Medido en 3
  tareas reales: la revisión pasó de hacerse 0 de 3 a 3 de 3.

## [1.32.0] - 2026-11-14

### Corregido

- Hook `SessionStart`: el aviso de versión nueva salía solo por `systemMessage`, que en la extensión de VS Code puede no
  verse. Ahora va también por `additionalContext` y el modelo lo dice en la primera respuesta (unos 60 tokens, solo
  en la sesión con aviso).
- Instalador: `graphify install` reescribe `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` y `~/.gemini/GEMINI.md` y se
  llevaba los bloques globales marcados. Instalar una skill borraba el bloque de la otra, e instalar con `--target`
  borraba también el propio. Ahora se guardan antes y se devuelven los que falten.
- Instalador: en `--dry-run`, el aviso de la carpeta con el nombre anterior ya no dice que la quitó.

### Cambiado

- La skill pasa a llamarse `develop-back` (antes `desarrollo-backend-buenas-practicas`): se invoca con `/develop-back`.
  Al actualizar, el instalador borra la carpeta con el nombre anterior en cada destino y reescribe el bloque global.
  Las citas a la otra skill pasan a `develop-front`. El `.gitignore` de un proyecto ya instalado conserva la línea vieja
  (`skills/desarrollo-backend-buenas-practicas/`); se puede borrar a mano.
- README: secciones "Usar" y "Actualizar" propias; "Modelos: qué corre dónde" baja después de "Contenido". Cada comando de instalación en su bloque. Sale "Publicar cambios".

## [1.31.0] - 2026-11-13

### Agregado

- `01` §1.5: cuándo usar la forma de §1 (por defecto) y cuándo Onion, según el tipo de uso. Onion para dominio con
  reglas propias o usado por más de un host: reglas en entidades y `Domain/Services/`, interfaces de repositorio de
  escritura en `Domain/Interfaces/`. Repo existente: la que ya tiene. `SKILL.md` (regla 8, Simplicidad) y
  `checklists.md` apuntan a §1.5.

## [1.30.0] - 2026-11-13

### Agregado

- `03`: método HTTP `QUERY` (RFC 10008). No es el default: .NET 10 no trae `[HttpQuery]` ni lo incluye en el
  OpenAPI. Solo con pedido explícito y verificando IIS, proxy y CORS.

## [1.29.0] - 2026-11-13

### Agregado

- Aviso de versión nueva (Claude Code): el hook `SessionStart` compara la versión instalada con la de GitHub una vez
  por día y muestra una línea con el comando para actualizar. Cubre las dos skills (backend y front). No gasta
  tokens ni actualiza solo. Empieza a avisar después de reinstalar con esta versión. `14` §14.8.

## [1.28.0] - 2026-11-13

### Agregado

- `11` §11.4: feed Zero Wire de Cloudflare Radar (`https://radar.cloudflare.com/zero-wire/rss`) para lo que
  `dotnet list package --vulnerable` no ve: runtime, IIS / Kestrel, imagen base del `Dockerfile`, proxy. Se lee bajo
  demanda en la auditoría de seguridad (§11.6 paso 3), antes de subir el target framework (`19`) y al cambiar la
  imagen base. Sin hook ni tarea programada.

## [1.27.3] - 2026-11-11

### Agregado

- Instalador: prueba `python -m pip`, `py -m pip` y `python3 -m pip` antes que `pip` a secas. En Windows con Smart
  App Control, `pip.exe` no está firmado y cada instalación mostraba un aviso de Seguridad de Windows, aunque
  graphify quedaba bien instalado.

## [1.27.2] - 2026-11-11

### Agregado

- Instalador (corrección): después de instalar Python con `winget`, graphify seguía fallando con "Python was not
  found; run without arguments to install from the Microsoft Store" porque `python` resolvía al alias de la Tienda
  (`WindowsApps\python.exe`). Ahora ubica el `python.exe` oficial en `%LOCALAPPDATA%\Programs\Python` o
  `%ProgramFiles%` y corre pip por ruta absoluta. Si `winget` termina y no hay Python en esas carpetas, lo dice;
  si pip instala pero `graphify` no arranca, muestra ese error y no el de un intento anterior.
- `11` §11.2, de la guía de seguridad de [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance)
  (Chrome, Edge, Firefox y MDN): cookie con prefijo `__Host-`, `Clear-Site-Data` en logout,
  `Cross-Origin-Resource-Policy` en las respuestas, HSTS gradual y endpoint de reportes de CSP.

## [1.27.1] - 2026-11-11

### Agregado

- Instalador: si Windows Smart App Control bloquea el Python que trae uv ("Una directiva de Control de aplicaciones
  bloqueó este archivo", os error 4551) o no hay Python, instala el Python 3.13 oficial con `winget` (firmado, por
  usuario, sin admin), saca el shim roto `uv tool uninstall graphifyy` y reintenta `pip install graphifyy`.

## [1.27.0] - 2026-11-11

### Cambiado

- Graphify sin ceremonia (medido en nov 2026 contra `grep` en los dos repos de skills y en una app de 12.598 nodos:
  `grep -l` costó de 10 a 120 veces menos que `graphify query`, también en el repo grande; sin nombre conocido el
  grafo devolvió ruido). Paso 0 queda en `graphify update .` (gratis); `graphify query` pasa a último recurso con
  `--budget 800`. El instalador deja de correr `graphify <agente> install` por proyecto y el modo `--strict`
  (hook `hook-guard` que sumaba 130-180 tokens a cada `Bash` / `Grep` / `Read` / `Glob`), y quita ese hook de
  `~/.claude/settings.json`. `14` §14.5 reescrita con la medición; templates, subagentes y bloque global al día.
  Segunda medición: `graphify update .` sin cambios tarda 0,7 s (584 nodos), 1 s (1.247) y 17,4 s (12.598); Paso 0
  queda sin comando (el hook git actualiza en cada commit; `update` solo justo antes de un `query`). El hook
  `SessionStart` poda los snapshots diarios `graphify-out/AAAA-MM-DD` (graphify no los borra: 442 MB en 27
  carpetas en el repo grande), quedan los 2 más nuevos.

## [1.26.0] - 2026-11-11

### Quitado

- Headroom. Medido en 14.558 requests (oct-nov 2026, suscripción): ahorró 1,52% de los tokens de entrada; a cambio el
  proxy se colgaba sin aviso, la tarea de Windows entraba en loop de reinicios (`[winerror 10048]`) y el hook
  `PreToolUse` sumaba hasta 45 s por comando. El instalador ya no lo instala ni lo configura; si quedó de una
  versión anterior, quita `env.ANTHROPIC_BASE_URL` (`http://127.0.0.1:8787`) y los hooks `headroom init hook ensure`
  de `~/.claude/settings.json`. Para el resto (tarea `headroom-init-user-health`, variables de usuario `HEADROOM_*`):
  `headroom install remove --profile init-user` y `headroom unwrap claude`. `14` §14.8 documenta la medición.

## [1.25.0] - 2026-11-11

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

## [1.24.0] - 2026-11-10

### Cambiado

- `17` §17.12 deploy con pestañas abiertas: §17.8 vale dentro de la misma versión (lo no aditivo va al deploy
  siguiente); `426 Upgrade Required` como `ProblemDetails` con `X-App-Version` y `Front:VersionMinima` en Options
  (`IOptionsMonitor`, sin cabecera no bloquea, CORS); reciclado del app pool; SignalR no avisa deploys (§16.1).
  Checklists e índice enlazan. Contraparte del front: skill `desarrollo-buenas-practicas` §10.14.

## [1.22.0] - 2026-11-07

### Cambiado

- Headroom vuelve solo si se cae: en Windows la tarea oculta lo revisa cada 2 min (antes 5), dentro
  de los ~3 min que Claude Code reintenta. README: qué hacer si sigue caído; el aviso del hook da el
  comando según el sistema.

## [1.21.0] - 2026-11-07

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

## [1.20.0] - 2026-11-07

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

## [1.17.0] - 2026-11-03

### Skill

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
