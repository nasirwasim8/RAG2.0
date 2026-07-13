"""
Storage service for AWS S3 and DDN INFINIA.
Handles all object storage operations with both providers.
"""
import io
import time
import threading
from collections import deque
from datetime import datetime
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional, Tuple, List
import urllib3

from app.core.config import storage_config

# Disable SSL warnings for DDN INFINIA (self-signed certs)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ── Live Infinia Activity Feed ───────────────────────────────────────────
# Thread-safe ring buffer of I/O events consumed by the SSE /api/infinia/feed endpoint.
_infinia_events: deque = deque(maxlen=500)
_event_id = 0
_event_lock = threading.Lock()


def _emit_event(provider: str, op_type: str, key: str, bytes_count: int, latency_ms: float) -> None:
    """Push a DDN Infinia I/O event into the live feed buffer.
    Silently ignored for non-Infinia providers.
    """
    global _event_id
    if provider != 'ddn_infinia':
        return
    with _event_lock:
        _event_id += 1
        _infinia_events.append({
            "id": _event_id,
            "type": op_type,        # "READ" or "WRITE"
            "key": key,
            "bytes": bytes_count,
            "latency_ms": round(latency_ms, 1),
            "ts": datetime.now().strftime("%H:%M:%S.%f")[:-3],
        })


