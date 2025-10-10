import json
from tigershark.common.math import add
import numpy as np


def handler(event, context):
    # Example of using NumPy
    array = np.array([1, 2, 3, 4, 5])
    mean = np.mean(array)
    std = np.std(array)

    print(add(1, 2))
    print(json.dumps(event))
    return {
        "statusCode": 200,
        "body": {
            "array": array.tolist(),
            "mean": float(mean),
            "standard_deviation": float(std),
        },
    }
