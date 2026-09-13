# Misconception Lab

Turn an everyday belief into an experiment you can challenge with an AI lab partner.

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

## The five features

- **Test and repair:** candidate JavaScript executes in an isolated browser worker across control boundaries, viewport sizes, and animation positions. Actual failures feed a bounded two-repair loop. A separate Astra review checks scientific consistency. Only a passing candidate replaces the current lesson. An expandable notebook records what happened.
- **Live lab partner:** GPT-Live-1 uses WebRTC for audio and Responses delegation for seven lab tools. Learners can record a prediction, change controls, run, compare, request a revision, or ask a follow-up by voice. Version checks prevent stale actions; stopping releases the microphone and closes the owned session.
- **Adaptive follow-up:** questions use the learner's prediction, optional written reasoning, confidence, actual results, and recent conversation. The original prediction remains tied to its original conditions.
- **Sketch/photo input:** draw in the built-in canvas or upload PNG/JPEG/WebP. The image is decoded/resized locally, interpreted by Astra, and shown with highlighted regions and uncertainty. The proposed claim is editable; edits made while interpretation runs are preserved.
- **What-if comparisons:** pin a run, change its controls, and compare the recorded outcomes. A requested new capability generates a checked lesson revision while retaining the baseline and its version.

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

Suggested team pass:

1. Predict, explain your hunch, run, then change air resistance.
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
| `public/live-client.js`, `live-protocol.js` | WebRTC lifecycle, transcripts and delegated tools |
| `server/learning.mjs` | Astra generation, repair, review, vision and tutoring |
| `server/live.mjs` | Trusted Live session creation and signed ownership for stop |
| `scripts/dev.mjs` | Loopback server, validated Host, request cancellation |
| `scripts/build.mjs` | esbuild bundle with embedded frontend assets |
| `docs/hackathon-implementation.md` | Architecture, feature contracts and milestones |

## Boundaries and deployment

Experiments are educational models, not empirical proof. Execution checks catch runtime/output failures; model review can still miss scientific mistakes. The iframe CSP blocks network access; a worker timeout terminates slow generated code. Generated code cannot access the parent UI or API key. This is not a general-purpose adversarial code hosting service.

Lesson history stays in the current browser; URL IDs are local shelf references, not cross-device sharing links. Images and transcripts are not persisted in the shelf.

`npm run build` emits a self-contained Cloudflare Worker at `dist/server/index.js`. Production currently expects a trusted `oai-authenticated-user-id` from private OpenAI Sites dispatch and an exact same-origin request. Another hosting platform needs a trusted authentication integration. Do not expose the local developer identity publicly. No deployment credentials or site IDs are included.

Live sessions use a server-side signed ownership token, with the API key as the signing secret unless `LIVE_SESSION_SECRET` is configured. Key rotation invalidates outstanding stop tokens; configure a stable separate server secret for deployed use. Session duration is bounded by server configuration. Interrupting speech does not inherently cancel backend work; the application separately guards cancellation and stale lesson versions.

## Current verification status

The automated suite/build, real browser sandbox harness, and focused UI flow with controlled remote responses have been verified locally. Real Astra generation, image quality, and live audio remain to be checked after configuring the API key as described above. No claim of live API verification is made.
