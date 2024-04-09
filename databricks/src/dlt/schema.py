from pyspark.sql.types import StringType, StructField, StructType

PARTITION_KEY_ID_PATH = "event.dynamodb.Keys.PartitionKeyID.S"

kinesis_event_schema = StructType(
    [
        StructField("eventName", StringType(), False),
        StructField(
            "dynamodb",
            StructType(
                [
                    StructField(
                        "Keys",
                        StructType(
                            [
                                StructField(
                                    "PartitionKeyID",
                                    StructType([StructField("S", StringType(), False)]),
                                    False,
                                ),
                                StructField(
                                    "SortKeyID",
                                    StructType([StructField("S", StringType(), False)]),
                                    False,
                                ),
                            ]
                        ),
                        False,
                    ),
                ]
            ),
            False,
        ),
    ]
)
