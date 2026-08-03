import asyncio
import logging
import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

logger = logging.getLogger(__name__)


def _quiet_exception_handler(loop: asyncio.AbstractEventLoop, context: dict) -> None:
    """
    Custom asyncio exception handler.

    asyncio prints "Task exception was never retrieved" + full traceback to
    stderr when a Task finishes with an exception that nobody awaited.
    asgiref triggers this for CancelledError on Python 3.12+ / 3.14 when a
    client disconnects mid-request.  We silently drop those; everything else
    falls back to the default handler.
    """
    exc = context.get('exception')
    if isinstance(exc, asyncio.CancelledError):
        return  # expected on client disconnect — do nothing
    loop.default_exception_handler(context)


class _CancelledErrorMiddleware:
    """
    Outermost ASGI wrapper that:
      1. Installs the quiet asyncio exception handler on first call.
      2. Catches CancelledError at the top of the ASGI stack so uvicorn
         does not log it a second time after Django already swallowed it.
    """

    def __init__(self, app):
        self.app = app
        self._handler_installed = False

    async def __call__(self, scope, receive, send):
        if not self._handler_installed:
            try:
                loop = asyncio.get_running_loop()
                loop.set_exception_handler(_quiet_exception_handler)
                self._handler_installed = True
            except RuntimeError:
                pass

        try:
            await self.app(scope, receive, send)
        except asyncio.CancelledError:
            # Client disconnected — not an error; swallow silently.
            logger.debug(
                "Request cancelled (client disconnected): %s %s",
                scope.get('method', '?'),
                scope.get('path', '?'),
            )


django_asgi_app = get_asgi_application()

from config.routing import websocket_urlpatterns  # noqa: E402 — after Django setup

application = _CancelledErrorMiddleware(
    ProtocolTypeRouter({
        'http': django_asgi_app,
        'websocket': AllowedHostsOriginValidator(
            URLRouter(websocket_urlpatterns)
        ),
    })
)
