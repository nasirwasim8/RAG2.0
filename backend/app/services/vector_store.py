"""
Vector store service using FAISS with dual-provider object storage.
"""
# CRITICAL: Set these BEFORE importing torch/transformers to prevent segfault
import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['OMP_NUM_THREADS'] = '4'   # Allow more CPU threads for S3 parallel uploads
os.environ['MKL_NUM_THREADS'] = '4'
# Force HuggingFace to use local cache only — prevents 30s+ startup delay
# when the server has no/limited internet access (e.g., air-gapped demo env)
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'

import time
import json
import pickle
import hashlib
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

from app.core.config import settings
from app.services.storage import S3Handler
from app.services.gpu_utils import gpu_info

# Configure logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# S3 object keys for FAISS index persistence on Infinia
FAISS_INDEX_KEY = "vectordb/faiss_index.bin"
METADATA_KEY    = "vectordb/chunk_metadata.pkl"
COUNTER_KEY     = "vectordb/chunk_counter.pkl"


class VectorStore:
    """FAISS-based vector store with AWS S3 and DDN INFINIA storage."""

    def __init__(self, embedding_model_name: str = None, providers: List[str] = None, storage_ops_tracker=None):
        self.model_name = embedding_model_name or settings.embedding_model
        # Auto-detect GPU
        try:
            import torch
            if torch.cuda.is_available():
                device = "cuda"
                # Enable TF32 for Ampere+ GPUs (RTX 3090+) — free ~2x speedup on matrix ops
                torch.backends.cuda.matmul.allow_tf32 = True
                torch.backends.cudnn.allow_tf32 = True
            else:
                device = "cpu"
        except ImportError:
            device = "cpu"
        self.embedding_model = SentenceTransformer(self.model_name, device=device)
        # Use FP16 on GPU for 2x faster inference with negligible accuracy loss
        if device == "cuda":
            try:
                self.embedding_model.half()
                logger.info("⚡ Embedding model converted to FP16 for faster GPU inference")
            except Exception:
                pass  # Fall back to FP32 if half() not supported
        self.embedding_dim = self.embedding_model.get_sentence_embedding_dimension()
        self.device = device  # Track for GPU metrics
        # Batch size: large for GPU (RTX 5090 has 24GB VRAM), small for CPU
        self.embed_batch_size = 128 if device == "cuda" else 32
        logger.info(f"🔮 Embedding batch size set to {self.embed_batch_size} on {device}")


        # Initialize FAISS index
        self.index = faiss.IndexFlatL2(self.embedding_dim)
        self.chunk_metadata: Dict[int, Dict] = {}
        self.chunk_counter = 0

        # Storage providers - check AWS configuration
        from app.core.config import storage_config
        self.aws_configured = bool(storage_config.aws_config.get('access_key'))
        
        # Only initialize handlers for configured providers
        self.active_providers = ['ddn_infinia']  # DDN is always primary
        if self.aws_configured:
            self.active_providers.append('aws')
        
        self.providers = providers or self.active_providers
        self.storage_handlers = {p: S3Handler(p) for p in self.providers if p != 'aws' or self.aws_configured}
        
        # NEW: Storage operations tracker for metrics
        self.storage_ops_tracker = storage_ops_tracker

        # Serialize concurrent GPU operations (process_file + add_chunks).
        # RLock (re-entrant) lets the same thread acquire it multiple times —
        # the upload route acquires it before process_file(), then add_chunks()
        # acquires it again in the same thread without deadlock.
        # Cross-thread callers (bucket monitor) must wait for the lock.
        self._add_lock = threading.RLock()

        # Auto-restore persisted FAISS index from Infinia on startup
        # This means backend restarts never require re-indexing
        self.load_index_from_infinia()

    def _generate_chunk_id(self, content: str) -> str:
        """Generate unique chunk ID based on content hash."""
        return hashlib.md5(content.encode()).hexdigest()

    def encode(self, texts: List[str]) -> np.ndarray:
        """Encode texts to embeddings."""
        return self.embedding_model.encode(texts, convert_to_numpy=True, show_progress_bar=False)

    def add_chunks(self, chunks: List[Dict[str, Any]], progress_callback=None, aws_complete_callback=None, enable_s3: bool = True, enable_aws_bg: bool = True) -> Dict[str, Any]:
        """Add chunks to vector store and object storage.

        Acquires self._add_lock so concurrent callers (bucket monitor + document
        upload) queue up instead of racing on FAISS and the GPU encoder.
        """
        if not self._add_lock.acquire(timeout=600):   # 10-minute max wait
            raise RuntimeError("add_chunks: timed out waiting for vector store lock (another upload is running)")
        try:
            return self._add_chunks_impl(chunks, progress_callback, aws_complete_callback, enable_s3, enable_aws_bg)
        finally:
            self._add_lock.release()

    def _add_chunks_impl(self, chunks: List[Dict[str, Any]], progress_callback=None, aws_complete_callback=None, enable_s3: bool = True, enable_aws_bg: bool = True) -> Dict[str, Any]:
        """Internal implementation — always called under self._add_lock.
        
        Args:
            chunks: List of chunk dicts with 'content' and optional 'chunk_id' / 'metadata'.
            progress_callback: Optional callable(chunks_done, chunks_total, embeddings_per_sec,
            aws_complete_callback: Optional callable(avg_latency_ms) called when AWS bg upload finishes.
                               provider_write_stats) called after each chunk is stored.
        """
        UPLOAD_BATCH = 500  # Serialize & upload this many chunks at a time — keeps RAM bounded

        logger.info(f"📥 Adding {len(chunks)} chunks to vector store (upload_batch={UPLOAD_BATCH})")
        logger.info(f"   Current index size BEFORE: {self.index.ntotal} chunks")

        total = len(chunks)
        results = {
            'total_chunks': total,
            'stored_chunks': 0,
            'provider_performance': {p: {'times': [], 'success': 0, 'failed': 0} for p in self.providers},
            'embedding_time_ms': 0.0,
            'embedding_device': self.device
        }

        # ── Step 1: Generate ALL embeddings at once (numpy is memory-efficient) ──────
        contents = [chunk['content'] for chunk in chunks]
        logger.info(f"🔮 Generating embeddings for {total} chunks on {self.device} (batch_size={self.embed_batch_size})...")
        _embed_start = time.perf_counter()
        try:
            embeddings = self.embedding_model.encode(
                contents,
                show_progress_bar=False,
                batch_size=self.embed_batch_size,
                convert_to_numpy=True
            )
        except Exception as e:
            logger.error(f"❌ Embedding generation failed: {e}")
            raise
        embed_elapsed = (time.perf_counter() - _embed_start) * 1000
        results['embedding_time_ms'] = embed_elapsed
        embeddings_per_sec = (total / embed_elapsed * 1000) if embed_elapsed > 0 else 0
        logger.info(f"✅ Embeddings generated in {embed_elapsed:.1f}ms on {self.device} ({embeddings_per_sec:.0f} chunks/sec)")

        # ── Step 2: Add ALL embeddings to FAISS index at once ────────────────────────
        embeddings_f32 = embeddings.astype(np.float32)
        self.index.add(embeddings_f32)

        # ── Step 3: Build lightweight metadata (no pickle yet) ───────────────────────
        all_chunk_ids = []
        for i, chunk in enumerate(chunks):
            chunk_id = chunk.get('chunk_id') or self._generate_chunk_id(chunk['content'])
            all_chunk_ids.append(chunk_id)
            self.chunk_metadata[self.chunk_counter] = {
                'chunk_id': chunk_id,
                'content': chunk['content'],
                'metadata': chunk.get('metadata', {})
            }
            self.chunk_counter += 1

        results['stored_chunks'] = total

        ddn_providers = [p for p in self.providers if 'ddn' in p]
        aws_providers  = [p for p in self.providers if 'aws' in p] if enable_s3 else []

        def _upload_chunk(args):
            """Upload a single chunk to a single provider."""
            provider, chunk_id, chunk_bytes = args
            handler = self.storage_handlers[provider]
            t0 = time.perf_counter()
            try:
                success, message = handler.upload_bytes(chunk_bytes, f"chunks/{chunk_id}.json")
            except Exception as e:
                success, message = False, str(e)
            latency_ms = (time.perf_counter() - t0) * 1000
            if self.storage_ops_tracker:
                self.storage_ops_tracker.track_operation(
                    op_type='PUT', provider=provider,
                    bytes_transferred=len(chunk_bytes),
                    latency_ms=latency_ms, success=success
                )
            return provider, chunk_id, success, latency_ms / 1000

        upload_start = time.perf_counter()
        last_storage_results = {p: {'latency_ms': 0, 'success': True} for p in self.providers}
        all_aws_latencies: List[float] = []
        all_aws_tasks: List = []   # Collect ALL AWS tasks across all batches → upload in one bg thread

        # ── Step 4: DDN sync — one UPLOAD_BATCH at a time ───────────────────────────
        # AWS tasks are collected here and uploaded in a single background thread AFTER
        # all DDN batches complete (prevents accumulation of parallel ThreadPoolExecutors)
        for batch_start in range(0, total, UPLOAD_BATCH):
            batch_end = min(batch_start + UPLOAD_BATCH, total)
            logger.info(f"⬆️  Upload batch {batch_start}–{batch_end} / {total}...")

            # Serialize only this batch (memory freed when batch_data goes out of scope)
            batch_data = []
            for i in range(batch_start, batch_end):
                chunk_payload = json.dumps({
                    'content': chunks[i]['content'],
                    'embeddings': embeddings[i].tolist(),
                    'timestamp': datetime.now().isoformat(),
                    'chunk_id': all_chunk_ids[i],
                    'metadata': chunks[i].get('metadata', {})
                }, ensure_ascii=False).encode('utf-8')
                batch_data.append((all_chunk_ids[i], chunk_payload))

            # DDN: synchronous with bounded timeout ──────────────────────────────────
            if ddn_providers:
                # Fewer workers for large uploads — reduces DDN server connection pressure
                ddn_worker_count = 4 if total > 1000 else 8
                ddn_tasks = [(p, cid, cbytes) for p in ddn_providers for cid, cbytes in batch_data]
                chunks_uploaded_in_batch = 0
                PROGRESS_EVERY = 50  # Emit UI progress every N chunks within a batch

                # Use `with` block so threads are ALWAYS joined — no zombie threads
                # `TimeoutError` from as_completed cancels pending futures; running threads
                # complete within boto3 read_timeout (60s) so the with-block exits cleanly
                with ThreadPoolExecutor(max_workers=min(ddn_worker_count, len(ddn_tasks))) as ex:
                    futures = {ex.submit(_upload_chunk, t): t for t in ddn_tasks}
                    try:
                        for fut in as_completed(futures, timeout=90):
                            try:
                                provider, chunk_id, success, elapsed_sec = fut.result(timeout=30)
                            except Exception as e:
                                logger.warning(f"⚠️ DDN future error: {e}")
                                chunks_uploaded_in_batch += 1
                                continue
                            if success:
                                results['provider_performance'][provider]['success'] += 1
                                results['provider_performance'][provider]['times'].append(elapsed_sec)
                            else:
                                results['provider_performance'][provider]['failed'] += 1
                            last_storage_results[provider] = {'latency_ms': elapsed_sec * 1000, 'success': success}
                            chunks_uploaded_in_batch += 1

                            # Granular progress — fire every PROGRESS_EVERY chunks
                            if progress_callback and chunks_uploaded_in_batch % PROGRESS_EVERY == 0:
                                try:
                                    progress_callback(
                                        chunks_done=batch_start + chunks_uploaded_in_batch,
                                        chunks_total=total,
                                        embeddings_per_sec=embeddings_per_sec,
                                        provider_write_stats=last_storage_results
                                    )
                                except Exception:
                                    pass
                    except TimeoutError:
                        # Cancel queue'd-but-not-started futures; running threads finish naturally
                        for f in futures:
                            f.cancel()
                        logger.warning(f"⚠️ DDN batch {batch_start}–{batch_end} timed out after 90s — some chunks skipped")
                    # with-block waits here; running threads exit within boto3 read_timeout (60s)

                # Final progress event at batch boundary
                if progress_callback:
                    try:
                        progress_callback(
                            chunks_done=batch_end,
                            chunks_total=total,
                            embeddings_per_sec=embeddings_per_sec,
                            provider_write_stats=last_storage_results
                        )
                    except Exception:
                        pass
                logger.info(f"✅ DDN batch {batch_start}–{batch_end} complete")

            # Collect AWS tasks for this batch (uploaded later as ONE background thread)
            if aws_providers:
                all_aws_tasks.extend(
                    [(p, cid, cbytes) for p in aws_providers for cid, cbytes in batch_data]
                )

        # ── Step 5: Single AWS background thread for ALL batches combined ────────────
        # One thread + one ThreadPoolExecutor instead of N simultaneous ones — prevents
        # the resource exhaustion (40+ threads) that crashed the backend on large uploads.
        # enable_aws_bg=False is used by bucket_monitor (called per-file) to prevent
        # N files × 8 AWS workers accumulating simultaneously.
        if aws_providers and all_aws_tasks and enable_aws_bg:
            def _aws_all_bg():
                try:
                    with ThreadPoolExecutor(max_workers=8) as ex:
                        aws_futures = {ex.submit(_upload_chunk, t): t for t in all_aws_tasks}
                        for fut in as_completed(aws_futures, timeout=700):
                            try:
                                provider, _, success, elapsed_sec = fut.result(timeout=45)
                                if success:
                                    results['provider_performance'][provider]['success'] += 1
                                    results['provider_performance'][provider]['times'].append(elapsed_sec)
                                    all_aws_latencies.append(elapsed_sec * 1000)
                                else:
                                    results['provider_performance'][provider]['failed'] += 1
                            except Exception as e:
                                logger.warning(f"⚠️ AWS future error: {e}")
                    avg_ms = sum(all_aws_latencies) / len(all_aws_latencies) if all_aws_latencies else 0
                    logger.info(f"✅ AWS upload complete — {len(all_aws_tasks)} chunks, avg {avg_ms:.0f}ms")
                    if aws_complete_callback:
                        try:
                            aws_complete_callback(avg_ms)
                        except Exception as cb_err:
                            logger.warning(f"aws_complete_callback error: {cb_err}")
                except Exception as e:
                    logger.error(f"❌ AWS upload failed: {e}")
                    if aws_complete_callback:
                        try:
                            aws_complete_callback(0)
                        except Exception:
                            pass

            import threading as _threading
            _threading.Thread(target=_aws_all_bg, daemon=True, name="aws-all-bg").start()

        elif not aws_providers and aws_complete_callback:
            try:
                aws_complete_callback(0)
            except Exception:
                pass

        upload_elapsed = (time.perf_counter() - upload_start) * 1000

        logger.info(f"✅ Upload phase done in {upload_elapsed:.0f}ms (DDN sync batched, AWS async)")

        # Calculate average times per provider
        for provider in self.providers:
            times = results['provider_performance'][provider]['times']
            if times:
                results['provider_performance'][provider]['avg_time'] = sum(times) / len(times)
                results['provider_performance'][provider]['total_time'] = sum(times)

        logger.info(f"✅ Successfully added {results['stored_chunks']} chunks")
        logger.info(f"   Index size AFTER: {self.index.ntotal} chunks")
        logger.info(f"   Metadata entries: {len(self.chunk_metadata)}")

        return results


    def _store_to_providers(self, content: str, chunk_id: str, embedding: np.ndarray) -> Dict[str, Dict]:
        """Store chunk data to all configured storage providers (kept for backward compatibility)."""
        chunk_data = {
            'content': content,
            'embeddings': embedding.tolist(),
            'timestamp': datetime.now().isoformat(),
            'chunk_id': chunk_id
        }

        chunk_bytes = json.dumps(chunk_data, ensure_ascii=False).encode('utf-8')
        object_key = f"chunks/{chunk_id}.json"
        bytes_size = len(chunk_bytes)

        results = {}
        for provider in self.providers:
            start_time = time.perf_counter()
            handler = self.storage_handlers[provider]
            success, message = handler.upload_bytes(chunk_bytes, object_key)
            latency_ms = (time.perf_counter() - start_time) * 1000

            if self.storage_ops_tracker:
                self.storage_ops_tracker.track_operation(
                    op_type='PUT',
                    provider=provider,
                    bytes_transferred=bytes_size,
                    latency_ms=latency_ms,
                    success=success
                )

            results[provider] = {
                'success': success,
                'message': message,
                'time': latency_ms / 1000,
                'object_key': object_key
            }

        return results

    def search(self, query: str, top_k: int = 5) -> List[Tuple[str, float, Dict]]:
        """Search for similar chunks using FAISS."""
        if self.index.ntotal == 0:
            return []

        query_embedding = self.embedding_model.encode([query], show_progress_bar=False)[0]
        query_np = np.array([query_embedding], dtype=np.float32)

        distances, indices = self.index.search(query_np, min(top_k, self.index.ntotal))

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx >= 0 and idx in self.chunk_metadata:
                meta = self.chunk_metadata[idx]
                results.append((meta['content'], float(dist), meta['metadata']))

        return results

    def search_with_provider_comparison(
        self,
        query: str,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """Search and retrieve from both providers, comparing performance."""
        logger.info(f"🔍 Searching for query: '{query[:50]}...'")
        logger.info(f"   Index has {self.index.ntotal} chunks")
        logger.info(f"   Metadata has {len(self.chunk_metadata)} entries")
        
        if self.index.ntotal == 0:
            logger.warning("⚠️  Index is empty! No chunks to search.")
            return {'results': [], 'provider_times': {}, 'fastest_provider': None}

        # FAISS search
        query_embedding = self.embedding_model.encode([query], show_progress_bar=False)[0]
        query_np = np.array([query_embedding], dtype=np.float32)
        distances, indices = self.index.search(query_np, min(top_k, self.index.ntotal))

        # Get chunk IDs to retrieve
        chunk_ids = []
        for idx in indices[0]:
            if idx >= 0 and idx in self.chunk_metadata:
                chunk_ids.append(self.chunk_metadata[idx]['chunk_id'])

        logger.info(f"📦 Found {len(chunk_ids)} chunk IDs from FAISS search")

        # Check if AWS is configured
        from app.core.config import storage_config
        aws_configured = bool(storage_config.aws_config.get('access_key'))
        
        # Retrieve chunks from S3 with provider comparison
        provider_times = {}
        provider_chunks = {}
        
        # Determine which providers to actually retrieve from
        if aws_configured:
            # AWS is configured - retrieve from BOTH providers for real comparison
            providers_to_retrieve = ['ddn_infinia', 'aws']
            logger.info("🔬 Running REAL performance comparison (both providers)")
        else:
            # AWS not configured - retrieve from DDN only, simulate AWS
            providers_to_retrieve = ['ddn_infinia']
            logger.info("⚡ Running with DDN INFINIA only (AWS simulated)")
        
        for provider in providers_to_retrieve:
            logger.info(f"🌐 Retrieving from {provider}...")
            
            # Measure connection time separately
            conn_start = time.perf_counter()
            handler = S3Handler(provider)
            handler.create_client()
            connection_time = (time.perf_counter() - conn_start) * 1000
            
            # For AWS: Sample 1 chunk and extrapolate (for speed)
            # For DDN: Download all chunks (for actual use)
            if provider == 'aws':
                # Sample-based measurement: download only 1 chunk
                logger.info(f"   📊 Sampling 1 chunk for performance measurement...")
                download_start = time.perf_counter()
                
                # Download first chunk as sample
                sample_chunk_data, success = self._retrieve_from_provider_with_handler(chunk_ids[0], handler)
                sample_download_time = (time.perf_counter() - download_start) * 1000
                
                # Extrapolate for all chunks
                download_time = sample_download_time * len(chunk_ids)
                chunks_retrieved = []  # Don't use AWS chunks, will use DDN chunks
                
                logger.info(f"   Sample timing: {sample_download_time:.2f}ms/chunk, extrapolated: {download_time:.2f}ms for {len(chunk_ids)} chunks")
            else:
                # DDN: Download all chunks for actual use
                download_start = time.perf_counter()
                chunks_retrieved = []
                for chunk_id in chunk_ids:
                    chunk_data, success = self._retrieve_from_provider_with_handler(chunk_id, handler)
                    if success and chunk_data:
                        chunks_retrieved.append(chunk_data)
                
                download_time = (time.perf_counter() - download_start) * 1000
            
            total_time = connection_time + download_time
            
            # Store separate metrics
            provider_times[provider] = {
                'connection_ms': connection_time,
                'download_ms': download_time,  # This is the TTFB
                'total_ms': total_time
            }
            provider_chunks[provider] = chunks_retrieved
            
            logger.info(f"   {provider}: Connection={connection_time:.2f}ms, Download={download_time:.2f}ms, Total={total_time:.2f}ms for {len(chunk_ids)} chunks")

        # NO SIMULATION: Only use real AWS S3 data when credentials are configured
        # If AWS is not configured, provider_times will only contain 'ddn_infinia'

        # Determine fastest provider based on download time (TTFB)
        if provider_times:
            fastest_provider = min(provider_times.keys(), key=lambda k: provider_times[k]['download_ms'])
        else:
            fastest_provider = None

        # Use results from the fastest provider (or DDN if available)
        source_provider = 'ddn_infinia' if 'ddn_infinia' in provider_chunks else list(provider_chunks.keys())[0] if provider_chunks else None
        
        results = []
        if source_provider:
            chunks = provider_chunks[source_provider]
            for i, (dist, idx) in enumerate(zip(distances[0], indices[0])):
                if idx >= 0 and i < len(chunks):
                    chunk = chunks[i]
                    meta = self.chunk_metadata.get(idx, {})
                    results.append({
                        'content': chunk['content'],
                        'distance': float(dist),
                        'metadata': meta.get('metadata', {}),
                        'chunk_id': chunk['chunk_id']
                    })
                    logger.debug(f"   Retrieved chunk {idx}: distance={dist:.4f}, content_len={len(chunk['content'])}")

        logger.info(f"✅ Search complete: Found {len(results)} relevant chunks")
        if results:
            logger.info(f"   Sample chunk preview: {results[0]['content'][:100]}...")
        else:
            logger.warning("⚠️  No results returned!")
        
        # Extract storage TTFB metrics (download time only)
        storage_ttfb = {provider: metrics['download_ms'] for provider, metrics in provider_times.items()}
        
        return {
            'results': results,
            'storage_ttfb': storage_ttfb,  # NEW: Pure download time
            'provider_times': provider_times,  # Keep for backward compatibility
            'fastest_provider': fastest_provider,
            'ttfb_improvement': self._calculate_improvement(storage_ttfb)
        }

    def _retrieve_from_provider_with_handler(self, chunk_id: str, handler: S3Handler) -> Tuple[Optional[Dict], bool]:
        """Retrieve chunk from storage provider using provided handler.
        Tries JSON format first (.json), falls back to legacy pickle (.pkl).
        """
        for ext, deserialize in [
            ('.json', lambda b: json.loads(b.decode('utf-8'))),
            ('.pkl',  lambda b: pickle.loads(b))
        ]:
            chunk_bytes, _ = handler.download_bytes(f"chunks/{chunk_id}{ext}")
            if chunk_bytes:
                try:
                    return deserialize(chunk_bytes), True
                except Exception as e:
                    logger.error(f"Failed to deserialize chunk {chunk_id}{ext}: {e}")
        return None, False

    def _retrieve_from_provider(self, chunk_id: str, provider: str) -> Tuple[Optional[Dict], bool]:
        """Retrieve chunk from specific storage provider.
        Tries JSON format first (.json), falls back to legacy pickle (.pkl).
        """
        handler = self.storage_handlers[provider]
        start_time = time.perf_counter()
        chunk_bytes = None

        # Try JSON format first (new), then legacy pickle (old)
        for ext in ['.json', '.pkl']:
            data, _ = handler.download_bytes(f"chunks/{chunk_id}{ext}")
            if data:
                chunk_bytes = data
                break

        latency_ms = (time.perf_counter() - start_time) * 1000
        success = chunk_bytes is not None
        bytes_size = len(chunk_bytes) if chunk_bytes else 0

        # Track storage operation metrics
        if self.storage_ops_tracker:
            self.storage_ops_tracker.track_operation(
                op_type='GET',
                provider=provider,
                bytes_transferred=bytes_size,
                latency_ms=latency_ms,
                success=success
            )

        if chunk_bytes:
            try:
                try:
                    return json.loads(chunk_bytes.decode('utf-8')), True
                except (json.JSONDecodeError, UnicodeDecodeError):
                    return pickle.loads(chunk_bytes), True
            except Exception:
                return None, False
        return None, False

    def _calculate_improvement(self, provider_times: Dict[str, float]) -> Dict[str, Any]:
        """Calculate performance improvement metrics."""
        if 'aws' not in provider_times or 'ddn_infinia' not in provider_times:
            return {}

        # Ensure we have float values, not dicts
        aws_time = provider_times['aws']
        ddn_time = provider_times['ddn_infinia']
        
        # Handle case where values might still be dicts (backward compatibility)
        if isinstance(aws_time, dict):
            aws_time = aws_time.get('download_ms', 0)
        if isinstance(ddn_time, dict):
            ddn_time = ddn_time.get('download_ms', 0)

        if ddn_time > 0 and aws_time > 0:
            if ddn_time < aws_time:
                speedup = aws_time / ddn_time
                improvement_pct = (1 - ddn_time / aws_time) * 100
                return {
                    'ddn_faster': True,
                    'speedup': speedup,
                    'improvement_percent': improvement_pct
                }
            else:
                speedup = ddn_time / aws_time
                return {
                    'ddn_faster': False,
                    'speedup': speedup,
                    'improvement_percent': 0
                }
        return {}

    # ─────────────────────────────────────────────────────────────────────────
    # Infinia Persistence — FAISS index survives backend restarts
    # ─────────────────────────────────────────────────────────────────────────

    def save_index_to_infinia(self) -> bool:
        """Persist FAISS index + chunk metadata to Infinia.

        Called automatically after every ingest so the index is always durable.
        Three objects are written to the 'vectordb/' prefix:
          vectordb/faiss_index.bin    — binary FAISS index
          vectordb/chunk_metadata.pkl — {int → metadata dict} mapping
          vectordb/chunk_counter.pkl  — monotonic chunk counter

        Returns True on success, False if an error occurred.
        """
        try:
            handler = self.storage_handlers.get('ddn_infinia')
            if not handler:
                logger.warning("⚠️  No DDN INFINIA handler — skipping FAISS persistence")
                return False

            import tempfile

            # 1. Write FAISS index to temp file → read bytes → upload to Infinia
            with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as f:
                tmp_path = f.name
            faiss.write_index(self.index, tmp_path)
            with open(tmp_path, 'rb') as fb:
                index_bytes = fb.read()
            os.unlink(tmp_path)

            ok, msg = handler.upload_bytes(index_bytes, FAISS_INDEX_KEY)
            if not ok:
                logger.error(f"❌ Failed to persist FAISS index to Infinia: {msg}")
                return False

            # 2. Persist chunk metadata (CRITICAL — required for search after restart)
            ok2, msg2 = handler.upload_bytes(pickle.dumps(self.chunk_metadata), METADATA_KEY)
            if not ok2:
                logger.error(f"❌ Failed to persist chunk metadata to Infinia: {msg2}")
                return False

            # 3. Persist chunk counter
            ok3, msg3 = handler.upload_bytes(pickle.dumps(self.chunk_counter), COUNTER_KEY)
            if not ok3:
                logger.error(f"❌ Failed to persist chunk counter to Infinia: {msg3}")
                logger.warning("⚠️  Chunk counter not saved — will be re-computed on next ingest")

            index_mb = len(index_bytes) / (1024 * 1024)
            logger.info(
                f"💾 FAISS index persisted to Infinia — "
                f"{self.index.ntotal} vectors | {index_mb:.1f} MB | "
                f"{len(self.chunk_metadata)} metadata entries"
            )
            return True
        except Exception as e:
            logger.error(f"❌ Error persisting FAISS index to Infinia: {e}")
            import traceback; traceback.print_exc()
            return False

    def load_index_from_infinia(self) -> bool:
        """Restore FAISS index + metadata from Infinia on startup.

        Called automatically in __init__ so the backend never needs to
        re-index after a restart — vectors are loaded directly from
        Infinia S3 in seconds.

        Returns True if a persisted index was found and restored,
        False if no index exists yet (first run).
        """
        try:
            handler = self.storage_handlers.get('ddn_infinia')
            if not handler:
                return False

            # 1. Fetch FAISS binary index from Infinia
            index_bytes, _ = handler.download_bytes(FAISS_INDEX_KEY)
            if not index_bytes:
                logger.info("📭 No persisted FAISS index on Infinia — starting with empty index")
                return False

            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as f:
                f.write(index_bytes)
                tmp_path = f.name
            self.index = faiss.read_index(tmp_path)
            os.unlink(tmp_path)

            # 2. Restore chunk metadata
            meta_bytes, _ = handler.download_bytes(METADATA_KEY)
            if meta_bytes:
                self.chunk_metadata = pickle.loads(meta_bytes)

            # 3. Restore chunk counter
            counter_bytes, _ = handler.download_bytes(COUNTER_KEY)
            if counter_bytes:
                self.chunk_counter = pickle.loads(counter_bytes)

            logger.info(
                f"✅ FAISS index restored from Infinia — "
                f"{self.index.ntotal} vectors | {len(self.chunk_metadata)} chunks ready "
                f"(no re-indexing needed)"
            )
            return True
        except Exception as e:
            logger.error(f"❌ Error loading FAISS index from Infinia: {e}")
            import traceback; traceback.print_exc()
            # Reset to a safe empty state on error
            self.index = faiss.IndexFlatL2(self.embedding_dim)
            self.chunk_metadata = {}
            self.chunk_counter = 0
            return False


    def clear(self):
        """Clear all data from the vector store."""
        self.index = faiss.IndexFlatL2(self.embedding_dim)
        self.chunk_metadata.clear()
        self.chunk_counter = 0

    def clear_memory_only(self) -> int:
        """Clear in-memory FAISS without touching Infinia files.

        Used by Cold-Start Demo to simulate a server restart:
        chunks are gone from RAM but still persisted on Infinia S3,
        ready to be reloaded in sub-second time.

        Returns the number of vectors that were cleared.
        """
        with self._add_lock:
            chunks_cleared = self.index.ntotal
            self.index = faiss.IndexFlatL2(self.embedding_dim)
            self.chunk_metadata = {}
            self.chunk_counter = 0
            logger.info(
                f"\U0001f9f9 In-memory FAISS cleared ({chunks_cleared} vectors) — "
                f"Infinia files preserved and ready to reload"
            )
            return chunks_cleared

    @property
    def total_chunks(self) -> int:
        """Get total number of chunks in the index."""
        return self.index.ntotal
