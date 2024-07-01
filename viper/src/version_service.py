from datetime import datetime

from pyspark.sql import SparkSession

from src.aws.s3 import read_file_from_s3, write_file_to_s3

BASE_PATH = "/versions/"


class VersionService:
    """VersionService uses the file system to persist version strings that can be used
    between job runs as checkpoint IDs."""

    def __init__(
        self,
        spark: SparkSession,
    ):
        self.spark = spark

    def get_pipeline_checkpoint_id(self):
        return self.get_existing_version("pipeline")

    def reset_pipeline_checkpoint_id(self):
        return self.reset_version("pipeline")

    def clear_pipeline_checkpoint_id(self):
        return self.clear_version("pipeline")

    def get_kinesis_checkpoint_id(self):
        return self.get_existing_version("kinesis")

    def reset_kinesis_checkpoint_id(self):
        return self.reset_version("kinesis")

    def get_new_version(self):
        return datetime.now().strftime("%Y-%m-%dT%H%M%S%f%z")

    def get_existing_version(self, name):
        try:
            version = read_file_from_s3(f"{BASE_PATH}{name}")
            if version == "":
                return None
            return version
        except:  # pylint: disable=bare-except
            return None

    def reset_version(self, name):
        version = self.get_new_version()
        write_file_to_s3(f"{BASE_PATH}{name}", version)
        return version

    def clear_version(self, name):
        write_file_to_s3(f"{BASE_PATH}{name}", "")
