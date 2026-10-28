## 10. Logging, observabilidad y tests

Logging con `ICorpLoggerHandler`, datos que nunca se loguean y tests xUnit + Moq. Leer al loguear, escribir tests o verificar una tarea.

### 10.1 Logging

- Logs de negocio con `ICorpLoggerHandler` (`LogInformation` / `LogError` con el modelo corporativo: datos, descripción, origen, destino, código, tipo de transacción, usuario, banco). El `LoggerFilter` global ya loguea request/response: no duplicar en controllers.
- Errores: los loguea el `IExceptionHandler` vía `IExceptionHelper`. No loguear y relanzar la misma excepción en cada capa.
- **Nunca** loguear: tokens, `Authorization`, contraseñas, connection strings, CBU/CVU/CUIT completos (enmascarar: `0000***1234`), body completo de requests con PII.
- Correlación: propagar `traceId` (OpenTelemetry). No inventar ids propios.
- Health checks: `AddHealthChecks().AddSqlServer(...)` por base, con tag `"db"`. El endpoint de salud (`Echo`) queda fuera de auth y del `LoggerFilter`.

### 10.2 Tests

- Proyecto `UnitTest`: xUnit + Moq + `Assert` nativo. Carpeta por feature. Clase `<Clase>Tests`.
- Nombre del test: `<Metodo>_When<Condicion>_Should<Resultado>` (`Handle_WhenCodeExists_ShouldThrowSystemValidationException`).
- Estructura Arrange / Act / Assert. Mocks como campos `readonly` creados en el constructor. `It.IsAny<CancellationToken>()` en los `Setup`.
- Handler nuevo o modificado con lógica ⇒ tests de su camino feliz y sus errores. Bug corregido ⇒ test que lo reproduce.
- No testear el mediator, Dapper ni getters. No mockear lo que no se posee si se puede envolver en una interfaz propia ya existente.
- Handlers `internal` ⇒ `<InternalsVisibleTo Include="<X>.UnitTest" />` en el `.csproj` de Application; el test crea el handler con `new` y sus mocks.
- Casos múltiples: `[Theory]` + `[ClassData]`, con las clases de datos en `Data/` dentro de la carpeta del feature.
- E2E (`WebApplicationFactory<Program>`) dependen de entorno: no se corren en CI; asserts con un único status esperado. Una `CustomWebApplicationFactory<Program>` reemplaza los clientes externos por mocks.
- Verificación antes de "terminado": `dotnet build` sin warnings nuevos y, desde riesgo medio, `dotnet test Tests/<X>.UnitTest` verde (§13.3). Si no se pudo correr, decirlo.
