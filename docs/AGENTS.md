# Repository working instructions

These instructions apply to code changes, reviews, and documentation in this repository.

1. Read `docs/architecture.md` before changing code. Use it to locate the relevant modules and data flow. Update it in the same change when the architecture, data model, persistence, deployment, or test locations change.
2. Before starting a task, inspect the available `docs/skills/*/SKILL.md` files. Read and apply the skills that fit the actual task and technology. Follow their referenced rules when relevant. Do not apply unrelated skills just because they are present.
3. Use `docs/CODE_PRACTICES.md` as the repository's general coding guide. If local `docs/skills/` is absent in another checkout, continue with this file, the coding guide, and `docs/architecture.md`.
4. Preserve existing app behavior and data compatibility unless the task requires a change. Verify the affected code with relevant checks and report the results.
5. After each code correction, include a proposed commit name in the final response.

User instructions and applicable higher-priority instructions take precedence over these repository guidelines.

All paths above are relative to the repository root. This document was moved from the root at the user's request. Tools that discover only root-level AGENTS.md need this document explicitly included in their task context; README.md links to it.
