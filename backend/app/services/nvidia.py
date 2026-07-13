"""
Enhanced NVIDIA API integrations with offline fallback support.
Supports LLM, Reranking, and Guardrails with automatic cloud→local fallback.
"""
import requests
import time
import json
import logging
from typing import List, Dict, Any, Optional, Generator

from app.core.config import settings

logger = logging.getLogger(__name__)


class HybridLLMClient:
    """
    Hybrid LLM client with automatic cloud→local fallback.
    Tries NVIDIA Cloud API first, falls back to local LLM if unavailable.
    """
    
    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or settings.nvidia_api_key
        self.base_url = base_url or settings.nvidia_base_url
        self.default_model = "meta/llama-3.1-8b-instruct"
        
        # Initialize local LLM if offline mode or use_local_llm is enabled
        self.local_llm = None
        if settings.offline_mode or settings.use_local_llm:
            try:
                from app.services.local_llm import get_local_llm
                self.local_llm = get_local_llm()
                logger.info("🤖 Local LLM initialized for hybrid mode")
            except Exception as e:
                logger.warning(f"Local LLM not available: {e}")
    
    @property
    def is_configured(self) -> bool:
        """Check if either cloud or local LLM is configured."""
        return bool(self.api_key) or (self.local_llm and self.local_llm.is_configured)
    
    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        stream: bool = False,
        use_local: bool = False
    ) -> Dict[str, Any]:
        """
        Send chat completion request with automatic fallback.
        
        Args:
            messages: Chat messages
            model: Model name
            max_tokens: Max tokens to generate
            temperature: Sampling temperature
            stream: Enable streaming (cloud only)
            use_local: Force local LLM usage
        
        Returns:
            Response dict
        """
        # Force local if offline mode or explicitly requested
        if settings.offline_mode or use_local:
            return self._local_chat_completion(messages, max_tokens, temperature)
        
        # Try cloud first
        try:
            return self._cloud_chat_completion(messages, model, max_tokens, temperature, stream)
        except requests.exceptions.ConnectionError as e:
            logger.warning(f"☁️ Cloud API connection failed: {e}")
            logger.info("🔄 Falling back to local LLM...")
            return self._local_chat_completion(messages, max_tokens, temperature)
        except requests.exceptions.Timeout as e:
            logger.warning(f"⏱️ Cloud API timeout: {e}")
            logger.info("🔄 Falling back to local LLM...")
            return self._local_chat_completion(messages, max_tokens, temperature)
        except Exception as e:
            # For other errors, try local as fallback
            logger.error(f"❌ Cloud API error: {e}")
            if self.local_llm:
                logger.info("🔄 Attempting local LLM fallback...")
                return self._local_chat_completion(messages, max_tokens, temperature)
            raise
    
    def _cloud_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
        stream: bool = False
    ) -> Dict[str, Any]:
        """Cloud API chat completion."""
        if not self.api_key:
            raise Exception("NVIDIA API key not configured")
        
        model_name = model or self.default_model
        url = f"{self.base_url}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "top_p": 1.0,
            "max_tokens": max_tokens,
            "stream": stream
        }
        
        # Retry logic
        max_retries = 2
        for attempt in range(max_retries):
            try:
                timeout = 120
                response = requests.post(url, headers=headers, json=payload, timeout=timeout)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.ReadTimeout as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning(f"Timeout on attempt {attempt + 1}/{max_retries}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise Exception(f"Cloud API timed out after {max_retries} attempts") from e
            except Exception as e:
                raise
    
    def _local_chat_completion(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 500,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """Local LLM chat completion."""
        if not self.local_llm:
            raise Exception("Local LLM not available. Install transformers: pip install transformers accelerate")
        
        try:
            return self.local_llm.chat_completion(messages, max_tokens, temperature)
        except Exception as e:
            logger.error(f"Local LLM error: {e}")
            raise Exception(f"Both cloud and local LLM failed. Error: {e}")
    
    def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> Generator[str, None, None]:
        """
        Stream chat completion tokens one-by-one.
        Yields individual token strings.
        Falls back to word simulation when local LLM is used.
        """
        # Local / offline mode: get full response then emit word by word
        if settings.offline_mode or (not self.api_key):
            try:
                full = self._local_chat_completion(messages, max_tokens, temperature)
                text = full["choices"][0]["message"]["content"]
                words = text.split(" ")
                for i, word in enumerate(words):
                    yield word + ("" if i == len(words) - 1 else " ")
                    time.sleep(0.02)  # simulate ~50 tok/sec
            except Exception as e:
                logger.error(f"Local LLM stream error: {e}")
                yield f"[Error: {e}]"
            return

        # Cloud NVIDIA streaming
        model_name = model or self.default_model
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }
        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        try:
            with requests.post(url, headers=headers, json=payload, stream=True, timeout=120) as resp:
                resp.raise_for_status()
                for raw_line in resp.iter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.decode("utf-8") if isinstance(raw_line, bytes) else raw_line
                    if line.startswith("data:"):
                        data_str = line[5:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            token = delta.get("content", "")
                            if token:
                                yield token
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            # Fallback: non-streaming full response emitted word-by-word
            try:
                full = self._cloud_chat_completion(messages, model, max_tokens, temperature, stream=False)
                text = full["choices"][0]["message"]["content"]
                words = text.split(" ")
                for i, word in enumerate(words):
                    yield word + ("" if i == len(words) - 1 else " ")
            except Exception as e2:
                yield f"[Error: {e2}]"

    def available_models(self) -> List[str]:
        """Get list of available models."""
        models = [
            # Fast cloud models
            "meta/llama-3.1-8b-instruct",
            "mistralai/mistral-7b-instruct-v0.3",
            "google/gemma-2-9b-it",
            # Quality cloud models
            "nvidia/nvidia-nemotron-nano-9b-v2",
            "mistralai/mixtral-8x7b-instruct-v0.1"
        ]
        
        # Add local model if available
        if self.local_llm:
            models.append(f"local/{self.local_llm.model_name}")
        
        return models


# For backward compatibility
class NvidiaLLMClient(HybridLLMClient):
    """Alias for backward compatibility."""
    pass


class NvidiaReranker:
    """NVIDIA NeMo Retriever Reranking Service."""
    
    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or settings.nvidia_api_key
        self.base_url = base_url or settings.nvidia_base_url
        self.model = "nvidia/nv-rerankqa-mistral-4b-v3"
    
    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)
    
    def rerank(
        self,
        query: str,
        documents: List[str],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Rerank documents using NVIDIA NeMo Retriever."""
        if not self.api_key or not documents:
            return [{"text": doc, "index": i, "score": 1.0} for i, doc in enumerate(documents[:top_k])]
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            
            payload = {
                "model": self.model,
                "query": {"text": query},
                "passages": [{"text": doc} for doc in documents],
                "top_n": min(top_k, len(documents))
            }
            
            response = requests.post(
                f"{self.base_url}/ranking",
                headers=headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code == 404:
                logger.warning("⚠️ Reranking endpoint not available (404) - skipping")
                return [{"text": doc, "index": i, "score": 1.0} for i, doc in enumerate(documents[:top_k])]
            
            if response.status_code == 200:
                result = response.json()
                rankings = result.get("rankings", [])
                return [
                    {
                        "text": documents[item["index"]],
                        "index": item["index"],
                        "score": item.get("logit", 1.0)
                    }
                    for item in rankings[:top_k]
                ]
            else:
                logger.warning(f"Reranking failed with status {response.status_code}")
                return [{"text": doc, "index": i, "score": 1.0} for i, doc in enumerate(documents[:top_k])]
        
        except Exception as e:
            logger.warning(f"Reranking error: {e}")
            return [{"text": doc, "index": i, "score": 1.0} for i, doc in enumerate(documents[:top_k])]


class NvidiaGuardrails:
    """NVIDIA NeMo Guardrails for Content Safety."""
    
    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or settings.nvidia_api_key
        self.base_url = base_url or settings.nvidia_base_url
        self.model = "nvidia/aegis-ai-content-safety-1b"
    
    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)
    
    def check_safety(self, text: str) -> Dict[str, Any]:
        """Check text for safety issues."""
        if not self.api_key:
            return {"safe": True, "reason": "Guardrails disabled", "confidence": 1.0}
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": text}],
                "max_tokens": 100
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=5
            )
            
            if response.status_code == 404:
                logger.warning("⚠️ Guardrails endpoint not available (404)")
                return {"safe": True, "reason": "Endpoint not available", "confidence": 0.5}
            
            if response.status_code == 200:
                result = response.json()
                safety_response = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                is_safe = "unsafe" not in safety_response.lower() and "harmful" not in safety_response.lower()
                
                return {
                    "safe": is_safe,
                    "reason": safety_response if not is_safe else "Content appears safe",
                    "confidence": 0.8
                }
            else:
                return {"safe": True, "reason": "Check failed, allowing by default", "confidence": 0.5}
        
        except Exception as e:
            logger.warning(f"Guardrail check error: {e}")
            return {"safe": True, "reason": "Check failed, allowing by default", "confidence": 0.5}
    
    def check_input(self, text: str) -> Dict[str, Any]:
        """Check input text for safety issues."""
        return self.check_safety(text)
    
    def check_output(self, text: str) -> Dict[str, Any]:
        """Check output text for safety issues."""
        return self.check_safety(text)
