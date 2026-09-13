# Misconception Lab implementation plan

Approved scope: self-testing and repair, GPT-Live-1 tutor, adaptive follow-up, sketch/photo input, and what-if comparisons. Build in the dedicated local clone on `codex/hackathon-lab`. No deployment or posting is included.

## Architecture

Retain the plain JS frontend, Responses API/Astra generation, and sandboxed iframe/worker. Execute candidate lessons in the real browser sandbox against a parameter/viewport test matrix, then request an independent scientific review. Send observed failures to a repair endpoint, capped at two repairs. Publish only the passing candidate into the learner's workbench. This keeps generation compatible with the existing Worker deployment and does not require adding hosted agent infrastructure solely for an award category.

GPT-Live-1 uses its documented browser WebRTC transport with Responses delegation and a narrow lab tool surface. The application executes tools against versioned state and returns actual results. Vision uses Astra image input and an editable extracted claim. Adaptive tutoring consumes the learner's reasoning and observed results. Comparisons pin immutable parameter/results snapshots.

## Shared contracts

- Preserve `lessonSchema` and `validateLesson`; optional envelope metadata: `id`, `version`, `parentId`, `source`, `model`, `createdAt`, `lesson`, `validation`.
- All displayed model output is plain text. Generated code runs only in the isolated iframe/worker. Never evaluate it in the Node server or parent page.
- API routes retain trusted server identity and same-origin validation. The local server stays loopback-only. API secrets remain server-side.
- `POST /api/lessons {claim}` returns a lesson envelope as today.
- `POST /api/repair {claim,lesson,failures:[{name,detail}],attempt}` returns a replacement envelope. Attempt must be 1 or 2.
- `POST /api/revise {lesson,request,params}` returns a new lesson envelope for the requested extension.
- `POST /api/review {lesson,runs:[{params,viewport,metrics,summary}]}` returns `{passed,summary,issues:[{name,detail}]}`. This is scientific consistency review, not a claim that the server executed code.
- `POST /api/vision {image,note}` accepts a bounded image data URL, returns `{claim,observations:[string],regions:[{x,y,width,height,label}],uncertainty}`. Region coordinates are normalized 0–1.
- `POST /api/tutor {lesson,selectedIndex,reason,confidence,params,results,history,message}` returns `{message,reasoningFocus,question:{prompt,options,correctIndex,feedback}}`. `history` is bounded `{role,text}` entries; `message` optional.
- Live module exports `handleLiveRequest(request,env,fetcher=fetch)` returning a response or null for unrelated routes; client exports `createLivePartner({getState,onTool,onStatus,onTranscript})` with `start()`, `stop()`, `sync()`.
- Live application tools: `read_lab`, `record_prediction`, `set_control`, `run_experiment`, `revise_experiment`, `ask_followup`, `compare_runs`. State includes `lessonId`, `version`, `phase`, controls and revealed results. Read state never includes answer indices or unrevealed results. Mutating tools include lessonId and version.
- `SandboxExperiment` in `public/experiment-host.js`: constructor(container,{title}), `load(code,{signal})`, `run(params,viewport,{signal}) -> {marks,metrics,summary}`, `destroy()`. Tests run the same iframe as visible workbench; container is a real DOM element.
- `preflightLesson(lesson,run,{signal,onProgress})` in `public/experiment-checks.js` returns `{passed,checks:[{name,passed,detail}],runs:[{params,viewport,metrics,summary}]}`; `run` is an injected sandbox runner. Pure test-matrix/checking code must be Node-testable.
- `LabState` in `public/lab-state.js` stores the accepted envelope, original prediction/conditions, current parameters, revealed results and optional pinned run. Validate finite controls, steps, unknown keys and version identity before mutations. Retain original answers on parameter changes.

## Tasks and ownership

