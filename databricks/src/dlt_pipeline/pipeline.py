# type: ignore
import json
import os
import sys

import dlt  # pylint: disable=import-error
from boto3.dynamodb.types import TypeDeserializer
from data_quality_checks import (  # pylint: disable=import-error
    raw_event_data_valid,
    raw_event_data_warn,
)
from pyspark.sql.functions import col, expr, from_json, regexp_extract, udf

sys.path.append(os.path.abspath("/Workspace/Shared/main/src"))

from openapi_client.models.transaction import (  # pylint: disable=import-error
    Transaction,
)
from openapi_client.models.user import User  # pylint: disable=import-error

from dlt_pipeline.schema import kinesis_event_schema  # pylint: disable=import-error

aws_access_key = dbutils.secrets.get(  # pylint: disable=undefined-variable
    "kinesis", "aws-access-key"
)

aws_secret_key = dbutils.secrets.get(  # pylint: disable=undefined-variable
    "kinesis", "aws-secret-key"
)


def deserialise_dynamo(column):
    data = json.loads(column)
    try:
        if "dynamodb" in data and "NewImage" in data["dynamodb"]:
            return TypeDeserializer().deserialize({"M": data["dynamodb"]["NewImage"]})
        return None
    except KeyError:
        return None


entities = [
    ["transactions", Transaction, "transaction#primary"],
    ["users", User, "user#primary"],
]


def define_pipeline(spark):
    @dlt.table(
        comment="Raw event data from Kinesis",
        table_properties={
            "pipelines.reset.allowed": "false",
        },
    )
    @dlt.expect_all_or_drop(raw_event_data_valid)
    @dlt.expect_all(raw_event_data_warn)
    def kinesis_events():
        return (
            spark.readStream.format("kinesis")
            .option("streamName", os.environ["KINESIS_STREAM"])
            .option("region", os.environ["KINESIS_REGION"])
            .option("awsAccessKey", aws_access_key)
            .option("awsSecretKey", aws_secret_key)
            .option("startingposition", "latest")
            .load()
        )

    for entity in entities:
        create_entity_tables(entity[0], entity[1], entity[2])


def create_entity_tables(entity, schema, dynamo_key):
    cdc_table_name = f"{entity}_cdc"

    @dlt.table(name=cdc_table_name, comment=f"{entity} CDC", partition_cols=["tenant"])
    def cdc():
        deserialisation_udf = udf(deserialise_dynamo, schema)
        partition_key_id_path = "event.dynamodb.Keys.PartitionKeyID.S"
        sort_key_id_path = "event.dynamodb.Keys.SortKeyID.S"
        df = (
            dlt.readStream("kinesis_events")
            .withColumn(
                "event", from_json(col("data").cast("string"), kinesis_event_schema)
            )
            .withColumn(
                "PartitionKeyID",
                col(partition_key_id_path).alias("PartitionKeyID"),
            )
            .withColumn(
                "SortKeyID",
                col(sort_key_id_path).alias("SortKeyID"),
            )
            .withColumn(
                "tenant",
                regexp_extract(col(partition_key_id_path), "^[^#]*", 0).alias("tenant"),
            )
            .withColumn("structured_data", deserialisation_udf(col("data")))
        )

        return df.filter(col(partition_key_id_path).contains(dynamo_key)).select(
            col("structured_data.*"),
            col("tenant"),
            col("PartitionKeyID"),
            col("SortKeyID"),
            col("approximateArrivalTimestamp"),
            col("event.eventName").alias("event"),
        )

    dlt.create_streaming_live_table(
        name=entity,
        partition_cols=["tenant"],
    )
    dlt.apply_changes(
        target=entity,
        source=cdc_table_name,
        keys=["PartitionKeyID", "SortKeyID"],
        sequence_by=col("approximateArrivalTimestamp"),
        apply_as_deletes=expr("event = 'REMOVE'"),
    )


define_pipeline(spark)  # pylint: disable=undefined-variable
