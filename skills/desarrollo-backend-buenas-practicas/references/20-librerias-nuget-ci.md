## 20. Librerías NuGet, CI/CD y Docker

Paquetes NuGet propios, pipelines de Azure DevOps y Dockerfile de una API. Leer al crear o tocar un paquete publicable, un YAML de pipeline o un `Dockerfile`.

**Cuándo aplica**: el repo publica un paquete NuGet, o ya tiene pipelines de CI/CD o un `Dockerfile`; o el usuario pide alguno. Si el proyecto no lo usa, no lo agregues. Si el repo ya tiene su forma (por ejemplo un YAML por ambiente, o un solo YAML con stages), **se sigue esa** (§13.5); lo de abajo es el criterio cuando no hay precedente. Para el análisis de dependencias y SonarCloud como regla de seguridad, ver §11.2 y §11.4. Es riesgo alto si toca el pipeline de despliegue (§13.3).

### 20.1 Paquete NuGet propio

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <PackageId>Corp.Extensions.Http</PackageId>
    <Description>Helpers de HttpClient para APIs de Corp.</Description>
    <Authors>Corp</Authors>
    <PackageReadmeFile>README.md</PackageReadmeFile>
    <!-- licencia: la que ya use el repo (PackageLicenseExpression / PackageLicenseFile) -->
    <RepositoryUrl>https://example.com/acme/extensions-http</RepositoryUrl>
    <GenerateDocumentationFile>true</GenerateDocumentationFile>
    <PublishRepositoryUrl>true</PublishRepositoryUrl>
    <EmbedUntrackedSources>true</EmbedUntrackedSources>
    <IncludeSymbols>true</IncludeSymbols>
    <SymbolPackageFormat>snupkg</SymbolPackageFormat>
    <ContinuousIntegrationBuild Condition="'$(TF_BUILD)' == 'true'">true</ContinuousIntegrationBuild>
  </PropertyGroup>

  <ItemGroup>
    <None Include="README.md" Pack="true" PackagePath="\" />
  </ItemGroup>
</Project>
```

- `PackageId` único y con el prefijo de la empresa (`Corp` es el placeholder de §0; en el repo, el prefijo real). `Description`, `Authors`, licencia y `README.md` completos.
- **Versión desde CI**, no escrita a mano en el `.csproj`: `dotnet pack -p:Version=$(Build.BuildNumber)` o `-p:PackageVersion=...`. SemVer (`MAJOR.MINOR.PATCH`); prerelease con sufijo (`1.4.0-beta.3`) fuera de la rama principal.
- **Breaking change = versión mayor** (§17.8 vale también para la API pública de una librería): quitar o renombrar un tipo o miembro público, cambiar una firma, subir el TFM mínimo. Un cambio aditivo es menor; un fix es parche.
- `GenerateDocumentationFile` para que los comentarios XML viajen en el paquete y se vean en el IDE de quien lo consume. Sin ese archivo, el IDE no muestra la documentación.
- **SourceLink y build determinístico**: `PublishRepositoryUrl`, `EmbedUntrackedSources`, símbolos (`snupkg`) y `ContinuousIntegrationBuild` en CI. Permiten depurar el paquete bajando el código fuente. Con repos Azure Repos / GitHub el SourceLink viene incluido en el SDK; no agregues paquetes de SourceLink a mano.
- Dependencias **de una librería publicada** (no de una API o app, que fijan versión, §11.1 punto 8): las mínimas, con versión mínima (límite inferior), sin rangos cerrados ni comodines; no arrastrar `Microsoft.*` de un mayor distinto al que el consumidor ya usa (§0, §12). Una librería no referencia `Microsoft.AspNetCore.App` completo si no hace falta.
- Empaquetar: `dotnet pack -c Release --no-build -o $(Build.ArtifactStagingDirectory)`. Probar el paquete localmente (feed de carpeta) antes de publicarlo.
- Secretos, connection strings o URLs internas **nunca** dentro del paquete ni del README (los `.nupkg` se pueden descomprimir).

### 20.2 Feed privado

```xml
<!-- nuget.config en la raíz del repo -->
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
    <add key="corp" value="https://pkgs.example.com/corp/_packaging/corp/nuget/v3/index.json" />
  </packageSources>
