from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Tuple

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import lit, unix_timestamp
from pyspark.sql.types import StringType, StructField, StructType, TimestampType

from src.dynamo.deserialize import deserialise_dynamo_udf
from src.entities.currency_rates import currency_schema
from src.entities.transactions import enrich_transactions, transaction_schema
from src.testing.file import read_file


@dataclass
class TestCase:
    """Class representing a test case"""

    name: str
    transaction_timestamp: str
    transaction_arrival_timestamp: str
    currency_rates: List[Tuple[str, float, str]]
    should_convert: bool


def test_transaction_enrichment():
    spark = SparkSession.builder.appName("Extension test").getOrCreate()
    txn = read_file("fixtures/transaction.json")
    transaction_data = [(txn,)]

    test_cases = [
        TestCase(
            name="Transaction arrives just after currency",
            transaction_timestamp="2020-01-01 00:00:10",
            transaction_arrival_timestamp="2020-01-01 00:00:10",
            currency_rates=[("2020-01-01", 1.0, "2020-01-01 00:00:00")],
            should_convert=True,
        ),
        TestCase(
            name="Transaction arrives 5 minutes before currency",
            transaction_timestamp="2020-01-01 00:00:00",
            transaction_arrival_timestamp="2020-01-01 00:00:00",
            currency_rates=[("2020-01-01", 1.0, "2020-01-01 00:05:00")],
            should_convert=True,
        ),
        TestCase(
            name="Transaction arrives 15 minutes before currency",
            transaction_timestamp="2020-01-01 00:00:00",
            transaction_arrival_timestamp="2020-01-01 00:00:00",
            currency_rates=[("2020-01-01", 1.0, "2020-01-01 00:15:00")],
            should_convert=False,
        ),
        TestCase(
            name="No currency for the transactions date",
            transaction_timestamp="2020-01-01 00:00:00",
            transaction_arrival_timestamp="2020-01-01 00:00:00",
            currency_rates=[("2020-01-02", 1.0, "2020-01-02 00:00:00")],
            should_convert=False,
        ),
        TestCase(
            name="Transaction arrives between multiple currency rates for the same date",
            transaction_timestamp="2020-01-01 00:00:15",
            transaction_arrival_timestamp="2020-01-01 00:00:15",
            currency_rates=[
                ("2020-01-01", 1.0, "2020-01-01 00:00:00"),
                ("2020-01-01", 1.0, "2020-01-01 00:00:30"),
            ],
            should_convert=True,
        ),
        TestCase(
            name="Only one transaction returned",
            transaction_timestamp="2020-01-02 00:00:00",
            transaction_arrival_timestamp="2020-01-02 00:00:00",
            currency_rates=[
                ("2020-01-01", 1.0, "2020-01-01 00:00:00"),
                ("2020-01-02", 1.0, "2020-01-02 00:00:00"),
            ],
            should_convert=True,
        ),
        TestCase(
            name="Transaction arrives 6 hours late",
            transaction_timestamp="2020-01-01 18:00:00",
            transaction_arrival_timestamp="2024-04-20T00:00:47.528",
            currency_rates=[
                ("2020-01-01", 1.0, "2020-01-02 00:00:00"),
            ],
            should_convert=True,
        ),
    ]

    for test_case in test_cases:
        df = spark.createDataFrame(
            transaction_data, StructType([StructField("data", StringType())])
        )
        with_structured_df = df.withColumn(
            "structured_data", deserialise_dynamo_udf("data", transaction_schema)
        )

        pre_enrichment_df = (
            with_structured_df.select("structured_data.*")
            .withColumn(
                "approximateArrivalTimestamp",
                lit(test_case.transaction_arrival_timestamp),
            )
            .withColumn(
                "timestamp",
                unix_timestamp(lit(test_case.transaction_timestamp)) * 1000,
            )
        )

        enriched_df = enrich_transactions(
            pre_enrichment_df,
            currency_stream_resolver(spark, test_case.currency_rates),
        )
        assert enriched_df.select("transactionAmountUSD").count() == 1
        converted = enriched_df.select("transactionAmountUSD").first()[0] is not None
        assert test_case.should_convert is converted, f"{test_case.name} failed"

    spark.stop()


currency_schema_with_ts = currency_schema.add(
    "approximateArrivalTimestamp", TimestampType()
)


def currency_stream_resolver(
    spark: SparkSession,
    rates: List[Tuple[str, float, str]],
):
    rates_df_data: List[Tuple[str, Dict[str, float], datetime]] = [
        (rate[0], {"EUR": rate[1]}, datetime.strptime(rate[2], "%Y-%m-%d %H:%M:%S"))
        for rate in rates
    ]

    def stream_resolver(_: str) -> DataFrame:
        return spark.createDataFrame(rates_df_data, currency_schema_with_ts)

    return stream_resolver
