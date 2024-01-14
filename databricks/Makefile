test:
	poetry install
	poetry run coverage run --source=src --omit='*tests/*' --branch -m pytest tests
	poetry run coverage report -m --skip-empty

black:
	poetry run black src tests --check

lint:
	poetry run pylint src tests

isort:
	poetry run isort src tests --check

mypy:
	poetry run mypy src

all_checks: isort black test lint mypy

fix:
	poetry run isort src tests
	poetry run black src tests

generate:
	rm -rf openapi/gen
	command -v openapi-generator-cli >/dev/null 2>&1 || npm install @openapitools/openapi-generator-cli -g
	npm exec openapi-generator-cli generate -- -i ../tarpon/lib/openapi/public/openapi-public-original.yaml -g python -o ./openapi/gen --template-dir openapi
	ln -sf ./openapi/gen/openapi_client ./src/openapi_client

