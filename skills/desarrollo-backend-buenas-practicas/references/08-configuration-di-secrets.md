## 8. Configuración, DI y secretos

Options pattern, DI por capa, lifetimes y secretos en Key Vault. Leer al tocar `Program.cs`, `appsettings` o registros de DI.

- Settings tipados con Options pattern: `services.AddOptions<T>().Bind(config.GetSection("X")).ValidateDataAnnotations().ValidateOnStart()` o `IValidateOptions<T>`. Consumir con `IOptions<T>` / `IOptionsMonitor<T>`. **No** `configuration.GetValue<>` disperso en código nuevo.
- `appsettings.json`: estructura y nombres de secretos (`"ConnectionStrings:MainDb": "<nombre-del-secret>"`). Valores sensibles **solo** en Key Vault. Claves sin espacios ni typos.
- DI por capa con extension methods: `AddApplicationServices` (Application), `AddInfrastructureServices` (Infrastructure), `AddKeyVault` / `AddObservability` / `AddApiDependencies` (Api). Registrar donde vive la implementación.
- Lifetimes: contextos de conexión `Singleton`; `DbSession`, `UnitOfWork`, servicios con estado por request `Scoped`; repositorios `Transient` (o `Scoped`, consistente con el resto). Nunca inyectar `Scoped` en `Singleton`.
- Feature flags por config (`EnableX:IsEnable`), leídos con Options.
