"""
Custom logging filters for Guinée Marché.
"""
import asyncio
import logging


class SuppressCancelledError(logging.Filter):
    """
    Drop log records whose exception is asyncio.CancelledError.

    On Python 3.12+ / Python 3.14 with uvicorn + asgiref, a client
    disconnect during static-file serving causes CancelledError to
    propagate through WhiteNoise's sync middleware and reach Django's
    internal error logger as "Internal Server Error".  These entries
    are harmless (the connection is already closed) and clutter logs.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if record.exc_info:
            exc_type = record.exc_info[0]
            if exc_type is not None and issubclass(exc_type, asyncio.CancelledError):
                return False  # drop the record
        return True
