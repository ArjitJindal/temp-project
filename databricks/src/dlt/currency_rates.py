from pyspark.sql.functions import col, from_json, udf

from src.dlt.cdc import PARTITION_KEY_ID_PATH
from src.dlt.schema import kinesis_event_schema
from src.dynamo.deserialize import deserialise_dynamo
from src.entities.currency_rates import currency_schema


def currency_rates_transformation(df):
    deserialisation_udf = udf(deserialise_dynamo, currency_schema)
    filtered_df = df.withColumn(
        "event", from_json(col("data").cast("string"), kinesis_event_schema)
    ).filter(col(PARTITION_KEY_ID_PATH) == "flagright#currency-cache")
    return filtered_df.withColumn(
        "structured_data", deserialisation_udf(col("data"))
    ).select(
        col("structured_data.*"),
        col("event.eventName").alias("event"),
        col("approximateArrivalTimestamp"),
    )
