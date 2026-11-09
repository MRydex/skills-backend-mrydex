## 9. Integraciones HTTP

Typed `HttpClient`, Polly, timeouts y certificados. Leer al integrar un sistema externo.

```csharp
services.AddHttpClient<IAccountBlockClient, AccountBlockClient>(client =>
    {
        client.BaseAddress = new Uri(settings.BaseUrl);
        client.Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds);
    })
    .AddPolicyHandler(RetryPolicy.GetRetryPolicy(settings.RetryCount));
```

- Resiliencia: el repo que ya usa Polly con `AddPolicyHandler` (`Microsoft.Extensions.Http.Polly`) lo
  mantiene, como en el ejemplo. Repo nuevo sin precedente: `Microsoft.Extensions.Http.Resilience`
  (`AddStandardResilienceHandler()` o `AddResilienceHandler(...)` con Options), que aplica las mismas reglas de abajo.
- Siempre typed client (`AddHttpClient<IX, X>`). Nunca `new HttpClient()` ni `IHttpClientFactory.CreateClient()` suelto.
- `Timeout` explícito por cliente. Retry solo para errores transitorios (5xx, 408, 429) y operaciones idempotentes; nunca reintentar un POST que crea algo sin idempotency key (qué verbo es idempotente: [03](./03-controllers.md)).
- `BaseUrl`, `Timeout`, `RetryCount` y `HandlerLifetime` vienen de Options validadas con rango (§8). Retry con backoff exponencial (`WaitAndRetryAsync(retryCount, i => TimeSpan.FromSeconds(Math.Pow(2, i)))`) y `.SetHandlerLifetime(...)` desde config.
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
