from typing import Callable

from pyspark.sql import DataFrame
from pyspark.sql.functions import col, from_json, lower, regexp_extract

from src.dlt.schema import PARTITION_KEY_ID_PATH, kinesis_event_schema
from src.dynamo.deserialize import deserialise_dynamo
from src.entities.entity import Entity


def cdc_transformation(
    entity: Entity, read_stream: DataFrame, stream_resolver: Callable[[str], DataFrame]
) -> DataFrame:
    enrichment_fn = entity.enrichment_fn

    sort_key_id_path = "event.dynamodb.Keys.SortKeyID.S"
    df = (
        read_stream.withColumn(
            "event", from_json(col("data").cast("string"), kinesis_event_schema)
        )
        .withColumn(
            "PartitionKeyID",
            col(PARTITION_KEY_ID_PATH).alias("PartitionKeyID"),
        )
        .withColumn(
            "SortKeyID",
            col(sort_key_id_path).alias("SortKeyID"),
        )
        .withColumn(
            "tenant",
            lower(regexp_extract(col(PARTITION_KEY_ID_PATH), "^[^#]*", 0)).alias(
                "tenant"
            ),
        )
    )

    filtered_df = df.filter(col(PARTITION_KEY_ID_PATH).contains(entity.partition_key))

    with_structured_df = filtered_df.withColumn(
        "structured_data", deserialise_dynamo(col("data"), entity.schema)
    ).alias("entity")

    pre_enrichment_df = with_structured_df.select(
        col("structured_data.*"),
        col("tenant"),
        col("PartitionKeyID"),
        col("SortKeyID"),
        col("approximateArrivalTimestamp"),
        col("entity.event.eventName").alias("event"),
    )

    if enrichment_fn:
        return enrichment_fn(pre_enrichment_df, stream_resolver, False)
    return pre_enrichment_df
