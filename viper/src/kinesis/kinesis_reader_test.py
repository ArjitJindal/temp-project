from pyspark.sql import SparkSession
from pyspark.sql.types import StringType, StructField, StructType

from src.kinesis.kinesis_reader import kinesis_events_transformation
from src.testing.file import read_file


def test_kinesis_events_transformation():
    spark = SparkSession.builder.appName("Extension test").getOrCreate()

    transaction_data = read_file("fixtures/transaction.json")

    transaction_df = spark.createDataFrame(
        [(transaction_data,)], StructType([StructField("data", StringType())])
    )
    transformed_events = kinesis_events_transformation(transaction_df)
    assert (
        transformed_events.select("tenant").first()[0] == "aman-tenant"
    ), "Event tenant is correct"
