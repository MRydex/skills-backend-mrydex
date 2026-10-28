## 16. Tiempo real — Hubs de SignalR

Hubs, autenticación, grupos, gateway y despliegue. Leer al crear o tocar un hub. Contraparte del front:
skill `desarrollo-buenas-practicas` §16.
Fuente: docs de ASP.NET Core SignalR (seguridad, configuración, escalado, hosting).

### 16.1 Cuándo un hub

- Servidor que avisa a varios clientes (chat, presencia, notificaciones, tableros): **SignalR**.
- Solo servidor → cliente, sin grupos ni presencia: `TypedResults.ServerSentEvents` (.NET 10) alcanza.
- **Comandos por HTTP, avisos por hub.** Crear, editar o enviar un mensaje va por controller + handler
  (validación §6, `ProblemDetails` §7); el handler publica el evento por el hub. Métodos de hub solo para
  la conexión: unirse o salir de un grupo, presencia, typing.

### 16.2 Hub tipado y delgado

```csharp
public interface INotificacionesClient
{
    Task NotificacionNueva(NotificacionResponse notificacion);
    Task NotificacionLeida(long id);
}

[Authorize]
public sealed class NotificacionesHub(IAutorizacionSalas autorizacion) : Hub<INotificacionesClient>
{
    public async Task UnirseASala(long salaId)
    {
        if (!await autorizacion.PuedeVerAsync(Context.UserIdentifier!, salaId, Context.ConnectionAborted))
            throw new HubException("No autorizado.");

        await Groups.AddToGroupAsync(Context.ConnectionId, SalaGroup(salaId), Context.ConnectionAborted);
    }

    private static string SalaGroup(long salaId) => $"sala:{salaId}";
}
```

- **Siempre `Hub<TClient>`** con interfaz: los nombres de evento salen de los métodos y el compilador
  los controla. El front los replica 1:1 en un objeto `as const`; cambiar un nombre es cambio de
  contrato en los dos lados.
- **Hub delgado**: sin SQL ni reglas de negocio. Delegar a servicios de Application.
- **Sin estado en campos**: el hub es transient (una instancia por invocación). Estado de conexiones en
  un servicio singleton (`IConnectionTracker`).
- Payloads: records `*Response` (§7), nunca entidades. Fechas UTC ISO 8601 (§2).
- `CancellationToken`: `Context.ConnectionAborted` en métodos del hub.

### 16.3 Publicar desde un handler

```csharp
// Application: abstracción, sin referencia a SignalR
public interface INotificador
{
    Task NotificarAsync(string userId, NotificacionResponse notificacion, CancellationToken ct);
}

// Api / Infrastructure: implementación con IHubContext tipado
internal sealed class SignalRNotificador(IHubContext<NotificacionesHub, INotificacionesClient> hub) : INotificador
{
    public Task NotificarAsync(string userId, NotificacionResponse notificacion, CancellationToken ct) =>
        hub.Clients.User(userId).NotificacionNueva(notificacion);
}
```

- Application no referencia `Microsoft.AspNetCore.SignalR` (§1). El handler depende de `INotificador`.
- Publicar **después** de confirmar la transacción (`UnitOfWork` §5): si se publica antes y falla el
  commit, el cliente ve un cambio que no existe.
- `Clients.User(id)` para un usuario (todas sus pestañas), `Clients.Group(...)` para una sala. Nunca
  `Clients.All` con datos de un usuario.

### 16.4 Autenticación e identidad

```csharp
options.Events = new JwtBearerEvents
{
    OnMessageReceived = context =>
    {
        var token = context.Request.Query["access_token"];
        if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/api/hubs"))
            context.Token = token;
        return Task.CompletedTask;
    },
};

app.MapHub<NotificacionesHub>("/api/hubs/notificaciones", o => o.CloseOnAuthenticationExpiration = true);
```

- **`[Authorize]` en todo hub.** El navegador no manda headers en WebSocket: el token llega en
  `?access_token=` y se lee solo para la ruta de hubs.
- **Identidad solo desde claims** (`Context.UserIdentifier` vía `IUserIdProvider` con
  `NameIdentifier`). **Nunca** `Query["username"]` / `Query["userId"]` como identidad: cualquiera se
  conecta como otro.
- `CloseOnAuthenticationExpiration = true`: la conexión se cierra cuando vence el token; el cliente
  reconecta con uno nuevo.
- **Autorizar cada `UnirseA...`** contra la base (BOLA, OWASP API1): estar autenticado no da acceso a
  cualquier grupo.
