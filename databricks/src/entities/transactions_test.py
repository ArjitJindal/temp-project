from dataclasses import dataclass
from typing import Dict, List, Tuple

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_unixtime
from pyspark.sql.types import StringType, StructField, StructType

from src.dynamo.deserialize import deserialise_dynamo
from src.entities.mock import mock_stream_resolver
from src.entities.transactions import enrich_transactions, transaction_schema
from src.testing.file import read_file


@dataclass
class TestCase:
    """Class representing a test case"""

    rates: List[Tuple[str, Dict[str, float]]]
    expected_amount: float


def test_transaction_enrichment():
    spark = SparkSession.builder.appName("Extension test").getOrCreate()
    txn = read_file("fixtures/transaction.json")
    transaction_data = [(txn,)]

    test_case = TestCase(
        expected_amount=232064.0,
        rates=[
            ("2024-01-26", {"USD": 0.5, "EUR": 0.15, "GBP": 0.50}),
            ("2024-01-27", {"USD": 1.0, "EUR": 0.25, "GBP": 0.55}),
            ("2024-01-27", {"USD": 1.0, "EUR": 0.25, "GBP": 0.55}),
            ("2024-01-28", {"USD": 1.5, "EUR": 0.35, "GBP": 0.60}),
        ],
    )

    df = spark.createDataFrame(
        transaction_data, StructType([StructField("data", StringType())])
    )
    with_structured_df = df.withColumn(
        "structured_data", deserialise_dynamo(df["data"], transaction_schema)
    )
    pre_enrichment_df = with_structured_df.select("structured_data.*").withColumn(
        "approximateArrivalTimestamp",
        from_unixtime(col("timestamp") / 1000).cast("timestamp"),
    )

    enriched_df = enrich_transactions(
        pre_enrichment_df, mock_stream_resolver(spark, test_case.rates), True
    )
    count = enriched_df.select("transactionAmountUSD").count()
    assert count == 1
    assert (
        enriched_df.select("transactionAmountUSD").first()[0]
        == test_case.expected_amount
    ), "Transaction amount is correct"

    spark.stop()
