import sys


def error_message_details(error, exceptionDetails: sys):
    _, _, exec_tb = exceptionDetails.exc_info()
    message = "Error occured in file: [{0}], line: [{1}], error message: [{2}]".format(
        exec_tb.tb_frame.f_code.co_filename, exec_tb.tb_lineno, str(error)
    )
    return message


class CustomException(Exception):
    def __init__(self, error_message, exceptionDetails: sys):
        super().__init__(error_message)
        self.error_message = error_message_details(error_message, exceptionDetails)

    def __str__(self):
        return self.error_message
