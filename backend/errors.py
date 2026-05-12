"""Typed exceptions that map cleanly to HTTP responses."""


class ExternalAPIError(Exception):
    """Raised when an upstream AI service fails. Maps to HTTP 502."""
