import os
import sys
import time

from pyspark.sql import SparkSession

from src.aws.glue import get_arg
from src.entities.entities import entities
from src.kinesis.kinesis_reader import KinesisReader
from src.tables.currency_rates import CurrencyTable
from src.tables.entity_tables import EntityTables
from src.tables.kinesis_tables import KinesisTables
from src.tables.table_service import TableService
from src.version_service import VersionService

# Tried and failed to use "--customer-driver-env-vars" from
# https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-etl-glue-arguments.html
# so instead we're using flags.
args = sys.argv
datalake_bucket = get_arg("datalake_bucket")
tenants = get_arg("tenants")

os.environ["DATALAKE_BUCKET"] = (
    datalake_bucket if datalake_bucket is not None else args[1]
)
os.environ["TENANTS"] = tenants if tenants is not None else args[2]


class Jobs:
    """This is the entry point for all jobs that run on databricks"""

    def __init__(self, spark: SparkSession):
        self.spark = spark
        self.version_service = VersionService(spark)
        self.table_service = TableService.new(spark)
        self.kinesis_reader = KinesisReader.new(spark)
        self.kinesis_tables = KinesisTables.new(spark)
        self.entity_tables = EntityTables.new(spark)
        self.currency_table = CurrencyTable(spark, self.table_service)

    def refresh(self):
        print("Performing a refresh by clearing entity tables")
        for entity in entities:
            self.entity_tables.refresh(entity)

        print("Resetting pipeline checkpoint")
        self.version_service.reset_pipeline_checkpoint_id()

    def backfill(self):
        self.spark.sql("create database if not exists main")
        self.version_service.clear_pipeline_checkpoint_id()

        self.table_service.clear_table("kinesis_events")
        self.table_service.clear_table("hammerhead_kinesis_events")
        self.table_service.clear_table("currency_rates")

        print("Start and stop kinesis streams to set a checkpoint")
        self.version_service.reset_kinesis_checkpoint_id()
        self.kinesis_tables.create_stream(
            "tarponDynamoChangeCaptureStream", "kinesis_events"
        ).stop()
        self.kinesis_tables.create_stream(
            "hammerheadDynamoChangeCaptureStream", "hammerhead_kinesis_events"
        ).stop()

        self.currency_table.backfill()
        for entity in entities:
            self.table_service.clear_table(f"{entity.table}_backfill")
            self.entity_tables.backfill(entity)

        print("Backfill complete")

        print("Starting refresh")
        self.refresh()

    def stream(self):
        pipeline_checkpoint_id = self.version_service.get_pipeline_checkpoint_id()
        if pipeline_checkpoint_id is None:
            print("Please run backfill first.")
            return

        print(f"Current version: {pipeline_checkpoint_id}")

        self.kinesis_tables.create_stream(
            "tarponDynamoChangeCaptureStream", "kinesis_events"
        )
        self.kinesis_tables.create_stream(
            "hammerheadDynamoChangeCaptureStream", "hammerhead_kinesis_events"
        )

        self.currency_table.start_stream()

        for entity in entities:
            print(f"\n\n===== Setting up {entity.table} ======")
            self.entity_tables.start_streams(entity)

        # Kill process after 20 minutes
        time.sleep(60 * 20)

        streaming_query_manager = self.spark.streams
        active_streams = streaming_query_manager.active
        for stream in active_streams:
            stream.stop()

    def optimize(self):
        for entity in entities:
            self.table_service.optimize_yesterday(f"main.{entity.table}")
