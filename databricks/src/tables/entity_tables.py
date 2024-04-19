import os

import pymongo
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import (
    col,
    concat,
    from_json,
    from_unixtime,
    lit,
    lower,
    regexp_extract,
)

from src.dynamo.deserialize import deserialise_dynamo_udf
from src.entities.entity import Entity
from src.tables.kinesis_tables import KinesisTables
from src.tables.schema import kinesis_event_schema
from src.tables.table_service import TableService

PARTITION_KEY_ID_PATH = "event.dynamodb.Keys.PartitionKeyID.S"


class EntityTables:
    """
    EntityTables provides abstractions for creating tables for the core
    entities like transactions and users.
    """

    def __init__(
        self,
        spark: SparkSession,
        schema: str,
        mongo_uri: str,
        table_service: TableService,
        kinesis_tables: KinesisTables,
    ):
        self.schema = schema
        self.spark = spark
        self.table_service = table_service
        self.mongo_uri = mongo_uri
        self.kinesis_tables = kinesis_tables

    def refresh(self, entity: Entity):

        kinesis_df = cdc_transformation(
            entity,
            self.table_service.read_table(entity.source),
        )
        backfill_df = self.table_service.read_table(f"{entity.table}_backfill")

        print("Refresh from kinesis and the backfill tables")
        tenants = self.table_service.tenant_schemas()
        self.table_service.clear_table(f"{entity.table}_cdc")
        stage = os.environ["STAGE"]
        for tenant in tenants:
            self.table_service.clear_table(entity.table, schema=tenant)
            schema = f"{stage}.{tenant}"

            for stream in [kinesis_df, backfill_df]:
                if entity.enrichment_fn is not None:
                    stream = entity.enrichment_fn(stream, self.table_service.read_table)
                self.table_service.write_table(
                    entity.table,
                    stream.filter(stream["tenant"] == tenant),
                    True,
                    schema=schema,
                )

    def start_streams(self, entity: Entity):
        df = cdc_transformation(
            entity,
            self.kinesis_tables.get_stream(entity.source),
        )
        if entity.enrichment_fn is None:
            self.create_entity_stream(df, entity)
        else:
            # If we want to enrich our entity stream by joining it on other streams,
            # we must store a CDC intermediate table as stream-stream joins cannot be
            # persisted in "update" mode.
            enriched_stream = entity.enrichment_fn(
                df, self.table_service.read_table_stream
            )
            self.table_service.write_table_stream(
                f"{entity.table}_cdc", enriched_stream
            )
            self.create_entity_stream(
                self.table_service.read_table_stream(f"{entity.table}_cdc"), entity
            )

    def create_entity_stream(self, df: DataFrame, entity: Entity):
        print(f"Setting up {entity.table} table stream")

        matcher_condition = f"s.{entity.id_column} = t.{entity.id_column}"
        id_column = entity.id_column
        timestamp_column = entity.timestamp_column
        incoming_updates = f"{entity.table}_incoming_updates"
        latest_updates = f"{entity.table}_latest_updates"

        def upsert_to_delta(micro_batch_output_df, _batch_id):
            tenants = [
                row.tenant
                for row in micro_batch_output_df.select("tenant").distinct().collect()
            ]

            micro_batch_output_df.createOrReplaceTempView(incoming_updates)

            spark = micro_batch_output_df.sparkSession

            spark.sql(
                f"""
                CREATE OR REPLACE TEMP VIEW {latest_updates} AS
                SELECT *
                FROM (
                    SELECT *, ROW_NUMBER() OVER (PARTITION BY {id_column} 
                    ORDER BY {timestamp_column} DESC) AS rn
                    FROM {incoming_updates}
                ) tmp
                WHERE rn = 1
            """
            )
            table = entity.table
            stage = os.environ["STAGE"]

            for tenant in tenants:
                spark.sql(
                    f"""
                    MERGE INTO {stage}.{tenant}.{table} t
                    USING {latest_updates} s
                    ON {matcher_condition} and s.tenant = "{tenant}"
                    WHEN MATCHED THEN UPDATE SET *
                    WHEN NOT MATCHED THEN INSERT *
                """
                )

        return (
            df.writeStream.format("delta")
            .foreachBatch(upsert_to_delta)
            .option("mergeSchema", "true")
            .outputMode("update")
            .queryName(entity.table)
            .start()
        )

    def create_enrichment_stream(self, entity):
        entity_stream = self.table_service.read_table_stream(entity.table)
        enriched_stream = entity.enrichment_fn(
            entity_stream, self.table_service.read_table_stream
        )
        self.table_service.write_table_stream(
            f"{entity.table}_enriched", enriched_stream
        )

    def backfill(self, entity):
        table = entity.table
        mongo_table = table.replace("_", "-")
        client = pymongo.MongoClient(self.mongo_uri, 27017, maxPoolSize=50)
        db_name = "tarpon"
        db = client[db_name]
        table_path = f"{self.schema}.{table}_backfill"

        suffix = f"-{mongo_table}"

        # List the collections and process each
        for coll in db.list_collection_names():
            if not coll.endswith(suffix):
                continue

            print(f"Backfilling for: {coll}")

            try:
                tenant = coll.replace(suffix, "")
                df = (
                    self.spark.read.format("mongo")
                    .option("database", db_name)
                    .option("uri", self.mongo_uri)
                    .option("collection", coll)
                    .schema(entity.schema)
                    .load()
                    .withColumn("tenant", lit(tenant.lower()))
                )

                final_df = backfill_transformation(entity, df)

                final_df.write.option("mergeSchema", "true").format("delta").mode(
                    "append"
                ).saveAsTable(table_path)
                print(f"Collection backfilled: {coll}")
            except:  # pylint: disable=bare-except
                print(f"Failed to backfill: {coll}")



