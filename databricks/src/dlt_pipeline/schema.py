from pyspark.sql.types import (
    ArrayType,
    BooleanType,
    DoubleType,
    LongType,
    StringType,
    StructField,
    StructType,
)

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


# Created by pasting JSON data into GPT and asking it to produce a PySpark schema
payment_method_schema = StructType(
    [
        StructField("method", StringType(), True),
        StructField("upiID", StringType(), True),
        StructField("phoneNumber", StringType(), True),
        StructField("IBAN", StringType(), True),
        StructField("checkIdentifier", StringType(), True),
        StructField("walletId", StringType(), True),
        StructField("cardFingerprint", StringType(), True),
        StructField("bankName", StringType(), True),
        StructField("bankCode", StringType(), True),
        StructField("name", StringType(), True),
        StructField("accountNumber", StringType(), True),
        StructField("accountType", StringType(), True),
        StructField(
            "bankAddress",
            StructType(
                [
                    StructField("addressLines", ArrayType(StringType(), True), True),
                    StructField("postcode", StringType(), True),
                    StructField("city", StringType(), True),
                    StructField("state", StringType(), True),
                    StructField("country", StringType(), True),
                ]
            ),
            True,
        ),
    ]
)

rule_schema = ArrayType(
    StructType(
        [
            StructField("ruleInstanceId", StringType(), True),
            StructField("ruleName", StringType(), True),
            StructField("ruleAction", StringType(), True),
            StructField("ruleId", StringType(), True),
            StructField("nature", StringType(), True),
            StructField("ruleDescription", StringType(), True),
            StructField("ruleHit", BooleanType(), True),
            StructField(
                "ruleHitMeta",
                StructType(
                    [
                        StructField(
                            "falsePositiveDetails",
                            StructType(
                                [
                                    StructField("isFalsePositive", BooleanType(), True),
                                    StructField("confidenceScore", DoubleType(), True),
                                ]
                            ),
                            True,
                        ),
                        StructField(
                            "hitDirections", ArrayType(StringType(), True), True
                        ),
                    ]
                ),
                True,
            ),
        ]
    ),
    True,
)

transaction_schema = StructType(
    [
        StructField("transactionId", StringType(), True),
        StructField("type", StringType(), True),
        StructField(
            "destinationAmountDetails",
            StructType(
                [
                    StructField("country", StringType(), True),
                    StructField("transactionCurrency", StringType(), True),
                    StructField("transactionAmount", LongType(), True),
                ]
            ),
            True,
        ),
        StructField("originUserId", StringType(), True),
        StructField("destinationUserId", StringType(), True),
        StructField("productType", StringType(), True),
        StructField("transactionState", StringType(), True),
        StructField(
            "originAmountDetails",
            StructType(
                [
                    StructField("country", StringType(), True),
                    StructField("transactionCurrency", StringType(), True),
                    StructField("transactionAmount", LongType(), True),
                ]
            ),
            True,
        ),
        StructField("timestamp", LongType(), True),
        StructField("destinationPaymentDetails", payment_method_schema, True),
        StructField(
            "originDeviceData",
            StructType([StructField("ipAddress", StringType(), True)]),
            True,
        ),
        StructField(
            "destinationDeviceData",
            StructType([StructField("ipAddress", StringType(), True)]),
            True,
        ),
        StructField("originPaymentDetails", payment_method_schema, True),
        StructField("hitRules", rule_schema, True),
        StructField("executedRules", rule_schema, True),
        StructField("status", StringType(), True),
        StructField("createdAt", LongType(), True),
        StructField("destinationPaymentMethodId", StringType(), True),
        StructField("originPaymentMethodId", StringType(), True),
        StructField(
            "arsScore",
            StructType(
                [
                    StructField("transactionId", StringType(), True),
                    StructField("createdAt", LongType(), True),
                    StructField("originUserId", StringType(), True),
                    StructField("destinationUserId", StringType(), True),
                    StructField("riskLevel", StringType(), True),
                    StructField("arsScore", DoubleType(), True),
                    StructField(
                        "components",
                        ArrayType(
                            StructType(
                                [
                                    StructField("score", DoubleType(), True),
                                    StructField("riskLevel", StringType(), True),
                                    StructField("entityType", StringType(), True),
                                    StructField("parameter", StringType(), True),
                                    StructField("value", StringType(), True),
                                ]
                            ),
                            True,
                        ),
                        True,
                    ),
                ]
            ),
            True,
        ),
        StructField(
            "tags",
            ArrayType(
                StructType(
                    [
                        StructField("key", StringType(), True),
                        StructField("value", StringType(), True),
                    ]
                ),
                True,
            ),
            True,
        ),
    ]
)
