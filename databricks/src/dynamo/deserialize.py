import json


class DeserializerException(Exception):
    """Exception class for deserializing errors from the dynamo format"""

    def __init__(self, json_string):
        self.json_string = json_string

    def __str__(self):
        return f"An error occurred deserializing: {self.json_string}"


def deserialise_dynamo(dynamodb_json: str):
    data = json.loads(dynamodb_json)
    to_des = None
    if "dynamodb" in data:
        images = data["dynamodb"]
        if "NewImage" in data["dynamodb"]:
            to_des = images["NewImage"]
        else:
            to_des = images["OldImage"]
    if to_des is None:
        raise DeserializerException(dynamodb_json)

    def parse_item(item):
        # Recursively parse the DynamoDB item to handle nested structures
        if isinstance(item, dict):
            if "M" in item:
                return {k: parse_item(v) for k, v in item["M"].items()}
            if "S" in item:
                return item["S"]
            if "N" in item:
                return float(item["N"])
            if "L" in item:
                return [parse_item(i) for i in item["L"]]
            if "BOOL" in item:
                return item["BOOL"]
            return {k: parse_item(v) for k, v in item.items()}
        return item

    item = parse_item(to_des)
    return item
