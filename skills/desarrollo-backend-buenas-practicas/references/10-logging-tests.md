## 10. Logging, observabilidad y tests

Logging con `ICorpLoggerHandler`, datos que nunca se loguean y tests xUnit + Moq. Leer al loguear, escribir tests o verificar una tarea.

### 10.1 Logging

- Logs de negocio con `ICorpLoggerHandler` (`LogInformation` / `LogError` con el modelo corporativo: datos, descripción, origen, destino, código, tipo de transacción, usuario, entidad). El `LoggerFilter` global ya loguea request/response: no duplicar en controllers.
- Errores: los loguea el `IExceptionHandler` vía `IExceptionHelper`. No loguear y relanzar la misma excepción en cada capa.
- **Nunca** loguear: tokens, `Authorization`, contraseñas, PIN, ids de sesión, connection strings, CBU/CVU/CUIT completos (enmascarar: `0000***1234`), body completo de requests con PII, contenido o nombre de documentos del usuario. Rutas con ids secretos: loguear el nombre del endpoint, no `Request.Path`.
- Correlación: propagar `traceId` (OpenTelemetry). No inventar ids propios. El que se loguea es el mismo del `ProblemDetails`: `Activity.Current?.Id ?? HttpContext.TraceIdentifier`.
- Repo sin el logger corporativo: `ILogger<T>` con `[LoggerMessage]` (cumple CA1848). Verificar que producción tenga un destino persistente: solo `AddDebug` / consola en una app de escritorio o servicio es no tener logs. Categorías `Microsoft` y `System` en `Warning`: en `Information` escriben rutas y query, que pueden traer ids secretos.
- Health checks: `AddHealthChecks().AddSqlServer(...)` por base, con tag `"db"`. El endpoint de salud (`Echo`) queda fuera de auth y del `LoggerFilter`.

### 10.2 Tests

- Proyecto `UnitTest`: xUnit + Moq + `Assert` nativo. Carpeta por feature, en plural (`Customers/`) para no chocar con la entidad (`CS0118`, §2). Clase `<Clase>Tests`.
- Si el proyecto de tests ya tiene su convención (fakes a mano, otro naming, otra librería de mocks), se sigue esa. No se agrega Moq solo por esta regla.
- Nombre del test: `<Metodo>_When<Condicion>_Should<Resultado>` (`Handle_WhenCodeExists_ShouldThrowSystemValidationException`).
- Estructura Arrange / Act / Assert. Mocks como campos `readonly` creados en el constructor. `It.IsAny<CancellationToken>()` en los `Setup`.
- Handler nuevo o modificado con lógica ⇒ tests de su camino feliz y sus errores. Bug corregido ⇒ test que lo reproduce.
- Casos de error: el `Assert` verifica el campo y el mensaje exactos (`ErrorMessage.X`), no solo que haya un error.
- El test verifica la intención (la regla de la spec o del pedido), no la implementación: el `Assert` mira el resultado o la excepción que el negocio espera. `Verify` sobre un mock solo cuando la llamada **es** el resultado (se envió el mail, se grabó el registro). Un test que repite el `Setup` en el `Assert` no prueba nada.
- Refactor de código sin tests que fijen su comportamiento (regla de negocio, validación, endpoint): primero tests de caracterización que fijan el
  comportamiento de hoy, rarezas incluidas (comentario `// Fijado a propósito: ...`). Si la regla
  cambia, cambia a propósito junto con su test, nunca de paso en el refactor. Comprobar que el test
  detecta: romper la regla, verlo fallar, restaurar.
- Escenarios con varios datos: un builder del caso base con nombres y métodos `Con<X>(...)`, así cada
  test muestra solo lo que cambia. Sobre un conjunto de flags, comparar el conjunto completo, no uno solo.
- No testear el mediator (salvo un smoke de resolución + DI cuando se escribe nuevo), Dapper ni getters. No mockear lo que no se posee si se puede envolver en una interfaz propia ya existente.
- Handlers `internal` ⇒ `<InternalsVisibleTo Include="<X>.UnitTest" />` en el `.csproj` de Application; el test crea el handler con `new` y sus mocks.
- Casos múltiples: `[Theory]` + `[ClassData]`, con las clases de datos en `Data/` dentro de la carpeta del feature.
- E2E (`WebApplicationFactory<Program>`) y tests contra servicios reales (base, APIs externas) dependen de entorno: no se corren en CI ni por cuenta propia, solo si el usuario lo pide; asserts con un único status esperado. Una `CustomWebApplicationFactory<Program>` reemplaza los clientes externos por mocks.
- Verificación antes de "terminado": `dotnet build` sin warnings nuevos y, desde riesgo medio, `dotnet test Tests/<X>.UnitTest` verde (§13.3). Si no se pudo correr, decirlo.
