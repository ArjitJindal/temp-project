# type: ignore
import logging
import os
import sys

import pymongo
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, lit

# Hack to make module imports work on Databricks
sys.path.append(os.path.abspath("/Workspace/Shared/main/src"))

# pylint: disable=import-error,wrong-import-position
from openapi_client.models.user import User  # pylint: disable=import-error

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

    # Initialize Spark Session
    spark = SparkSession.builder.appName("MongoDBToDelta").getOrCreate()

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
        )
        transformed_df = (
            df.withColumn("tenant", lit(tenant))
            .withColumn("PartitionKeyID", lit(f"{tenant}{partition_key}"))
            .withColumn("SortKeyID", col(id_column))
            # Timestamp of 0 to indicate the initial data load.
            .withColumn(
                "approximateArrivalTimestamp",
                lit("1970-01-01 00:00:00").cast("timestamp"),
            )
            .withColumn("event", lit("INSERT"))
        )
        (
            transformed_df.write.mode("append")
            .format("delta")
            .saveAsTable(f"{table.replace('-', '_')}_cdc")
        )
        logger.info("Collection processed: %s", coll)
    logger.info("All collections processed successfully.")

