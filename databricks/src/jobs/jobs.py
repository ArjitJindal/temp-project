import os

from pyspark.sql import SparkSession

from src.dbutils.dbutils import get_dbutils
from src.entities.entities import entities
from src.kinesis.kinesis_reader import KinesisReader
from src.tables.currency_rates import CurrencyTable
from src.tables.entity_tables import EntityTables
from src.tables.kinesis_tables import KinesisTables
from src.tables.table_service import TableService
from src.version_service import VersionService


class Jobs:
    """This is the entry point for all jobs that run on databricks"""

    def __init__(self, spark: SparkSession):
        dbutils = get_dbutils(spark)
        stage = os.environ["STAGE"]

        schema = f"{stage}.main"

        aws_access_key = dbutils.secrets.get("kinesis", "aws-access-key")
        aws_secret_key = dbutils.secrets.get("kinesis", "aws-secret-key")
        mongo_username = dbutils.secrets.get("mongo", "mongo-username")
        mongo_password = dbutils.secrets.get("mongo", "mongo-password")
        mongo_host = dbutils.secrets.get("mongo", "mongo-host")
        mongo_uri = f"mongodb+srv://{mongo_username}:{mongo_password}@{mongo_host}"

        self.spark = spark
        self.version_service = VersionService(spark)
        self.table_service = TableService(spark, self.version_service, schema)
        self.kinesis_reader = KinesisReader(
            spark,
            aws_access_key,
            aws_secret_key,
            self.version_service,
        )
        self.kinesis_tables = KinesisTables(
            spark, self.kinesis_reader, self.table_service
        )
        self.entity_tables = EntityTables(
            spark, schema, mongo_uri, self.table_service, self.kinesis_tables
        )
        self.currency_table = CurrencyTable(spark, self.table_service)

    def refresh(self):
        print("Performing a refresh by clearing entity tables")
        for entity in entities:
            self.entity_tables.refresh(entity)

        print("Resetting pipeline checkpoint")
        self.version_service.reset_pipeline_checkpoint_id()

    def backfill(self):
        dbutils = get_dbutils(self.spark)

        dbutils.widgets.text(
            "force",
            ",".join(entity.table for entity in entities),
            "Force running backfill",
        )
        force = dbutils.widgets.get("force") == "true"

        if not force and self.table_service.table_exists("kinesis_events"):
            raise Exception(  # pylint: disable=broad-exception-raised
                "Backfill has already been run, please run with force parameter as true to override"
            )

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
            self.entity_tables.backfill(entity)

        print("Backfill complete")

        print("Starting refresh")
        self.refresh()

    def stream(self):
        print("Checking all tables exist first, in case backfill is still running")

        all_tables = [entity.table for entity in entities] + [
            "currency_rates",
            "kinesis_events",
            "hammerhead_kinesis_events",
        ]
        for table in all_tables:
            if not self.table_service.table_exists(table):
                raise Exception(  # pylint: disable=broad-exception-raised
                    f"{table} has not been created yet, please run backfill"
                )

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
