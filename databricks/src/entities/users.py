from pyspark.sql.types import StringType, StructField, StructType

from src.entities.entity import Entity
from src.entities.schema import merge_schemas
from src.openapi.public.models import BusinessWithRulesResult, UserWithRulesResult

user_schema = merge_schemas(
    UserWithRulesResult,
    BusinessWithRulesResult,
    StructType([StructField("type", StringType(), True)]),
)

user_entity = Entity(
    table="users",
    schema=user_schema,
    partition_key="user#primary",
    id_column="userId",
    source="kinesis_events",
    timestamp_column="createdTimestamp",
)
