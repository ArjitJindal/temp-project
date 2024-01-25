import json
from decimal import Decimal

from boto3.dynamodb.types import TypeDeserializer


def replace_decimals(obj):
    if isinstance(obj, list):
        for i in range(len(obj)):
            obj[i] = replace_decimals(obj[i])
        return obj
    elif isinstance(obj, dict):
        for k in obj:
            obj[k] = replace_decimals(obj[k])
        return obj
    elif isinstance(obj, Decimal):
        return float(obj)
    else:
        return obj


def deserialise_dynamo(column):
    data = json.loads(column)
    if "dynamodb" in data and "NewImage" in data["dynamodb"]:
        raw = TypeDeserializer().deserialize({"M": data["dynamodb"]["NewImage"]})
        return replace_decimals(raw)
    raise Exception("Incorrect dynamo format")
