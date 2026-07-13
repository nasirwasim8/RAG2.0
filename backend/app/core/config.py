"""
Configuration management for DDN RAG application.
Handles environment variables, storage configs, and application settings.
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # NVIDIA API
    nvidia_api_key: Optional[str] = Field(default=None, alias="NVIDIA_API_KEY")
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"

    # OpenAI (optional)
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")

    # Hugging Face
    huggingface_token: Optional[str] = Field(default=None, alias="HUGGINGFACE_TOKEN")

    # Embedding model
    embedding_model: str = "all-MiniLM-L6-v2"

    # Chunking defaults
    chunk_size: int = 500
    chunk_overlap: int = 50
    
    # CJK (Chinese/Japanese/Korean) Optimization
    chunk_size_cjk: int = 1000
    chunk_overlap_cjk: int = 100
    enable_language_detection: bool = True
    
    # Multi-GPU Settings
    use_multi_gpu: bool = Field(default=False, alias="USE_MULTI_GPU")
    max_gpus: int = Field(default=0, alias="MAX_GPUS")
    
    # Performance Settings
    parallel_processing: bool = Field(default=True, alias="PARALLEL_PROCESSING")
    max_upload_size_mb: int = 100
    enable_progress_tracking: bool = True
    
    # Offline Mode & Local LLM
    offline_mode: bool = Field(default=False, alias="OFFLINE_MODE")
    local_llm_model: str = Field(default="meta-llama/Llama-2-7b-chat-hf", alias="LOCAL_LLM_MODEL")
    local_llm_device: str = "cuda:0"
    use_local_llm: bool = Field(default=False, alias="USE_LOCAL_LLM")

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"


class StorageConfig:
    """Storage configuration for AWS S3 and DDN INFINIA."""

    def __init__(self):
        self.aws_config = {
            'access_key': '',
            'secret_key': '',
            'bucket_name': '',
            'region': 'us-east-1',
            'endpoint_url': '',
            'provider': 'AWS S3'
        }
        self.ddn_infinia_config = {
            'access_key': '',
            'secret_key': '',
            'bucket_name': '',
            'endpoint_url': '',
            'region': 'us-east-1',
            'provider': 'DDN INFINIA'
        }
        
        # Load persisted config
        self._load_config()

    def _get_config_path(self) -> str:
        """Get path to config file."""
        config_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
        if not os.path.exists(config_dir):
            os.makedirs(config_dir)
        return os.path.join(config_dir, "storage_config.json")

    def _load_config(self):
        """Load configuration from disk."""
        try:
            config_path = self._get_config_path()
            if os.path.exists(config_path):
                import json
                with open(config_path, 'r') as f:
                    data = json.load(f)
                    if 'aws' in data:
                        self.aws_config.update(data['aws'])
                    if 'ddn' in data:
                        self.ddn_infinia_config.update(data['ddn'])
                print(f"✅ Loaded configuration from {config_path}")
        except Exception as e:
            print(f"⚠️ Failed to load configuration: {e}")

    def _save_config(self):
        """Save configuration to disk."""
        try:
            config_path = self._get_config_path()
            import json
            with open(config_path, 'w') as f:
                json.dump({
                    'aws': self.aws_config,
                    'ddn': self.ddn_infinia_config
                }, f, indent=2)
            print(f"✅ Saved configuration to {config_path}")
        except Exception as e:
            print(f"❌ Failed to save configuration: {e}")

    def update_aws_config(self, access_key: str, secret_key: str, bucket_name: str, region: str, endpoint_url: str = ''):
        """Update AWS S3 / S3-Compatible configuration."""
        self.aws_config.update({
            'access_key': access_key,
            'secret_key': secret_key,
            'bucket_name': bucket_name,
            'region': region,
            'endpoint_url': endpoint_url or ''
        })
        self._save_config()

    def update_ddn_config(self, access_key: str, secret_key: str, bucket_name: str, endpoint_url: str, region: str):
        """Update DDN INFINIA configuration."""
        self.ddn_infinia_config.update({
            'access_key': access_key,
            'secret_key': secret_key,
            'bucket_name': bucket_name,
            'endpoint_url': endpoint_url,
            'region': region
        })
        self._save_config()

    def validate_config(self, config_type: str) -> tuple[bool, str]:
        """Validate that all required fields are provided."""
        if config_type == 'aws':
            config = self.aws_config
            required_fields = ['access_key', 'secret_key', 'bucket_name', 'region']
        elif config_type == 'ddn_infinia':
            config = self.ddn_infinia_config
            required_fields = ['access_key', 'secret_key', 'bucket_name', 'endpoint_url', 'region']
        else:
            return False, f"Unknown config type: {config_type}"

        missing_fields = [field for field in required_fields if not config.get(field)]

        if missing_fields:
            return False, f"Missing required fields: {', '.join(missing_fields)}"

        return True, "Configuration is valid"

    def get_config(self, config_type: str) -> dict:
        """Get configuration for specified provider."""
        if config_type == 'aws':
            return self.aws_config
        elif config_type == 'ddn_infinia':
            return self.ddn_infinia_config
        return {}

    def reset_config(self, config_type: str = 'all') -> tuple[bool, str]:
        """Reset configuration for specified provider or all providers.
        
        Args:
            config_type: 'aws', 'ddn_infinia', or 'all'
        
        Returns:
            Tuple of (success, message)
        """
        try:
            if config_type in ['aws', 'all']:
                self.aws_config = {
                    'access_key': '',
                    'secret_key': '',
                    'bucket_name': '',
                    'region': 'us-east-1',
                    'endpoint_url': '',
                    'provider': 'AWS S3'
                }
            
            if config_type in ['ddn_infinia', 'all']:
                self.ddn_infinia_config = {
                    'access_key': '',
                    'secret_key': '',
                    'bucket_name': '',
                    'endpoint_url': '',
                    'region': 'us-east-1',
                    'provider': 'DDN INFINIA'
                }
            
            if config_type not in ['aws', 'ddn_infinia', 'all']:
                return False, f"Invalid config type: {config_type}"
            
            # Save the reset configuration
            self._save_config()
            
            if config_type == 'all':
                return True, "All storage configurations have been reset"
            else:
                provider_name = "AWS S3" if config_type == 'aws' else "DDN INFINIA"
                return True, f"{provider_name} configuration has been reset"
        except Exception as e:
            return False, f"Failed to reset configuration: {e}"


# Global instances
settings = Settings()
storage_config = StorageConfig()
