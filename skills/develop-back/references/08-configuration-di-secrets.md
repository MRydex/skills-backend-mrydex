## 8. Configuración, DI y secretos

Options pattern, DI por capa, lifetimes, secretos en Key Vault y trabajo en segundo plano. Leer al tocar `Program.cs`, `appsettings` o registros de DI, o al crear un worker o job.

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
- Lifetimes: contextos de conexión `Singleton`; `DbSession`, `UnitOfWork`, servicios con estado por request `Scoped`; repositorios `Transient` (o `Scoped`, consistente con el resto). Nunca inyectar `Scoped` en `Singleton`: un `BackgroundService` o `IHostedService` es singleton, así que no recibe `DbSession`, `UnitOfWork` ni handlers por constructor (ver "Trabajo en segundo plano" abajo).
- Keyed services: resolver con la clave concreta (`GetRequiredKeyedService<IPaymentGateway>("card")`). Nunca `KeyedService.AnyKey` para resolver uno o enumerar: en .NET 10 `GetKeyedService(..., AnyKey)` lanza `InvalidOperationException` y `GetKeyedServices(..., AnyKey)` ya no devuelve los registros `AnyKey`.
- Feature flags por config (`EnableX:IsEnable`), leídos con Options.
- Validar Options con FluentValidation: una clase que es `AbstractValidator<T>` e `IValidateOptions<T>` a la vez, registrada `Singleton` como `IValidateOptions<T>`, más `.ValidateOnStart()`. Rangos explícitos (timeouts, reintentos) para que un valor fuera de rango no arranque la app.
- Ambiente con `IHostEnvironment` (`IsDevelopment()`, `IsProduction()`), no con una clave propia tipo `AppConfiguration:Environment == "DEV"`.

### Trabajo en segundo plano y varias instancias

- **Un scope por iteración.** `BackgroundService` / `IHostedService` inyecta `IServiceScopeFactory` y crea el scope dentro del loop; nunca captura un servicio scoped. Cada iteración lleva su `try / catch` con log y sigue: una excepción sin atrapar en `ExecuteAsync` detiene el host entero.

  ```csharp
  internal sealed class PendientesWorker(IServiceScopeFactory scopeFactory) : BackgroundService
  {
      protected override async Task ExecuteAsync(CancellationToken stoppingToken)
      {
          using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
          while (await timer.WaitForNextTickAsync(stoppingToken))
          {
              try
              {
                  await using var scope = scopeFactory.CreateAsyncScope();     // scope nuevo por iteración
                  await scope.ServiceProvider.GetRequiredService<ProcesarPendientes>().RunAsync(stoppingToken);
              }
              catch (Exception) when (!stoppingToken.IsCancellationRequested)
              {
                  // loguear con contexto (§10.1) y seguir con la próxima iteración
              }
          }
      }
  }
  ```

- **Fire-and-forget en un request, nunca.** `_ = Task.Run(() => servicio.Hacer())` usa servicios cuyo scope se cierra al terminar el request (quedan `Disposed`) y sus errores no los ve nadie. El trabajo va a una cola en memoria (`Channel<T>` acotado, singleton) que consume un `BackgroundService`, con un scope por mensaje: el handler solo hace `await channel.Writer.WriteAsync(job, cancellationToken)`.

  ```csharp
  builder.Services.AddSingleton(Channel.CreateBounded<EnviarMailJob>(
      new BoundedChannelOptions(500) { FullMode = BoundedChannelFullMode.Wait, SingleReader = true }));
  builder.Services.AddHostedService<MailWorker>();

  // MailWorker.ExecuteAsync
  await foreach (var job in channel.Reader.ReadAllAsync(stoppingToken))
  {
      try
      {
          await using var scope = scopeFactory.CreateAsyncScope();
          await scope.ServiceProvider.GetRequiredService<IMailSender>().SendAsync(job, stoppingToken);
      }
      catch (Exception) when (!stoppingToken.IsCancellationRequested) { /* loguear y seguir */ }
  }
  ```

  El `Channel` vive en la memoria de **una** instancia: si el proceso cae, lo encolado se pierde. Lo que no puede perderse (pagos, mails obligatorios) va a una tabla de **outbox**: se inserta en la misma transacción que el cambio y un job lo toma como abajo.
- **`Parallel.ForEachAsync` con servicios scoped**: un scope por ítem y `MaxDegreeOfParallelism` explícito. Un `DbContext` o `UnitOfWork` compartido entre las tareas rompe ([02](./02-csharp-design.md)).

  ```csharp
  await Parallel.ForEachAsync(ids, new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct },
      async (id, token) =>
      {
          await using var scope = scopeFactory.CreateAsyncScope();
          await scope.ServiceProvider.GetRequiredService<IProcesador>().RunAsync(id, token);
      });
  ```

- **Jobs con dos instancias corren duplicados**: cada instancia tiene su `PeriodicTimer`. El trabajo se toma de forma atómica en la base, nunca con un `lock` ni leyendo "pendientes" y marcándolos después. Con `READPAST`, dos instancias reciben lotes distintos y no se bloquean entre sí:

  ```sql
  ;WITH cola AS (
      SELECT TOP (@Lote) * FROM dbo.Trabajo WITH (UPDLOCK, READPAST, ROWLOCK)
      WHERE Estado = 'Pendiente' ORDER BY Id)
  UPDATE cola SET Estado = 'EnProceso', TomadoPor = @Instancia, TomadoEn = SYSUTCDATETIME()
  OUTPUT inserted.Id, inserted.Payload;
  ```

  Un `EnProceso` viejo (la instancia cayó) vuelve a `Pendiente` con otro `UPDATE ... WHERE Estado = 'EnProceso' AND TomadoEn < @Limite`. Si lo que debe correr en una sola instancia es el job entero (cierre diario), `sp_getapplock` con `@LockOwner = 'Session'` y `@LockTimeout = 0`: devuelve `>= 0` si lo obtuvo y `< 0` si otra instancia lo tiene; vale mientras la misma conexión siga abierta durante todo el job, y se libera con `sp_releaseapplock` en un `finally`. Para algo más grande, outbox en la base o una cola de mensajes (Service Bus, el broker que el equipo ya use): sin sumar librerías por esta regla.
