# Journal

A minimal TypeScript project for a browser-based journal client. The HTML
interface uses vanilla JavaScript and [w3.css](https://www.w3schools.com/w3css/).
After unlocking, select a date to browse entries, add new notes, edit existing
ones, and update a daily summary.
Journal entries are encrypted locally using a symmetric key derived from a
user-provided password. The key is never stored and session data is not
persisted. Each save produces a new signing key pair: the public key is written
to disk for verification while the private key is sealed inside the encrypted
payload. The encrypted file also records a UTC timestamp and a SHA-256 hash of
the ciphertext to protect against tampering.

## Project Guidelines

See [AGENTS.md](AGENTS.md) for project structure, coding style, and workflow
details.

## Prerequisites

This project targets the latest Node.js LTS release. Ensure your environment uses **Node.js 22.x**.

## Running in a Dev Container

1. Install Docker and the VS Code **Dev Containers** extension.
2. Open the command palette and select **Dev Containers: Open Folder in Container...**.
3. VS Code builds the container from `.devcontainer/devcontainer.json` and runs `npm install` automatically.

## Running Locally

1. Install dependencies: `npm install`.
2. Build the project: `npm run build`.
3. Start the server: `npm start` and visit http://localhost:3000.
4. Use the npm scripts below to develop, test, and build the project.

## API Endpoints

The server exposes a small JSON API. All endpoints except `/api/unlock` require
an `X-Password` header containing the user's password:

- `POST /api/unlock` – supply `{password}` to decrypt the journal.
- `GET /api/entries?date=YYYY-MM-DD` – retrieve `{summary, entries}` for a day.
- `POST /api/entries` – send `{date, content}` to append a new entry.
- `PUT /api/entries/:id` – update an entry's `{content}` and optional `timestamp`.
- `PUT /api/summary/:date` – update the summary for the given day.

## npm Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Starts the server with hot reload and debug logging. |
| `npm start` | Executes the compiled code from `dist/`. |
| `npm run build` | Compiles TypeScript using `tsconfig.build.json`. |
| `npm run build:fast` | Faster, less strict build for development. |
| `npm test` | Runs the Jest test suite. |
| `npm run lint` | Lints the `src/` directory without making changes. |
| `npm run format` | Applies ESLint fixes to the `src/` directory. |
| `npm run check` | Runs `lint` and `build:fast`. |
| `npm run watch` | Runs `check` whenever source files change. |

## Environment Variables

No environment variables are required by default. You can supply your own via the shell or a `.env` file and access them with `process.env`.

## Logging

Logging is handled by a [Winston](https://github.com/winstonjs/winston) logger. The default log level is `info`, which includes `info`, `warn`, and `error` messages. To adjust the verbosity, set the `LOG_LEVEL` environment variable to one of `error`, `warn`, `info`, or `debug`:

```bash
LOG_LEVEL=warn npm start
```

The `npm run dev` script sets `LOG_LEVEL=debug` so development runs show debug messages. Avoid logging secrets such as passwords or private keys.

## Commit Conventions

This repository follows [Conventional Commits](https://www.conventionalcommits.org/). Examples: `feat: add feature` or `fix: resolve issue`.

## Continuous Integration

GitHub Actions runs lint and test jobs on each push and pull request to ensure the project builds and tests pass.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved.

## Configuration

Environment variables are managed with [dotenv](https://www.npmjs.com/package/dotenv). Create a `.env` file by copying `.env.example` and updating the values as needed:

```bash
cp .env.example .env
```

Load and validate these variables in code through `src/config.ts`:

```ts
import config from './config';
import logger from './utils/logger';

logger.info(`Running in ${config.nodeEnv} mode on port ${config.port}`);
```

## EditorConfig

This project includes an `.editorconfig` file to enforce consistent coding styles. Install an EditorConfig plugin for your editor to automatically apply these settings.
