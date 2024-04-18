from typing import Dict

from pyspark.sql import DataFrame, SparkSession

from src.kinesis.kinesis_reader import KinesisReader
from src.tables.table_service import TableService


class KinesisTables:
    """
    KinesisTables provides abstractions for creating tables from kinesis streams
    """

    def __init__(
        self,
        spark: SparkSession,
        kinesis_reader: KinesisReader,
        table_service: TableService,
    ):
        self.spark = spark
        self.table_service = table_service
        self.kinesis_reader = kinesis_reader
        self.streams: Dict[str, DataFrame] = {}

    def create_stream(self, kinesis_stream: str, table: str):
        read_stream = self.kinesis_reader.read_kinesis(kinesis_stream)
        if table not in self.streams:
            self.streams[table] = read_stream
        return self.table_service.write_table_stream(
            table,
            read_stream,
            False,
        )

    def get_stream(self, table: str):
        return self.streams[table]
