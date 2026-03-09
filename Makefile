.PHONY: dev frontend backend install

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
