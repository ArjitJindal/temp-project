# type: ignore
import os

import dlt  # pylint: disable=import-error
from data_quality_checks import (  # pylint: disable=import-error
    raw_event_data_valid,
    raw_event_data_warn,
)

aws_access_key = dbutils.secrets.get(  # pylint: disable=undefined-variable
    "kinesis", "aws-access-key"
)

aws_secret_key = dbutils.secrets.get(  # pylint: disable=undefined-variable
    "kinesis", "aws-secret-key"
)


def define_pipeline(spark):
    @dlt.table(comment="Raw event data from Kinesis")
    @dlt.expect_all_or_drop(raw_event_data_valid)
    @dlt.expect_all(raw_event_data_warn)
    def kinesis_events():
        return (
            spark.readStream.format("kinesis")
            .option("streamName", os.environ["KINESIS_STREAM"])
            .option("region", os.environ["KINESIS_REGION"])
            .option("awsAccessKey", aws_access_key)
            .option("awsSecretKey", aws_secret_key)
            .load()
        )


define_pipeline(spark)  # pylint: disable=undefined-variable
