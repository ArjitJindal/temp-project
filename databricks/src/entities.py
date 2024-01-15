# type: ignore
import json
import os
import sys

from pyspark.sql.types import StructType

sys.path.append(os.path.abspath("/Workspace/Shared/main/src"))

from openapi_client.models.business import Business  # pylint: disable=import-error
from openapi_client.models.transaction import (  # pylint: disable=import-error
    Transaction,
)
from openapi_client.models.user import User  # pylint: disable=import-error


def merge_schemas(*schemas):
    return StructType(list({obj.name: obj for l in schemas for obj in l}.values()))


entities = [
    {
        "table": "transactions",
        "schema": Transaction,
        "partition_key": "transaction#primary",
        "id_column": "transactionId",
    },
    {
        "table": "users",
        "schema": merge_schemas(User, Business),
        "partition_key": "user#primary",
        "id_column": "userId",
    },
]