- `ValidateTokenFilter` y `[RoleAuthorization]` (§3) son filtros de MVC: no corren en hubs. El token se
  valida con el esquema de autenticación de arriba; roles por hub o método con
  `[Authorize(Roles = Roles.X)]` o `[Authorize(Policy = ...)]`.

### 16.5 Configuración

```csharp
services.AddSignalR(o =>
{
    o.KeepAliveInterval = TimeSpan.FromSeconds(15);
    o.ClientTimeoutInterval = TimeSpan.FromSeconds(30);       // >= 2 x keep-alive del cliente
    o.MaximumReceiveMessageSize = 32 * 1024;                  // default; no subir sin motivo
    o.EnableDetailedErrors = env.IsDevelopment();
});
```

- Valores desde Options validadas (§8).
- El `serverTimeout` del cliente debe ser al menos el doble del `KeepAliveInterval`. Cambiar uno =
  avisar al front.
- `EnableDetailedErrors` solo en Development: en producción expone excepciones al cliente.
- Errores para el cliente: `HubException` con mensaje genérico. Logging de errores en un `IHubFilter`
  (`SignalRExceptionFilter`), con `ICorpLoggerHandler` (§10).
- CORS del hub: orígenes explícitos + `AllowCredentials()` (§11.2). Nunca `SetIsOriginAllowed(_ => true)`.
- **CORS no protege el WebSocket**: el navegador no lo aplica al handshake. Validar el header `Origin`
  contra los mismos orígenes con `app.UseWebSockets(new WebSocketOptions { AllowedOrigins = { ... } })` (comparación exacta:
  `https://host[:puerto]`, sin barra final)
  antes de `MapHub` (403 si no coincide; cross-site WebSocket hijacking).
- Cortes cortos sin perder mensajes: `o.AllowStatefulReconnects = true` en `MapHub` (.NET 8+) y
  `withStatefulReconnect()` en el cliente. Se negocia en `/negotiate`: no sirve si el cliente usa
  `skipNegotiation`.

### 16.6 Gateway, IIS y escalado

- **YARP**: proxya WebSocket por defecto (no hace falta `UseWebSockets()`); ruta `/api/hubs/{**catch-all}` hacia
  el backend. `ActivityTimeout` del cluster mayor al keep-alive.
- **Nunca loguear `QueryString`** en gateway ni middleware: lleva el `access_token`. Loguear solo `Path`.
  ASP.NET Core loguea la URL completa en `Information`: categoría `Microsoft.AspNetCore.Hosting` en
  `Warning`, o filtrar `access_token`. IIS: quitar el campo `URI Query` (`cs-uri-query`) del log W3C del sitio.
- Middleware que lee o reemplaza el body de la respuesta: excluir `/api/hubs` (rompe el streaming).
- IIS: feature **WebSocket Protocol** instalada en el servidor. Sin ella, cae a long polling o falla si
  el cliente usa `skipNegotiation`.
- Más de una instancia del backend: `IConnectionTracker` en memoria deja de servir. Usar backplane
  (Redis) o Azure SignalR Service (exige `/negotiate`: el front quita `skipNegotiation`), y sticky sessions si el cliente negocia. Decidir antes de escalar.
- `MaximumParallelInvocationsPerClient` en 1 (default) y rate limiting en `UnirseA...` si se puede
  abusar.

### 16.7 Tests

- Métodos del hub con xUnit + Moq: mockear `IHubCallerClients<TClient>`, `IGroupManager` y
  `HubCallerContext`; verificar `AddToGroupAsync` y que el no autorizado lanza `HubException`.
- `INotificador` mockeado en los tests de handlers: verificar que se publica solo después del commit.
- Verificación manual con el front (skill frontend §16.11): reconexión, logout, dos usuarios.

### 16.8 Antipatrones

| Antipatrón | En su lugar |
| :--- | :--- |
| `[AllowAnonymous]` + `?username=` como identidad | `[Authorize]`, token en `access_token`, claims |
| `Hub` sin tipar, `SendAsync("Nombre", ...)` con strings | `Hub<TClient>` |
| Lógica de negocio o SQL en el hub | Servicio de Application |
| Comando con validación como método de hub | Controller + handler; el handler publica |
| Publicar antes del commit | Publicar después de `UnitOfWork` |
| `UnirseASala` sin autorizar contra la base | Chequeo por sala (BOLA) |
| CORS cualquier origen + credenciales | Orígenes explícitos desde config |
| Gateway que loguea `Path + QueryString` | Solo `Path` |
| Tracker en memoria con varias instancias | Backplane / Azure SignalR |
