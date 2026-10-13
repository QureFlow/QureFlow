# MySQL DBMS Implementation Plan

**Goal:** Run QureFlow locally on MySQL for the SQL-focused DBMS demonstration without changing or publishing the primary AWS checkout.

**Architecture:** Keep the React/Express API and authentication boundaries. Select a MySQL repository in the DBMS entry point; retain DynamoDB and Cognito for AWS entry points. Use normalized clinical directory, identity, schedule, appointment and token tables with transactional operations, readable SQL routines and aggregate views.

**Tech stack:** MySQL 8.4, mysql2, TypeScript, Express, React, Docker Compose.

## Constraints
- Work only in the isolated `codex/mysql-dbms` checkout; no commits, pushes, cloud writes, or course report.
- Only synthetic local demo data; credentials are exclusively local development fixtures.
- Parameterized values, whitelisted sort expressions, staff clinic isolation, patient ownership and one active consultation per doctor.
- Preserve operational prediction behavior; no clinical triage automation.

## Tasks and verification
- [x] Add local MySQL setup and integration tests that initially demonstrate the missing relational implementation.
- [x] Implement foreign keys, normalized specialties/languages/schedules, unique active-visit constraints, views, function, procedures, triggers and cursor example.
- [x] Implement the repository contract with SQL CRUD, transactions, slot capacity, queue ordering and SQL aggregates; retain the AWS repository.
- [x] Generate an idempotent synthetic dataset with directory, visits, login accounts and current/future queues.
- [x] Move directory filtering/sorting/pagination and appointment/analytics selection to SQL; keep frontend interactions consistent.
- [x] Verify booking/cancellation/queue progression, concurrent conflicts, privacy, filters/injection, SQL objects and clean startup against disposable MySQL fixtures.
- [x] Run builds, frontend tests and the existing AWS tests with DynamoDB Local; document exact run commands and SQL examples.

## Rollback
The original checkout remains on `main` with the AWS files untouched. Stop only the DBMS processes and its Compose service to return to that checkout. The DBMS volume persists synthetic data. There is no live-data migration or destructive contraction.
