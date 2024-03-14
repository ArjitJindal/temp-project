# Databricks notebook source
# MAGIC %pip install /Workspace/Shared/src-0.1.0-py3-none-any.whl

# COMMAND ----------

import os
import dlt
import sentry_sdk
from pyspark.sql.functions import col, expr, from_json, lit, regexp_extract, udf, lower, to_timestamp
from src.dlt.schema import kinesis_event_schema
from src.dynamo.serde import deserialise_dynamo
from src.entities import entities, currency_schema

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

partition_key_id_path = "event.dynamodb.Keys.PartitionKeyID.S"

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
        deserialisation_udf = udf(deserialise_dynamo, currency_schema)
        filtered_df = (
            dlt.readStream("kinesis_events")
            .withColumn(
                "event", from_json(col("data").cast("string"), kinesis_event_schema)
            )
            .filter(col(partition_key_id_path) == "flagright#currency-cache")
        )
        return filtered_df.withColumn("structured_data", deserialisation_udf(col("data"))).select(
            col("structured_data.*"),
            col("event.eventName").alias("event"),
            col("approximateArrivalTimestamp"),
        )

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
            entity.get("table"),
            entity.get("schema"),
            entity.get("partition_key"),
            entity.get("source"),
            entity.get("enrichment_fn"),
        )

def create_entity_tables(entity, schema, dynamo_key, source, enrichment_fn):
    cdc_table_name = f"{entity}_cdc"
    backfill_table_name = f"{entity}_backfill"

    dlt.create_streaming_table(
        name=cdc_table_name,
        partition_cols=["tenant"],
    )

    @dlt.append_flow(
        name=cdc_table_name,
        target=cdc_table_name,
    )
    def cdc():
        deserialisation_udf = udf(deserialise_dynamo, schema)
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
        with_structured_df = filtered_df.withColumn("structured_data", deserialisation_udf(col("data"))).alias("entity")

        pre_enrichment_df = with_structured_df.select(
            col("structured_data.*"),
            col("tenant"),
            col("PartitionKeyID"),
            col("SortKeyID"),
            col("approximateArrivalTimestamp"),
            col("entity.event.eventName").alias("event"),
        )

        if enrichment_fn:
            currency_rates = (
                dlt.readStream("currency_rates")
            )
            return enrichment_fn(pre_enrichment_df, currency_rates)
        return pre_enrichment_df

    @dlt.append_flow(
        name=backfill_table_name,
        target=cdc_table_name,
    )
    def backfill():
        stage = os.environ["STAGE"]
        return spark.readStream.format("delta").table(f"{stage}.default.{backfill_table_name}")

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
