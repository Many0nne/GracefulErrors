# Contributing to GracefulErrors

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Node.js** >= 20 (matches the CI environment)
- **npm** >= 10 (bundled with Node 20)

## Local Setup

```bash
git clone https://github.com/Many0nne/GracefulErrors.git
cd GracefulErrors
npm install
```

Build the library:

```bash
npm run build
```

## Running Tests

```bash
# Unit tests (vitest)
npm test

# Unit tests in watch mode
npm run test:watch

# Type-level tests (tsd) — requires a build first
npm run test:types

# Type-check without emitting
npm run typecheck
```

The CI runs `npm test -- --coverage` and uploads a coverage report as a build artifact.

## Linting and Formatting

```bash
# ESLint
npm run lint

# Prettier check (read-only)
npx prettier --check .

# Prettier fix
npx prettier --write .
```

A pre-commit hook (Husky + lint-staged) automatically runs ESLint and Prettier on staged `src/**/*.{ts,tsx}` files before every commit.

## Branch and PR Conventions

- Branch off `main` for every change.
- Use short, descriptive branch names prefixed by type:
  - `feat/my-feature`
  - `fix/short-description`
  - `docs/update-readme`
  - `chore/bump-deps`
- Open pull requests against `main`.
- Keep PRs focused — one logical change per PR.
- All CI checks (lint, format, tests) must pass before merging.

## Commit Message Format

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short summary>
```

| Type | When to use |
|------|-------------|
| `feat` | New feature or behavior |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that is neither a fix nor a feature |
| `test` | Adding or updating tests |
| `chore` | Tooling, dependencies, CI |

Examples:

```
feat: add retry limit option to ErrorEngine
fix: handle null payload in Axios adapter
docs: update quickstart example in README
```

The summary line should be lowercase, imperative mood, and under 72 characters.
