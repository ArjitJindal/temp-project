# Databricks notebook source
# MAGIC %pip install databricks-sdk --upgrade
# MAGIC %pip install /Workspace/Shared/src-0.1.0-py3-none-any.whl

# COMMAND ----------
dbutils.library.restartPython()

# COMMAND ----------

from databricks.sdk import WorkspaceClient

import os
import pymongo
from pyspark.sql.functions import lit, col, to_timestamp
from pyspark.sql import DataFrame
import logging

from databricks.sdk.runtime import *

from src.entities.entities import entities
from src.dlt.backfill import backfill_transformation
from src.entities.currency_rates import currency_schema

w = WorkspaceClient()

for p in w.pipelines.list_pipelines():
    if p.name == "main":
        main_pipeline = p

if main_pipeline is None:
    raise Exception("No main pipeline found")

dbutils.widgets.text("entities", ",".join(entity.table for entity in entities), "Entities to backfill")

# MongoDB Connection Setup
MONGO_USERNAME = dbutils.secrets.get(
    "mongo", "mongo-username"
)
MONGO_PASSWORD = dbutils.secrets.get(
    "mongo", "mongo-password"
)
MONGO_HOST = dbutils.secrets.get(
    "mongo", "mongo-host"
)

stage = os.environ["STAGE"]

logger = logging.getLogger("backfill")

json_file_path = "/data/currency_rates_backfill.json"
currency_df = spark.read.json(json_file_path, currency_schema)
currency_df = (
    currency_df
    .withColumn(
        "approximateArrivalTimestamp",
        to_timestamp(col("date"), "yyyy-MM-dd")
    )
)

def load_mongo(entity):
    table = entity.table
    mongo_table = table.replace("_", "-")
    logging.basicConfig(level=logging.INFO)
    connection_uri = f"mongodb+srv://{MONGO_USERNAME}:{MONGO_PASSWORD}@{MONGO_HOST}"
    client = pymongo.MongoClient(connection_uri, 27017, maxPoolSize=50)
    db_name = "tarpon"
    db = client[db_name]
    table_path = f"{stage}.default.{table}_backfill"

    suffix = f"-{mongo_table}"

    # List the collections and process each
    for coll in db.list_collection_names():
        if not coll.endswith(suffix):
            continue

        tenant = coll.replace(suffix, "")
        logger.info("Processing collection: %s", coll)
        try:
            df = (
                spark.read.format("mongo")
                .option("database", db_name)
                .option("uri", connection_uri)
                .option("collection", coll)
                .schema(entity.schema)
                .load()
                .withColumn("tenant", lit(tenant.lower()))
            )

            def stream_resolver(stream_name: str) -> DataFrame:
                if stream_name == "currency_rates":
                    return currency_df
                raise Exception(f"No stream with name {stream_name}")

            final_df = backfill_transformation(entity, df, stream_resolver)

            final_df.write.option("mergeSchema", "true").format("delta").mode(
                "append"
            ).saveAsTable(table_path)
            logger.info("Collection backfilled: %s", coll)
        except Exception as e:
            logging.error("Failed to backfill %s %s", coll, str(e))

    logger.info("All collections processed.")


entity_names = dbutils.widgets.get("entities")

w.pipelines.stop_and_wait(p.pipeline_id)
logger.info("Backfilling currencies")
currency_df.write.option("mergeSchema", "true").format("delta").mode("overwrite").saveAsTable(
    f"{stage}.default.currency_rates_backfill")

logger.info("Resetting backfill tables")
for entity in entities:
    is_present = entity.table in entity_names.split(',')
    if is_present:
        table = entity.table
        table_path = f"{stage}.default.{table}_backfill"
        # Clear existing table
        empty_df = spark.createDataFrame([], entity.schema)
        empty_df.write.option("mergeSchema", "true").format("delta").mode(
            "overwrite"
        ).saveAsTable(table_path)

logger.info("Refreshing Delta Live Tables!")
w.pipelines.start_update(p.pipeline_id, full_refresh=True)

logger.info("Backfilling entities")
for entity in entities:
    is_present = entity.table in entity_names.split(',')
    if is_present:
        load_mongo(entity)
