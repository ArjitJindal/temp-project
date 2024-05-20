test:
	poetry install

black:
	poetry run black src --check

mypy:
	poetry run mypy --install-types --non-interactive ./
	poetry run mypy src

all_checks: black test mypy

fix:
	poetry run black src
