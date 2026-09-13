# Misconception Lab

Turn an everyday belief into an interactive experiment with GPT-6 Astra.

Enter a claim, predict what will happen, explore a visualization with adjustable controls, and answer a follow-up question. Astra generates new experiment JavaScript, questions, explanations, and model assumptions inside a consistent learning interface.

## Features

- Claim entry with examples across physics, probability, and mathematics.
- Server-side OpenAI Responses API integration using `gpt-6-astra` and structured outputs.
- Original generated experiment code, executed in an isolated Web Worker inside a sandboxed iframe.
- Prediction, replay, adjustable controls, measurements, explanations, and transfer questions.
- Browser-local shelf for the eight most recent generated lessons.
- A built-in falling-objects example that works without an API key.
- Responsive layout and reduced-motion support.

## Quick start

Requires Node.js 22 or later. No package dependencies are needed.

```sh
npm run dev
```

Open the loopback URL printed by the server.

For live generation, configure `OPENAI_API_KEY` in your local environment or an ignored `.env.local` through a secure credential setup flow. The API project must have access to `gpt-6-astra` and available API credits. Credentials are never sent to the browser.

```sh
npm test
npm run build
```

The build produces a self-contained Cloudflare Worker at `dist/server/index.js` with embedded frontend assets and API routes.

## Project structure

| Path | Purpose |
| --- | --- |
| `public/` | Lab UI, lesson contract, built-in example, isolated canvas renderer |
| `server/api.mjs` | OpenAI Responses API integration and request validation |
| `scripts/dev.mjs` | Loopback-only development server |
| `scripts/build.mjs` | Worker build |
| `test/` | API tests and browser sandbox verification harness |

## Hosting and authentication

The production API expects the trusted `oai-authenticated-user-id` header supplied by private OpenAI Sites dispatch, and checks the request Origin. A different hosting platform requires a trusted server-side authentication integration before enabling generation. The local development server supplies a development identity only while bound to `127.0.0.1`.

No existing Site project identifiers, deployment credentials, or API keys are included in this repository. Configure hosting separately and store the production key as a server-side secret.

## Validation and current status

The UI, built-in experiment, and API integration are implemented. Live Astra generation has not yet been verified with an API key. Missing configuration is displayed explicitly; it never silently substitutes a scripted response for a generated lesson.

The six automated API tests cover auth and origin validation, claim validation, missing credentials, the Responses request contract, malformed outputs, refusal, and upstream failure. They stub only the external HTTP boundary and are not evidence of a live API request.

For browser checks, open `/sandbox-check.html` on the local development server. Its four checks cover valid rendering, blocked access to the parent DOM, blocked network requests, and timeout of infinite code. This harness is excluded from production builds.

## Model and execution boundaries

Generated code returns bounded canvas drawing primitives and measurements. It cannot access the parent page, browser storage, or the API key. The sandbox CSP blocks network access, and slow computations are terminated. This is an educational POC, not a general-purpose adversarial code-hosting service. Generated models may contain mistakes; assumptions are shown alongside each experiment.

The built-in example uses a five-metre drop, Earth gravity of 9.81 m/s², and optional equal linear drag of 0.3 kg/s for equal-size spheres. Both masses land in 1.01 seconds in a vacuum; with drag, the 100 g and 1000 g spheres take approximately 1.86 and 1.06 seconds.

Saved lessons stay in the current browser. Lesson URLs identify local shelf entries and are not cross-device sharing links.
