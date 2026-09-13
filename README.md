# Misconception Lab

Turn an everyday belief into an experiment you can challenge with an AI lab partner.

Youtube demo : https://youtu.be/SX8zoD2jKO8

## Run locally

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Open the printed loopback URL. The built-in falling-objects lab works without credentials.

### Add your API key

Create or open **`.env.local` in the repository root**, beside `package.json`. In the current local checkout, that file is:

```text
/Users/inder/Documents/Codex/2026-09-13/got-x20/misconception-lab/.env.local
```

Paste your existing key after the equals sign, replacing the example below:

```dotenv
OPENAI_API_KEY=your-api-key-here
```

Save the file, stop the dev server with `Ctrl+C` if it is running, and run `npm run dev` again. The dev command automatically loads `.env.local`; refresh the browser after restarting. The API project needs access to `gpt-6-astra` and `gpt-live-1`.

An existing `OPENAI_API_KEY` environment variable also works and takes precedence over the file. `.env.local` is excluded from Git, and the key stays on the server. Each teammate should create their own local file.

## Curiosity Gallery

The app opens on a gallery inspired by the proposed designer flow:

1. **Landing:** explore the collection or create your own experiment.
2. **Choose:** select **Does heavier mean faster?**, **Newton’s cradle**, **Back where we started?** (everyday math), or **Have your own hunch?**
3. **Create:** write a claim, add a photo, or sketch an idea. The draft and image stay in the open page when you navigate back. Building opens the lab with visible progress; cancelling returns to the draft.
4. **Lab:** predict and run beside the AI partner. Your original prediction folds into a compact record after the first run, leaving room for the step-by-step explanation and interactive experiment.

The header opens the current workbench, experiment shelf, or lesson planner. Browser Back/Forward preserves the current page state. Leaving the lab pauses playback and stops live voice; returning keeps your experiment and results. Legacy `#lesson-title` and `#history` links still open the right screen. Drafts survive screen changes within this tab, not a full reload.

While a What-if, sketch, photo, or custom idea is building, the lab shows the new question and progress. Previous controls, predictions, explanations, and measurements are hidden. A successful replacement starts with a fresh prediction and clears old What-if/partner drafts and visible conversation history. A retained What-if baseline appears in the comparison only after the new experiment is run; cancelling or a failed build keeps the previous experiment available.

## The five features

- **Test and repair:** candidate JavaScript executes in an isolated browser worker across control boundaries, viewport sizes, and animation positions. Actual failures feed a bounded two-repair loop. A separate Astra review checks scientific consistency. Only a passing candidate replaces the current lesson. An expandable notebook records what happened.
- **Live lab partner:** GPT-Live-1 uses WebRTC for audio and Responses delegation for seven lab tools. Learners can record a prediction, change controls, run, compare, request a revision, or ask a follow-up by voice. Version checks prevent stale actions; stopping releases the microphone and closes the owned session.
- **Adaptive follow-up:** questions use the learner's prediction, confidence, actual results, and recent conversation. The original prediction remains tied to its original conditions.
- **Sketch/photo input:** draw in the built-in canvas or upload PNG/JPEG/WebP. The image is decoded/resized locally, interpreted by Astra, and shown with highlighted regions and uncertainty. The proposed claim is editable; edits made while interpretation runs are preserved.
- **What-if comparisons:** pin a run, change its controls, and compare the recorded outcomes. A requested new capability scrolls back to the experiment and shows building, checking and repair progress inside its visualization. The checked revision retains the baseline and its version. **Cancel and return** keeps the current experiment available.

## Ball-drop demo

Choose **Explore experiments → Does heavier mean faster?**, make a prediction, and run. The drop chamber has equal-size balls, a fixed metre ruler, motion trails, speed readouts, and an elapsed simulation clock. After your first run:

- Switch between **Vacuum** and **Add air** to replay the same conditions with or without idealized linear drag.
- Drag **Release height** from 1–10 m (or use its arrow keys), then release to drop both balls together.
- **Match their masses** or **Swap masses** to test whether mass explains the difference.
- Use **Jump to a moment** to pause at release or either landing. Pin a result before changing conditions to compare it; **Reset conditions** restores the original 5 m vacuum setup.

Playback is slowed for inspection; the elapsed clock shows model time. Final measurements stay fixed while scrubbing. These interactions run locally, and the original prediction is retained. The model ignores bounce and stops each ball at ground contact.

## Newton’s cradle

