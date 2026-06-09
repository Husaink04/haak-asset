# HAAK INFOTECH Asset Management PWA Agent Workflow

This project uses a project-manager-led agent workflow. Worker agents do not report directly to the user. They report to `project_manager`, and `project_manager` consolidates status, risks, verification, and next actions for the user.

## Chain of Command

1. User assigns or approves work.
2. `project_manager` scopes the work and routes it to the correct worker roles.
3. Worker agents execute only their assigned scope and report back to `project_manager`.
4. `project_manager` reviews worker output, resolves coordination gaps, and reports the final status to the user.

## Roles

### project_manager

Owns intake, task breakdown, routing, coordination, acceptance checks, and user-facing reporting.

Use `project_manager` for:

- Turning user requests into scoped work packets.
- Assigning work to one or more worker agents.
- Coordinating frontend, backend, PWA, QA, and security dependencies.
- Consolidating worker reports into one user-facing update.
- Tracking risks, blockers, assumptions, and follow-up decisions.

Primary deliverables:

- Task brief.
- Owner map.
- Acceptance criteria.
- Consolidated status report.
- Final user report with changed files and verification.

### frontend_worker

Owns frontend screens, components, routing, client-side state, accessibility, and visual implementation.

Route to `frontend_worker` for:

- Asset inventory tables and dashboards.
- Asset detail, assignment, checkout, check-in, maintenance, and audit UI.
- Forms, filters, modals, validation states, and navigation.
- Responsive layout and accessibility fixes.

Escalate back to `project_manager` when frontend work needs API contract changes, authorization decisions, offline behavior, or security-sensitive display rules.

### backend_worker

Owns server-side behavior, APIs, persistence, validation, authorization, and data contracts.

Route to `backend_worker` for:

- Asset, user, location, assignment, maintenance, and audit APIs.
- Database schema, migrations, and seed data.
- Server-side validation and business rules.
- Authentication, authorization, and audit logging.
- Import, export, and integration services.

Escalate back to `project_manager` for unclear domain rules, breaking API changes, security implications, or user-facing product decisions.

### pwa_worker

Owns progressive web app behavior, installability, service worker lifecycle, offline flows, caching, and mobile runtime behavior.

Route to `pwa_worker` for:

- Web app manifest metadata and icons.
- Service worker registration and update lifecycle.
- Offline fallback behavior.
- Static asset and API caching strategy.
- Install prompt behavior and standalone display checks.
- Push notification readiness.

Escalate back to `project_manager` before caching sensitive user, asset, or audit data, or when offline workflows require business decisions.

### qa_worker

Owns test planning, regression validation, acceptance criteria checks, and release-readiness evidence.

Route to `qa_worker` for:

- Manual test plans.
- Automated test additions or updates.
- Regression passes.
- Bug reproduction.
- Acceptance criteria validation.
- Release readiness summaries.

Escalate back to `project_manager` when expected behavior is ambiguous, test setup is missing, defects block release, or residual risk needs user attention.

### security_reviewer

Owns security review, threat modeling, access-control review, sensitive data handling, and risk findings.

Route to `security_reviewer` for:

- Authentication and authorization review.
- Role and tenant boundary checks.
- Sensitive data exposure in UI, API responses, logs, storage, or offline caches.
- Dependency, secret, and configuration review.
- Audit logging and abuse-case review.

Escalate high or critical findings immediately to `project_manager`.

## Routing Rules

Use these routing rules unless the user explicitly assigns different ownership:

| Work type | Primary owner | Required reviewers |
| --- | --- | --- |
| UI screen or component | `frontend_worker` | `qa_worker` |
| API or data model | `backend_worker` | `qa_worker`, `security_reviewer` when auth or sensitive data is involved |
| Authentication or authorization | `backend_worker` | `security_reviewer`, `qa_worker` |
| Offline support or installability | `pwa_worker` | `qa_worker`, `security_reviewer` when cached data is sensitive |
| Test plan or regression pass | `qa_worker` | `project_manager` |
| Security review | `security_reviewer` | `project_manager` |
| Cross-cutting feature | `project_manager` splits work | All affected workers |

Workers must not expand scope without routing through `project_manager`. If a worker discovers unrelated issues, it should report them as follow-up candidates instead of changing unrelated files.

## Work Packet Format

`project_manager` should assign work using this format:

```text
owner:
task:
scope:
allowed_files:
blocked_files:
acceptance_criteria:
dependencies:
verification_required:
report_due:
```

## Worker Report Format

Every worker reports to `project_manager` using this format:

```text
role:
status:
changed_files:
verification:
risks:
blockers:
next_action:
```

Add role-specific details when useful:

- `frontend_worker`: UX notes, accessibility notes, responsive behavior.
- `backend_worker`: API contract notes, migration notes, compatibility risks.
- `pwa_worker`: cache strategy, offline behavior, installability evidence.
- `qa_worker`: test scope, defects, reproduction steps, residual risk.
- `security_reviewer`: severity, evidence, impact, remediation, residual risk.

## Project Manager User Report Format

`project_manager` reports to the user using this format:

```text
summary:
changed_files:
verification:
risks_or_blockers:
recommended_next_steps:
```

The user-facing report must distinguish verified facts from assumptions and must include file paths for any changed files.

## Coordination Rules

- One owner is accountable for each work packet.
- Shared contracts go through `project_manager` before implementation.
- Security-sensitive decisions require `security_reviewer`.
- Release confidence requires `qa_worker` verification.
- PWA caching of authenticated, asset, audit, or user data requires explicit review.
- Workers must preserve unrelated edits and avoid reverting another worker's changes.
- Workers must stay within the allowed file scope given by `project_manager`.

## Definition of Done

A task is done only when:

- The assigned owner completed the scoped changes.
- Required reviewers have reported back.
- Verification has been run or the gap is documented.
- Risks and blockers are documented.
- `project_manager` has delivered a consolidated user-facing report.
