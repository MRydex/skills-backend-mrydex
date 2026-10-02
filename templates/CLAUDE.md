# Claude Code Project Guidelines

## Backend / .NET Stack Conventions
This project enforces the official **.NET 8 backend** standards in [`skills/desarrollo-backend-buenas-practicas/SKILL.md`](./skills/desarrollo-backend-buenas-practicas/SKILL.md) (or `~/.claude/skills/desarrollo-backend-buenas-practicas/SKILL.md`). Read `SKILL.md` first; then read only the reference that matches the task (paths relative to the skill folder):

- **Architecture and size** (`references/01-solution-structure.md`): Clean Architecture (Api → Application → Domain; Infrastructure implements Application interfaces). One class per file. Max 150 lines per controller or handler, 250 per repository, 300 per class, 40 per method.
- **C#** (`references/02-csharp-design.md`): primary constructors, records, real nullable, `async` all the way. Never `.Result`, `.Wait()` or `async void`.
- **Controllers** (`references/03-controllers.md`): thin. One action = receive the request, `await mediator.Send(request, cancellationToken)`, map to `ActionResult`. Every action has `[RoleAuthorization(...)]` and real `[ProducesResponseType]`.
- **Mediator** (`references/04-mediator-handlers.md`): team mediator (`IRequest<T>` / `IRequestHandler<TRequest,T>`), never MediatR. Handlers are `internal`.
- **Data access and cache** (`references/05-data-access-dapper.md`): Dapper with `const` SQL, explicit columns, parameters only, `CommandDefinition(transaction:, cancellationToken:)`. Writes through `IUnitOfWork`. Cache as a Scrutor decorator.
- **EF Core / LINQ** (`references/15-data-access-ef-core.md`): only in repos that already have a `DbContext`. `AsNoTracking` + `Select` to DTO, async with `CancellationToken`, no N+1, `IQueryable` never leaves the repository, `FromSql` interpolated (never concatenated), one `SaveChangesAsync` per handler via `IUnitOfWork`, idempotent migration scripts (never `Database.Migrate()` at startup).
- **Validation** (`references/06-validation.md`): `AbstractValidator<TRequest>` + `Guard.AgainstInvalidSpecification` as the handler's first line.
- **Errors** (`references/07-errors-responses.md`): typed exceptions + `IExceptionHandler` → `ProblemDetails`. Never `BadRequest("text")` or `ex.Message` to the client.
- **Config and secrets** (`references/08-configuration-di-secrets.md`): Options pattern with `ValidateOnStart`; secret values only in Azure Key Vault.
- **HTTP integrations** (`references/09-http-integrations.md`): typed `HttpClient`, explicit timeout, Polly only for transient errors. Never disable certificate validation.
- **Logging and tests** (`references/10-logging-tests.md`): never log tokens, connection strings or PII. xUnit + Moq, `<Method>_When<Condition>_Should<Result>`. Before "done": `dotnet build` without new warnings + `dotnet test` of the UnitTest project green.
- **Security, always** (`references/11-security.md`): every change passes the Red Team review (§11.1). Dependency audit with `dotnet list package --vulnerable --include-transitive` when starting, after any package change and before delivering; flag `High`/`Critical`, never bump a major version without asking (§11.4). Report every vulnerability found, even out of scope.
- **Known tech debt** (`references/12-tech-debt.md`): never copy it into new code, never fix it out of scope; report it in one line.
- **Workflow** (`references/13-workflow-orchestration.md`): explore before editing, plan in `tasks/todo.md`, no scope creep, no over-engineering (§13.7.1), lessons in `tasks/lessons.md`, AI files in `.gitignore` (§13.9).
- **Checklists** (`references/checklists.md`): run through them before delivering.

## Agent Efficiency (always on)
See `references/14-agent-efficiency.md`.

- **Adapt to the agent and models in use**: Model and tool names in the skill (Opus, Haiku, `/compact`, `AskUserQuestion`) are examples. Detect which agent and models are available and use the equivalent. Rules never change, only syntax (§14.7).
- **Caveman mode** (§14.1): Terse replies, no filler, no tool-call narration. Technical terms, code and errors exact. Normal prose only for security warnings, irreversible actions, code, commits, PRs and docs.
- **Library lookups** (§14.2): Before researching a library (`Corp.*` private feed or public NuGet), ask another open agent session that knows it (`ListAgents` + `SendMessage`). Then code in the repo that already uses it, then docs MCP / XML docs in `~/.nuget/packages`, then web.
- **Orchestrate (§14.3, explicit standing request: delegate without waiting to be asked)**: The strongest available model plans, delegates and always reviews. Subagents `investigador`, `ejecutor-backend`, `revisor-checklist-backend` run searches, reads and mechanical edits only when it lowers total tokens. Shared context in `tasks/brief-<task>.md`. Executors never guess: when stuck they return `NECESITA_ADVISOR: <question>`.
- **Ask upfront** (§13.6): Before non-trivial work, ask all questions that change the result in one turn, with options and a recommended one (`AskUserQuestion`): endpoint contract, required role, target table/SP, cache yes/no.
- **Auto-compact** (§14.4): At the end of each phase, save state to `tasks/todo.md` and run `/compact` with focus. Never mid-change or with a pending question.
- **Graphify startup (§14.5, mandatory, first action of every session)**: run `graphify --help`, `graphify hook status` and `graphify update .`. Command not found → `pip install graphifyy && graphify install`. `warning: skill is from graphify X, package is Y` → `pip install --upgrade graphifyy && graphify install`. Hooks not installed → `graphify hook install` + `graphify claude install`. The first search on the code is always `graphify query "<question>"`. After editing any file: `graphify update .`.
