# Roadmap: silmaril-0.5

This folder is a parallel roadmap. `GOAL.md` has the outcome. Each node is a folder under `nodes/`.

Rules for agents working on a node:

- Work only on your own node. Edit files inside your brief's owned paths and your own `nodes/<id>/` folder.
- Do not edit other briefs, `status` fields, contracts or `GOAL.md`. The orchestrator owns them.
- If a contract is wrong, write `contracts/<name>.change-request.md` and adapt locally. Do not edit the contract.
- Keep notes in your `log.md`. Finish by writing `outcome.md` from the template.
- Read the outcomes of your direct dependencies. Do not read other nodes' logs.
- The runtime entries (`src`, `store`, `solid`) must not gain dependencies.
- If you add a dependency, say so in your outcome: lockfile changes merge one at a time.
- Add a changeset when published behavior changes (see the changesets skill).

Script: `python3 <skill>/scripts/plan.py docs/roadmaps/silmaril-0.5 context <id>` lists the files to load for a node.
