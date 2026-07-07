from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    proxmox_host: str = ""
    proxmox_token_id: str = ""
    proxmox_token_secret: str = ""
    proxmox_node: str = ""
    app_secret_key: str = "change-me"
    app_debug: bool = False
    use_mock: bool = False
    proxmox_timeout: int = 30

    @property
    def is_mock(self) -> bool:
        return self.use_mock

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
