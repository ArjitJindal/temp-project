from pyspark.sql import SparkSession
from pyspark.sql.functions import lit
from pyspark.sql.types import StringType, StructField, StructType

from src.dlt.cdc import cdc_transformation
from src.entities.mock import mock_stream_resolver
from src.entities.transactions import transaction_entity
from src.testing.file import read_file


def test_cdc_transformation():
    spark = SparkSession.builder.appName("Extension test").getOrCreate()
    txn = read_file("fixtures/transaction.json")
    transaction_data = [(txn,)]

    transactions_df = spark.createDataFrame(
        transaction_data, StructType([StructField("data", StringType())])
    ).withColumn(
        "approximateArrivalTimestamp", lit("1970-01-01 00:00:00").cast("timestamp")
    )

    stream_resolver = mock_stream_resolver(
        spark,
        [
            ("2021-01-01", {"GBP": 0.15}),
        ],
    )
    transformed_df = cdc_transformation(
        transaction_entity, transactions_df, stream_resolver
    )
    assert (
        transformed_df.select("originAmountDetails.transactionAmount").first()[0]
        == 58016.0
    ), "Transaction amount is correct"

    assert transformed_df.count() == 1, "Transaction amount is correct"

    not_txn = read_file("fixtures/dynamic_risk_value.json")
    transaction_data = [(not_txn,)]

    transactions_df = spark.createDataFrame(
        transaction_data, StructType([StructField("data", StringType())])
    ).withColumn(
        "approximateArrivalTimestamp", lit("1970-01-01 00:00:00").cast("timestamp")
    )

    stream_resolver = mock_stream_resolver(spark, [("2021-01-01", {"GBP": 0.15})])
    transformed_df = cdc_transformation(
        transaction_entity, transactions_df, stream_resolver
    )
    assert transformed_df.first() is None, "Wrong kinesis event not selected"

    spark.stop()
