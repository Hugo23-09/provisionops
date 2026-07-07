import httpx

from app.config import settings


class ProxmoxClient:
    def __init__(self):
        self.base_url = settings.proxmox_host.rstrip("/") + "/api2/json"
        self.token_id = settings.proxmox_token_id
        self.token_secret = settings.proxmox_token_secret
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "Authorization": f"PVEAPIToken={self.token_id}={self.token_secret}",
            },
            verify=False,
        )

    async def get_nodes(self) -> list[dict]:
        resp = await self._client.get("/nodes")
        resp.raise_for_status()
        return resp.json()["data"]

    async def health_check(self) -> bool:
        try:
            await self.get_nodes()
            return True
        except Exception:
            return False

    async def close(self):
        await self._client.aclose()
