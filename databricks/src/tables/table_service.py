import os
from typing import List

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col

from src.tables.batch_cache import BatchCache
from src.tables.stream_cache import StreamCache
from src.version_service import VersionService


class TableService:
    """
    TableService provides abstractions for creating, reading and writing to tables
    by batch and stream.
    """

    def __init__(
        self,
        spark: SparkSession,
        version_service: VersionService,
        schema: str,
    ):
        self.version_service = version_service
        self.spark = spark
        self.schema = schema

        self.streams = StreamCache()
        self.batches = BatchCache()

    @staticmethod
    def new(spark: SparkSession):
        stage = os.environ["STAGE"]
        schema = f"{stage}.main"
        return TableService(spark, VersionService(spark), schema)

    def table_exists(self, name: str):
        tables: List[str] = [
            row["tableName"]
            for row in self.spark.sql(f"show tables  in {self.schema}").collect()
        ]
        return name in tables

    def read_table_stream(self, table_name: str):
        checkpoint_id = self.version_service.get_pipeline_checkpoint_id()
        table = f"{self.schema}.{table_name}"

        existing_stream = self.streams.get_stream(table)
        if existing_stream:
            print(f"Reusing existing stream for table {table}")
            return existing_stream

        print(f"Creating read stream for table {table}")
        stream = (
            self.spark.readStream.option(
                "checkpointLocation",
                f"/tmp/delta/_checkpoints/{table_name}_ingress/{checkpoint_id}",
            )
            .format("delta")
            .table(table)
        )

        self.streams.add_stream(table, stream)
        return stream

    def read_table(self, table_name: str, schema=None):
        if schema is None:
            schema = self.schema
        table = f"{schema}.{table_name}"
        print(f"Batching table {table}")
        existing_batch = self.batches.get_batch(table)
        if existing_batch:
            print(f"Reusing existing stream for table {table}")
            return existing_batch
        batch = self.spark.read.format("delta").table(table)
        self.batches.add_batch(table, batch)
        return batch

    def write_table_stream(self, name: str, df: DataFrame, partitions=None):
        checkpoint_id = self.version_service.get_pipeline_checkpoint_id()

        if partitions is None:
            partitions = ["tenant"]

        table_name = name
        write_stream = df.writeStream.format("delta").partitionBy(*partitions)
        print(f"Setting up {name} table stream")
        return (
            write_stream.option(
                "checkpointLocation",
                f"/tmp/delta/_checkpoints/{table_name}/{checkpoint_id}",
            )
            .outputMode("append")
            .option("mergeSchema", "true")
            .queryName(name)
            .toTable(f"{self.schema}.{table_name}")
        )

    def write_table(
        self,
        name: str,
        df: DataFrame,
        partitions=None,
        mode="append",
        schema=None,
    ):
        if schema is None:
            schema = self.schema
        if partitions is None:
            partitions = ["tenant"]
        table_name = name
        write_stream = (
            df.write.format("delta")
            .option("mergeSchema", "true")
            .partitionBy(*partitions)
        )
        if mode == "overwrite":
            write_stream = write_stream.option("overwriteSchema", "true")
        print(f"Batching to table {schema}.{table_name} in mode {mode}")
        return write_stream.mode(mode).saveAsTable(f"{schema}.{table_name}")

    def clear_table(self, table_name: str, schema=None):
        if schema is None:
            schema = self.schema
        print(f"Clearing {schema}.{table_name}")
        self.spark.sql(f"DROP TABLE IF EXISTS {schema}.{table_name}")

    def tenant_schemas(self):
        stage = os.environ["STAGE"]
        df = self.spark.sql(f"show schemas in {stage}")
        return [
            row["databaseName"]
            for row in df.filter(
                ~col("databaseName").isin("default", "main", "information_schema")
            ).collect()
        ]

    def optimize(self, table: str):
        print(f"Optimizing {table}")
        self.spark.sql(f"optimize {table}")

    def optimize_yesterday(self, table: str):
        print(f"Optimizing {table}")
        self.spark.sql(
            f"optimize {table} where date == current_timestamp() - INTERVAL 1 day"
        )

    def prepare_table_for_df(self, df: DataFrame, table: str):
        existing_schema = None
        mode = "append"
        try:
            existing_schema = self.spark.table(table).schema
        except:  # pylint: disable=bare-except
            mode = "overwrite"

        if existing_schema != df.schema or existing_schema is None:
            if mode == "overwrite":
                print(f"Creating table {table}")
            else:
                print(f"Migrating table {table}")
            df_with_new_schema = self.spark.createDataFrame([], df.schema)
            df_with_new_schema.write.format("delta").mode(mode).option(
                "mergeSchema", "true"
            ).option("overwriteSchema", "true").saveAsTable(table)
