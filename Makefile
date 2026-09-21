## ─────────────────────────────────────────────────────────────────────────────
## InsureAI — Makefile
## Usage: make <target>
##
## All database operations (seed, reset, count) call the Next.js API routes
## which use the MongoDB Node.js driver directly — no mongosh required.
## The driver reads MONGODB_URI from .env.local (Atlas or local URI).
## ─────────────────────────────────────────────────────────────────────────────

PORT     := 3888
APP_URL  := http://localhost:$(PORT)
SEED_URL := $(APP_URL)/api/seed
COMPOSE   := docker compose --env-file .env.local

.DEFAULT_GOAL := help

# ── Help ───────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  InsureAI — available commands"
	@echo ""
	@echo "  Infrastructure"
	@echo "    make up          Start the app, Cerbos, and mongodb-mcp-server (detached)"
	@echo "    make down        Stop and remove containers"
	@echo "    make restart     down + up"
	@echo "    make logs        Tail all container logs"
	@echo "    make status      Show all Compose container health"
	@echo "    make mcp-status  Check mongodb-mcp-server health"
	@echo "    make mcp-logs    Tail mongodb-mcp-server logs only"
	@echo ""
	@echo "  Database  (requires: the app service running on port $(PORT))"
	@echo "    make seed           Seed Atlas DB with 20 records (idempotent)"
	@echo "    make reset          Drop collection and re-seed all 20 records"
	@echo "    make db-count       Show document count per agent"
	@echo "    make db-shell       How to open a MongoDB shell"
	@echo "    make vector-index   Create Atlas Vector Search index (chat_sessions)"
	@echo ""
	@echo "  App"
	@echo "    make install     npm install"
	@echo "    make dev         Start Next.js dev server on port $(PORT)"
	@echo "    make build       Production build"
	@echo "    make start       Start production server on port $(PORT)"
	@echo ""
	@echo "  Convenience"
	@echo "    make boot        Alias for up"
	@echo "    make nuke        down + remove volumes (full wipe)"
	@echo ""

# ── Infrastructure ─────────────────────────────────────────────────────────────
.PHONY: up
up:
	@echo "▶ Starting containers..."
	$(COMPOSE) up -d --wait
	@echo "✓ Containers ready."

.PHONY: down
down:
	@echo "▶ Stopping containers..."
	$(COMPOSE) down

.PHONY: restart
restart: down up

.PHONY: logs
logs:
	$(COMPOSE) logs -f

.PHONY: status
status:
	@docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" \
		--filter name=insurance_app \
		--filter name=insurance_cerbos \
		--filter name=insurance_mcp_server

## Check mongodb-mcp-server reachability and probe the MCP HTTP endpoint
.PHONY: mcp-status
mcp-status:
	@echo "▶ mongodb-mcp-server container status..."
	@docker inspect insurance_mcp_server --format='  Status: {{.State.Status}} | Running: {{.State.Running}}' 2>/dev/null || echo "  container not found"
	@echo ""
	@echo "▶ Probing MCP HTTP endpoint (http://localhost:4000/mcp)..."
	@curl -s -o /dev/null -w "  HTTP status: %{http_code}\n" http://localhost:4000/ 2>/dev/null || echo "  ✗ not reachable on port 4000"
	@echo ""
	@echo "▶ Container process:"
	@docker exec insurance_mcp_server ps aux 2>/dev/null | grep mongodb-mcp || echo "  not running"
	@echo ""

## Tail only the mongodb-mcp-server container logs
.PHONY: mcp-logs
mcp-logs:
	docker logs -f insurance_mcp_server

# ── Database ───────────────────────────────────────────────────────────────────
# All operations use the MongoDB Node.js driver via the /api/seed route.
# No mongosh or local MongoDB container required.
# Requires: the app service to be running on port $(PORT).

## Idempotent seed — only inserts 20 records if the collection is empty.
## Uses the MongoDB driver (MONGODB_URI from .env.local) — no mongosh needed.
.PHONY: seed
seed:
	@echo "▶ Seeding Atlas database via $(SEED_URL) ..."
	@curl -s -X GET $(SEED_URL) | python3 -m json.tool 2>/dev/null || curl -s -X GET $(SEED_URL)
	@echo ""

## Drop the insurance_policies collection and re-seed all 20 records from scratch.
## Uses the MongoDB driver (MONGODB_URI from .env.local) — no mongosh needed.
.PHONY: reset
reset:
	@echo "▶ Resetting Atlas database via $(SEED_URL) ..."
	@curl -s -X DELETE $(SEED_URL) | python3 -m json.tool 2>/dev/null || curl -s -X DELETE $(SEED_URL)
	@echo ""

## Alias: db-reset calls reset (kept for backward compatibility)
.PHONY: db-reset
db-reset: reset

## Show document count per agent and status via the seed API response.
## Uses the MongoDB driver (MONGODB_URI from .env.local) — no mongosh needed.
.PHONY: db-count
db-count:
	@echo "▶ Querying document counts via $(SEED_URL) ..."
	@curl -s -X GET $(SEED_URL) | python3 -c "\
import sys, json; \
d = json.load(sys.stdin); \
print('  Status : ' + ('already seeded' if not d.get('seeded') else 'freshly seeded')); \
print('  Total  : ' + str(d.get('count', '?'))); \
" 2>/dev/null || curl -s -X GET $(SEED_URL)
	@echo ""
	@echo "  For per-agent breakdown, visit:"
	@echo "  $(APP_URL)/api/seed"
	@echo ""

## Print instructions for connecting a MongoDB shell to Atlas.
## mongosh is not required for this project — all operations use the Node.js driver.
.PHONY: db-shell
db-shell:
	@echo ""
	@echo "  MongoDB shell options:"
	@echo ""
	@echo "  Option A — mongosh (if installed locally):"
	@echo "    mongosh \"\$$MONGODB_URI\""
	@echo "    (set MONGODB_URI from .env.local first)"
	@echo ""
	@echo "  Option B — MongoDB Atlas web UI:"
	@echo "    https://cloud.mongodb.com → your cluster → Browse Collections"
	@echo ""

# ── App ────────────────────────────────────────────────────────────────────────
.PHONY: install
install:
	npm install

.PHONY: dev
dev:
	npm run dev

.PHONY: build
build:
	npm run build

.PHONY: start
start:
	npm run start

# ── Convenience ────────────────────────────────────────────────────────────────

## The Compose app service runs the Next.js development server with Fast Refresh.
.PHONY: boot
boot: up

## Full wipe: stop containers and delete all Docker volumes
.PHONY: nuke
nuke:
	@echo "▶ Nuking containers and volumes..."
	$(COMPOSE) down -v
	@echo "✓ All containers and volumes removed."

## Create the Atlas Vector Search index for the chat_sessions collection.
## Requires: npm run dev is running on port $(PORT).
## Safe to call multiple times — idempotent (checks before creating).
## Note: index may take 1-2 minutes to become READY after creation.
.PHONY: vector-index
vector-index:
	@echo "▶ Creating Atlas Vector Search index via $(APP_URL)/api/setup-vector-index ..."
	@curl -s $(APP_URL)/api/setup-vector-index | python3 -m json.tool 2>/dev/null || curl -s $(APP_URL)/api/setup-vector-index
	@echo ""
