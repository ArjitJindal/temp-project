test:
	poetry install
	poetry run coverage run --source=src --branch -m pytest src
	poetry run coverage report -m --skip-empty

black:
	poetry run black src --check

lint:
	poetry run pylint src

mypy:
	poetry run mypy src

all_checks: isort black test lint mypy

fix:
	poetry run isort src
	poetry run black src
