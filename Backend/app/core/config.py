from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    gemini_api_key: str = ""
    llm_model: str = "gemini-3.8-flash"
    cors_origins: str = "http://localhost:3000"
    data_dir: Path = BASE_DIR / "data" / "resumes"
    max_tool_rounds: int = 8


settings = Settings()
