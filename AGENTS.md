# Repository Guidelines

This file defines conventions for the entire project.

## Project Structure
- `src/` holds all TypeScript source files.
- `tests/` mirrors the `src/` layout for Jest tests.
- `dist/` contains compiled output and is not committed.
- Browser-facing assets should live in `public/` (plain HTML, vanilla JS and [w3.css](https://www.w3schools.com/w3css/) only).

## Coding Style
- Use TypeScript targeting ESNext.
- Follow the ESLint and Prettier configs:
  - single quotes, semicolons, trailing commas, 80 character lines.
  - `@typescript-eslint` recommended rules with warnings for `no-var`, `prefer-const`, etc.
- Keep dependencies minimal; prefer standard APIs over libraries.
- Client code must avoid frameworks and favour vanilla JS with w3.css for styling.

## Encryption
- Journal entries are encrypted locally using symmetric algorithms such as AES-GCM.
- Derive the encryption key from a user-provided password (e.g. PBKDF2).
- Never store the derived key or any session data.

## Workflow
- Use Node.js 22.x.
- Run `npm run lint` and `npm test` before committing.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- Update tests and documentation alongside code changes.
