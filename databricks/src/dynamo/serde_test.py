from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.functions import udf
from pyspark.sql.types import StringType, StructField, StructType

from src.dynamo.serde import deserialise_dynamo
from src.openapi.internal.models import DrsScore
from src.openapi.internal.models.transaction import Transaction as InternalTransaction
from src.openapi.public.models.transaction import Transaction

CUR_DIR = Path(__file__).parent.absolute()


def test_deserialize():
    test_cases = [
        ["transaction.json", [Transaction, InternalTransaction]],
        ["dynamic_risk_value.json", [DrsScore]],
    ]
    spark = SparkSession.builder.appName("UDF Test").getOrCreate()
    for test_case in test_cases:
        [fixture, schemas] = test_case
        with open(f"{CUR_DIR}/fixtures/{fixture}", "r", encoding="UTF-8") as file:
            txn = file.read()
            for entity_schema in schemas:

                my_udf = udf(deserialise_dynamo, entity_schema)

                data = [(txn,)]

                schema = StructType([StructField("data", StringType())])
                df = spark.createDataFrame(data, schema)

                df_transformed = df.withColumn("deserialized_data", my_udf(df["data"]))
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
