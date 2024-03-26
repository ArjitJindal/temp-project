from pyspark.sql.types import StructType

from src.entities.entity import Entity
from src.openapi.internal.models import ArsScore, DrsScore, KrsScore


def sanitise_scoring_schema(schema: StructType) -> StructType:
    return StructType([field for field in schema if field.name != "components"])


kyc_risk_value_entity = Entity(
    table="kyc_risk_values",
    schema=sanitise_scoring_schema(KrsScore),
    partition_key="#krs-value",
    id_column="userId",
    source="hammerhead_kinesis_events",
    timestamp_column="createdAt",
)

action_risk_value_entity = Entity(
    table="action_risk_values",
    schema=sanitise_scoring_schema(ArsScore),
    partition_key="#ars-value",
    id_column="transactionId",
    source="hammerhead_kinesis_events",
    timestamp_column="createdAt",
)

dynamic_risk_value_entity = Entity(
    table="dynamic_risk_values",
    schema=sanitise_scoring_schema(DrsScore),
    partition_key="#drs-value",
    id_column="userId",
    source="hammerhead_kinesis_events",
    timestamp_column="createdAt",
)
