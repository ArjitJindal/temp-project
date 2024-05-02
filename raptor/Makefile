test:
	poetry install

black:
	poetry run black src --check

lint:
	poetry run pylint src

isort:
	poetry run isort src --check

mypy:
	poetry run mypy src

all_checks: isort black test lint mypy

fix:
	poetry run isort src
	poetry run black src