</configuration>
```

- `nuget.config` **sin credenciales**: ni usuario, ni token, ni `ClearTextPassword`. Solo URLs de feeds.
- Local: el credential provider de Azure Artifacts (`dotnet restore --interactive`) pide el login. En CI: `NuGetAuthenticate@1` antes del restore (§20.3).
- `<clear />` y fuentes explícitas; con **`packageSourceMapping`** si hay varios feeds, para que los paquetes `Corp.*` solo salgan del feed privado (mitiga dependency confusion, §11.4).
- El agente no lee `nuget.config` de usuario ni tokens (§11.2): pedí el valor si hace falta.

### 20.3 Pipeline de Azure DevOps (YAML)

```yaml
name: 1.0.$(Rev:r)   # build number SemVer X.Y.Z; lo usa el pack (§20.1)

trigger:
  branches:
    include: [main]

pool:
  vmImage: ubuntu-latest

variables:
  buildConfiguration: Release

stages:
  - stage: Build
    jobs:
      - job: BuildAndTest
        steps:
          - task: UseDotNet@2
            inputs:
              packageType: sdk
              version: 10.0.x

          - task: NuGetAuthenticate@1

          - task: DotNetCoreCLI@2
            displayName: Restore
            inputs:
              command: restore
              projects: '**/*.sln*'
              feedsToUse: config
              nugetConfigPath: nuget.config

          - task: DotNetCoreCLI@2
            displayName: Build
            inputs:
              command: build
              projects: '**/*.sln*'
              arguments: '-c $(buildConfiguration) --no-restore'

          - task: DotNetCoreCLI@2
            displayName: Test
            inputs:
              command: test
              projects: '**/*UnitTest*.csproj'
              arguments: '-c $(buildConfiguration) --no-build --collect:"XPlat Code Coverage"'

          - task: DotNetCoreCLI@2
            displayName: Publish
            inputs:
              command: publish
              publishWebProjects: true
              arguments: '-c $(buildConfiguration) --no-build -o $(Build.ArtifactStagingDirectory)'
              zipAfterPublish: true

          - task: PublishPipelineArtifact@1
            inputs:
              targetPath: $(Build.ArtifactStagingDirectory)
              artifact: drop
