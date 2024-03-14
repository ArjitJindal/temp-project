from pyspark.sql.functions import broadcast, coalesce, col, explode, expr
from pyspark.sql.types import (
    DoubleType,
    FloatType,
    MapType,
    StringType,
    StructField,
    StructType,
)

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


def enrich_transactions(transactions_df, currency_rates_df):
    currencies_usd = currency_rates_df.select(
        col("date"),
        explode(col("rates")).alias("currency", "rate"),
        col("approximateArrivalTimestamp"),
    ).withWatermark("approximateArrivalTimestamp", "1 second")

    broadcast_currencies = broadcast(currencies_usd).alias("cr")

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


currency_schema = StructType(
    [
        StructField("date", StringType(), False),
        StructField("rates", MapType(StringType(), FloatType(), False), False),
    ]
)

transaction_schema = merge_schemas(
    TransactionWithRulesResult,
    StructType([StructField("transactionAmountUSD", DoubleType(), True)]),
)

user_schema = merge_schemas(
    UserWithRulesResult,
    BusinessWithRulesResult,
    StructType([StructField("type", StringType(), True)]),
)

entities = [
    {
        "table": "transactions",
        "schema": transaction_schema,
        "partition_key": "transaction#primary",
        "id_column": "transactionId",
        "source": "kinesis_events",
        "enrichment_fn": enrich_transactions,
        "timestamp_column": "timestamp",
    },
    {
        "table": "users",
        "schema": user_schema,
        "partition_key": "user#primary",
        "id_column": "userId",
        "source": "kinesis_events",
        "timestamp_column": "createdTimestamp",
    },
    {
        "table": "kyc_risk_values",
        "schema": sanitise_scoring_schema(KrsScore),
        "partition_key": "#krs-value",
        "id_column": "userId",
        "source": "hammerhead_kinesis_events",
        "timestamp_column": "createdAt",
    },
    {
        "table": "action_risk_values",
        "schema": sanitise_scoring_schema(ArsScore),
        "partition_key": "#ars-value",
        "id_column": "transactionId",
        "source": "hammerhead_kinesis_events",
        "timestamp_column": "createdAt",
    },
    {
        "table": "dynamic_risk_values",
        "schema": sanitise_scoring_schema(DrsScore),
        "partition_key": "#drs-value",
        "id_column": "userId",
        "source": "hammerhead_kinesis_events",
        "timestamp_column": "createdAt",
    },
]
