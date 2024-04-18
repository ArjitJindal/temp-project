from typing import Dict

from pyspark.sql import DataFrame, SparkSession

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

    def table_exists(self, name: str):
        return self.spark.catalog.tableExists(  # type: ignore[attr-defined]
            f"{self.schema}.{name}"
        )

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

    def read_table(self, table_name: str):
        table = f"{self.schema}.{table_name}"
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
        self, name: str, df: DataFrame, tenant_partition=True, mode="append"
    ):
        table_name = name
        write_stream = df.write.format("delta").option("mergeSchema", "true")
        if tenant_partition:
            write_stream = write_stream.partitionBy("tenant")
        print(f"Batching to table {name}")
        return write_stream.mode(mode).saveAsTable(f"{self.schema}.{table_name}")

    def clear_table(self, table_name: str):
        print(f"Clearing {table_name}")
        self.spark.sql(f"DROP TABLE IF EXISTS {self.schema}.{table_name}")