The **Motion & Energy · Newton’s cradle** challenge replaces Space & Science. Open it from the experiment chooser, shelf or lesson planner, predict what swings out, and run. Change the release height, the mass of all five balls, or the number of swings to replay the transfer. Playback controls pause or scrub the scene. The energy bar shows energy stored in height and motion; the model assumes identical balls, ideal elastic transfer and no energy loss. No API key is needed for this reference experiment.

## Explain it beside the experiment

After predicting and running either demo, choose **Walk me through it** in **Your lab partner**. The explanation appears beside the visualization. **Next step**, **Back** and **Replay step** apply the demonstrated conditions and pause the scene at the relevant moment. Manual changes reset the guide so an old explanation does not describe new conditions.

- **Falling objects:** shared release → vacuum drop → pause at the heavier ball's landing with air → equal masses with air.
- **Everyday math:** click **Back where we started?** to open the local percentages lab. Follow **$100 → $50 → $75**, then test the 100% increase needed to restore the discounted $50 to $100. After predicting, enter your own starting price and percentages and choose **Try my numbers**. Presets include **20% off · 25% up** and **Half price · then double**. The three step buttons pause at the starting, discounted or final price. Money bars share one dollar scale: hatching shows removed money, mint shows added money, and a dashed marker keeps the original price visible.

The app checks the demonstration steps in its sandbox before requesting Astra narration through `/api/walkthrough`. Astra explains those results; the app chooses and validates the control changes. Without a configured key, or if the request fails, the panel explicitly labels its reference explanation. This is a text walkthrough with synchronized visualization; **Start live** remains the separate voice conversation. Final measurement cards summarize the complete run even while a guide displays an intermediate frame. Both demo experiments are available without generation or an API key.

## Plan a lesson

Use the **Plan a lesson** tab beside **Experiment**. Switching tabs keeps your current experiment and form edits.

1. Enter a topic, grade and subject, with optional learning goals and observed beliefs. Or choose **Import screenshot** to extract those fields from a PNG/JPEG/WebP teaching screenshot, then review the highlighted source regions and edit the interpretation.
2. Choose **Find experiments**. Edit a suggested claim, its proposed experiment, or the question and reasoning under **Customize**. **Build this experiment** uses that edited proposal and teaching context, runs the existing checks/repair workflow, then opens the accepted lesson in **Experiment**.
3. For immediate exploration without an API key, open **Buoyancy and density**, **Converging lenses**, or **Newton’s cradle**. Each runs its browser checks before opening. Their calculations also have independent numerical reference tests; these are labeled reference models.
4. Make a prediction and run. Use **Play/Pause**, the **Animation** slider and speed selector to examine the scene. Playback changes the view while measurements retain the final result. **Reset conditions** restores the initial controls and keeps the original prediction. You can still pin and compare runs.

The buoyancy model shows force balance and submerged fraction; its playback is a force reveal, not a physical settling trajectory. The lens model shows signed real/virtual image properties and explicitly handles the focal-plane limit. Read each model's **Conditions & assumptions** for its scope.

AI planning and screenshot interpretation need the API key described above. Input images are resized locally and sent to OpenAI only after import. New field edits made while interpretation runs are preserved. The teaching brief travels with generated lessons, repairs, revisions and follow-up tutoring. Planner drafts currently last for the open page session; accepted generated lessons use the existing local shelf.

## Focused verification

```sh
npm test
npm run build
```

The tests cover the core failure and state boundaries. They substitute only external HTTP or browser media/event boundaries where needed; they do not prove live model access or speech quality.

For real browser isolation checks, open `/sandbox-check.html` and choose **Run checks**. This harness is excluded from production.

For a short full-flow check without API charges:

```sh
npm run verify:browser
```

This separate loopback server uses **controlled OpenAI responses**. Its first generated lesson deliberately throws so the real browser execution/repair flow can be checked. It also provides image interpretation, an adaptive question, and a gravity revision. Live voice is deliberately unavailable there. It is a verification fixture, not a demo of live generation.

The fixture also supplies planner cards and teaching-brief extraction. Its labeled **Use sample teaching screenshot** helper sends a synthetic PNG through the real file-change handler and image decoder, so the import flow can be checked without automating a native file picker. These helpers are absent from the normal app and production build.

Suggested team pass:

1. Predict, set your confidence, run, then change air resistance.
2. Pin a baseline and compare; request a new condition such as gravity.
3. Draw/upload a diagram, correct the suggested claim, and build.
4. Answer an adapted question, then ask about one of its options.
5. With a configured key, start voice, interrupt, change a control, and stop. Verify microphone capture stops.

## Structure

