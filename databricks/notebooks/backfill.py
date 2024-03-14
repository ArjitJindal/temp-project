# Databricks notebook source
# MAGIC %pip install /Workspace/Shared/src-0.1.0-py3-none-any.whl

# COMMAND ----------

import pymongo
from pyspark.sql.functions import lower, lit
import logging
import os

from databricks.sdk.runtime import *

from src.entities import entities, currency_schema

dbutils.widgets.text("entities", ",".join(entity["table"] for entity in entities), "Entities to backfill")

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

def load_mongo(table, schema):
    mongo_table = table.replace("_", "-")
    logging.basicConfig(level=logging.INFO)
    connection_uri = f"mongodb+srv://{MONGO_USERNAME}:{MONGO_PASSWORD}@{MONGO_HOST}"
    client = pymongo.MongoClient(connection_uri, 27017, maxPoolSize=50)
    db_name = "tarpon"
    db = client[db_name]
    table_path = f"{stage}.default.{table}_backfill"

    # Clear existing table
    empty_df = spark.createDataFrame([], schema)
    empty_df.write.option("mergeSchema", "true").format("delta").mode(
        "overwrite"
    ).saveAsTable(table_path)

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
                .schema(schema)
                .load()
                .withColumn("tenant", lit(tenant.lower()))
            )
            df.write.option("mergeSchema", "true").format("delta").mode(
                "append"
            ).saveAsTable(table_path)
            logger.info("Collection processed: %s", coll)
        except:
            logger.info("Could not backfill from %s", coll)
    logger.info("All collections processed successfully.")

entity_names = dbutils.widgets.get("entities")

logger.info("Backfilling currencies")

# Path to your JSON file in Databricks File System (DBFS)
json_file_path = "/data/currency_rates_backfill.json"
df = spark.read.json(json_file_path, currency_schema)
df.write.option("mergeSchema", "true").format("delta").mode("overwrite").saveAsTable(f"{stage}.default.currency_rates_backfill")

logger.info("Backfilling entities")
for entity in entities:
    is_present = entity["table"] in entity_names.split(',')
    if is_present:
        load_mongo(
            entity["table"], entity["schema"]
        )
