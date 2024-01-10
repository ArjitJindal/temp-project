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
