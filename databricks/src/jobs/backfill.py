# type: ignore
import logging
import os
import sys

import pymongo
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, lit

from databricks.sdk.runtime import *

sys.path.append(os.path.abspath("/Workspace/Shared/main/src"))

from openapi_client.models.transaction import (  # pylint: disable=import-error
    Transaction,
)

from entities import entities  # pylint: disable=import-error

# MongoDB Connection Setup
MONGO_USERNAME = dbutils.secrets.get(  # pylint: disable=undefined-variable
    "mongo", "mongo-username"
)
MONGO_PASSWORD = dbutils.secrets.get(  # pylint: disable=undefined-variable
    "mongo", "mongo-password"
)
MONGO_HOST = dbutils.secrets.get(  # pylint: disable=undefined-variable
    "mongo", "mongo-host"
)


def load_mongo(table, partition_key, id_column, schema):
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger("MongoDBToDelta")
    connection_uri = f"mongodb+srv://{MONGO_USERNAME}:{MONGO_PASSWORD}@{MONGO_HOST}"
    client = pymongo.MongoClient(connection_uri, 27017, maxPoolSize=50)
    db_name = "tarpon"
    db = client[db_name]
    table_path = f"hive_metastore.default.{table}_backfill"

    # Initialize Spark Session
    spark = SparkSession.builder.appName("MongoDBToDelta").getOrCreate()

    # Clear existing table
    empty_df = spark.createDataFrame([], schema)
    empty_df.write.format("delta").mode("overwrite").saveAsTable(table_path)

    suffix = f"-{table}"

    # List the collections and process each
    for coll in db.list_collection_names():
        if not coll.endswith(suffix):
            continue
        tenant = coll.replace(suffix, "")
        logger.info("Processing collection: %s", coll)
        df = (
            spark.read.format("mongo")
            .option("database", db_name)
            .option("uri", connection_uri)
            .option("collection", coll)
            .schema(schema)
            .load()
            .withColumn("tenant", lit(tenant))
        )
        df.write.option("mergeSchema", "true").format("delta").mode(
            "append"
        ).saveAsTable(table_path)
        logger.info("Collection processed: %s", coll)
    logger.info("All collections processed successfully.")


for entity in entities:
    load_mongo(
        entity["table"], entity["partition_key"], entity["id_column"], entity["schema"]
    )
