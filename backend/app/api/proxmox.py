from fastapi import APIRouter, HTTPException
from app.schemas import CreateRequest, CreateResponse, ResourceType
from app.proxmox.client import ProxmoxClient

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
    cpu = resources.get("cpu", {})
    memory = resources.get("memory", {})
    root = resources.get("root", {})
    return {
        "data": {
            "cpu_max": cpu.get("max", 0),
            "cpu_used": cpu.get("used", 0),
            "memory_max": memory.get("max", 0),
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
        raise HTTPException(409, f"A resource named '{req.name}' already exists")
    try:
        upid = await client.create(req.type.value, req.model_dump())
        await client.close()
        return CreateResponse(upid=upid, status="running")
    except Exception as e:
        await client.close()
        raise HTTPException(502, f"Proxmox creation failed: {str(e)}")


@router.get("/task/{upid:path}")
async def task_status(upid: str):
    client = await get_client()
    status = await client.get_task_status(upid)
    await client.close()
    return {"data": status}
