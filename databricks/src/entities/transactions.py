from typing import Callable

from pyspark.sql import DataFrame
from pyspark.sql.functions import broadcast, coalesce, col, explode, expr
from pyspark.sql.types import DoubleType, StructField, StructType

from src.entities.entity import Entity
from src.entities.schema import merge_schemas
from src.openapi.public.models import TransactionWithRulesResult

transaction_schema = merge_schemas(
    TransactionWithRulesResult,
    StructType([StructField("transactionAmountUSD", DoubleType(), True)]),
)


def enrich_transactions(
    transactions_df: DataFrame, resolve_stream: Callable[[str], DataFrame]
):
    currency_rates_df = resolve_stream("currency_rates")

    currencies_usd = (
        currency_rates_df.filter(currency_rates_df.date.isNotNull())
        .select(
            col("date"),
            explode(col("rates")).alias("currency", "rate"),
            col("approximateArrivalTimestamp"),
        )
        .withWatermark("approximateArrivalTimestamp", "1 second")
    ).dropDuplicates(["date"])

    filtered_currencies_usd = currencies_usd.filter(currencies_usd.date.isNotNull())
    broadcast_currencies = broadcast(filtered_currencies_usd).alias("cr")

    joined_df = (
        transactions_df.alias("t")
        .withWatermark("approximateArrivalTimestamp", "1 second")
        .join(
            broadcast_currencies,
            expr(
                """
            t.transactionAmountUSD is null AND
            cr.currency = t.originAmountDetails.transactionCurrency AND
            to_date(from_unixtime(t.timestamp / 1000)) == cr.date AND
            t.approximateArrivalTimestamp >= cr.approximateArrivalTimestamp AND
            t.approximateArrivalTimestamp <= cr.approximateArrivalTimestamp + interval 1 day
        """
            ),
            "leftOuter",
        )
    )

    return (
        joined_df.drop("transactionDate")
        .withColumn(
            "transactionAmountUSD",
            coalesce(
                col("t.transactionAmountUSD"),
                (col("t.originAmountDetails.transactionAmount") / col("cr.rate")),
            ),
        )
        .select(col("t.*"), col("transactionAmountUSD"))
    )


transaction_entity = Entity(
    table="transactions",
    schema=transaction_schema,
    partition_key="transaction#primary",
    id_column="transactionId",
    source="kinesis_events",
    timestamp_column="timestamp",
    enrichment_fn=enrich_transactions,
)
