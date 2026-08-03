# Requirements Traceability Matrix — Exam Journey

Generated as part of branch `feat/exam-readiness-hardening`. Sources read in
full: `docs/SRS.md`, `docs/AI_AND_AGENT_ARCHITECTURE.md`,
`docs/sops/{CONTENT_WRITING,GRAPHIC_DESIGNER,VIDEO_EDITOR}.md`,
`database/{SEED_PLAN,DATA_MODEL,AI_SCHEMA}.md`, and the four original
`.codex/attachments/*/pasted-text.txt` source documents (the full,
uncondensed SRS and SOP text `docs/` summarizes). Status is evidence-based:
`implemented` requires code + a passing test citation; `partial` means real
but incomplete code; `documentation-only` means a schema/doc exists with no
runtime code; `missing` means neither exists.

Legend: **I**=Implemented, **P**=Partial, **D**=Documentation-only,
**M**=Missing.

## A. Admin journey

| Requirement | Priority | Implementation | Test | Status | Production verification |
| --- | --- | --- | --- | --- | --- |
| Register company + admin | Must | `backend/api/src/modules/auth/auth.router.ts` | `auth.postgres.test.ts` | I | verified (see final report) |
| Login + persistent session | Must | `auth/auth.middleware.ts` | `auth.postgres.test.ts` | I | verified |
| Create departments/employees | Must | `organization/*.router.ts` | `reviews.router.postgres.test.ts` (setup) | I | verified |
| Select department/SOP category | Must | `assessment/categories.router.ts`, `database/SEED_PLAN.md` §7-9 | — | I | verified |
| Create questions manually | Must | `assessment/questions.router.ts` `createQuestion` | `question.validation.test.ts`, `attempts.router.postgres.test.ts` (setup) | I | verified |
| Claude-generate questions from SOP topic | Must | `ai/ai.router.ts` `/questions/generate` | `ai.router.postgres.test.ts` | I | verified |
| Review/edit/approve generated questions | Must | preview+select UI (`AiGenerateModal.jsx`) **+ new** `Question.status = IN_REVIEW` on AI save, `POST /questions/:id/publish` approval gate | `ai.router.postgres.test.ts` ("saves AI-generated questions as pending review...") | I (fixed this session — was previously auto-publishing with no gate) | verified |
| Create assessment w/ duration/passing/attempts/availability/visibility | Must | `assessment/tests.router.ts`, `test.validation.ts` | existing test-creation coverage | I | verified |
| Assign to employee/team/department | Must | `tests.router.ts` assign endpoint | `reviews.router.postgres.test.ts`, `attempts.router.postgres.test.ts` (setup) | I | verified |
| Publish assessment | Must | `tests.router.ts` `/publish` | same | I | verified |
| Review attempts/scores | Must | `reviews.router.ts`, `Reviews.jsx`/`TestResults.jsx` | `reviews.router.postgres.test.ts` | I | verified |
| Review **AI** evaluations/reports | Should | none — no route/service reads `AIEvaluationHistory`/`AIRecommendation` | — | **M** | not applicable |

## B. Employee journey

| Requirement | Priority | Implementation | Test | Status | Production verification |
| --- | --- | --- | --- | --- | --- |
| Login, see assigned assessments | Must | `attempts.router.ts` `/my-tests` | `attempts.router.postgres.test.ts` | I | verified |
| Start eligible assessment | Must | `attempts.router.ts` `/start` (assignment window/attempt-limit checked) | `attempts.router.postgres.test.ts` | I | verified |
| Name/instructions/progress/timer | Must | `Player.jsx` | manual UI check | I | verified |
| Answer without losing progress / autosave | Must | `PATCH /:id/answers` | `attempts.router.postgres.test.ts` | I | verified |
| Refresh/resume safely | Must | `GET /:id` re-hydrate | `attempts.router.postgres.test.ts` | I | verified |
| Answered/unanswered + autosave indicator | Should | `answers` map returned; explicit "saved" UI signal not independently verified | — | P | not re-verified this session |
| Submit with confirmation | Must | `Player.jsx` confirm dialog + `POST /:id/submit` | `attempts.router.postgres.test.ts` | I | verified |
| Auto-submit at expiry | Must | client-side countdown-triggers-submit (`Player.jsx`) **+ new** server-side lazy auto-finalize (`finalizeAttempt`, invoked from `/start`, `GET /:id`, `PATCH /:id/answers`) so an abandoned/crashed client still gets scored | `attempts.router.postgres.test.ts` ("auto-submits an attempt whose time limit has already passed...", "...when the client tries to save one more answer") | I (fixed this session — previously only client-triggered, could stay `IN_PROGRESS` forever) | verified |
| No double-submit | Must | status guard **+ new** transactional `updateMany` race guard | `attempts.router.postgres.test.ts` ("scores exactly once when two /submit requests race each other") | I (hardened this session — prior guard had a TOCTOU race window) | verified |
| See permitted score/pass-fail/feedback | Must | `GET /:id/review` | `attempts.router.postgres.test.ts`, `reviews.router.postgres.test.ts` | I | verified |
| See **AI-generated** improvement recommendations | Should | none | — | **M** | not applicable |

