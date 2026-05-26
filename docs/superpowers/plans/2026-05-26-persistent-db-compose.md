# Persistent Database Compose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production deployment shape from database-inside-application-container to a Compose deployment where MariaDB data is stored in a named Docker volume.

**Architecture:** Run three services on one Docker network: `db` for MariaDB with the `yuncang_mysql_data` named volume, `backend` for the Node API, and `frontend` for Nginx static files and `/api` proxying. Production migration remains dump/restore based, but future application upgrades should recreate only `backend` and `frontend` while preserving the database volume.

**Tech Stack:** Docker Compose, MariaDB 10.5, Node 18 backend, Nginx frontend, existing SQL backup/restore flow.

---

### Task 1: Compose And Environment Files

**Files:**
- Modify: `docker-compose.yml`
- Create: `.env.production.example`

- [ ] **Step 1: Replace the old Compose file with a production-like split deployment**

Use `mariadb:10.5` for compatibility with the current All-in-One container, define `yuncang_mysql_data`, keep the database port bound to `127.0.0.1` only, and require `JWT_SECRET`.

- [ ] **Step 2: Add an environment example**

Document required variables without committing production secrets.

### Task 2: Migration Documentation

**Files:**
- Create: `docs/persistent-database-deployment.md`

- [ ] **Step 1: Document local restore flow**

Explain how to bring up Compose, restore a `.sql.gz` backup, and run health/API checks.

- [ ] **Step 2: Document production migration flow**

Explain the safe order: backup, start Compose with volume, restore, validate, then keep old container and rollback image until verified.

### Task 3: Local Verification

**Files:**
- No source changes.

- [ ] **Step 1: Build and start local Compose**

Run with an isolated project name and non-conflicting ports:

```bash
COMPOSE_PROJECT_NAME=yuncang-persistent-test \
FRONTEND_PORT=18084 \
DB_PORT=13306 \
MARIADB_ROOT_PASSWORD=local-root-pass \
MARIADB_PASSWORD=local-yuncang-pass \
JWT_SECRET=local-persistent-db-secret \
docker compose up -d --build
```

- [ ] **Step 2: Restore the latest production backup into the local `db` service**

Use `docker compose exec -T db mariadb ...` with the local backup file under `.temp/production-backups`.

- [ ] **Step 3: Run API smoke tests**

Verify health, admin login, normal-user forbidden balance adjustment, and `奋斗测试` `+0.01/-0.01` against `http://localhost:18084`.

- [ ] **Step 4: Verify volume persistence**

Run `docker compose down`, then `docker compose up -d` without `-v`, and confirm user and transaction counts remain.

### Task 4: Final Review

**Files:**
- No source changes.

- [ ] **Step 1: Check git diff**

Confirm only Compose, environment example, and documentation files changed.

- [ ] **Step 2: Report online migration readiness**

Summarize local evidence and explicitly state that production has not been modified in this task.
