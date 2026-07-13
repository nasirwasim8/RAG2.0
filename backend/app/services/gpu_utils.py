"""
Enhanced GPU detection and configuration utility with multi-GPU support.
"""
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class GPUInfo:
    """Detect and manage GPU availability with multi-GPU support."""
    
    def __init__(self):
        self._gpu_available = False
        self._device_name = "cpu"
        self._cuda_version = None
        self._gpu_count = 0
        self._gpu_names = []
        self._gpu_memory = []
        self._detect_gpu()
    
    def _detect_gpu(self):
        """Detect GPU availability and get device information."""
        try:
            import torch
            
            if torch.cuda.is_available():
                self._gpu_available = True
                self._device_name = "cuda"
                self._gpu_count = torch.cuda.device_count()
                self._cuda_version = torch.version.cuda
                
                # Get GPU names and memory
                for i in range(self._gpu_count):
                    gpu_name = torch.cuda.get_device_name(i)
                    self._gpu_names.append(gpu_name)
                    
                    # Get memory info
                    mem_total = torch.cuda.get_device_properties(i).total_memory / (1024**3)  # GB
                    self._gpu_memory.append(mem_total)
                
                logger.info(f"🎮 GPU DETECTED: {self._gpu_count} GPU(s) available")
                for i, (name, mem) in enumerate(zip(self._gpu_names, self._gpu_memory)):
                    logger.info(f"   GPU {i}: {name} ({mem:.1f} GB)")
                logger.info(f"   CUDA Version: {self._cuda_version}")
            else:
                logger.info("💻 Running on CPU (No GPU detected)")
                
        except ImportError:
            logger.warning("⚠️  PyTorch not installed - GPU acceleration disabled")
        except Exception as e:
            logger.error(f"❌ Error detecting GPU: {e}")
    
    @property
    def is_available(self) -> bool:
        """Check if GPU is available."""
        return self._gpu_available
    
    @property
    def device_name(self) -> str:
        """Get device name (cuda or cpu)."""
        return self._device_name
    
    @property
    def gpu_count(self) -> int:
        """Get number of available GPUs."""
        return self._gpu_count
    
    @property
    def gpu_names(self) -> List[str]:
        """Get list of GPU names."""
        return self._gpu_names
    
    @property
    def gpu_memory(self) -> List[float]:
        """Get list of GPU memory sizes in GB."""
        return self._gpu_memory
    
    @property
    def cuda_version(self) -> str:
        """Get CUDA version."""
        return self._cuda_version or "N/A"
    
    def get_device(self, device_id: Optional[int] = None):
        """
        Get torch device object.
        
        Args:
            device_id: Specific GPU ID, or None for default
        
        Returns:
            Torch device object
        """
        try:
            import torch
            if self._gpu_available and device_id is not None:
                return torch.device(f"cuda:{device_id}")
            return torch.device(self._device_name)
        except ImportError:
            return "cpu"
    
    def get_available_devices(self) -> List[str]:
        """Get list of all available device names."""
        if self._gpu_available:
            return [f"cuda:{i}" for i in range(self._gpu_count)]
        return ["cpu"]
    
    def allocate_gpus(self, max_gpus: int = 0) -> List[int]:
        """
        Allocate GPUs for parallel processing.
        
        Args:
            max_gpus: Maximum GPUs to use (0 = all available)
        
        Returns:
            List of GPU IDs to use
        """
        if not self._gpu_available or self._gpu_count == 0:
            return []
        
        if max_gpus == 0:
            # Use all available GPUs
            return list(range(self._gpu_count))
        else:
            # Use specified number of GPUs
            return list(range(min(max_gpus, self._gpu_count)))
    
    def get_gpu_utilization(self) -> List[dict]:
        """
        Get current GPU utilization stats.
        
        Returns:
            List of dicts with GPU utilization info
        """
        if not self._gpu_available:
            return []
        
        try:
            import torch
            stats = []
            for i in range(self._gpu_count):
                mem_allocated = torch.cuda.memory_allocated(i) / (1024**3)  # GB
                mem_reserved = torch.cuda.memory_reserved(i) / (1024**3)  # GB
                mem_total = self._gpu_memory[i]
                
                stats.append({
                    "gpu_id": i,
                    "name": self._gpu_names[i],
                    "memory_allocated_gb": round(mem_allocated, 2),
                    "memory_reserved_gb": round(mem_reserved, 2),
                    "memory_total_gb": round(mem_total, 2),
                    "utilization_percent": round((mem_allocated / mem_total) * 100, 1) if mem_total > 0 else 0
                })
            return stats
        except Exception as e:
            logger.error(f"Error getting GPU utilization: {e}")
            return []
    
    def to_dict(self) -> dict:
        """Get GPU info as dictionary for API responses."""
        return {
            "gpu_available": self._gpu_available,
            "device": self._device_name,
            "gpu_count": self._gpu_count,
            "gpu_names": self._gpu_names,
            "gpu_memory_gb": self._gpu_memory,
            "cuda_version": self.cuda_version,
            "available_devices": self.get_available_devices()
        }


# Global GPU info instance
gpu_info = GPUInfo()
