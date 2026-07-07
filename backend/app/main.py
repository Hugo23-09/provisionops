from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.proxmox import router as proxmox_router
from app.api.history import router as history_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="ProvisionOps API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(proxmox_router)
app.include_router(history_router)
