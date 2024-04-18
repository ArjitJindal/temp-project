from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.functions import lit
from pyspark.sql.types import StringType, StructField, StructType

from src.entities.transactions import transaction_entity, transaction_schema
from src.tables.entity_tables import backfill_transformation, cdc_transformation
from src.testing.file import read_file

CUR_DIR = Path(__file__).parent.absolute()


def test_backfill_transformation():
    spark = SparkSession.builder.appName("Extension test").getOrCreate()
    df = spark.read.schema(transaction_schema).json(
        f"{CUR_DIR}/../../fixtures/transaction_processed.json"
    )

    df_with_column = df.withColumn("tenant", lit("some_tenant"))

    transformed_df = backfill_transformation(transaction_entity, df_with_column)
    assert (
        transformed_df.select("originAmountDetails.transactionAmount").first()[0]
        == 16211
    ), "Transaction amount is correct"
    assert (
        transformed_df.select("PartitionKeyID").first()[0]
        == "some_tenant#transaction#primary"
    ), "Transaction partition key is correct"

    spark.stop()


def test_cdc_transformation():
    spark = SparkSession.builder.appName("Extension test").getOrCreate()
    txn = read_file("fixtures/transaction.json")
    transaction_data = [(txn,)]

    transactions_df = spark.createDataFrame(
        transaction_data, StructType([StructField("data", StringType())])
    ).withColumn(
        "approximateArrivalTimestamp", lit("2024-01-27 12:00:00").cast("timestamp")
    )

    transformed_df = cdc_transformation(transaction_entity, transactions_df)
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

    transformed_df = cdc_transformation(transaction_entity, transactions_df)
    assert transformed_df.first() is None, "Wrong kinesis event not selected"

    spark.stop()
