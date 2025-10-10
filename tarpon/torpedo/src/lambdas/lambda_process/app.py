import json
from tigershark.common.math import add


def handler(event, context):
    print("Event received:", json.dumps(event))
    return add(event.get("a", 0), event.get("b", 0))


print(handler({"a": 1, "b": 3}, {}))
