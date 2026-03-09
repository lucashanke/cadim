.PHONY: dev frontend backend install test test-backend test-frontend

dev:
	@trap 'kill 0' INT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

backend:
	cd backend && cargo watch -x run

frontend:
	cd frontend && npm run dev

install:
	cargo install cargo-watch
	cd frontend && npm install

test:
	$(MAKE) test-backend
	$(MAKE) test-frontend

test-backend:
	cd backend && cargo test

test-frontend:
	cd frontend && npm test -- --run
