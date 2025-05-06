.PHONY: build clean install test

# Build targets
build: clean install
	@echo "Building Python lambdas..."
	@./build.sh

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist
	@rm -rf .venv

# Install dependencies
install:
	@echo "Installing dependencies..."
	@deactivate 2>/dev/null || true && rm -rf .venv && python3.10 -m venv .venv && source .venv/bin/activate
	@source .venv/bin/activate && pip install -r requirements.txt

# Run tests
test:
	@echo "Running tests..."
	@source .venv/bin/activate && pytest

# Development setup
dev: install
	@echo "Setting up development environment..."
	@source .venv/bin/activate