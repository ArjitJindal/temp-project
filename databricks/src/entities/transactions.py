from typing import Callable

from pyspark.sql import DataFrame
from pyspark.sql.functions import broadcast, col, explode, expr

from src.entities.entity import Entity
from src.openapi.public.models import TransactionWithRulesResult

transaction_schema = TransactionWithRulesResult


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
    ).dropDuplicates(["date", "currency"])

    filtered_currencies_usd = currencies_usd.filter(currencies_usd.date.isNotNull())
    broadcast_currencies = broadcast(filtered_currencies_usd).alias("cr")

    joined_df = (
        transactions_df.alias("t")
        .withWatermark("approximateArrivalTimestamp", "10 minutes")
        .join(
            broadcast_currencies,
            expr(
                """
            cr.currency = t.originAmountDetails.transactionCurrency AND
            to_date(from_unixtime(t.timestamp / 1000)) = cr.date AND
            cr.approximateArrivalTimestamp < (t.approximateArrivalTimestamp + interval 10 minutes)
        """
            ),
            "leftouter",
        )
    )

    return (
        joined_df.drop("transactionDate")
        .withColumn(
            "transactionAmountUSD",
            col("t.originAmountDetails.transactionAmount") / col("cr.rate"),
        )
        .select(col("t.*"), col("transactionAmountUSD"))
    )


def transaction_quality_check(df: DataFrame):
    null_count = df.filter(col("transactionAmountUSD").isNull()).count()
    if null_count > 0:
        raise ValueError(f" {null_count} nulls in 'transactionAmountUSD' column")


transaction_entity = Entity(
    table="transactions",
    schema=transaction_schema,
    partition_key="transaction#primary",
    id_column="transactionId",
    source="kinesis_events",
    timestamp_column="timestamp",
    enrichment_fn=enrich_transactions,
    quality_checks=transaction_quality_check,
)
