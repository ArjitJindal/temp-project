from typing import Dict, List, Tuple

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col, to_timestamp

from src.entities.currency_rates import currency_schema


def mock_stream_resolver(
    spark: SparkSession,
    rates: List[Tuple[str, Dict[str, float]]],
):
    def stream_resolver(_: str) -> DataFrame:
        currency_rates = spark.createDataFrame(rates, currency_schema)
        return currency_rates.withColumn(
            "approximateArrivalTimestamp",
            to_timestamp(col("date"), "yyyy-MM-dd"),
        )

    return stream_resolver
