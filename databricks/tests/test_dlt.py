# pylint: disable=redefined-outer-name
import pytest
from pyspark.sql import SparkSession

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


def test_noop():
    value = True
    assert value


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
