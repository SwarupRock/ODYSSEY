# AGENTS.md — Permanent Instruction Manual for AI Coding Assistants & Developers

**Project Name:** ODYSSEY  
**Repository:** https://github.com/SwarupRock/ODYSSEY  
**Genre:** 2D Cinematic Action-Adventure based on Homer's *Odyssey*  
**Core Technologies:** JavaScript (ES Modules), HTML5 Canvas 2D, Web Audio API, CSS, Android Java WebView, Progressive Web App (PWA)  
**Target Platforms:** Android (Native APK via Android Studio) and Web (PWA / modern browsers)  
**Development Philosophy:** Incrementally modernise the existing engine while keeping the game continuously playable. Never discard working foundations for an unverified total rewrite.

---

## A. Authoritative Documentation Hierarchy

The repository maintains an explicit hierarchy of authoritative documents. Every developer and AI assistant must consult these documents and adhere to their respective authority:

1. **`Game Design Document.txt` (GDD)**
   - *Authority:* Creative, narrative, artistic, character, and chapter-level design authority.
   - *Defines:* The seven-section campaign structure (Prologue, Chapters I–VI), canonical narrative events, themes of hubris and pride, visual aesthetics (Greek black/red-figure pottery palette), character rosters, equipment lore, boss encounters, and dialogue directions.

2. **`Final Gameplay Systems Specification & Technical Implementation Plan.txt` (Gameplay Systems Spec)**
   - *Authority:* Gameplay mechanics, systems specification, and technical execution authority.
   - *Defines:* Shared movement (run, grounded jump, directional dodge), combat rules, lightweight stamina parameters, enemy AI states, equipment effects, stealth, sailing, alchemy, underworld trials, rhythm mechanics, versioned save persistence, technical phases, and testing requirements.

3. **`TECHNICAL_AUDIT.txt`**
   - *Authority:* Verified technical architecture, code inspections, root-vs-Android synchronisation diffs, bugs, architectural risks, and implementation readiness.
   - *Role:* Documents the reality of the existing codebase. Distinguishes what is already built from what is planned.

4. **`DEVELOPMENT_LOG.txt`**
   - *Authority:* Persistent chronological record of actual completed tasks, verified tests, file modifications, blockers, and next steps.
   - *Role:* Provides the ground truth of project history across sessions, IDEs, and assistants.

5. **`AGENTS.md`** (This file)
   - *Authority:* Permanent operational rules, workflow governance, session procedures, and design consistency guidelines.

---

## B. Mandatory Session-Start Procedure

Before beginning any development task, every AI assistant or human developer must execute the following sequence without skipping steps:

1. Read `AGENTS.md`.
2. Read `DEVELOPMENT_LOG.txt` (especially the most recent entry and current phase).
3. Read relevant sections of `Game Design Document.txt`.
4. Read relevant sections of `Final Gameplay Systems Specification & Technical Implementation Plan.txt`.
5. Read relevant sections of `TECHNICAL_AUDIT.txt`.
6. Inspect the relevant current source files in `js/`, `scenes/`, and `android/`.
7. Identify the current development phase (e.g., Phase 0 Baseline Audit, Phase 1 Input/Lifecycle, etc.).
8. Identify the last completed task and any blockers.
9. Identify incomplete and pending tasks.
10. Confirm the exact next appropriate task with the user before introducing gameplay modifications.

*Do not rely on previous chat context or assumptions.*

---

## C. Design Consistency Rules

- **Never contradict the GDD or Gameplay Systems Specification.**
- **Never implement an unapproved design change.**
- **Do not treat proposed features as existing functionality.** Clearly distinguish between what is already running in `v1.0.0` and what is specified for future phases.
- **Preserve the approved seven-section structure:**
  - Prologue: The Fall of Troy
  - Chapter I: Polyphemus's Cave
  - Chapter II: The Bag of Winds
  - Chapter III: Circe's Island (Aeaea)
  - Chapter IV: The Underworld (Hades)
  - Chapter V: Sirens, Scylla & Charybdis
  - Chapter VI: Return to Ithaca
- **Maintain narrative continuity:** Odysseus's hubris, the six crewmen lost to Scylla, the unmoving olive-tree bed, and Homeric canon are non-negotiable narrative anchors.
- **Preserve dual Android and Web compatibility:** Every gameplay feature must work under touch/joystick on mobile Android WebView as well as desktop browser keyboard/mouse.
- **Prefer small, isolated changes:** Deliver verified incremental commits rather than sweeping multi-system overhauls.
- **Avoid unnecessary engine rewrites:** Evolve the existing Canvas 2D engine; do not swap in third-party engines (Phaser, Pixi, Three.js) without explicit written approval.

