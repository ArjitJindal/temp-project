# type: ignore
import json
import os
import sys

sys.path.append(os.path.abspath("/Workspace/Shared/main/src"))

from openapi_client.models.transaction import (  # pylint: disable=import-error
    Transaction,
)
from openapi_client.models.user import User  # pylint: disable=import-error

entities = [
    {
        "table": "transactions",
        "schema": Transaction,
        "partition_key": "transaction#primary",
        "id_column": "transactionId",
    },
    {
        "table": "users",
        "schema": User,
        "partition_key": "user#primary",
        "id_column": "userId",
    },
]
