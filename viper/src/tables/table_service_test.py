from pyspark.sql.types import (
    ArrayType,
    BooleanType,
    IntegerType,
    StringType,
    StructField,
    StructType,
)

from src.tables.table_service import schemas_equal

# Define test schemas
simple_schema1 = StructType(
    [StructField("id", IntegerType(), True), StructField("name", StringType(), True)]
)
simple_schema2 = StructType(
    [StructField("name", StringType(), True), StructField("id", IntegerType(), True)]
)

nested_schema1 = StructType(
    [
        StructField("id", IntegerType(), True),
        StructField(
            "info",
            StructType(
                [
                    StructField("name", StringType(), True),
                    StructField("features", ArrayType(StringType(), True), True),
                ]
            ),
            True,
        ),
    ]
)

nested_schema2 = StructType(
    [
        StructField(
            "info",
            StructType(
                [
                    StructField("name", StringType(), True),
                    StructField("features", ArrayType(StringType(), True), True),
                ]
            ),
            True,
        ),
        StructField("id", IntegerType(), True),
    ]
)


def test_simple_schema_equality():
    assert schemas_equal(simple_schema1, simple_schema2)


def test_schema_none_equality():
    assert schemas_equal(None, None)
    assert not schemas_equal(None, simple_schema1)


def test_nested_schema_equality():
    assert schemas_equal(nested_schema1, nested_schema2)


def test_complex_schema_inequality():
    complex_schema1 = StructType(
        [
            StructField("id", IntegerType(), True),
            StructField("active", BooleanType(), True),
        ]
    )
    complex_schema2 = StructType(
        [
            StructField("id", IntegerType(), True),
            StructField("active", StringType(), True),
        ]
    )
    assert not schemas_equal(complex_schema1, complex_schema2)


def test_array_type_inequality():
    array_schema1 = StructType(
        [StructField("features", ArrayType(IntegerType(), True), True)]
    )
    array_schema2 = StructType(
        [StructField("features", ArrayType(StringType(), True), True)]
    )
    assert not schemas_equal(array_schema1, array_schema2)
