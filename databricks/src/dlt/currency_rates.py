from pyspark.sql.functions import col, from_json, udf

from src.dlt.schema import PARTITION_KEY_ID_PATH, kinesis_event_schema
from src.dynamo.deserialize import legacy_deserialise_dynamo
from src.entities.currency_rates import currency_schema


def currency_rates_transformation(df):
    dynamo_udf = udf(legacy_deserialise_dynamo, currency_schema)
    filtered_df = df.withColumn(
        "event", from_json(col("data").cast("string"), kinesis_event_schema)
    ).filter(col(PARTITION_KEY_ID_PATH) == "flagright#currency-cache")
    return filtered_df.withColumn("structured_data", dynamo_udf(col("data"))).select(
        col("structured_data.*"),
        col("event.eventName").alias("event"),
        col("approximateArrivalTimestamp"),
    )
