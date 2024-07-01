import json

from delta.tables import DeltaTable
from pyspark.sql import DataFrame, SparkSession, Window
from pyspark.sql.functions import (
    col,
    concat,
    from_json,
    from_unixtime,
    lit,
    lower,
    regexp_extract,
    row_number,
    to_date,
)

from src.aws.s3 import checkpoint_dir
from src.aws.secrets import get_secret
from src.dynamo.deserialize import deserialise_dynamo_udf
from src.entities.entity import Entity
from src.tables.kinesis_tables import KinesisTables
from src.tables.schema import kinesis_event_schema
from src.tables.table_service import TableService
from src.version_service import VersionService

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
        version_service: VersionService,
    ):
        self.schema = schema
        self.mongo_uri = mongo_uri
        self.spark = spark
        self.table_service = table_service
        self.kinesis_tables = kinesis_tables
        self.version_service = version_service

    @staticmethod
    def new(spark: SparkSession):
        mongo_connection = json.loads(get_secret("mongoAtlasCreds"))
        mongo_username = mongo_connection["username"]
        mongo_password = mongo_connection["password"]
        mongo_host = mongo_connection["host"]
        mongo_uri = f"mongodb+srv://{mongo_username}:{mongo_password}@{mongo_host}"
        table_service = TableService.new(spark)
        kinesis_tables = KinesisTables.new(spark)
        schema = "main"
        return EntityTables(
            spark,
            schema,
            mongo_uri,
            table_service,
            kinesis_tables,
            VersionService(spark),
        )

    def refresh(self, entity: Entity):
        kinesis_df = cdc_transformation(
            entity,
            self.table_service.read_table(entity.source),
        )
        backfill_df = self.table_service.read_table(
            f"{entity.table}_backfill"
        ).withColumn("date", to_date(col("approximateArrivalTimestamp")))

        print("Refresh from backfill and kinesis tables")

        def write(df: DataFrame, mode: str):
            if entity.enrichment_fn is not None:
                df = entity.enrichment_fn(df, self.table_service.read_table)
            if "_id" in df.columns:
                df = df.drop("_id")
            self.table_service.write_table(
                entity.table,
                df,
                partitions=["tenant", "date"],
                schema="main",
                mode=mode,
            )

        deduped_kinesis_df = kinesis_df.dropDuplicates(["tenant", entity.id_column])
        deduped_backfill_df = backfill_df.join(
            deduped_kinesis_df, entity.id_column, "left_anti"
        )
        write(deduped_backfill_df, "overwrite")
        write(deduped_kinesis_df, "append")

        self.table_service.optimize(f"main.{entity.table}")

    def start_streams(self, entity: Entity):
        df = cdc_transformation(
            entity,
            self.kinesis_tables.get_stream(entity.source),
        )
        if entity.enrichment_fn is not None:
            df = entity.enrichment_fn(df, self.table_service.read_table_stream)
        self.create_entity_stream(df, entity)

    def create_entity_stream(self, df: DataFrame, entity: Entity):
        print(f"Setting up {entity.table} table stream")

        self.table_service.prepare_table_for_df(df, f"main.{entity.table}")

        matcher_condition = (
            f"s.{entity.id_column} = t.{entity.id_column} and s.tenant = t.tenant"
        )
        id_column = entity.id_column
        timestamp_column = entity.timestamp_column
        table = entity.table

        def upsert_to_delta(micro_batch_output_df, _batch_id):
            window_spec = Window.partitionBy(id_column).orderBy(
                col(timestamp_column).desc()
            )

            # Add a row number within each partition
            latest_updates_df = (
                micro_batch_output_df.withColumn("rn", row_number().over(window_spec))
                .filter("rn = 1")
                .drop("rn")
            )

            spark = micro_batch_output_df.sparkSession
            delta_table = f"main.{table}"

            # Perform merge operation using Delta Lake
            (
                DeltaTable.forName(spark, delta_table)
                .alias("t")
                .merge(
                    latest_updates_df.alias("s"),
                    matcher_condition,
                )
                .whenMatchedUpdateAll()
                .whenNotMatchedInsertAll()
                .execute()
            )

        checkpoint_id = self.version_service.get_pipeline_checkpoint_id()
        return (
            df.writeStream.foreachBatch(upsert_to_delta)
            .queryName(entity.table)
            .option(
                "checkpointLocation",
                checkpoint_dir(f"write/{self.schema}/{entity.table}/{checkpoint_id}"),
            )
            .start()
        )

    def backfill(self, entity):
        table = entity.table
        mongo_table = table.replace("_", "-")
        table_path = f"{self.schema}.{table}_backfill"
        suffix = f"-{mongo_table}"

        # List the collections and process each
        tenants = self.table_service.tenants()
        tenants_upper_lower = [
            (
                s.upper()
                if "-test" not in s
                else s.replace("-test", "-TEST").upper().replace("-TEST", "-test")
            )
            for s in tenants
        ] + [s.lower() for s in tenants]

        total = len(tenants_upper_lower)
        print(f"Processing {total} tenants")
        count = 0
        for tenant in tenants_upper_lower:
            coll = f"{tenant}{suffix}"

            print(f"Backfilling for: {coll}")
            try:
                df = (
                    self.spark.read.format("mongo")
                    .option("database", "tarpon")
                    .option("uri", self.mongo_uri)
                    .option("collection", coll)
                    .schema(entity.schema)
                    .load()
                    .withColumn("tenant", lit(tenant.lower()))
                )

                if "_id" in df.columns:
                    df = df.drop("_id")

                final_df = backfill_transformation(entity, df)

                final_df.write.option("mergeSchema", "true").format("delta").mode(
                    "append"
                ).saveAsTable(table_path)
                print(f"Collection backfilled: {coll}")
            except Exception as err:  # pylint: disable=broad-exception-caught
                print(f"Failed to backfill: {coll}")
                print(err)
            count += 1
            print(f"Completed {count}/{total}")


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
            "SortKeyID",
            col(sort_key_id_path).alias("SortKeyID"),
        )
        .withColumn(
            "PartitionKeyID",
            col(PARTITION_KEY_ID_PATH).alias("PartitionKeyID"),
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
        to_date(col("approximateArrivalTimestamp")).alias("date"),
    )

    # Ignore remove events
    return final_df.filter(col("event") != "REMOVE")