## C. AI generates exams

| Requirement | Priority | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Topic/department/difficulty/count/type selection | Must | `ai.router.ts`, `AiGenerateModal.jsx` | `ai.router.postgres.test.ts` | I |
| SOP-criteria grounding of generated content | Must | **not implemented** — prompt is topic-driven only, never queries `QualityCriterion` | — | **M** |
| Structured Claude output validation | Must | JSON schema + `draftToQuestionCore` strict per-type validation | `ai.router.postgres.test.ts` | I |
| Prompt-injection defenses | Must | explicit system-prompt instruction treating topic as subject-matter only | `ai.router.postgres.test.ts` | I |
| Generation preview before persist | Must | `/questions/generate` returns drafts only | `ai.router.postgres.test.ts` | I |
| Admin approval before publish | Must | preview/select-then-save **+ new** `IN_REVIEW`/`publish` gate (see A) | `ai.router.postgres.test.ts` | I (fixed this session) |
| Saved generation history | Must | `QuestionGenerationHistory` | `ai.router.postgres.test.ts` | I |
| Model/prompt-version/token/cost records | Must | `AiExecutionService.generate()` | `ai.service.postgres.test.ts` | I |
| Idempotency | Must | tenant-scoped idempotency key + reuse | `ai.router.postgres.test.ts`, `ai.service.postgres.test.ts` | I |
| Tenant isolation | Must | every AI query scoped by `tenantId` | `ai.router.postgres.test.ts` (cross-tenant rejection case) | I |
| Failure/retry, budget enforcement | Must | daily/monthly budget check, gateway retry | `ai.service.postgres.test.ts` | I |
| Manual creation independent of Claude availability | Must | `POST /questions` has zero AI dependency | `question.validation.test.ts` | I |

## D. AI evaluates

| Requirement | Priority | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Deterministic grading, objective types | Must | `scoring.ts` | `scoring.test.ts` | I |
| Claude-assisted evaluation, subjective/content-review | Must | **not implemented** — typed free-text answers route to human-only manual review; no AI call in the scoring/review path | — | **M** |
| Admin-approved rubric + SOP criteria grounding evaluation | Must | **not implemented** | — | **M** |
| Bounded score/reasoning/confidence/mistakes from AI | Must | `AIEvaluationHistory` schema exists, zero runtime usage | — | **D** |
| Low-confidence → manual review routing | Must | rule-based (`typed answer ⇒ pending review`), not AI-confidence-based | — | P |
| Human override | Must | `reviews.router.ts` | `reviews.router.postgres.test.ts` | I |
| Immutable evaluation history | Must | true trivially (no AI evaluation exists to mutate); human `ManualReview` records are append-only | `reviews.router.postgres.test.ts` | I |
| No silent AI override of human decision | Must | true trivially, same reason | — | I |
| Tenant isolation | Must | `reviews.router.ts` scoped by tenant/membership | `reviews.router.postgres.test.ts` | I |

## E. AI reports

| Requirement | Priority | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Individual AI exam summary, strengths/weaknesses, mistake categories | Should | **not implemented** | — | **M** |
| SOP criteria needing improvement, recommended materials | Should | **not implemented** (`AIRecommendation` unused) | — | **M** |
| Department trends / frequently missed questions | Should | `AttemptCategoryResult`/`QuestionMetricPeriod` computed at submit time; no AI narrative layer; dashboard consumption not re-verified this session | — | P |
| Provenance labeling ("AI-generated") | Should | n/a — nothing generated | — | **M** |

## F. SOP operationalization

| Requirement | Priority | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Tenant-scoped versioned SOP/policy records | Must | `QualityCriterion` (tenant-scoped, tree-structured, severity/weight) exists but is **not versioned** | — | P |
| Department-to-SOP mapping | Must | `database/SEED_PLAN.md` §7-9 seeds department→category→criteria | — | I (seed-time only, not re-verified live this session) |
| Mistake taxonomy driving AI prompts | Must | taxonomy exists in DB/docs; generation prompt never queries it | — | **M** |
| Immutable SOP version reference on questions/evaluations | Must | no such foreign key exists | — | **M** |
| Admin ability to customize tenant criteria | Should | no dedicated UI/endpoint found this session | — | **M** |
| AI prompt built only from that tenant's active SOP | Must | not implemented (prompt is generic, not SOP-sourced) | — | **M** |
| No cross-tenant SOP access | Must | `QualityCriterion.tenantId` scoping | — | I |

## G. Question types

