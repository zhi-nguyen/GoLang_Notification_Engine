# Contributing Guide

## Git Branching Model

- `main`: Production branch.
- `staging`: Pre-production staging environment.
- `dev`: Integration branch where all features merge.
- Working branches: `phase-{N}/{name}`, `feature/{name}`, `fix/{name}`, `hotfix/{name}`.

## Commit Message Convention

Format: `<type>(<scope>): <description>`

### Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring without logic changes
- `docs`: Documentation updates
- `test`: Tests added or updated
- `chore`: Infrastructure, build, or tooling
- `ci`: CI/CD workflows
- `perf`: Performance improvements

### Scopes
- `infra`, `config`, `domain`, `ws`, `api`, `nats`, `auth`, `db`, `worker`, `ui`

### Example
`feat(auth): implement jwt token generation and validation`