def backfill_transformation(entity: Entity, df: DataFrame) -> DataFrame:
    return (
        df.withColumn(
            "PartitionKeyID", concat(df["tenant"], lit("#"), lit(entity.partition_key))
        )
        .withColumn("SortKeyID", col(entity.id_column))
        .withColumn(
            "approximateArrivalTimestamp",
            from_unixtime(col(entity.timestamp_column) / 1000).cast("timestamp"),
        )
        .withColumn("event", lit("INSERT"))
    )


def cdc_transformation(entity: Entity, read_stream: DataFrame) -> DataFrame:
    sort_key_id_path = "event.dynamodb.Keys.SortKeyID.S"
    df = (
        read_stream.filter(col("data").cast("string").contains(entity.partition_key))
        .select("data", "approximateArrivalTimestamp")
        .withColumn(
            "event", from_json(col("data").cast("string"), kinesis_event_schema)
        )
        .withColumn(
            "PartitionKeyID",
            col(PARTITION_KEY_ID_PATH).alias("PartitionKeyID"),
        )
        .withColumn(
            "SortKeyID",
            col(sort_key_id_path).alias("SortKeyID"),
        )
        .withColumn(
            "tenant",
            lower(regexp_extract(col(PARTITION_KEY_ID_PATH), "^[^#]*", 0)).alias(
                "tenant"
            ),
        )
    )

    filtered_df = df.filter(col(PARTITION_KEY_ID_PATH).contains(entity.partition_key))

    with_structured_df = filtered_df.withColumn(
        "structured_data", deserialise_dynamo_udf("data", entity.schema)
    ).alias("entity")

    final_df = with_structured_df.select(
        col("structured_data.*"),
        col("tenant"),
        col("PartitionKeyID"),
        col("SortKeyID"),
        col("approximateArrivalTimestamp"),
        col("entity.event.eventName").alias("event"),
    )

    # Ignore remove events
    return final_df.filter(col("event") != "REMOVE")
