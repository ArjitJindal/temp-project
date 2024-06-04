import base64

import boto3
from botocore.exceptions import ClientError


def get_secret(secret_name: str):
    session = boto3.session.Session()
    client = session.client(
        service_name="secretsmanager",
    )
    try:
        get_secret_value_response = client.get_secret_value(SecretId=secret_name)
        if "SecretString" in get_secret_value_response:
            secret = get_secret_value_response["SecretString"]
        else:
            secret = base64.b64decode(get_secret_value_response["SecretBinary"])

        return secret
    except ClientError as err:
        raise err
