# Curiosity Gallery integration

Use the supplied designer flow as the direction for the existing app: a warm white gallery, cobalt actions, navy text, and objects that represent the three local experiments. The learner should see one clear next action on each screen.

1. Landing: “A little doubt. A new discovery.” with original illustrations of falling objects, Newton’s cradle, and everyday percentages. Explore opens the chooser; Create opens the existing hunch form.
2. Choose: four rows for falling objects, Newton’s cradle, everyday math, and making your own experiment. Reference rows open the existing models and keep their prediction-first behavior.
3. Create: the existing claim, photo, and sketch controls in a dedicated screen. Keep the draft when navigating away. Building opens the lab with progress inside the experiment; failures retain the draft.
4. Lab: a focused experiment beside the existing partner, prediction, guided explanation and follow-up controls. Keep playback, custom math/drop controls, What-if comparison and loading, and the experiment notebook.
5. Supporting screens: keep the lesson planner and experiment shelf reachable from the shared header.

Implement static screen containers in index.html, a small hash navigation module in flow.js, and scoped visual styles in flow.css. Integrate screen changes into existing lesson loading instead of rebuilding experiment state. Pause playback when leaving the lab; do not destroy the sandbox or draft. Support browser Back/Forward and existing lesson/history links.

Do not run tests or browser checks in this iteration, per the user’s request. Do not commit or push these changes.
