from typing import Dict

raw_event_data_valid: Dict[str, str] = {}

raw_event_data_warn: Dict[str, str] = {}

transformed_event_data_valid = {
    **raw_event_data_valid,
}

transformed_event_data_warn = raw_event_data_warn
