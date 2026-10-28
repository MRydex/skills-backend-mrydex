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

- Siempre typed client (`AddHttpClient<IX, X>`). Nunca `new HttpClient()` ni `IHttpClientFactory.CreateClient()` suelto.
- `Timeout` explícito por cliente. Retry solo para errores transitorios (5xx, 408, 429) y operaciones idempotentes; nunca reintentar un POST que crea algo sin idempotency key.
- `BaseUrl`, `Timeout`, `RetryCount` y `HandlerLifetime` vienen de Options validadas con rango (§8). Retry con backoff exponencial (`WaitAndRetryAsync(retryCount, i => TimeSpan.FromSeconds(Math.Pow(2, i)))`) y `.SetHandlerLifetime(...)` desde config.
- Respuesta no exitosa ⇒ `ExternalApiException` con sistema destino y status, sin el body completo si trae datos sensibles. Si falla la llamada, la excepción original va como inner.
- Tokens de servicio (Basic / Bearer) por handler o por request desde config/Key Vault; nunca hardcodeados ni logueados.
- **Nunca** `ServerCertificateCustomValidationCallback = (...) => true` en código nuevo. Certificados internos ⇒ validar thumbprint/CA específica.
- `CancellationToken` del request hasta `SendAsync` / `GetFromJsonAsync`.
