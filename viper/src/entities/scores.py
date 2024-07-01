from src.entities.entity import Entity
from src.openapi.internal.models import ArsScore, DrsScore, KrsScore

kyc_risk_value_entity = Entity(
    table="kyc_risk_values",
    schema=KrsScore,
    partition_key="#krs-value",
    id_column="userId",
    source="hammerhead_kinesis_events",
    timestamp_column="createdAt",
)

action_risk_value_entity = Entity(
    table="action_risk_values",
    schema=ArsScore,
    partition_key="#ars-value",
    id_column="transactionId",
    source="hammerhead_kinesis_events",
    timestamp_column="createdAt",
)

dynamic_risk_value_entity = Entity(
    table="dynamic_risk_values",
    schema=DrsScore,
    partition_key="#drs-value",
    id_column="userId",
    source="hammerhead_kinesis_events",
    timestamp_column="createdAt",
)
