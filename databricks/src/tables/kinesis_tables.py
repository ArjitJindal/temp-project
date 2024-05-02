from pyspark.sql import SparkSession

from src.kinesis.kinesis_reader import KinesisReader
from src.tables.stream_cache import StreamCache
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
        self.streams = StreamCache()

    @staticmethod
    def new(spark: SparkSession):
        return KinesisTables(spark, KinesisReader.new(spark), TableService.new(spark))

    def create_stream(self, kinesis_stream: str, table: str):
        read_stream = self.kinesis_reader.read_kinesis(kinesis_stream)

        self.streams.add_stream(table, read_stream)

        return self.table_service.write_table_stream(
            table,
            read_stream,
            [],
        )

    def get_stream(self, table: str):
        return self.streams.get_stream(table)
