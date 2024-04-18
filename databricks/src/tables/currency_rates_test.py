from pyspark.sql import SparkSession
from pyspark.sql.functions import lit
from pyspark.sql.types import StringType, StructField, StructType

from src.tables.currency_rates import currency_rates_transformation
from src.testing.file import read_file


def test_currency_rates_transformation():
    spark = SparkSession.builder.appName("Extension test").getOrCreate()

    currency_data = read_file("fixtures/currency.json")

    currency_df = spark.createDataFrame(
        [(currency_data,)], StructType([StructField("data", StringType())])
    ).withColumn(
        "approximateArrivalTimestamp", lit("2024-01-27 00:00:00").cast("timestamp")
    )
    transformed_currencies = currency_rates_transformation(currency_df)
    assert (
        round(transformed_currencies.select("rates.GBP").first()[0], 2) == 0.15
    ), "Transaction amount is correct"
