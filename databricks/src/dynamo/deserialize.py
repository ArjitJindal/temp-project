import json
from typing import Any

from boto3.dynamodb.types import Binary
from pyspark.sql import Column
from pyspark.sql.functions import udf
from pyspark.sql.types import Row, StructType


def deserialise_dynamo_udf(column: Column, schema: StructType):
    return udf(deserialise_dynamo, schema)(column)


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


def deserialise_dynamo(dynamodb_json: str) -> Any:
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

    return TypeDeserializer().deserialize({"M": image_to_deserialize})


class TypeDeserializer:
    """This class deserializes DynamoDB types to Python types.
    The code below was copied and modified from
    https://github.com/boto/boto3/blob/develop/boto3/dynamodb/table.py under Apache License 2.0
    """

    def deserialize(self, value):
        """The method to deserialize the DynamoDB data types.

        :param value: A DynamoDB value to be deserialized to a pythonic value.
            Here are the various conversions:

            DynamoDB                                Python
            --------                                ------
            {'NULL': True}                          None
            {'BOOL': True/False}                    True/False
            {'N': str(value)}                       Decimal(str(value))
            {'S': string}                           string
            {'B': bytes}                            Binary(bytes)
            {'NS': [str(value)]}                    set([Decimal(str(value))])
            {'SS': [string]}                        set([string])
            {'BS': [bytes]}                         set([bytes])
            {'L': list}                             list
            {'M': dict}                             dict

        :returns: The pythonic value of the DynamoDB type.
        """

        if not value:
            raise TypeError(
                "Value must be a nonempty dictionary whose key "
                "is a valid dynamodb type."
            )
        dynamodb_type = list(value.keys())[0]
        try:
            deserializer = getattr(self, f"_deserialize_{dynamodb_type}".lower())
        except AttributeError as exc:
            raise TypeError(f"Dynamodb type {dynamodb_type} is not supported") from exc
        return deserializer(value[dynamodb_type])

    def _deserialize_null(self, _value):
        return None

    def _deserialize_bool(self, value):
        return value

    def _deserialize_n(self, value):
        return float(value)

    def _deserialize_s(self, value):
        return value

    def _deserialize_b(self, value):
        return Binary(value)

    def _deserialize_ns(self, value):
        return set(map(self._deserialize_n, value))

    def _deserialize_ss(self, value):
        return set(map(self._deserialize_s, value))

    def _deserialize_bs(self, value):
        return set(map(self._deserialize_b, value))

    def _deserialize_l(self, value):
        return [self.deserialize(v) for v in value]

    def _deserialize_m(self, value):
        return {k: self.deserialize(v) for k, v in value.items()}
