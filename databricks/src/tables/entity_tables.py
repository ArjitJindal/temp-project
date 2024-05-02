import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import (
    col,
    concat,
    from_json,
    from_unixtime,
    lit,
    lower,
    regexp_extract,
    to_date,
)

from src.dbutils.dbutils import get_dbutils
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

    @staticmethod
    def new(spark: SparkSession):
        dbutils = get_dbutils(spark)
        mongo_username = dbutils.secrets.get("mongo", "mongo-username")
        mongo_password = dbutils.secrets.get("mongo", "mongo-password")
        mongo_host = dbutils.secrets.get("mongo", "mongo-host")
        mongo_uri = f"mongodb+srv://{mongo_username}:{mongo_password}@{mongo_host}"
        table_service = TableService.new(spark)
        kinesis_tables = KinesisTables.new(spark)
        stage = os.environ["STAGE"]
        schema = f"{stage}.main"
        return EntityTables(spark, schema, mongo_uri, table_service, kinesis_tables)

    def refresh(self, entity: Entity):
        kinesis_df = cdc_transformation(
            entity,
            self.table_service.read_table(entity.source),
        )
        backfill_df = self.table_service.read_table(
            f"{entity.table}_backfill"
        ).withColumn("date", to_date(col("approximateArrivalTimestamp")))

        print("Refresh from backfill and kinesis tables")
        tenants = self.table_service.tenant_schemas()
        stage = os.environ["STAGE"]

        def write(tenant: str, df: DataFrame, mode: str):
            if entity.enrichment_fn is not None:
                df = entity.enrichment_fn(df, self.table_service.read_table)
            self.table_service.write_table(
                entity.table,
                df.filter(df["tenant"] == tenant),
                partitions=["tenant", "date"],
                schema=schema,
                mode=mode,
            )

        for tenant in tenants:
            schema = f"`{stage}`.`{tenant}`"
            write(tenant, backfill_df, "overwrite")
            write(tenant, kinesis_df, "append")
            self.table_service.optimize(f"{schema}.{entity.table}")

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

        matcher_condition = f"s.{entity.id_column} = t.{entity.id_column}"
        id_column = entity.id_column
        timestamp_column = entity.timestamp_column
        incoming_updates = f"{entity.table}_incoming_updates"
        latest_updates = f"{entity.table}_latest_updates"
        stage = os.environ["STAGE"]
        quality_checks = entity.quality_checks

        def upsert_to_delta(micro_batch_output_df, _batch_id):
            if quality_checks:
                quality_checks(micro_batch_output_df)

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

            for tenant in tenants:
                spark.sql(
                    f"""
                    MERGE INTO `{stage}`.`{tenant}`.`{table}` t
                    USING {latest_updates} s
                    ON {matcher_condition} and s.tenant = "{tenant}"
                    WHEN MATCHED THEN UPDATE SET *
                    WHEN NOT MATCHED THEN INSERT *
                """
                )

        return (
            df.writeStream.foreachBatch(upsert_to_delta).queryName(entity.table).start()
        )

    def backfill(self, entity):
        table = entity.table
        mongo_table = table.replace("_", "-")
        db_name = "tarpon"
        table_path = f"{self.schema}.{table}_backfill"
        suffix = f"-{mongo_table}"

        # List the collections and process each
        tenants = self.table_service.tenant_schemas()
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
        to_date(col("approximateArrivalTimestamp")).alias("date"),
    )

    # Ignore remove events
    return final_df.filter(col("event") != "REMOVE")
