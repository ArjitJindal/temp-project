from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_unixtime, to_timestamp, udf
from pyspark.sql.types import StringType, StructField, StructType

from src.dynamo.serde import deserialise_dynamo
from src.entities import currency_schema, enrich_transactions, transaction_schema

CUR_DIR = Path(__file__).parent.absolute()


def test_transaction_enrichment():
    spark = SparkSession.builder.appName("Extension test").getOrCreate()
    with open(
        f"{CUR_DIR}/dynamo/fixtures/transaction.json", "r", encoding="UTF-8"
    ) as file:
        txn = file.read()
    transaction_data = [(txn,)]

    test_cases = [
        {
            "rates": [
                ("2024-01-26", {"USD": 0.5, "EUR": 0.15, "GBP": 0.50}),
                ("2024-01-27", {"USD": 1.0, "EUR": 0.25, "GBP": 0.55}),
                ("2024-01-28", {"USD": 1.5, "EUR": 0.35, "GBP": 0.60}),
            ],
            "expectedAmount": 232064.0,
        },
        {
            "rates": [("2024-01-28", {"USD": 1.0, "EUR": 0.25, "GBP": 0.55})],
            "expectedAmount": None,
        },
    ]
    my_udf = udf(deserialise_dynamo, transaction_schema)

    for test_case in test_cases:
        df = spark.createDataFrame(
            transaction_data, StructType([StructField("data", StringType())])
        )
        with_structured_df = df.withColumn("structured_data", my_udf(df["data"]))
        pre_enrichment_df = with_structured_df.select("structured_data.*").withColumn(
            "approximateArrivalTimestamp",
            from_unixtime(col("timestamp") / 1000).cast("timestamp"),
        )
        currency_rates = spark.createDataFrame(test_case["rates"], currency_schema)

        currency_rates = currency_rates.withColumn(
            "approximateArrivalTimestamp",
            to_timestamp(col("date"), "yyyy-MM-dd"),
        )

        count = (
            enrich_transactions(pre_enrichment_df, currency_rates)
            .select("transactionAmountUSD")
            .count()
        )
        assert count == 1
        assert (
            enrich_transactions(pre_enrichment_df, currency_rates)
            .select("transactionAmountUSD")
            .first()[0]
            == test_case["expectedAmount"]
        ), "Transaction amount is correct"

    spark.stop()