---

## D. Development & Code Modification Rules

1. **Inspect before editing:** Check references and call-sites across `js/`, `scenes/`, `styles.css`, and `index.html`.
2. **Understand dependencies before modifying shared systems:** `js/engine.js`, `js/scenefw.js`, `js/ui.js`, `js/art.js`, `js/audio.js`, and `js/voice.js` are consumed by all 7 chapters.
3. **Make the smallest safe changes:** Keep commits and diffs focused on the objective of the current task.
4. **Preserve existing functionality:** Never break existing chapter scenes while updating engine code.
5. **Avoid unrelated refactoring:** Do not reformat or clean up unrelated code blocks.
6. **Never delete existing features without approval:** Pruning or replacing existing mechanics must be documented and pre-approved.
7. **Zero external media assets constraint:** The core design mandates that sprites and visuals are procedural Canvas 2D vector code (`js/art.js`), procedural audio is Web Audio API (`js/audio.js`), and voiceovers use either pre-recorded hashed clips (`audio/voices/`) or native TTS fallback (`js/voice.js`). Do not add external bitmap textures or bulky audio libraries.
8. **Keep root and Android assets synchronised:** When editing `index.html`, `styles.css`, `sw.js`, `js/*`, `scenes/*`, `fonts/*`, or `audio/*`, the packaged copies in `android/app/src/main/assets/` must also be kept in sync prior to release builds.
9. **Test actual behaviour before declaring success:** Run tests in browser or emulator. Never report a test has passed without having verified it.

---

## E. Mandatory Development Logging

After every meaningful completed change, update `DEVELOPMENT_LOG.txt` following the standardised entry format:

```text
--------------------------------------------------
ENTRY [NUMBER] — [TASK TITLE]

Date: YYYY-MM-DD
Status: [NOT STARTED | IN PROGRESS | COMPLETED | BLOCKED | NEEDS TESTING]
Development phase: [Phase Number and Name]

Objective:
[What was intended]

Work completed:
[What actually happened]

Files modified:
[Exact file paths]

Files created:
[Exact file paths]

Files deleted:
[Exact file paths, if applicable]

Technical decisions:
[Important architectural decisions and trade-offs]

Testing performed:
[Actual tests performed and verification commands]

Test results:
[Actual results observed]

Outstanding issues:
[Unresolved problems or newly discovered risks]

Platform validation:
[Browser / Android / Both / Not tested]

Next recommended action:
[Specific next step]
--------------------------------------------------
```

- Append entries chronologically; never overwrite past entries.
- Record blockers and unexpected discrepancies immediately.
- **Mandatory for Planning & Review Tasks:** Planning, architectural specifications, and review-only tasks must also be logged. Clearly label them as planning/review activities, state which source files were inspected, and explicitly record that no gameplay source files were modified.
- **Verification Rule:** After every turn or task, reopen `DEVELOPMENT_LOG.txt`, verify that the new entry exists at the end and that all previous entries remain intact, and report the entry number in the session handoff. Never claim a log update was performed without verifying the persisted file.

---

## F. Session-End Handoff Protocol

At the conclusion of each development session, the assistant must provide a clear handoff containing:
1. Work completed during the session.
2. Files modified, created, or deleted.
3. Tests executed and their exact outcomes.
4. Outstanding issues, bugs, or risks identified.
5. Current development phase according to the Implementation Plan.
6. Exact next recommended task.
7. Confirmation that `DEVELOPMENT_LOG.txt` has been updated.

---

## G. Conflict Resolution Protocol

If `Game Design Document.txt`, `Final Gameplay Systems Specification & Technical Implementation Plan.txt`, `TECHNICAL_AUDIT.txt`, or existing source code disagree:
1. **Do not silently pick one.**
2. Formulate a concise summary identifying the discrepancy.
3. Detail the technical and design implications of each alternative.
4. If a design decision must change from the approved specifications, present the rationale to the user and request explicit confirmation.
5. Update the relevant documentation only after approval is granted.

*Rule of Thumb:* The GDD and Gameplay Systems Spec define the **intended game**. Existing source code defines what is **currently running**. The Development Log records what has **actually been completed and verified**.

---

## H. Cross-IDE Continuity

This project is developed across multiple machines, IDEs (Android Studio, VS Code, Antigravity, WebStorm), and AI assistants. 

No session history is guaranteed to persist outside of git and the filesystem. **All context resides in the repository files.** A newly initiated agent must be able to read `AGENTS.md`, `DEVELOPMENT_LOG.txt`, and `TECHNICAL_AUDIT.txt` and immediately pick up the next task safely.

