## 9. Integraciones HTTP

Typed `HttpClient`, Polly, timeouts y certificados. Leer al integrar un sistema externo.

```csharp
services.AddHttpClient<IAccountBlockClient, AccountBlockClient>(client =>
    {
        client.BaseAddress = new Uri(settings.BaseUrl);
        client.Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds);   // tope de TODA la operación, reintentos incluidos
    })
    .AddPolicyHandler(RetryPolicy.GetRetryPolicy(settings.RetryCount))    // afuera: reintenta
    .AddPolicyHandler(Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(settings.AttemptTimeoutSeconds))); // adentro: timeout por intento
```

```csharp
// RetryPolicy: jitter y Retry-After
public static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy(int retryCount) =>
    HttpPolicyExtensions.HandleTransientHttpError()                    // 5xx, 408, HttpRequestException
        .Or<TimeoutRejectedException>()                                // timeout por intento
        .OrResult(r => r.StatusCode == HttpStatusCode.TooManyRequests)
        .WaitAndRetryAsync(retryCount,
            (attempt, outcome, _) => outcome.Result?.Headers.RetryAfter?.Delta is { } retryAfter
                ? TimeSpan.FromTicks(Math.Min(retryAfter.Ticks, MaxEspera.Ticks))   // el servidor manda: se respeta, con tope
                : TimeSpan.FromSeconds(Math.Pow(2, attempt) * (0.5 + Random.Shared.NextDouble() * 0.5)), // backoff con jitter
            (_, _, _, _) => Task.CompletedTask);
```

- Resiliencia: el repo que ya usa Polly con `AddPolicyHandler` (`Microsoft.Extensions.Http.Polly`) lo
  mantiene, como en el ejemplo. Repo nuevo sin precedente: `Microsoft.Extensions.Http.Resilience`
  (`AddStandardResilienceHandler()` o `AddResilienceHandler(...)` con Options), que aplica las mismas reglas de abajo.
- Siempre typed client (`AddHttpClient<IX, X>`). Nunca `new HttpClient()` ni `IHttpClientFactory.CreateClient()` suelto: un `HttpClient` creado por request agota sockets bajo carga y no rota DNS; el typed client reusa los handlers del pool. `BannedSymbols` ya lo bloquea ([02](./02-csharp-design.md)).
- **Dos timeouts distintos.** `HttpClient.Timeout` corta la operación entera: cuenta las esperas y todos los reintentos juntos (con 3 reintentos de 1 s, 2 s y 4 s y `Timeout` de 3 s, se cancela en pleno backoff). El tope **por intento** va en un handler de timeout interno al retry (arriba, `AttemptTimeoutSeconds`); su `TimeoutRejectedException` hay que incluirla en lo que el retry maneja y, si agota los intentos, se mapea a `504`. Con `AddStandardResilienceHandler()` el `HttpClient.Timeout` **se ignora** (el handler lo deja en infinito): los topes son `AttemptTimeout` (10 s por defecto) y `TotalRequestTimeout` (30 s), y se configuran en sus Options.
- Retry solo para errores transitorios (5xx, 408, 429) y operaciones idempotentes; nunca reintentar un POST que crea algo sin idempotency key (qué verbo es idempotente: [03](./03-controllers.md)).
- `BaseUrl`, `Timeout`, `RetryCount` y `HandlerLifetime` vienen de Options validadas con rango (§8). Retry con backoff exponencial **con jitter** (sin él, los reintentos de todas las instancias caen a la vez y vuelven a tirar al servicio) y `.SetHandlerLifetime(...)` desde config. En un `429` o `503` con `Retry-After`, se espera lo que el servidor pide (con un tope). `AddStandardResilienceHandler()` ya trae jitter y respeta `Retry-After`, pero **reintenta también los `POST`**: `options.Retry.DisableForUnsafeHttpMethods()` si el cliente envía altas sin idempotency key.
- Circuit breaker: `AddStandardResilienceHandler()` ya lo trae; con Polly clásico, `CircuitBreakerAsync` junto al retry. Un servicio caído no se reintenta en cada request: se corta un tiempo y se responde `ExternalApiException` rápido.
- Respuesta no exitosa ⇒ `ExternalApiException` con sistema destino y status, sin el body completo si trae datos sensibles. Si falla la llamada, la excepción original va como inner.
- Status que devuelve la API cuando falla el downstream (lo resuelve el cliente, lo responde el handler de `ExternalApiException`), nunca un 500 genérico:

  | Falla | Status |
  | :--- | :--- |
  | Sin conexión (`HttpRequestException` sin respuesta) | `503` |
  | Timeout (`TaskCanceledException` sin cancelación del request) | `504` |
  | 2xx con body que no se puede deserializar | `502` |
  | El servicio respondió 4xx/5xx | `502`, o su status si el front lo necesita (ej. `404` de un recurso pedido) |

  Cancelación del request del cliente (`cancellationToken.IsCancellationRequested`) ⇒ relanzar, no
  mapear a 504. El endpoint que falló va en la excepción y en el log, no en el `detail` al cliente.
- Tokens de servicio (Basic / Bearer) por handler o por request desde config/Key Vault; nunca hardcodeados ni logueados.
- **Nunca** `ServerCertificateCustomValidationCallback = (...) => true` en código nuevo. Certificados internos ⇒ validar thumbprint/CA específica.
- `CancellationToken` del request hasta `SendAsync` / `GetFromJsonAsync`.
