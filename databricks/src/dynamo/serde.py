import json
from decimal import Decimal

from boto3.dynamodb.types import TypeDeserializer


def replace_decimals(obj):
    if isinstance(obj, list):
        for i, value in enumerate(obj):
            obj[i] = replace_decimals(value)
        return obj
    if isinstance(obj, dict):
        for k in obj:
            obj[k] = replace_decimals(obj[k])
        return obj
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


class DeserializerException(Exception):
    """Exception class for deserializing errors from the dynamo format"""

    def __init__(self, json_string):
        self.json_string = json_string

    def __str__(self):
        return f"An error occurred deserializing: {self.json_string}"


def deserialise_dynamo(column):
    data = json.loads(column)
    if "dynamodb" in data:
        images = data["dynamodb"]
        if "NewImage" in data["dynamodb"]:
            to_des = images["NewImage"]
        if "OldImage" in data["dynamodb"]:
            to_des = images["OldImage"]
        return replace_decimals(TypeDeserializer().deserialize({"M": to_des}))
    raise DeserializerException(column)
