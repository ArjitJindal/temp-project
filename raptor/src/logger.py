import logging
import os
from datetime import datetime

LOG_FILE = f"{datetime.now().strftime('%m_%d_%Y_%H_%M_%S')}-raptor.log"
logs_dir = os.path.join(os.getcwd(), "logs", LOG_FILE)

os.makedirs(logs_dir, exist_ok=True)

LOG_FILEPATH = os.path.join(logs_dir, LOG_FILE)

logging.basicConfig(
    filename=LOG_FILEPATH,
    level=logging._SysExcInfoType,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
