import json
from typing import Any

from pyspark.sql import Column
from pyspark.sql.functions import from_json, udf
from pyspark.sql.types import ArrayType, Row, StringType, StructField, StructType


def deserialise_dynamo(column: Column, schema: StructType, root_column="root"):
    return udf(parse_dynamo, schema)(
        from_json(column.cast("string"), dynamo_schema(schema))
        .getItem("dynamodb")
        .getItem("NewImage"),
    ).alias(root_column)


def dynamo_schema(schema):
    return StructType(
        [
            StructField(
                "dynamodb",
                StructType([StructField("NewImage", convert_to_dynamo_schema(schema))]),
            )
        ]
    )


def convert_to_dynamo_schema(field):
    if isinstance(field, StructField):
        return convert_struct_field_to_dynamo(field)
    if isinstance(field, StructType):
        return StructType(
            [
                StructField(f.name, convert_struct_field_to_dynamo(f))
                for f in field.fields
            ]
        )
    raise TypeError("Unsupported field type")


def convert_struct_field_to_dynamo(field):
    # Process a StructField based on its data type
    if isinstance(field.dataType, StructType):
        # Convert nested StructType
        return StructType(
            [
                StructField(
                    "M",
                    StructType(
                        [
                            StructField(f.name, convert_struct_field_to_dynamo(f))
                            for f in field.dataType.fields
                        ]
                    ),
                )
            ]
        )
    if isinstance(field.dataType, ArrayType):
        # Convert ArrayType, checking for element type
        element_type = field.dataType.elementType
        if isinstance(element_type, StructType):
            return StructType(
                [StructField("L", ArrayType(convert_to_dynamo_schema(element_type)))]
            )
        return StructType([StructField("L", field.dataType)])
    # Convert basic data types using a mapping
    return convert_basic_types_to_dynamo(field.dataType)


def convert_basic_types_to_dynamo(data_type):
    # Map Spark data types to DynamoDB types
    type_mapping = {
        "STRING": "S",
        "INT": "N",
        "FLOAT": "N",
        "DOUBLE": "N",
        "BOOLEAN": "B",
    }
    dynamodb_type = type_mapping.get(data_type.simpleString().upper(), "")
    if not dynamodb_type:
        raise ValueError(f"Unsupported data type: {data_type.simpleString()}")
    return StructType([StructField(dynamodb_type, StringType())])


def parse_dynamo(item):
    if isinstance(item, Row):
        item = item.asDict()
    # Recursively parse the DynamoDB item to handle nested structures
    if isinstance(item, dict):
        if "M" in item:
            inner_m = item["M"]
            if isinstance(inner_m, Row):
                inner_m = inner_m.asDict()
            return {k: parse_dynamo(v) for k, v in inner_m.items()}
        if "S" in item:
            return item["S"]
        if "N" in item:
            return float(item["N"])
        if "B" in item:
            return item["B"] == "true"
        if "L" in item:
            return [parse_dynamo(i) for i in item["L"]]
        return {k: parse_dynamo(v) for k, v in item.items()}
    return item


class DeserializerException(Exception):
    """Exception class for deserializing errors from the dynamo format"""

    def __init__(self, json_string):
        self.json_string = json_string

    def __str__(self):
        return f"An error occurred deserializing: {self.json_string}"


def legacy_deserialise_dynamo(dynamodb_json: str) -> Any:
    try:
        data = json.loads(dynamodb_json)
    except json.JSONDecodeError as err:
        raise DeserializerException(f"Error parsing JSON: {str(err)}") from err

    dynamodb_data = data.get("dynamodb", {})
    new_image = dynamodb_data.get("NewImage")
    old_image = dynamodb_data.get("OldImage")

    image_to_deserialize = new_image if new_image is not None else old_image

    if image_to_deserialize is None:
        raise DeserializerException(
            f"Missing 'NewImage' or 'OldImage' in the provided data: {dynamodb_json}"
        )

    return parse_dynamo(image_to_deserialize)
