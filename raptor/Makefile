test:
	poetry install

black:
	poetry run black src --check

lint:
	poetry run pylint src

mypy:
	poetry run mypy --install-types --non-interactive ./
	poetry run mypy src

all_checks: black test lint mypy

fix:
	poetry run black src
