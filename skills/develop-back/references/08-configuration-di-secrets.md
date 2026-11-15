## 8. Configuración, DI y secretos

Options pattern, DI por capa, lifetimes y secretos en Key Vault. Leer al tocar `Program.cs`, `appsettings` o registros de DI.

- Settings tipados con Options pattern: `services.AddOptions<T>().Bind(config.GetSection("X")).ValidateDataAnnotations().ValidateOnStart()` o `IValidateOptions<T>`. Consumir con `IOptions<T>` / `IOptionsMonitor<T>`. **No** `configuration.GetValue<>` disperso en código nuevo.
- `appsettings.json`: estructura y nombres de secretos (`"ConnectionStrings:MainDb": "<nombre-del-secret>"`). Valores sensibles **solo** en Key Vault. Claves sin espacios ni typos.
- Única excepción a "solo Key Vault": un repo que ya corre en un ambiente sin Key Vault (on-prem, IIS)
  y el usuario lo confirma. No es alternativa para una API que ya tiene Key Vault. Ahí, valores sensibles por variable de entorno con `__` como
  separador de sección (`ConnectionStrings__MainDb`), cargadas con `AddEnvironmentVariables()` después
  de los `appsettings`, así los pisan. En IIS, en el app pool o a nivel máquina; nunca en
  `web.config` ni en `appsettings.<Ambiente>.json` versionado.
- Fail-fast: una clave requerida que falta corta el arranque con un mensaje que nombra la variable
  exacta a setear (`Falta 'ConnectionStrings:MainDb': setear la variable de entorno 'ConnectionStrings__MainDb'`),
  no en la primera consulta. `ValidateOnStart` lo cubre para Options; para connection strings sueltas,
  chequearlas en `Program.cs` antes de `Build()`. El mensaje nombra la clave, nunca el valor.
- DI por capa con extension methods: `AddApplicationServices` (Application), `AddInfrastructureServices` (Infrastructure), `AddKeyVault` / `AddObservability` / `AddApiDependencies` (Api). Registrar donde vive la implementación.
- Lifetimes: contextos de conexión `Singleton`; `DbSession`, `UnitOfWork`, servicios con estado por request `Scoped`; repositorios `Transient` (o `Scoped`, consistente con el resto). Nunca inyectar `Scoped` en `Singleton`.
- Feature flags por config (`EnableX:IsEnable`), leídos con Options.
- Validar Options con FluentValidation: una clase que es `AbstractValidator<T>` e `IValidateOptions<T>` a la vez, registrada `Singleton` como `IValidateOptions<T>`, más `.ValidateOnStart()`. Rangos explícitos (timeouts, reintentos) para que un valor fuera de rango no arranque la app.
- Ambiente con `IHostEnvironment` (`IsDevelopment()`, `IsProduction()`), no con una clave propia tipo `AppConfiguration:Environment == "DEV"`.