```

- `UseDotNet@2` con la misma versión mayor que el `TargetFramework` (y que `global.json`, si existe); sin `latest` sin versión.
- Orden: restore → build `--no-restore` → test `--no-build` → publish `--no-build`. Cada paso reutiliza el anterior; no se compila dos veces.
- **Cobertura**: `--collect:"XPlat Code Coverage"` y publicar el resultado con `PublishCodeCoverageResults@2` si el repo ya lo muestra. Sin umbral inventado; el que exista en el repo se respeta.
- **SonarCloud**: si el repo ya lo tiene, `SonarCloudPrepare` antes del build, `SonarCloudAnalyze` después del test y `SonarCloudPublish`; con el quality gate como condición de merge (§11.2). Se agrega solo si el proyecto ya lo usa.
- **Un job de pipeline que falla corta el despliegue**: nunca `continueOnError: true` en build, test o análisis para "que pase" (§13.7).
- Versión de cada tarea (`@2`, `@3`...): la que el repo ya usa. Subirla es otro cambio.

### 20.4 Publicar el paquete NuGet

```yaml
          - task: DotNetCoreCLI@2
            displayName: Pack
            inputs:
              command: pack
              packagesToPack: src/Corp.Extensions.Http/*.csproj
              configuration: $(buildConfiguration)
              nobuild: true
              versioningScheme: byBuildNumber   # exige un build number X.Y.Z (ver `name:` arriba)

          - task: DotNetCoreCLI@2
            displayName: Push
            condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
            inputs:
              command: push
              packagesToPush: '$(Build.ArtifactStagingDirectory)/*.nupkg'
              nuGetFeedType: internal
              publishVstsFeed: 'corp/corp'
```

- El push solo desde la rama principal (o desde un tag de release), nunca desde ramas de feature.
- Una versión publicada **no se sobrescribe ni se borra**: se corrige con una versión nueva.

### 20.5 Ambientes, aprobaciones y secretos

- Stages por ambiente (`Dev` → `Test` → `Prod`) sobre el **mismo artefacto**; se promueve, no se reconstruye.
- Cada ambiente como `environment` de Azure DevOps con **aprobaciones y checks** (Prod siempre con aprobación manual).

```yaml
  - stage: DeployProd
    dependsOn: DeployTest
    jobs:
      - deployment: Deploy
        environment: corp-prod       # con aprobación configurada en el environment
        strategy:
          runOnce:
            deploy:
              steps:
                - download: current
                  artifact: drop
```

- Si el repo ya tiene **un YAML por ambiente**, seguilo: no unifiques sin pedido.
- **Secretos**: en *variable groups* (marcados como secretos) o enlazados a Azure Key Vault; la service connection con permisos mínimos. **Nunca** en el YAML, en `appsettings*.json` ni en `nuget.config` (§8, §11.2). Un secreto no se imprime en logs del pipeline (`echo`, `--verbosity diagnostic`).
- Los valores por ambiente (URLs, nombres de secretos) van en variables o en `appsettings.{Env}.json`; el valor sensible, en Key Vault (§8).
- Cambios de pipeline son de riesgo alto (§13.3): revisión manual antes de mergear.

### 20.6 Dockerfile de una API

```dockerfile
# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY nuget.config ./
COPY src/Corp.Api/Corp.Api.csproj src/Corp.Api/
COPY src/Corp.Application/Corp.Application.csproj src/Corp.Application/
RUN dotnet restore src/Corp.Api/Corp.Api.csproj
COPY . .
RUN dotnet publish src/Corp.Api/Corp.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Corp.Api.dll"]
```

- **Multi-stage**: imagen `sdk` para compilar, `aspnet` para correr. La imagen final no lleva el SDK ni el código fuente.
- Copiar los `.csproj` y hacer `restore` **antes** de copiar el resto: aprovecha la caché de capas.
- **No root**: `USER $APP_UID` (las imágenes de .NET 8+ traen el usuario `app`). Sin `USER root` ni `--privileged`.
- Puerto: `ASPNETCORE_HTTP_PORTS=8080` (puerto no privilegiado; el 80 requiere root). TLS lo termina el proxy / ingress, no la imagen.
- Sin secretos en `ENV`, `ARG` ni en `COPY`: se inyectan al correr (variables del orquestador, Key Vault). El `nuget.config` copiado no lleva credenciales (§20.2); para un feed privado, secreto de build con `--mount=type=secret`.
- Tag de imagen con versión mayor fija (`10.0`), no `latest`.
- **`.dockerignore`**: `bin/`, `obj/`, `.git/`, `.vs/`, `*.user`, `**/appsettings.Development.json`, `.env*`, `tests/`, archivos de agentes (`.claude/`, `graphify-out/`, `tasks/`, §13.9). Evita filtrar secretos y acelera el build.
- Health check por `HEALTHCHECK` o del orquestador contra `Echo/HealthCheck` (§11.3).

### 20.7 Checklist

- [ ] Paquete: `PackageId`, versión desde CI (SemVer), README, XML docs, SourceLink; breaking change ⇒ mayor.
- [ ] `nuget.config` sin credenciales; `NuGetAuthenticate@1` en CI; `packageSourceMapping` si hay varios feeds.
- [ ] Pipeline: `UseDotNet@2` con la versión del TFM, restore → build → test → publish con `--no-restore` / `--no-build`.
- [ ] Cobertura y SonarCloud solo si el repo ya los usa; sin `continueOnError` para tapar fallas.
- [ ] Mismo artefacto por ambiente, aprobaciones en Prod, secretos en variable group o Key Vault.
- [ ] Un YAML por ambiente existente se respeta.
- [ ] Dockerfile multi-stage, `USER $APP_UID`, `ASPNETCORE_HTTP_PORTS`, `.dockerignore`, sin secretos en la imagen.
