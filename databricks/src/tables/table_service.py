import os
from typing import Dict, List

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col

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
        self.streams: Dict[str, DataFrame] = {}
        self.batches: Dict[str, DataFrame] = {}

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
        if table in self.streams:
            print(f"Reusing existing stream for table {table}")
            return self.streams[table]

        print(f"Creating read stream for table {table}")
        stream = (
            self.spark.readStream.option(
                "checkpointLocation",
                f"/tmp/delta/_checkpoints/{table_name}_ingress/{checkpoint_id}",
            )
            .format("delta")
            .table(table)
        )

        self.streams[table] = stream
        return stream

    def read_table(self, table_name: str, schema=None):
        if schema is None:
            schema = self.schema
        table = f"{schema}.{table_name}"
        print(f"Batching table {table}")
        if table in self.batches:
            print(f"Reusing existing stream for table {table}")
            return self.batches[table]
        batch = self.spark.read.format("delta").table(table)
        self.batches[table] = batch
        return batch

    def write_table_stream(self, name: str, df: DataFrame, tenant_partition=True):
        checkpoint_id = self.version_service.get_pipeline_checkpoint_id()

        table_name = name
        write_stream = df.writeStream.format("delta")
        if tenant_partition:
            write_stream = write_stream.partitionBy("tenant")
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
        tenant_partition=True,
        mode="append",
        schema=None,
    ):
        if schema is None:
            schema = self.schema
        table_name = name
        write_stream = df.write.format("delta").option("mergeSchema", "true")
        if tenant_partition:
            write_stream = write_stream.partitionBy("tenant")
        print(f"Batching to table {schema}.{table_name}")
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
        stage = os.environ["STAGE"]
        print(f"Optimizing {table}")
        self.spark.sql(f"optimize {stage}.{table}")
