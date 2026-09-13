# Lesson planner implementation plan

Approved by the user: implement planner, teaching-screenshot import, buoyancy/lens starters and playback controls, end to end, as a new on-screen tab. Design reference: the research-inspired enhancement brief in the workspace outputs folder.

## Constraints

- Keep vanilla JS, existing sandbox and Worker build. No new framework or dependency.
- Preserve existing experiment, voice, repair and comparison behavior. No secrets in frontend or Git.
- Add accessible Experiment / Plan a lesson tabs. Switching tabs preserves the current experiment and in-progress form.
- All model output is editable plain text. An imported screenshot supplies data, never instructions.
- Keep verification concise: focused contract/model/playback checks and three complete browser journeys.
- Keep this dedicated checkout and branch. Separate modules allow API, starters and playback work to run independently; root integrates shared UI files.

## Contracts and tasks

1. Planner API and shared schema (`server/learning.mjs`, `public/planner-schema.js`, `test/planner.test.mjs`).
   - Export `validateBrief`, `validatePlan`, `validateBriefImport` plus JSON schemas needed by server.
   - Brief: `{topic,grade,subject,learningGoal,observedBeliefs,includeQuickChecks}`. Text limits: topic 2–120, grade 1–40, subject 1–60, learningGoal 0–500, observedBeliefs 0–1600; includeQuickChecks boolean.
   - `POST /api/plan {brief}` -> `{brief,cards:[{id,claim,rationale,quickCheck,experiment,variable}]}`; 1–5 unique card ids, claim 8–600, rationale <=500, quickCheck <=500 (can be empty when checks disabled), experiment <=600, variable <=100. Cards represent possible beliefs, never diagnoses.
   - `POST /api/import-brief {image}` -> `{brief,regions:[{field,label,x,y,width,height}],uncertainty}`. Normalized visible source regions, maximum 8. Unknown required context must have an explicit editable fallback rather than inferred certainty. Reuse existing image and security boundaries.
   - Optional `brief` on lessons, repairs, revision and tutoring. Validate it, use it in prompts, return it in generated envelopes. Absent brief must preserve previous API behavior.
   - Optional `experimentRequest` on lessons, at most 2400 characters, carries the selected card's edited proposal, variable, reasoning and quick question into generation.
   - Verify malformed boundaries, image prompt/schema, grade continuity and missing-key behavior without remote calls.
2. Original reference starters (`public/experiment-starters.js`, `test/experiment-starters.test.mjs`).
   - Export `experimentStarters`, array of two complete existing-schema lesson envelopes with source `curated`, version 1, stable ids, createdAt and `catalog:{topic,grade,description,tags}`.
   - Buoyancy: object density, fluid density and volume; show weight/buoyant force, submerged fraction and outcome under explicit assumptions. Model actual floating equilibrium and fully submerged sinking cases accurately; no unsupported bottom-contact/net-force claims.
   - Lens: object distance, focal length and object height; principal rays, real/virtual image and signed magnification. Handle focal-plane limit explicitly with readable metrics and finite drawing coordinates.
   - Both run with existing mark types, widths 320/720, height 340 and progress 0/.5/1. No remote assets. Prediction names fixed initial conditions.
   - Add a few independent numerical reference tests and runtime-matrix validation. Mark reference checks honestly; no fake model-review receipt.
3. Playback module (`public/playback.js`, `test/playback.test.mjs`).
   - Export `createPlayback({render,onChange,onError,duration=3000,now,schedule,cancel})`; returns `{play,pause,seek,setSpeed,reset,destroy,getState}`. State `{progress,playing,speed}`. render(progress) async; serialize calls, no stale frame after reset/destroy, coalesce seeks; last desired frame wins.
   - `play()` resumes or restarts at 0 if complete; `pause()` retains position; `seek(0..1)` pauses; `setSpeed` allows .25/.5/1/2; reset cancels pending animation and returns progress 0 without calling render; destroy cannot render again.
   - This module never mutates measured result/state. Root supplies the current host and cancels playback before changes to lesson/params.
   - Verify pause/seek/speed and async stale-frame behavior with a controllable clock. Keep tests short.
4. Root UI and integration (`public/index.html`, `public/planner.js`, `public/planner.css`, `public/lab.js`, `public/image-input.js`).
   - New accessible tabs with keyboard navigation and dedicated planner panel. Teacher form, import preview/regions, editable misconception cards with Build experiment actions, curated starter cards.
   - Extract/export reusable image decoding `prepareImage(file)` from image-input module. Import operation must not overwrite form edits made after upload started. Show uncertainty and status; cancellation/clear release busy UI.
   - `setupPlanner({request,onBuild,onOpenStarter,onBusy,isLabBusy})` returns `{setBusy,cancel}`. onBuild receives `{claim,brief,experimentRequest}`; onOpenStarter receives starter envelope. Root handles sandbox validation, switches back to Experiment only after acceptance and keeps context for revision/tutoring.
   - Playback toolbar appears after first successful run: Play/Pause, speed select, timeline and Reset conditions. Final measured results remain invariant while scrubbing. Controls are paused/invalidated before parameter or lesson changes. Reset conditions retains original prediction and computes results at original defaults.
   - Starter opening runs real local preflight, independent of API availability; errors preserve last accepted lesson.
5. Integration verification, README and commit.
   - Extend only controlled HTTP fixture for planner/import. Real browser: plan -> edit card -> build -> prediction/run; import -> edit brief -> plan; both curated models -> run -> playback/compare. Include narrow viewport check.
   - Run npm test, npm run build, git diff --check once after changes stabilize. Review the final diff for correctness; address material issues. Commit work per continuing user preference, keep .env.local excluded. Live AI verification depends on configured key and must be reported separately.

## Progress

- Implemented the new tab, editable planner, screenshot import, both original reference models, and serialized playback without additional dependencies.
- Final verification after integrating the remote Astra validation fixes: 76 tests passed; production build contains 20 frontend assets; whitespace checks passed.
- Controlled-response browser flow: plan → edit claim/proposal/question/variable → build → actual sandbox failure and repair → predict/run. Teaching grade and subject remain attached to the accepted lesson.
- Screenshot flow used a labeled fixture helper to send a synthetic PNG through the actual file-change handler and decoder. Source regions appeared, and a grade edit made during interpretation was preserved. Native file-picker automation was not used.
- Normal app: each starter passed 54 browser execution cases. Checked buoyancy force/volume comparison and reset, lens real/virtual/focal-plane cases, pause/scrub/speed, and a 390px mobile layout without horizontal overflow.
- Focused review fixes cover editable card details, preserving the previous playback context on a failed lesson load, preventing actions during pending condition changes, and redrawing after tab/viewport changes.
- Live AI verification remains pending a configured API key. Controlled responses verify integration, not live model quality. The key belongs in the ignored root `.env.local`; setup remains documented in README.