1. API generation/review/repair/vision/adaptive tutor: implement `server/learning.mjs`, own `server/api.mjs`, meaningful API tests in `test/learning.test.mjs`. Reuse external fetch injection; mock only OpenAI boundary. Preserve old tests. Return explicit missing credentials, refusals, invalid outputs and bounded input errors. Do not edit frontend or Live files.
2. Live transport: implement `server/live.mjs`, `public/live-client.js`, `public/live-protocol.js` and tests. Fetch official current Live quickstart/delegation before coding. Own only these modules. Check session ownership, terminate session/audio on stop, avoid stale tool results, implement permission/error/disconnect states.
3. Sandboxed execution and state: implement host/check modules and state plus renderer compatibility updates. Meaningful tests for checking/limits/state; verify browser sandbox checks. Own `public/experiment-host.js`, `public/experiment-checks.js`, `public/lab-state.js`, `public/experiment-frame.html`, related tests. Prevent pre-prediction answer leakage by keeping the experiment hidden until run.
4. Integration and interface: root owns HTML/CSS/lab orchestration, image upload/sketch UI, immutable comparison cards, generation/repair progress, tutor and voice controls, shelf, dev/build changes. Expose the documented tool bridge. Prevent stale generation/tutor/image responses from updating newer lessons. Preserve last accepted lesson on failure and cancellation. Build pipeline handles new ESM server modules.
5. Verification: full automated suite/build; real browser desktop/mobile flows; controlled failure/repair; API/live smoke once existing key location is provided; independent review, fix findings, update README and delivery record. Clearly separate mocked, browser and live verification.

## Acceptance cases

- An executable candidate with a runtime error, nonfinite drawing output or failed checks is repaired from actual failure details; at most two repairs; exhausted attempts preserve current lesson.
- Sample initial/min/max parameters at responsive widths and animation progress. A timeout terminates the worker. Failed computations do not leak partial results into learning state.
- Learner makes a prediction/reason before results; initial canvas cannot reveal answer. Outcomes and feedback are shown only after successful run.
- Tutor returns a new question grounded in learner reason and computed conditions. Stale responses ignored; static built-in question explicitly available offline.
- Image upload or drawing yields a visible editable claim and highlighted regions; user confirms by generating. Oversized/unsupported files and image decode failures are explicit.
- Pin a baseline, change conditions and compare visible labeled results. New experiment requests pass the same checks; reference survives revision but is clearly identified as a different lesson version.
- Voice starts only on user action, records visible transcript, performs acknowledged versioned actions, handles microphone rejection and disconnect, and closes media/session on stop.
- Baseline and browser shelf work without credentials; all model-backed features visibly indicate setup required rather than substituting scripted output.

## Progress

- Planning: completed; implementation authorized by user.
- Ruling: Use the dedicated fresh clone with a feature branch, keeping paths stable for the user. No shared checkout changes exist to isolate further.
- Ruling: Browser-executed agent loop is the minimal compatible execution environment for these five requested features; no Agents API award was requested in this implementation scope.
- Ruling: Reuse user's existing key, per their prior confirmation. Created an ignored repository-root `.env.local` for the user to populate, with setup instructions in README.
- Implementation: all five requested features are integrated. Independent review findings have been resolved.
- Verification: 56 automated checks pass, the Worker build succeeds, and 13 real browser sandbox checks pass. Focused browser flows cover prediction/run, pinned comparisons, actual runtime failure and repair, adaptive follow-up, versioned what-if revision, sketch interpretation, shelf reload, and mobile layout. AI responses in these browser checks use an explicitly controlled HTTP fixture; generated code still executes in the real sandbox.
- Remaining external verification: real model generation, image interpretation, and spoken GPT-Live-1 conversation require the existing key to be configured. Live transport and tool handling have automated boundary tests, but have not been verified against a real session.
- Team iteration: keep testing to the five short flows in README. Expand checks only when team feedback exposes a concrete issue.

## UI direction

Preserve the laboratory's warm paper and forest-green palette. Make the experiment the focal object, prediction an explicit numbered step, and the tutor a calm conversational column. Use serif display type sparingly for lesson/claim titles and system sans for controls; 4px spacing base, 16px tool-panel padding, soft tonal surfaces and restrained borders. Test receipts appear as a compact experiment notebook, not fake agent avatars. Drawing/upload, voice, and what-if are real controls with pending, failure and disabled states.
