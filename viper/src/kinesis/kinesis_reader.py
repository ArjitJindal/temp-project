import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col, from_json, lower, regexp_extract

from src.aws.s3 import checkpoint_dir
from src.tables.schema import kinesis_event_schema
from src.tables.stream_cache import StreamCache
from src.version_service import VersionService


class KinesisReader:
    """
    KinesisReader abstracts reading a kinesis stream
    """

    def __init__(
        self,
        spark: SparkSession,
        version_service: VersionService,
    ):
        self.spark = spark
        self.version_service = version_service
        self.streams = StreamCache()

    @staticmethod
    def new(spark: SparkSession):
        return KinesisReader(spark, VersionService(spark))

    def read_kinesis(self, kinesis_stream_name: str):
        existing_stream = self.streams.get_stream(kinesis_stream_name)
        if existing_stream:
            return existing_stream
        checkpoint_id = self.version_service.get_kinesis_checkpoint_id()
        region = os.environ["AWS_DEFAULT_REGION"]
        stream = kinesis_events_transformation(
            self.spark.readStream.format("kinesis")
            .option("streamName", kinesis_stream_name)
            .option("region", region)
            .option("endpointUrl", f"https://kinesis.{region}.amazonaws.com")
            .option("initialPosition", "latest")
            .option(
                "checkpointLocation",
                checkpoint_dir(f"read/main/{kinesis_stream_name}/{checkpoint_id}"),
            )
            .load()
        )
        self.streams.add_stream(kinesis_stream_name, stream)
        return stream


def kinesis_events_transformation(df: DataFrame):
    return df.withColumn(
        "tenant",
        lower(
            regexp_extract(
                from_json(col("data").cast("string"), kinesis_event_schema)
                .getField("dynamodb")
                .getField("Keys")
                .getField("PartitionKeyID")
                .getField("S"),
                "^[^#]*",
                0,
            )
        ),
    )
