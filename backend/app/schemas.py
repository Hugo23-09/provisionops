from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator
import re


class ResourceType(str, Enum):
    lxc = "lxc"
    vm = "vm"


class CreateRequest(BaseModel):
    type: ResourceType
    template: str = Field(min_length=1)
    cpu: int = Field(ge=1, le=32)
    ram: int = Field(ge=256, le=262144)
    disk: int = Field(ge=1, le=2048)
    storage: str = Field(min_length=1)
    bridge: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=32)
    ip_config: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("Name must match a-z, 0-9, hyphens only")
        return v


class CreateResponse(BaseModel):
    upid: str
    status: str


class Template(BaseModel):
    volid: str
    format: str
    size: int
    content: str


class StorageInfo(BaseModel):
    storage: str
    type: str
    content: str
    active: bool
    used: Optional[float] = None
    avail: Optional[float] = None
    total: Optional[float] = None


class BridgeInfo(BaseModel):
    iface: str
    active: bool
    method: Optional[str] = None
    cidr: Optional[str] = None


class NodeResources(BaseModel):
    cpu_max: float
    memory_max: int
    disk_max: int
    cpu_used: float
    memory_used: int
    disk_used: int
