from pyspark.sql.types import FloatType, MapType, StringType, StructField, StructType

from src.openapi.internal.models import ArsScore, DrsScore, KrsScore
from src.openapi.public.models import (
    BusinessWithRulesResult,
    TransactionWithRulesResult,
    UserWithRulesResult,
)


def merge_schemas(*schemas):
    return StructType(list({obj.name: obj for l in schemas for obj in l}.values()))


def sanitise_scoring_schema(schema):
    return StructType([field for field in schema if field.name != "components"])


currency_schema = StructType(
    [
        StructField("date", StringType(), False),
        StructField("rates", MapType(StringType(), FloatType(), False), False),
    ]
)

entities = [
    {
        "table": "transactions",
        "schema": TransactionWithRulesResult,
        "partition_key": "transaction#primary",
        "id_column": "transactionId",
        "source": "kinesis_events",
    },
    {
        "table": "users",
        "schema": merge_schemas(
            UserWithRulesResult,
            BusinessWithRulesResult,
            StructType([StructField("type", StringType(), True)]),
        ),
        "partition_key": "user#primary",
        "id_column": "userId",
        "source": "kinesis_events",
    },
    {
        "table": "kyc_risk_values",
        "schema": sanitise_scoring_schema(KrsScore),
        "partition_key": "#krs-value",
        "id_column": "userId",
        "source": "hammerhead_kinesis_events",
    },
    {
        "table": "action_risk_values",
        "schema": sanitise_scoring_schema(ArsScore),
        "partition_key": "#ars-value",
        "id_column": "transactionId",
        "source": "hammerhead_kinesis_events",
    },
    {
        "table": "dynamic_risk_values",
        "schema": sanitise_scoring_schema(DrsScore),
        "partition_key": "#drs-value",
        "id_column": "userId",
        "source": "hammerhead_kinesis_events",
    },
]
