from pyspark.sql import DataFrame
from pyspark.sql.functions import col, from_json, lower, regexp_extract

from src.dlt.schema import kinesis_event_schema


def kinesis_events_transformation(df: DataFrame):
    return df.withColumn(
        "tenant",
        lower(
            regexp_extract(
                from_json(col("data").cast("string"), kinesis_event_schema)
                .getField("dynamodb")
                .getField("Keys")
                .getField("PartitionKeyID")
                .getField("S"),
                "^[^#]*",
                0,
            )
        ),
    )