| Path | Responsibility |
|---|---|
| `public/lab.js` | Workbench integration and versioned tool bridge |
| `public/lab-state.js` | Immutable predictions, parameters, runs and comparisons |
| `public/lab-pipeline.js` | Build → execute → review → repair workflow |
| `public/experiment-host.js`, `experiment-checks.js`, `experiment-frame.html` | Isolated execution and actual browser checks |
| `public/image-input.js`, `lab-ui.js` | Image/sketch input and presentation helpers |
| `public/planner.js`, `planner-schema.js`, `planner.css` | Lesson-planning tab, editable screenshot context and idea cards |
| `public/experiment-starters.js` | Original buoyancy and thin-lens reference models |
| `public/playback.js` | Serialized animation playback, pause, scrubbing and speed |
| `public/live-client.js`, `live-protocol.js` | WebRTC lifecycle, transcripts and delegated tools |
| `server/learning.mjs` | Astra generation, repair, review, vision and tutoring |
| `server/live.mjs` | Trusted Live session creation and signed ownership for stop |
| `scripts/dev.mjs` | Loopback server, validated Host, request cancellation |
| `scripts/build.mjs` | esbuild bundle with embedded frontend assets |
| `docs/hackathon-implementation.md` | Architecture, feature contracts and milestones |

## Boundaries and deployment

Experiments are educational models, not empirical proof. Execution checks catch runtime/output failures; model review can still miss scientific mistakes. The iframe CSP blocks network access; a worker timeout terminates slow generated code. Generated code cannot access the parent UI or API key. This is not a general-purpose adversarial code hosting service.

Lesson history stays in the current browser; URL IDs are local shelf references, not cross-device sharing links. Images and transcripts are not persisted in the shelf.

The Sites address is [misconception-lab.likhariinder.chatgpt.site](https://misconception-lab.likhariinder.chatgpt.site). The homepage and built-in experiments are public. For AI features, click **Sign in with ChatGPT** in the header and use your own ChatGPT account; no personal API key is needed. Sites handles sign-in and returns you to the same page. The header shows **Signed in** after authentication, or **Local preview** on the development server. Manage site access through Sites sharing settings.

For the hosted app, set `OPENAI_API_KEY` as a **secret** in the Site's runtime environment variables, then deploy a saved version to apply the change. `.env.local` is only for local development; it is never bundled or uploaded. The existing key is configured for the initial Sites deployment. Keep API keys out of `.openai/hosting.json`, frontend code, and Git.

`npm run build` emits a self-contained Cloudflare Worker at `dist/server/index.js` and copies the Site manifest to `dist/.openai/hosting.json`. The source manifest records the existing Site so later deployments reuse it. AI routes expect a trusted `oai-authenticated-user-id` from OpenAI Sites dispatch and an exact same-origin request. `/api/status` exposes only a sign-in boolean, not the user's identity. Another hosting platform needs a trusted authentication integration. Do not expose the local developer identity publicly.

Live sessions use a server-side signed ownership token, with the API key as the signing secret unless `LIVE_SESSION_SECRET` is configured. Key rotation invalidates outstanding stop tokens; configure a stable separate server secret for deployed use. Session duration is bounded by server configuration. Interrupting speech does not inherently cancel backend work; the application separately guards cancellation and stale lesson versions.

## Current verification status

The automated suite/build, real browser sandbox harness, and focused UI flow with controlled remote responses have been verified locally. Real Astra generation, image quality, and live audio remain to be checked after configuring the API key as described above. No claim of live API verification is made.

### Hackathon debug panel

Click **</> Astra debug** (bottom right) to open the side console. It shows actual
Astra request start/end timings, errors with server reference IDs, generated
JavaScript, sandbox test cases, repair/review stages, and experiment runs.
Code appears when the response completes; this is not token streaming or model
reasoning. The latest code is expandable and may reveal the lesson's answer.
The panel captures up to 180 events in memory for the current tab, without request
bodies, credentials, or uploaded images. **Clear** resets the displayed history;
**Follow logs** controls automatic scrolling. Close it with the close button or
Escape. On small screens it opens as a drawer. Server logs remain separate.

### Discovery Lab design

The main site uses the Discovery Lab visual direction: ivory backgrounds, cobalt
primary actions, colorful subject cards, and a prediction-first workbench. The
planner, saved lessons, comparison, and debug drawer share the updated layout.
The falling-object reference includes labeled mass lanes, trajectories, shaded
spheres, and physical elapsed time. Buoyancy and lens references have clearer
scene grouping; numerical models are unchanged. New Astra generations receive
illustration and composition guidance. Existing saved code is not rewritten.