class S3Handler:
    """Unified handler for AWS S3 and DDN INFINIA storage operations."""

    def __init__(self, config_type: str = 'aws'):
        self.config_type = config_type
        self.client = None
        self.config = None

    def create_client(self) -> Tuple[bool, str]:
        """Create S3 client based on configuration type."""
        try:
            print(f"DEBUG: Creating {self.config_type} client...")
            is_valid, message = storage_config.validate_config(self.config_type)
            if not is_valid:
                error_msg = f"Invalid {self.config_type} configuration: {message}"
                print(f"DEBUG: {error_msg}")
                return False, error_msg
            
            print(f"DEBUG: Configuration valid for {self.config_type}")

            if self.config_type == 'aws':
                self.config = storage_config.aws_config
                endpoint_url = self.config.get('endpoint_url', '').strip()

                if endpoint_url:
                    # S3-Compatible mode: OCI Object Storage, MinIO, Wasabi, etc.
                    # NOTE: Do NOT set addressing_style='path' here — OCI's S3-compatible API
                    # requires virtual-hosted style (default). Path style causes boto3 to send
                    # chunked Transfer-Encoding which OCI rejects with MissingContentLength.
                    # NOTE: botocore 1.36+ enables automatic checksum calculation by default,
                    # which also triggers chunked Transfer-Encoding. OCI doesn't support this,
                    # so we disable it with request_checksum_calculation='when_required'.
                    print(f"DEBUG: Initializing S3-compatible client (endpoint: {endpoint_url})...")
                    boto_config = Config(
                        signature_version='s3v4',
                        s3={'addressing_style': 'path'},
                        request_checksum_calculation='when_required',
                        response_checksum_validation='when_required',
                        retries={'max_attempts': 3},
                        connect_timeout=30,
                        read_timeout=60,
                        max_pool_connections=100  # Handle concurrency=50 benchmark + headroom
                    )
                    self.client = boto3.client(
                        's3',
                        aws_access_key_id=self.config['access_key'],
                        aws_secret_access_key=self.config['secret_key'],
                        endpoint_url=endpoint_url,
                        region_name=self.config['region'],
                        config=boto_config,
                        verify=False  # OCI and other S3-compatible endpoints may use self-signed/untrusted certs
                    )
                else:
                    # Standard AWS S3
                    print(f"DEBUG: Initializing standard AWS S3 client...")
                    aws_std_config = Config(
                        retries={'max_attempts': 3},
                        connect_timeout=30,
                        read_timeout=60,
                        max_pool_connections=100  # Handle concurrency=50 benchmark + headroom
                    )
                    self.client = boto3.client(
                        's3',
                        aws_access_key_id=self.config['access_key'],
                        aws_secret_access_key=self.config['secret_key'],
                        region_name=self.config['region'],
                        config=aws_std_config
                    )
            elif self.config_type == 'ddn_infinia':
                self.config = storage_config.ddn_infinia_config
                print(f"DEBUG: Initializing boto3 client for DDN (endpoint: {self.config.get('endpoint_url')})...")

                boto_config = Config(
                    signature_version='s3v4',
                    s3={'addressing_style': 'path'},
                    retries={'max_attempts': 3},
                    connect_timeout=30,
                    read_timeout=60,
                    max_pool_connections=100  # Handle concurrency=50 benchmark + headroom
                )

                self.client = boto3.client(
                    's3',
                    aws_access_key_id=self.config['access_key'],
                    aws_secret_access_key=self.config['secret_key'],
                    endpoint_url=self.config['endpoint_url'],
                    region_name=self.config['region'],
                    config=boto_config,
                    verify=False  # DDN INFINIA uses self-signed certs
                )
            else:
                error_msg = f"Unsupported config type: {self.config_type}"
                print(error_msg)
                return False, error_msg

            print(f"DEBUG: Client created successfully for {self.config_type}")
            return True, "Client created successfully"
        except Exception as e:
            error_msg = f"Error creating {self.config_type} S3 client: {e}"
            print(error_msg)
            import traceback
            traceback.print_exc()
            return False, error_msg

    def _ensure_client(self) -> Tuple[bool, str]:
        """Ensure client is initialized."""
        if not self.client:
            return self.create_client()
        return True, "Client already initialized"

    def upload_bytes(self, data_bytes: bytes, object_key: str) -> Tuple[bool, str]:
        """Upload bytes data to S3 bucket."""
        success, message = self._ensure_client()
        if not success:
            return False, f"Failed to create S3 client: {message}"

        try:
            bucket_name = self.config['bucket_name']
            _t = time.perf_counter()
            self.client.put_object(
                Bucket=bucket_name,
                Key=object_key,
                Body=data_bytes
            )
            _latency_ms = (time.perf_counter() - _t) * 1000
            _emit_event(self.config_type, "WRITE", object_key, len(data_bytes), _latency_ms)
            return True, f"Successfully uploaded to {self.config['provider']}"
        except Exception as e:
            return False, f"Upload error: {e}"

    def download_bytes(self, object_key: str) -> Tuple[Optional[bytes], str]:
        """Download bytes data from S3 bucket."""
        success, message = self._ensure_client()
        if not success:
            return None, f"Failed to create S3 client: {message}"

        try:
            bucket_name = self.config['bucket_name']
            _t = time.perf_counter()
            response = self.client.get_object(Bucket=bucket_name, Key=object_key)
            data = response['Body'].read()
            _latency_ms = (time.perf_counter() - _t) * 1000
            _emit_event(self.config_type, "READ", object_key, len(data), _latency_ms)
            return data, f"Successfully downloaded from {self.config['provider']}"
        except Exception as e:
            return None, f"Download error: {e}"

    def upload_file(self, file_path: str, object_key: str) -> Tuple[bool, str]:
        """Upload file to S3 bucket."""
        success, message = self._ensure_client()
        if not success:
            return False, f"Failed to create S3 client: {message}"

        try:
            bucket_name = self.config['bucket_name']
            self.client.upload_file(file_path, bucket_name, object_key)
            return True, f"Successfully uploaded to {self.config['provider']}"
        except Exception as e:
            return False, f"Upload error: {e}"

    def download_file(self, object_key: str, file_path: str) -> Tuple[bool, str]:
        """Download file from S3 bucket."""
        success, message = self._ensure_client()
        if not success:
            return False, f"Failed to create S3 client: {message}"

        try:
            bucket_name = self.config['bucket_name']
            self.client.download_file(bucket_name, object_key, file_path)
            return True, f"Successfully downloaded from {self.config['provider']}"
        except Exception as e:
            return False, f"Download error: {e}"

    def list_objects(self, prefix: str = "") -> Tuple[List[dict], str]:
        """List objects in S3 bucket."""
        success, message = self._ensure_client()
        if not success:
            return [], f"Failed to create S3 client: {message}"

        try:
            bucket_name = self.config['bucket_name']
            response = self.client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
            objects = response.get('Contents', [])
            return objects, f"Successfully listed objects from {self.config['provider']}"
        except Exception as e:
            return [], f"List error: {e}"

    def delete_object(self, object_key: str) -> Tuple[bool, str]:
        """Delete object from S3 bucket."""
        success, message = self._ensure_client()
        if not success:
            return False, f"Failed to create S3 client: {message}"

        try:
            bucket_name = self.config['bucket_name']
            self.client.delete_object(Bucket=bucket_name, Key=object_key)
            return True, f"Successfully deleted from {self.config['provider']}"
        except Exception as e:
            return False, f"Delete error: {e}"

    def test_connection(self) -> Tuple[bool, str]:
        """Test connection to storage provider."""
        success, message = self._ensure_client()
        if not success:
            return False, f"Failed to create client: {message}"

        try:
            bucket_name = self.config['bucket_name']
            self.client.head_bucket(Bucket=bucket_name)
            return True, f"Successfully connected to {self.config['provider']}"
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            return False, f"Connection failed ({error_code}): {e}"
        except Exception as e:
            return False, f"Connection error: {e}"
