COMPOSE := docker compose --env-file .env -f docker-compose.yml

.DEFAULT_GOAL := help

.PHONY: help build run up down teardown restart ps logs migrate-logs health

help:
	@echo "Guardian container commands"
	@echo ""
	@echo "  make build      Build the Guardian web and worker image"
	@echo "  make run        Start the complete stack in the background"
	@echo "  make down       Stop the stack and preserve PostgreSQL data"
	@echo "  make teardown   Alias for make down"
	@echo "  make restart    Restart the web and worker containers"
	@echo "  make health     Check containers, PostgreSQL, and Guardian readiness"
	@echo "  make ps         Show container status"
	@echo "  make logs       Follow web and worker logs"
	@echo "  make migrate-logs  Show the Prisma migration log"

build:
	$(COMPOSE) build

run up:
	$(COMPOSE) up -d

down teardown:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart web worker

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f web worker

migrate-logs:
	$(COMPOSE) logs --no-color migrate

health:
	$(COMPOSE) ps
	$(COMPOSE) exec -T postgres pg_isready -U guardian -d guardian
	$(COMPOSE) exec -T web node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async response => { console.log(await response.text()); process.exit(response.ok ? 0 : 1); }).catch(error => { console.error(error); process.exit(1); })"
	$(COMPOSE) exec -T worker node -e "console.log('Guardian worker container is running')"
