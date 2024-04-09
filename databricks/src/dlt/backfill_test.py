from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.functions import lit

from src.dlt.backfill import backfill_transformation
from src.entities.mock import mock_stream_resolver
from src.entities.transactions import transaction_entity, transaction_schema

CUR_DIR = Path(__file__).parent.absolute()


def test_backfill_transformation():
    spark = SparkSession.builder.appName("Extension test").getOrCreate()
    df = spark.read.schema(transaction_schema).json(
        f"{CUR_DIR}/../../fixtures/transaction_processed.json"
    )

    stream_resolver = mock_stream_resolver(spark, [("2024-01-27", {"EUR": 0.15})])

    df_with_column = df.withColumn("tenant", lit("some_tenant"))

    transformed_df = backfill_transformation(
        transaction_entity, df_with_column, stream_resolver
    )
    assert (
        transformed_df.select("originAmountDetails.transactionAmount").first()[0]
        == 16211
    ), "Transaction amount is correct"
    assert (
        round(transformed_df.select("transactionAmountUSD").first()[0]) == 108073
    ), "Transaction amount is correct"
    assert (
        transformed_df.select("PartitionKeyID").first()[0]
        == "some_tenant#transaction#primary"
    ), "Transaction partition key is correct"

    spark.stop()
