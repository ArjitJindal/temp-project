# Databricks notebook source
# MAGIC %pip install /Workspace/Shared/src-0.1.0-py3-none-any.whl

# COMMAND ----------

import os
import dlt
from pyspark.sql.functions import col, concat, expr, from_json, lit, regexp_extract, udf, lower

from src.dlt.schema import kinesis_event_schema
from src.dynamo.serde import deserialise_dynamo
from src.entities import entities

aws_access_key = dbutils.secrets.get(
    "kinesis", "aws-access-key"
)

aws_secret_key = dbutils.secrets.get(
    "kinesis", "aws-secret-key"
)

def define_pipeline(spark):
    @dlt.table(
        comment="Raw event data from hammerhead Kinesis stream",
        table_properties={
            "pipelines.reset.allowed": "false",
        },
    )
    def hammerhead_kinesis_events():
        return (
            spark.readStream.format("kinesis")
            .option("streamName", os.environ["HAMMERHEAD_KINESIS_STREAM"])
            .option("region", os.environ["AWS_REGION"])
            .option("awsAccessKey", aws_access_key)
            .option("awsSecretKey", aws_secret_key)
            .load()
        )
    @dlt.table(
        comment="Raw event data from Kinesis",
        table_properties={
            "pipelines.reset.allowed": "false",
        },
    )
    def kinesis_events():
        return (
            spark.readStream.format("kinesis")
            .option("streamName", os.environ["KINESIS_STREAM"])
            .option("region", os.environ["AWS_REGION"])
            .option("awsAccessKey", aws_access_key)
            .option("awsSecretKey", aws_secret_key)
            .load()
        )

    for entity in entities:
        create_entity_tables(
            entity["table"],
            entity["schema"],
            entity["partition_key"],
            entity["id_column"],
            entity["source"],
        )


def create_entity_tables(entity, schema, dynamo_key, id_column, source):
    cdc_table_name = f"{entity}_cdc"
    backfill_table_name = f"{entity}_backfill"

    def cdc():
        deserialisation_udf = udf(deserialise_dynamo, schema)
        partition_key_id_path = "event.dynamodb.Keys.PartitionKeyID.S"
        sort_key_id_path = "event.dynamodb.Keys.SortKeyID.S"
        df = (
            dlt.readStream(source)
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
                lower(regexp_extract(col(partition_key_id_path), "^[^#]*", 0)).alias("tenant"),
            )
        )

        filtered_df = (
            df
            # ignore tiermoney on sandbox and they have schema breaking data.
            .filter(lower(col("tenant")) != lower(lit("1RRDYI5GQ4")))
            .filter(col(partition_key_id_path).contains(dynamo_key))
        )
        with_structured_df = filtered_df.withColumn("structured_data", deserialisation_udf(col("data")))
        return with_structured_df.select(
            col("structured_data.*"),
            col("tenant"),
            col("PartitionKeyID"),
            col("SortKeyID"),
            col("approximateArrivalTimestamp"),
            col("event.eventName").alias("event"),
        )

    dlt.table(cdc,
        name=cdc_table_name,
        comment=f"{entity} CDC",
        partition_cols=["tenant"]
    )

    @dlt.append_flow(
        name=backfill_table_name,
        target=cdc_table_name,
    )
    def backfill():
        df = spark.readStream.format("delta").table(backfill_table_name)
        return (
            df.withColumn("PartitionKeyID", concat(df["tenant"], lit(dynamo_key)))
            .withColumn("SortKeyID", col(id_column))
            # Timestamp of 0 to indicate the initial data load.
            .withColumn(
                "approximateArrivalTimestamp",
                lit("1970-01-01 00:00:00").cast("timestamp"),
            )
            .withColumn("event", lit("INSERT"))
        )

    dlt.create_streaming_table(
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

define_pipeline(spark)
