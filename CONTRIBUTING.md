# Contributing to Zorfly

## Before contributing

1. Search existing issues and pull requests.
2. Discuss changes that affect architecture, public contracts, security,
   infrastructure, or data ownership before implementation.
3. Keep each pull request focused on one outcome.

## Branches and commits

- Branch from the latest `main`.
- Use descriptive branches such as `feat/billing-portal` or
  `fix/tenant-boundary`.
- Follow Conventional Commits, for example `feat:`, `fix:`, `docs:`, `test:`,
  `refactor:`, `chore:`, and `ci:`.
- Do not include secrets, customer data, generated build output, or unrelated
  formatting changes.

## Pull requests

Every pull request must:

- explain the problem and the selected approach;
- identify security, tenant-isolation, data-migration, and operational impact;
- include or update appropriate tests;
- update documentation for changed behavior or decisions;
- provide a rollback plan when the change affects production;
- pass required automated checks and receive code-owner approval.

## Architecture decisions

Create an Architecture Decision Record under `docs/adr/` for decisions that are
costly to reverse, affect multiple modules, introduce a vendor, or change a
public contract. Use a sequential number and descriptive name, such as
`0001-use-postgresql.md`.

## Definition of done

A change is complete when it is reviewed, tested at the correct level,
documented, observable, secure, deployable, and reversible.
