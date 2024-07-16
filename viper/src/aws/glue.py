# mypy: ignore-errors

import sys


def get_arg(name: str) -> str or None:
    try:
        from awsglue.utils import (  # pylint: disable=import-outside-toplevel
            getResolvedOptions,
        )
    except ImportError:
        # Handle the absence of the library or take alternative actions
        print("awsglue is not installed.")
        return None
    args = getResolvedOptions(sys.argv, [name])
    return args[name]
