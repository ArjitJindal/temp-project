test:
	poetry install
	poetry run coverage run --source=src --omit='**/*_test.py,src/openapi/**' --branch -m pytest src
	poetry run coverage report -m --skip-empty

black:
	poetry run black src --check

lint:
	poetry run pylint src

isort:
	poetry run isort src --check --skip src/openapi

mypy:
	poetry run mypy src

all_checks: isort black test lint mypy

fix:
	poetry run isort src
	poetry run black src

generate:
	command -v openapi-generator-cli >/dev/null 2>&1 || npm install @openapitools/openapi-generator-cli -g
	npm exec openapi-generator-cli generate -- -i ../tarpon/lib/openapi/public/openapi-public-original.yaml -g python -o ./openapi/gen --template-dir openapi --additional-properties=packageName=src.openapi
	rm -rf src/openapi
	mkdir -p src/openapi
	touch src/openapi/__init__.py
	mv ./openapi/gen/src/openapi/models src/openapi/models

patch: generate
	poetry build
	databricks workspace import-dir --overwrite notebooks /Shared/
	databricks workspace import-dir --overwrite dist /Shared/
