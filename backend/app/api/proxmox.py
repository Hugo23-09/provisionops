from fastapi import APIRouter, HTTPException
from app.schemas import CreateRequest, CreateResponse, HistoryEntry, ResourceType
from app.proxmox.client import ProxmoxClient
from app.api.history import add_history as _add_history

router = APIRouter(prefix="/api/proxmox", tags=["proxmox"])


async def get_client() -> ProxmoxClient:
    client = ProxmoxClient()
    return client


@router.get("/health")
async def proxmox_health():
    client = await get_client()
    ok = await client.health_check()
    await client.close()
    return {"status": "ok" if ok else "error"}


@router.get("/templates")
async def list_templates(type: str = "lxc"):
    if type not in ("lxc", "vm"):
        raise HTTPException(400, "type must be 'lxc' or 'vm'")
    client = await get_client()
    templates = await client.get_templates(type)
    await client.close()
    return {"data": templates}


@router.get("/storages")
async def list_storages():
    client = await get_client()
    storages = await client.get_storages()
    await client.close()
    return {"data": storages}


@router.get("/bridges")
async def list_bridges():
    client = await get_client()
    bridges = await client.get_bridges()
    await client.close()
    return {"data": bridges}


@router.get("/resources")
async def node_resources():
    client = await get_client()
    resources = await client.get_resources()
    await client.close()
    cpuinfo = resources.get("cpuinfo", {})
    memory = resources.get("memory", {})
    root = resources.get("rootfs", {})
    return {
        "data": {
            "cpu_max": cpuinfo.get("cpus", 0),
            "cpu_used": resources.get("cpu", 0),
            "memory_max": memory.get("total", 0),
            "memory_used": memory.get("used", 0),
            "disk_max": root.get("total", 0),
            "disk_used": root.get("used", 0),
        }
    }


@router.post("/create", response_model=CreateResponse)
async def create_resource(req: CreateRequest):
    client = await get_client()
    exists = await client.check_name_exists(req.type.value, req.name)
    if exists:
        await client.close()
        await _add_history(HistoryEntry(
            type=req.type.value, template=req.template,
            cpu=req.cpu, ram=req.ram, disk=req.disk,
            name=req.name, status="error",
            error=f"Name '{req.name}' already exists"
        ))
        raise HTTPException(409, f"A resource named '{req.name}' already exists")
    try:
        upid = await client.create(req.type.value, req.model_dump())
        await client.close()
        await _add_history(HistoryEntry(
            type=req.type.value, template=req.template,
            cpu=req.cpu, ram=req.ram, disk=req.disk,
            name=req.name, status="success", upid=upid
        ))
        return CreateResponse(upid=upid, status="running")
    except Exception as e:
        await client.close()
        await _add_history(HistoryEntry(
            type=req.type.value, template=req.template,
            cpu=req.cpu, ram=req.ram, disk=req.disk,
            name=req.name, status="error", error=str(e)
        ))
        raise HTTPException(502, f"Proxmox creation failed: {str(e)}")


@router.get("/vms")
async def list_vms():
    client = await get_client()
    vms = await client.get_all_vms()
    await client.close()
    return {"data": vms}


@router.get("/task/{upid:path}")
async def task_status(upid: str):
    client = await get_client()
    status = await client.get_task_status(upid)
    await client.close()
    return {"data": status}
