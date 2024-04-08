from pyspark.sql.types import FloatType, MapType, StringType, StructField, StructType

currency_schema = StructType(
    [
        StructField("date", StringType(), False),
        StructField("rates", MapType(StringType(), FloatType(), False), False),
    ]
)
