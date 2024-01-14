from pyspark.sql.types import StringType, StructField, StructType

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
