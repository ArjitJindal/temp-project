# type: ignore
import json
import os
import sys

from pyspark.sql.types import StructType, StructField, StringType

sys.path.append(os.path.abspath("/Workspace/Shared/main"))

from src.openapi.models.business import Business  # pylint: disable=import-error
from src.openapi.models.transaction import (  # pylint: disable=import-error
    Transaction,
)
from src.openapi.models.user import User  # pylint: disable=import-error


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
        "schema": merge_schemas(User, Business, StructType([StructField("type", StringType(), True)])),
        "partition_key": "user#primary",
        "id_column": "userId",
    },
]
