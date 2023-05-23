# model upload

Don't delete this **_model_** directory.

**_model.tar.gz_** file in this directory will be uploaded by **_ModelArchvingStack_**.

**_model.tar.gz_** file can be created by **_pack_models.sh_** script in **_script_** directory.

The specific path can be set in **_app-config.json_** in **_config_** directory. **\*model.tar.gz** in "ModelLocalPath" will be uploaed into **_ModelS3Key_** in S3.

```json
...
        "ModelArchiving": {
            "Name": "ModelArchivingStack",

            "BucketBaseName": "model-archiving",
            "ModelList": [
                {
                    "ModelLocalPath": "models/model-a/model",
                    "ModelS3Key":     "models/model-a/model"
                },
                {
                    "ModelLocalPath": "models/model-b/model",
                    "ModelS3Key":     "models/model-b/model"
                }
            ]
        },
...
```
