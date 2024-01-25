from pyspark.sql.types import StringType, StructField, StructType

from src.openapi.models.business import Business
from src.openapi.models.transaction import Transaction
from src.openapi.models.user import User

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
        "schema": merge_schemas(
            User, Business, StructType([StructField("type", StringType(), True)])
        ),
        "partition_key": "user#primary",
        "id_column": "userId",
    },
]
