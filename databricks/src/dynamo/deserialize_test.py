from pyspark.sql import SparkSession
from pyspark.sql.types import StringType, StructField, StructType

from src.dynamo.deserialize import (
    DeserializerException,
    deserialise_dynamo,
    deserialise_dynamo_udf,
)
from src.openapi.internal.models import DrsScore
from src.openapi.internal.models.transaction import Transaction as InternalTransaction
from src.openapi.public.models.transaction import Transaction
from src.testing.file import read_file


def test_deserialise_dynamo_udf():
    test_cases = [
        ["transaction.json", [Transaction, InternalTransaction]],
        ["dynamic_risk_value.json", [DrsScore]],
    ]
    spark = SparkSession.builder.appName("Deserialise dynamo test").getOrCreate()
    for test_case in test_cases:
        [fixture, schemas] = test_case
        entity = read_file(f"fixtures/{fixture}")

        for entity_schema in schemas:
            data = [(entity,)]

            schema = StructType([StructField("data", StringType())])
            df = spark.createDataFrame(data, schema)

            df_transformed = df.withColumn(
                "deserialized_data", deserialise_dynamo_udf("data", entity_schema)
            )
            expected_schema = StructType(
                [
                    StructField("data", StringType()),
                    StructField("deserialized_data", entity_schema),
                ]
            )

            assert (
                df_transformed.schema == expected_schema
            ), "Schema does not match expected schema"

    spark.stop()


def test_deserialise_dynamo():
    exception_thrown = False
    try:
        deserialise_dynamo("{}")
    except DeserializerException:
        exception_thrown = True

    assert exception_thrown, "Exception was thrown"

    txn = read_file("fixtures/transaction.json")

    deserialise_dynamo(txn)
