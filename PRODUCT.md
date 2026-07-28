# UniMap Product Definition

## Purpose

UniMap is a lightweight web application for exploring and learning about a curated catalogue of celestial bodies. It combines fast catalogue browsing, forgiving search, educational object profiles, quiz gameplay, and a simple celestial map without requiring an account, backend, installation, or build process.

## Product principles

1. **Stay lightweight.** Use static HTML, CSS, vanilla JavaScript, and JSON.
2. **Stay understandable.** A new contributor should be able to understand the project in one sitting.
3. **Prefer usefulness over feature count.** Add only features that improve browsing, learning, accuracy, discovery, or accessibility.
4. **Progressive enhancement.** Core browsing and quiz gameplay must remain fast on phones and desktop browsers.
5. **No infrastructure without a demonstrated need.** Do not add a framework, package manager, backend, database, authentication, or third-party runtime dependency by default.
6. **Treat scientific data carefully.** Display units and approximations clearly, preserve provenance, and never invent missing facts or classifications.
7. **Keep runtime data local.** Astronomy services may support controlled imports, but browsing, search, quiz, and the first map must work from shipped local data.

## User jobs

A visitor should be able to:

- browse the full catalogue;
- search by name, common name, alias, or catalogue identifier;
- find an object despite a reasonable spelling mistake;
- use autocomplete suggestions on desktop or mobile;
- filter objects by clear categories and category groups;
- open an object and understand what it is, where it is, why it matters, and how it was discovered where supported;
- see where a coordinate-bearing object appears on a simple celestial map;
- play a timed astronomy quiz at an appropriate difficulty;
- keep local leaderboard scores across browser sessions;
- return to the same browse state;
- use the application with touch, keyboard, and assistive technology.

## Current shipped scope

- Static catalogue loaded from `celestial-bodies.json`
- 208 celestial-body records
- Ranked search over names, aliases, and catalogue ids, with punctuation
  tolerance, spelling correction, and accessible autocomplete
- Flat category filters
- Accessible result list and object detail view
- Four quiz difficulties with local leaderboards
- Responsive dark interface
- Static hosting

## Prioritized product expansion

Item 1 is complete. The remaining approved order is:

1. Effortless quiz mode, more question families, stronger Hard/Impossible content, and reliable local leaderboard persistence
2. More verified information on object profiles
3. A grouped planet hierarchy covering solar-system planets, exoplanets, dwarf planets, and candidate dwarf planets
4. More celestial bodies, including candidate dwarf planets, brown dwarfs, and galaxy clusters
5. Per-object and catalogue-wide celestial maps
6. Properly attributed local images
7. Lightweight validation automation

The footer was removed with the search slice.

## Category direction

Planet-related categories should share one hierarchy while preserving scientific distinctions:

- Planets
  - All Planets
  - Solar System Planets
  - Exoplanets
  - Dwarf Planets
  - Candidate Dwarf Planets

Brown dwarfs are not planets and must have a separate category. Galaxy clusters must remain distinct from star clusters.

## Leaderboard boundary

Local leaderboard persistence is part of the static product and should be reliable, versioned, recoverable, and exportable. Cross-device or global leaderboards are not part of the current static architecture because they require hosted writes, identity, privacy decisions, server-side validation, and anti-cheat controls.

## Explicitly out of scope until separately approved

- Accounts or authentication
- User-generated content
- Backend services
- Database servers
- Required live astronomy APIs
- Global or cross-device leaderboards
- Administrative editing interfaces
- Tracking or advertising
- Framework migrations
- Native mobile applications

## Success criteria

UniMap is successful when it:

- loads quickly from static hosting;
- works without console errors;
- presents all valid catalogue records;
- finds objects through exact, partial, alias, identifier, and reasonable fuzzy searches;
- provides useful autocomplete on desktop and mobile;
- offers fair, varied quiz gameplay across all documented difficulties;
- preserves local scores reliably;
- provides sourced educational information and clear missing-data behavior;
- remains usable at mobile and desktop widths;
- preserves accessibility and keyboard navigation;
- can be changed and deployed without a build tool.

## Architecture guardrail

Any proposal that introduces a dependency, server, framework, database, build step, or paid service must first document:

- the user problem it solves;
- why the existing static architecture cannot solve it cleanly;
- its operational and maintenance cost;
- a rollback or migration path.
