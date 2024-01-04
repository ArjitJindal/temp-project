import json

import pyspark.sql.functions as F
from boto3.dynamodb.types import TypeDeserializer
from pyspark.sql.functions import udf


def deserialise_dynamo(column):
    try:
        return TypeDeserializer().deserialize(
            {"M": json.loads(column)["dynamodb"]["NewImage"]}
        )
    except KeyError:
        return None


deserialise_dynamo_udf = udf(deserialise_dynamo)


def transform_event_data(event_df):
    return event_df.withColumn("json_data", deserialise_dynamo_udf(F.col("data")))
