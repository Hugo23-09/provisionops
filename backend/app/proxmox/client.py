import asyncio
import time
import uuid

import httpx

from app.config import settings


MOCK_TEMPLATES_LXC = [
    {"volid": "local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst", "format": "zst", "size": 251658240, "content": "vztmpl"},
    {"volid": "local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst", "format": "zst", "size": 209715200, "content": "vztmpl"},
    {"volid": "local:vztmpl/alpine-3.20-default_20240801_amd64.tar.zst", "format": "zst", "size": 83886080, "content": "vztmpl"},
]

MOCK_TEMPLATES_VM = [
    {"volid": "local:iso/ubuntu-24.04-server-cloudimg-amd64.img", "format": "iso", "size": 629145600, "content": "iso"},
    {"volid": "local:iso/debian-12.7.0-amd64-netinst.iso", "format": "iso", "size": 419430400, "content": "iso"},
]

MOCK_STORAGES = [
    {"storage": "local", "type": "dir", "content": "vztmpl,iso,backup", "active": True, "used": 536870912000, "avail": 1073741824000, "total": 1610612736000},
    {"storage": "local-lvm", "type": "lvmthin", "content": "images,rootdir", "active": True, "used": 214748364800, "avail": 858993459200, "total": 1073741824000},
]

MOCK_BRIDGES = [
    {"iface": "vmbr0", "active": True, "method": "static", "cidr": "192.168.1.1/24"},
    {"iface": "vmbr1", "active": True, "method": "manual", "cidr": "10.0.0.1/24"},
]

MOCK_NODE_STATUS = {
    "cpu": {"max": 16, "used": 4.5},
    "memory": {"max": 68719476736, "used": 25769803776},
    "root": {"total": 2000000000000, "used": 536870912000, "avail": 1463129088000},
}

MOCK_TASKS: dict = {}

MOCK_EXISTING_NAMES = {"test", "template", "existing-vm"}


class ProxmoxClient:
    def __init__(self):
        self.base_url = settings.proxmox_host.rstrip("/") + "/api2/json"
        self.token_id = settings.proxmox_token_id
        self.token_secret = settings.proxmox_token_secret
        self.node = settings.proxmox_node
        self.timeout = settings.proxmox_timeout
        self._mock = settings.is_mock

        if not self._mock:
            transport = httpx.AsyncHTTPTransport(retries=2)
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "Authorization": f"PVEAPIToken={self.token_id}={self.token_secret}",
                },
                verify=False,
                timeout=self.timeout,
                transport=transport,
            )
        else:
            self._client = None

    async def _request(self, method: str, path: str, **kwargs):
        last_error = None
        for attempt in range(3):
            try:
                resp = await self._client.request(method, path, **kwargs)
                resp.raise_for_status()
                return resp.json()["data"]
            except httpx.TimeoutException as e:
                last_error = e
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code >= 500 and attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise
        raise last_error

    async def close(self):
        if self._client:
            await self._client.aclose()

    async def health_check(self) -> bool:
        if self._mock:
            return True
        try:
            await self._request("GET", "/nodes")
            return True
        except Exception:
            return False

    async def get_templates(self, type_: str) -> list[dict]:
        if self._mock:
            return list(MOCK_TEMPLATES_LXC if type_ == "lxc" else MOCK_TEMPLATES_VM)

        content_type = "vztmpl" if type_ == "lxc" else "iso"
        storages = await self._request("GET", f"/nodes/{self.node}/storage")
        target = None
        for s in storages:
            if content_type in s.get("content", ""):
                target = s["storage"]
                break
        if not target:
            return []
        data = await self._request("GET", f"/nodes/{self.node}/storage/{target}/content")
        return [item for item in data if item.get("content") == content_type]

    async def get_storages(self) -> list[dict]:
        if self._mock:
            return list(MOCK_STORAGES)
        return await self._request("GET", f"/nodes/{self.node}/storage")

    async def get_bridges(self) -> list[dict]:
        if self._mock:
            return list(MOCK_BRIDGES)
        data = await self._request("GET", f"/nodes/{self.node}/network")
        return [iface for iface in data if iface.get("type") == "bridge"]

    async def get_resources(self) -> dict:
        if self._mock:
            return dict(MOCK_NODE_STATUS)
        return await self._request("GET", f"/nodes/{self.node}/status")

    async def check_name_exists(self, type_: str, name: str) -> bool:
        if self._mock:
            return name in MOCK_EXISTING_NAMES
        endpoint = "qemu" if type_ == "vm" else "lxc"
        items = await self._request("GET", f"/nodes/{self.node}/{endpoint}")
        return any(item.get("name") == name for item in items)

    async def create(self, type_: str, data: dict) -> str:
        if self._mock:
            node = self.node or "mock-node"
            pid = str(uuid.uuid4().int)[:8]
            pstart = str(int(time.time()))
            starttime = str(int(time.time()))
            upid = f"UPID:{node}:{pid}:{pstart}:{starttime}:{'qemu' if type_ == 'vm' else 'lxc'}:{data.get('vmid', '100')}:root@pam!"
            MOCK_TASKS[upid] = {
                "upid": upid,
                "status": "running",
                "starttime": int(time.time()),
                "type": "mock-create",
            }
            return upid

        endpoint = "qemu" if type_ == "vm" else "lxc"
        payload = {
            "vmid": data.get("vmid", 0),
            "name": data["name"],
            "cores": data["cpu"],
            "memory": data["ram"],
            "storage": data["storage"],
            "net0": f"model=virtio,bridge={data['bridge']}",
        }

        if type_ == "vm":
            payload["ide2"] = f"{data['template']},media=cdrom"
            payload["scsihw"] = "virtio-scsi-pci"
            payload["virtio0"] = f"{data['storage']}:{data['disk']}"
        else:
            payload["ostemplate"] = data["template"]
            payload["rootfs"] = f"{data['storage']}:{data['disk']}"

        if data.get("ip_config"):
            payload["net0"] += f",ip={data['ip_config']}"

        result = await self._request("POST", f"/nodes/{self.node}/{endpoint}", json=payload)
        return result

    async def get_task_status(self, upid: str) -> dict:
        if self._mock:
            task = MOCK_TASKS.get(upid)
            if not task:
                return {"upid": upid, "status": "unknown", "exitstatus": "not found"}
            task["status"] = "stopped"
            task["exitstatus"] = "OK"
            return dict(task)
        return await self._request("GET", f"/nodes/{self.node}/tasks/{upid}/status")
