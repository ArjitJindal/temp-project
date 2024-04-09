from typing import Callable

from pyspark.sql import DataFrame
from pyspark.sql.functions import col, concat, from_unixtime, lit

from src.entities.entity import Entity

PARTITION_KEY_ID_PATH = "event.dynamodb.Keys.PartitionKeyID.S"


def backfill_transformation(
    entity: Entity, df: DataFrame, stream_resolver: Callable[[str], DataFrame]
) -> DataFrame:
    pre_enrichment_df = (
        df.withColumn("PartitionKeyID", concat(df["tenant"], lit(entity.partition_key)))
        .withColumn("SortKeyID", col(entity.id_column))
        .withColumn(
            "approximateArrivalTimestamp",
            from_unixtime(col(entity.timestamp_column) / 1000).cast("timestamp"),
        )
        .withColumn("event", lit("INSERT"))
    )

    if entity.enrichment_fn:
        return entity.enrichment_fn(pre_enrichment_df, stream_resolver, True)
    return pre_enrichment_df
