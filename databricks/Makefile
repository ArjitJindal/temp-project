test:
	poetry install
	poetry run coverage run --source=dlt_pipeline --omit='*tests/*' --branch -m pytest tests
	poetry run coverage report -m --skip-empty

black:
	poetry run black . --check

lint:
	poetry run pylint dlt_pipeline

isort:
	poetry run isort dlt_pipeline --check

mypy:
	poetry run mypy dlt_pipeline

all_checks: isort black test lint mypy
