import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import col, from_json, lower, regexp_extract

from src.dbutils.dbutils import get_dbutils
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
        aws_access_key: str,
        aws_secret_key: str,
        version_service: VersionService,
    ):
        self.spark = spark
        self.aws_access_key = aws_access_key
        self.aws_secret_key = aws_secret_key
        self.version_service = version_service
        self.streams = StreamCache()

    @staticmethod
    def new(spark: SparkSession):
        dbutils = get_dbutils(spark)
        aws_access_key = dbutils.secrets.get("kinesis", "aws-access-key")
        aws_secret_key = dbutils.secrets.get("kinesis", "aws-secret-key")
        return KinesisReader(
            spark, aws_access_key, aws_secret_key, VersionService(spark)
        )

    def read_kinesis(self, kinesis_stream_name: str):
        existing_stream = self.streams.get_stream(kinesis_stream_name)
        if existing_stream:
            return existing_stream
        checkpoint_id = self.version_service.get_kinesis_checkpoint_id()

        stream = kinesis_events_transformation(
            self.spark.readStream.format("kinesis")
            .option("streamName", kinesis_stream_name)
            .option("region", os.environ["AWS_REGION"])
            .option("awsAccessKey", self.aws_access_key)
            .option("awsSecretKey", self.aws_secret_key)
            .option("initialPosition", "latest")
            .option(
                "checkpointLocation",
                f"/tmp/delta/_checkpoints/{kinesis_stream_name}/ingress/{checkpoint_id}",
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
