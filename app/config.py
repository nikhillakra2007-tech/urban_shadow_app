from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def _project_path(value: str, default: Path) -> str:
    """Resolve configured relative paths from the project, not the shell cwd."""
    path = Path(value).expanduser() if value else default
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return str(path.resolve())


class Settings(BaseSettings):
    app_name: str = "urban_shadow"
    debug: bool = True
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/urban_shadow_v2"
    cors_origins: str = "*"
    model_dir: str = str(PROJECT_ROOT / "data" / "models")
    raw_data_dir: str = str(PROJECT_ROOT / "data" / "raw")
    ml_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def model_post_init(self, __context: object) -> None:
        self.model_dir = _project_path(self.model_dir, PROJECT_ROOT / "data" / "models")
        self.raw_data_dir = _project_path(self.raw_data_dir, PROJECT_ROOT / "data" / "raw")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
