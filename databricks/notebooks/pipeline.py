# Databricks notebook source
# MAGIC %pip install /Workspace/Shared/src-0.1.0-py3-none-any.whl

# COMMAND ----------

import os
import dlt
import sentry_sdk
from pyspark.sql import DataFrame
from pyspark.sql.functions import col, expr, to_timestamp

from src.dlt.cdc import cdc_transformation
from src.dlt.currency_rates import currency_rates_transformation
from src.entities.entities import entities

aws_access_key = dbutils.secrets.get(
    "kinesis", "aws-access-key"
)

aws_secret_key = dbutils.secrets.get(
    "kinesis", "aws-secret-key"
)

SENTRY_DSN = "https://2f1b7e0a135251afb6ab00dbeab9c423@o1295082.ingest.us.sentry.io/4506869105754112"

sentry_sdk.init(
    dsn=SENTRY_DSN,
    traces_sample_rate=1.0,
)

@dlt.on_event_hook
def write_events_to_sentry(event):
    eventType = event.get('event_type', '')
    if eventType == 'update_progress':  
        eventState = event.get('details', {}).get('update_progress', {}).get('state', '')

        if 'FAIL' in eventState or 'STOP' in eventState:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("eventType", eventType)
                scope.set_tag("eventState", eventState)
                sentry_sdk.set_extra("event", event)
                sentry_sdk.capture_event({
                    "message": f"Delta live tables pipeline status: {eventState}",
                    "level": "error",
                    "logger": "dlt",
                })

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

    @dlt.table(
        comment="Currency exchange table",
    )
    def currency_rates():
        return currency_rates_transformation(dlt.readStream("kinesis_events"))

    @dlt.append_flow(
        name="currency_rates_backfill",
        target="currency_rates",
    )
    def currency_rates_backfill():
        stage = os.environ["STAGE"]
        return (
            spark.readStream.format("delta").table(f"{stage}.default.currency_rates_backfill")
            .withColumn(
                "approximateArrivalTimestamp",
                to_timestamp(col("date"), "yyyy-MM-dd"),
            )
        )

    for entity in entities:
        create_entity_tables(
            entity,
        )

def create_entity_tables(entity):
    table = entity.table
    source = entity.source
    cdc_table_name = f"{table}_cdc"
    backfill_table_name = f"{table}_backfill"

    dlt.create_streaming_table(
        name=cdc_table_name,
        partition_cols=["tenant"],
    )

    @dlt.append_flow(
        name=cdc_table_name,
        target=cdc_table_name,
    )
    def cdc():
        def stream_resolver(stream_name: str) -> DataFrame:
            return dlt.readStream(stream_name)
        return cdc_transformation(entity, dlt.readStream(source), stream_resolver)

    @dlt.append_flow(
        name=backfill_table_name,
        target=cdc_table_name,
    )
    def backfill():
        stage = os.environ["STAGE"]
        return spark.readStream.format("delta").table(f"{stage}.default.{backfill_table_name}")

    dlt.create_streaming_table(
        name=table,
        partition_cols=["tenant"],
    )
    dlt.apply_changes(
        target=table,
        source=cdc_table_name,
        keys=["PartitionKeyID", "SortKeyID"],
        sequence_by=col("approximateArrivalTimestamp"),
        apply_as_deletes=expr("event = 'REMOVE'"),
    )

define_pipeline(spark)