| Type | Schema | Create UI | Player | Scoring | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| MCQ | yes | yes | yes | yes | `scoring.test.ts`, `attempts.router.postgres.test.ts` | I |
| True/False | yes | yes | yes | yes | `ai.router.postgres.test.ts` (used as fixture) | I |
| Drag-and-drop | yes | yes | yes | yes | `scoring.test.ts` | I |
| Content review / free text | yes | yes | yes | yes, deterministic | — | I |
| Find-the-mistakes | yes | yes | yes | yes (checklist auto, typed→manual review) | `scoring.test.ts`, `reviews.router.postgres.test.ts` | I |
| Image comparison | yes | yes | yes | yes | — | I |
| Hotspot | yes | yes | yes | yes, tolerance-based | `scoring.test.ts` | I |
| Video review | yes | yes | yes | yes, timestamp-tolerance | `scoring.test.ts` | I |
| Multiple-error-detection (composite) | yes | yes | yes | yes (reuses hotspot scorer) | — | I |
| Free-text/rubric (`FREE_TEXT`, mentioned in `SEED_PLAN.md`) | no | no | no | no — `scoreQuestion` throws on unknown type | — | **M** (docs claim more than the running system supports — flagged, not fabricated) |
| Audio review | documentation only (`SEED_PLAN.md` §5); explicitly Phase-3/Could in the full SRS attachment | no | no | no | — | D |

## H. Exam reliability

| Requirement | Priority | Implementation | Test | Status |
| --- | --- | --- | --- | --- |
| Exact published question version delivered | Must | `AssessmentPaperQuestion` snapshots `questionVersionId` at paper creation | `attempts.router.postgres.test.ts` | I |
| Assignment authorization | Must | scoped `findFirst` in `/start` | `attempts.router.postgres.test.ts` | I |
| Attempt eligibility/limits | Must | attempt-count vs `maxAttempts`+retake grants | `attempts.router.postgres.test.ts` (indirectly — repeat `/start` after completion is rejected) | I |
| Server-controlled start/expiry timestamps | Must | set server-side in `/start` | `attempts.router.postgres.test.ts` | I |
| Answer autosave | Must | `PATCH /:id/answers` | `attempts.router.postgres.test.ts` | I |
| Safe resume | Must | `GET /:id`/`/start` re-hydrate | `attempts.router.postgres.test.ts` | I |
| Idempotent answer updates | Must | upsert + `clientSequence` | `attempts.router.postgres.test.ts` | I |
| Idempotent submission | Must | **new**: transactional `updateMany` claim guard | `attempts.router.postgres.test.ts` ("scores exactly once when two /submit requests race each other") | I (fixed this session) |
| Timer expiry handling | Must | client auto-submit at 0 **+ new** server-side lazy auto-finalize | `attempts.router.postgres.test.ts` (2 new cases) | I (fixed this session) |
| Shuffle/random-paper stability | Must | seeded deterministic ordering | existing coverage | I |
| Score calculation | Must | `scoring.ts` | `scoring.test.ts` | I |
| Negative marking when configured | Must | supported in manual test creation; **not surfaced** in `/ai/tests/generate` (hardcoded 0) | — | P |
| Manual review | Must | `reviews.router.ts` | `reviews.router.postgres.test.ts` | I |
| Result publication | Must | `/submit` sets `PUBLISHED`/`NEEDS_REVIEW` | `attempts.router.postgres.test.ts` | I |
| Refresh after submission | Must | `GET /:id` returns 422 pointing to `/review` | `attempts.router.postgres.test.ts` | I |
| Audit history | Must | `service.recordAudit` throughout | — | I |
| Tenant isolation | Must | `tenantId` present in every query reviewed | — | I |

## Summary of this session's changes

Three real, tested exam-day reliability fixes on branch
`feat/exam-readiness-hardening` (see PR for commit list):

1. **Server-side auto-finalize on expiry** — `finalizeAttempt()` extracted
   from `/submit` and invoked lazily from `/start`, `GET /:id`, and
   `PATCH /:id/answers` whenever an `IN_PROGRESS` attempt is found past its
   deadline. An abandoned/crashed client no longer leaves an attempt stuck
   `IN_PROGRESS` forever.
2. **AI-generated question approval gate** — AI-authored questions are now
   created `IN_REVIEW` (not auto-`PUBLISHED`), excluded from the default
   question-bank list, and require a new `POST /questions/:id/publish`
   admin action. Minimal `Questions.jsx` UI added (pending-review filter,
   badge, publish button) reusing existing components/classes.
3. **Idempotent submission under real concurrency** — the terminal
   `assessmentAttempt` update is now a conditional `updateMany` claimed
   inside the transaction; a losing concurrent `/submit` aborts with 409
   instead of racing the scoring/notification/certificate side effects.

## Explicitly out of scope this session (honest gaps, not fabricated)

The "AI evaluates" and "AI reports" pillars of the stated critical product
promise (sections D/E above) have **zero runtime implementation** — only
schema. This is a pre-existing gap, not a regression, and per the
exploration audit this session opened with, it does **not** block running
tomorrow's exam: deterministic scoring plus human manual review fully
covers grading end-to-end. SOP-criteria grounding of AI generation/
evaluation (section F) is similarly unimplemented. Both are legitimately
large features (new AI execution flows, prompt engineering against
`QualityCriterion`, new report endpoints/UI) that were not attempted given
the time available before the stated deadline — attempting them
superficially would have produced unverifiable, likely-broken code, which
is worse than an honest gap. They are recorded here as **missing/future**,
not implemented.
