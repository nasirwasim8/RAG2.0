"""
Local LLM service for offline operation without cloud API dependency.
Supports Hugging Face transformers models with GPU acceleration.
"""
import logging
from typing import List, Dict, Any, Optional
import torch

from app.core.config import settings
from app.services.gpu_utils import gpu_info

logger = logging.getLogger(__name__)


class LocalLLMClient:
    """Local LLM client using Hugging Face transformers."""
    
    def __init__(self, model_name: str = None, device: str = None):
        """
        Initialize local LLM.
        
        Args:
            model_name: Hugging Face model name
            device: Device to run on (cuda:0, cuda:1, cpu, etc.)
        """
        self.model_name = model_name or settings.local_llm_model
        self.device = device or settings.local_llm_device
        self.model = None
        self.tokenizer = None
        self.is_loaded = False
        
        logger.info(f"🤖 Initializing Local LLM: {self.model_name}")
        logger.info(f"   Device: {self.device}")
    
    def load_model(self) -> bool:
        """
        Load the model into memory.
        
        Returns:
            True if successful, False otherwise
        """
        if self.is_loaded:
            return True
        
        try:
            from transformers import AutoTokenizer, AutoModelForCausalLM
            
            logger.info(f"⏳ Loading model {self.model_name}...")
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            
            # Load model with appropriate device
            if self.device.startswith("cuda") and gpu_info.is_available:
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_name,
                    torch_dtype=torch.float16,  # Use FP16 for faster inference
                    device_map=self.device,
                    low_cpu_mem_usage=True
                )
            else:
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_name,
                    device_map="cpu",
                    low_cpu_mem_usage=True
                )
            
            self.is_loaded = True
            logger.info(f"✅ Local LLM loaded successfully on {self.device}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load local LLM: {e}")
            logger.error("   Install with: pip install transformers accelerate")
            return False
    
    def generate(
        self,
        prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.7,
        top_p: float = 0.9
    ) -> str:
        """
        Generate text from prompt.
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            top_p: Nucleus sampling parameter
        
        Returns:
            Generated text
        """
        if not self.is_loaded:
            if not self.load_model():
                raise Exception("Failed to load local LLM")
        
        try:
            # Tokenize input
            inputs = self.tokenizer(prompt, return_tensors="pt")
            
            # Move to device
            if self.device.startswith("cuda"):
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Generate
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id
                )
            
            # Decode
            generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Remove input prompt from output
            if generated_text.startswith(prompt):
                generated_text = generated_text[len(prompt):].strip()
            
            return generated_text
            
        except Exception as e:
            logger.error(f"Error generating text: {e}")
            raise
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 500,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Chat completion compatible with NVIDIA API format.
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
        
        Returns:
            Response dict in OpenAI format
        """
        # Convert messages to prompt
        prompt = self._messages_to_prompt(messages)
        
        # Generate response
        response_text = self.generate(prompt, max_tokens, temperature)
        
        # Return in OpenAI-compatible format
        return {
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": response_text
                },
                "index": 0,
                "finish_reason": "stop"
            }],
            "model": self.model_name,
            "usage": {
                "prompt_tokens": len(self.tokenizer.encode(prompt)),
                "completion_tokens": len(self.tokenizer.encode(response_text)),
                "total_tokens": len(self.tokenizer.encode(prompt + response_text))
            }
        }
    
    def _messages_to_prompt(self, messages: List[Dict[str, str]]) -> str:
        """Convert chat messages to a prompt string."""
        prompt_parts = []
        
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            if role == "system":
                prompt_parts.append(f"System: {content}")
            elif role == "user":
                prompt_parts.append(f"User: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
        
        prompt_parts.append("Assistant:")
        return "\n\n".join(prompt_parts)
    
    @property
    def is_configured(self) -> bool:
        """Check if local LLM is configured."""
        return self.is_loaded or self.model_name is not None


# Lazy-loaded global instance
_local_llm_client: Optional[LocalLLMClient] = None


def get_local_llm() -> LocalLLMClient:
    """Get or create the global local LLM instance."""
    global _local_llm_client
    if _local_llm_client is None:
        _local_llm_client = LocalLLMClient()
    return _local_llm_client
