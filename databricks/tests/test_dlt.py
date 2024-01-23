# pylint: disable=redefined-outer-name
import pytest
from pyspark.sql import SparkSession
from pyspark.sql.types import StringType

from src.dlt.transformations import transform_event_data

OUTPUT_JSON = """{timestamp=1701790627472}"""
DYNAMO_EVENT_JSON = """
{
   "awsRegion":"eu-central-1",
   "eventID":"5465442e-5b49-47bc-8f27-1e4a6c0fa621",
   "eventName":"INSERT",
   "userIdentity":null,
   "recordFormat":"application/json",
   "tableName":"Tarpon",
   "dynamodb":{
      "NewImage":{
         "timestamp":{
            "N":"1701790627472"
         }
      }
   },
   "eventSource":"aws:dynamodb"
}"""


@pytest.fixture()
def spark():
    spark_session = (
        SparkSession.builder.master("local[*]")
        .appName("dlt-pipeline-tests")
        .getOrCreate()
    )
    yield spark_session
    spark_session.stop()


def format_test_dataframe(dataframe):
    return dataframe.toJSON().collect()


def test_dynamo_event_transform(spark):
    dynamo_event_data = [(DYNAMO_EVENT_JSON), (DYNAMO_EVENT_JSON)]
    event_columns = ["data"]
    input_dynamo_event_df = spark.createDataFrame(
        dynamo_event_data, (StringType())
    ).toDF(*event_columns)

    expected_transformed_event_data = [
        (DYNAMO_EVENT_JSON, OUTPUT_JSON),
        (DYNAMO_EVENT_JSON, OUTPUT_JSON),
    ]
    expected_transformed_columns = ["data", "json_data"]
    expected_event_data_df = spark.createDataFrame(
        expected_transformed_event_data
    ).toDF(*expected_transformed_columns)

    transformed_event_data_df = transform_event_data(input_dynamo_event_df)

    assert format_test_dataframe(transformed_event_data_df) == format_test_dataframe(
        expected_event_data_df
    )
