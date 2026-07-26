# UniMap Product Definition

## Purpose

UniMap is a lightweight web application for browsing a curated catalogue of celestial bodies. It should make basic astronomy information easy to search, filter, and understand without requiring an account, backend, installation, or build process.

## Product principles

1. **Stay lightweight.** Use static HTML, CSS, vanilla JavaScript, and JSON.
2. **Stay understandable.** A new contributor should be able to understand the project in one sitting.
3. **Prefer usefulness over feature count.** Add only features that improve browsing, learning, accuracy, or accessibility.
4. **Progressive enhancement.** The core catalogue must remain fast and usable on phones and desktop browsers.
5. **No infrastructure without a demonstrated need.** Do not add a framework, package manager, backend, database, authentication, or third-party runtime dependency by default.
6. **Treat scientific data carefully.** Display units and approximations clearly, retain source information when added, and do not silently invent missing values.

## Current users and jobs

A visitor should be able to:

- browse the full catalogue;
- search a celestial body by partial or exact name;
- filter objects by category;
- understand how many results matched;
- open a record and review its basic measurements;
- return to the same search state;
- use the site with a keyboard and on a narrow mobile screen.

## Current scope

- Static catalogue loaded from `celestial-bodies.json`
- Name search
- Category filters
- Accessible result list
- Object detail view
- Responsive dark interface
- Static hosting

## Explicitly out of scope until prioritized

- Accounts or authentication
- User-generated content
- Backend services
- Database servers
- Live astronomy APIs
- Administrative editing interfaces
- Tracking or advertising
- Framework migrations
- Native mobile applications

## Success criteria

UniMap is successful when it:

- loads quickly from static hosting;
- works without console errors;
- presents all valid catalogue records;
- remains usable at mobile and desktop widths;
- preserves accessibility and keyboard navigation;
- can be changed and deployed without a build tool.

## Architecture guardrail

Any proposal that introduces a dependency, server, framework, database, build step, or paid service must first document:

- the user problem it solves;
- why the existing static architecture cannot solve it cleanly;
- its operational and maintenance cost;
- a rollback or migration path.
