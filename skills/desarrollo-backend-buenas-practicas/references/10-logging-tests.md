## 10. Logging, observabilidad y tests

Logging con `ICorpLoggerHandler`, datos que nunca se loguean y tests xUnit + Moq. Leer al loguear, escribir tests o verificar una tarea.

### 10.1 Logging

- Logs de negocio con `ICorpLoggerHandler` (`LogInformation` / `LogError` con el modelo corporativo: datos, descripción, origen, destino, código, tipo de transacción, usuario, banco). El `LoggerFilter` global ya loguea request/response: no duplicar en controllers.
- Errores: los loguea el `IExceptionHandler` vía `IExceptionHelper`. No loguear y relanzar la misma excepción en cada capa.
- **Nunca** loguear: tokens, `Authorization`, contraseñas, connection strings, CBU/CVU/CUIT completos (enmascarar: `0000***1234`), body completo de requests con PII.
- Correlación: propagar `traceId` (OpenTelemetry). No inventar ids propios.
- Health checks: `AddHealthChecks().AddSqlServer(...)` por base, con tag `"db"`. El endpoint de salud (`Echo`) queda fuera de auth y del `LoggerFilter`.
- Dos sondas: liveness ("el proceso vive", sin dependencias) y readiness ("puede atender": base y servicios críticos, filtrando por tag). Si una sola sonda consulta la base, el orquestador reinicia el proceso cuando la que falla es la base. Sin datos internos en la respuesta ([11](./11-security.md)).

### 10.2 Tests

- Proyecto `UnitTest`: xUnit + Moq + `Assert` nativo. Carpeta por feature. Clase `<Clase>Tests`.
- Nombre del test: `<Metodo>_When<Condicion>_Should<Resultado>` (`Handle_WhenCodeExists_ShouldThrowSystemValidationException`).
- Estructura Arrange / Act / Assert. Mocks como campos `readonly` creados en el constructor. `It.IsAny<CancellationToken>()` en los `Setup`.
- Handler nuevo o modificado con lógica ⇒ tests de su camino feliz y sus errores. Bug corregido ⇒ test que lo reproduce.
- El test verifica la intención (la regla de la spec o del pedido), no la implementación: el `Assert` mira el resultado o la excepción que el negocio espera. `Verify` sobre un mock solo cuando la llamada **es** el resultado (se envió el mail, se grabó el registro). Un test que repite el `Setup` en el `Assert` no prueba nada.
- Refactor de una regla de negocio sin tests: primero tests de caracterización que fijan el
  comportamiento de hoy, rarezas incluidas (comentario `// Fijado a propósito: ...`). Si la regla
  cambia, cambia a propósito junto con su test, nunca de paso en el refactor. Comprobar que el test
  detecta: romper la regla, verlo fallar, restaurar.
- Escenarios con varios datos: un builder del caso base con nombres y métodos `Con<X>(...)`, así cada
  test muestra solo lo que cambia. Sobre un conjunto de flags, comparar el conjunto completo, no uno solo.
- No testear el mediator, Dapper ni getters. No mockear lo que no se posee si se puede envolver en una interfaz propia ya existente.
- Handlers `internal` ⇒ `<InternalsVisibleTo Include="<X>.UnitTest" />` en el `.csproj` de Application; el test crea el handler con `new` y sus mocks.
- Casos múltiples: `[Theory]` + `[ClassData]`, con las clases de datos en `Data/` dentro de la carpeta del feature.
- E2E (`WebApplicationFactory<Program>`) y tests contra servicios reales (base, APIs externas) dependen de entorno: no se corren en CI ni por cuenta propia, solo si el usuario lo pide; asserts con un único status esperado. Una `CustomWebApplicationFactory<Program>` reemplaza los clientes externos por mocks.
- Verificación antes de "terminado": `dotnet build` sin warnings nuevos y, desde riesgo medio, `dotnet test Tests/<X>.UnitTest` verde (§13.3). Si no se pudo correr, decirlo.

### 10.3 Pruebas de carga

- "Funciona" no es "aguanta". Antes de afirmar la capacidad de un endpoint o de cerrar una tarea de rendimiento: prueba de carga local con base real y volumen realista. Herramienta: k6 o NBomber (.NET); autocannon solo si el entorno ya tiene Node.
- Reportar RPS, latencia p95 / p99, tasa de error y el punto donde empieza a degradar. Comparar antes / después del cambio con el mismo script.
- Solo contra entornos propios (local, dev), nunca contra producción ni servicios de terceros. No va a CI (el pipeline corre solo `UnitTest`): es una verificación manual, a pedido o cuando la tarea es de rendimiento (§5.4 para el lado SQL).
