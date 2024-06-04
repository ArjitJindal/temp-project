# mypy: ignore-errors

import sys

from awsglue.utils import getResolvedOptions  # pylint: disable=import-error


def get_arg(name: str) -> str:
    args = getResolvedOptions(sys.argv, [name])
    return args[name]
