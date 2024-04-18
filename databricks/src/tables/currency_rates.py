from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, to_timestamp, udf

from src.dynamo.deserialize import deserialise_dynamo
from src.entities.currency_rates import currency_schema
from src.tables.schema import PARTITION_KEY_ID_PATH, kinesis_event_schema
from src.tables.table_service import TableService


def currency_rates_transformation(df):
    dynamo_udf = udf(deserialise_dynamo, currency_schema)
    filtered_df = df.withColumn(
        "event", from_json(col("data").cast("string"), kinesis_event_schema)
    ).filter(col(PARTITION_KEY_ID_PATH) == "flagright#currency-cache")
    return filtered_df.withColumn("structured_data", dynamo_udf(col("data"))).select(
        col("structured_data.*"),
        col("approximateArrivalTimestamp"),
    )


class CurrencyTable:
    """
    CurrencyTable manages the currency exchange rates table
    """

    def __init__(
        self,
        spark: SparkSession,
        table_service: TableService,
    ):
        self.spark = spark
        self.table_service = table_service

    def backfill(self):
        print("Backfilling currencies from dump")
        currency_df = self.spark.read.json(
            "/data/currency_rates_backfill.json", currency_schema
        ).withColumn(
            "approximateArrivalTimestamp", to_timestamp(col("date"), "yyyy-MM-dd")
        )
        self.table_service.write_table("currency_rates", currency_df, False)

    def start_stream(self):
        print("Creating currency rates table")
        currency_rates_df = currency_rates_transformation(
            self.table_service.read_table_stream("kinesis_events")
        )
        self.table_service.write_table_stream(
            "currency_rates", currency_rates_df, False
        )
