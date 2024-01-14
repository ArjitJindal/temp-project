# type: ignore
import logging
import os
import sys

from mongo_load import load_mongo

# Hack to make module imports work on Databricks
sys.path.append(os.path.abspath("/Workspace/Shared/main/src"))

load_mongo("users", "#user#primary", "userId", User)
