.PHONY: install dev start test lint build build-worker dev-worker deploy clean

install:
	npm ci

dev:
	npm run dev

start: build
	npm start

test:
	npm test

# No separate linter is configured; a production build catches syntax and import errors.
lint:
	npm run build

build:
	npm run build

build-worker:
	npm run build:worker

dev-worker:
	npm run dev:worker

deploy:
	npm run deploy:worker

clean:
	rm -rf dist .wrangler
