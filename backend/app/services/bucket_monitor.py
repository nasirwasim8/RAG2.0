"""
Bucket monitoring service for continuous document ingestion.
Automatically processes files uploaded to S3 bucket's auto_ingest folder.
"""
import time
import threading
import logging
import asyncio
import json
import queue
import gc
from typing import Dict, Set, Optional
from datetime import datetime

from app.services.storage import S3Handler
from app.services.document import DocumentProcessor
from app.services.vector_store import VectorStore
from app.services.metrics import TTFBMonitor

logger = logging.getLogger(__name__)


class BucketMonitor:
    """Monitor S3 bucket for new files and process them automatically."""
    
    def __init__(
        self,
        vector_store: VectorStore,
        document_processor: DocumentProcessor,
        ttfb_monitor: TTFBMonitor
    ):
        self.vector_store = vector_store
        self.document_processor = document_processor
        self.ttfb_monitor = ttfb_monitor
        
        self.monitoring = False
        self.bucket_name: Optional[str] = None
        self.processed_files: Set[str] = set()
        self.monitor_thread: Optional[threading.Thread] = None
        self.poll_interval = 5  # seconds
        
        # Real-time streaming support (use queue.Queue for thread safety)
        self.processing_events: queue.Queue = queue.Queue(maxsize=500)
        self.current_file_progress: Dict = {}
        
        logger.info("📂 BucketMonitor initialized")
    
    def start_monitoring(self, bucket_name: str) -> str:
        """Start monitoring the specified S3 bucket."""
        # If already monitoring the same bucket and the thread is alive, no-op
        if self.monitoring and self.monitor_thread and self.monitor_thread.is_alive():
            return f"Already monitoring bucket: {self.bucket_name}"

        # If thread died unexpectedly, reset state before restarting
        if self.monitoring and (not self.monitor_thread or not self.monitor_thread.is_alive()):
            logger.warning(f"⚠️ Monitor thread was dead — restarting for bucket: {bucket_name}")
            self.monitoring = False

        self.bucket_name = bucket_name
        self.monitoring = True

        # Start the main polling thread
        self.monitor_thread = threading.Thread(
            target=self._poll_bucket,
            name="bucket-monitor-poll",
            daemon=True
        )
        self.monitor_thread.start()

        # Start a watchdog thread that auto-restarts the poll thread if it ever dies
        watchdog = threading.Thread(
            target=self._watchdog,
            name="bucket-monitor-watchdog",
            daemon=True
        )
        watchdog.start()

        logger.info(f"🚀 Started monitoring bucket: {bucket_name} (poll thread + watchdog started)")
        return f"Started monitoring bucket: {bucket_name}"
    
    def stop_monitoring(self) -> str:
        """Stop bucket monitoring."""
        if not self.monitoring:
            return "Monitoring is not active"
        
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=2)
        
        logger.info(f"🛑 Stopped monitoring bucket: {self.bucket_name}")
        return "Monitoring stopped"
    
    def get_status(self) -> Dict:
        """Get current monitoring status. READ-ONLY — never modifies self.monitoring."""
        # Check if the monitor thread is actually alive — catches cases where it
        # died silently due to an unhandled exception.
        thread_alive = self.monitor_thread is not None and self.monitor_thread.is_alive()
        # Note: we intentionally do NOT set self.monitoring = False here.
        # The watchdog thread is the correct mechanism to restart/recover.
        # Setting self.monitoring = False from get_status() caused the poll loop
        # and watchdog loop to both exit (they both check `while self.monitoring`).
        return {
            "monitoring": self.monitoring,
            "thread_alive": thread_alive,
            "bucket_name": self.bucket_name,
            "processed_files_count": len(self.processed_files),
            "processed_files": list(self.processed_files),
            "current_file_progress": self.current_file_progress,
            "last_check": datetime.now().isoformat() if self.monitoring else None
        }
    
    def _emit_progress(self, event_data: Dict):
        """Emit progress event for real-time streaming."""
        try:
            # Non-blocking put - if queue is full, skip this event
            self.processing_events.put_nowait(event_data)
            logger.info(f"📡 Emitted progress event: {event_data.get('file')} chunk {event_data.get('chunk_index')}/{event_data.get('total_chunks')}")
        except queue.Full:
            logger.warning("⚠️ Event queue full, skipping event")
    
    async def stream_events(self):
        """Generator for SSE streaming of processing events."""
        logger.info("📡 SSE stream started")
        try:
            while True:
                # Wait for new event with timeout using asyncio.to_thread for blocking queue.get()
                try:
                    # Run blocking queue.get() in thread pool with timeout
                    event = await asyncio.wait_for(
                        asyncio.to_thread(self.processing_events.get, timeout=30.0),
                        timeout=31.0  # Slightly longer than queue timeout
                    )
                    yield f"data: {json.dumps(event)}\n\n"
                except (asyncio.TimeoutError, queue.Empty):
                    # Send keepalive if no events
                    yield f": keepalive\n\n"
        except Exception as e:
            logger.error(f"SSE stream error: {e}")
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
    
    def _watchdog(self):
        """Watchdog thread: automatically restarts the poll thread if it dies unexpectedly.
        
        This is the primary mechanism that keeps monitoring alive regardless of
        what errors occur inside the poll thread.
        """
        logger.info("🐕 Watchdog thread started")
        while self.monitoring:
            time.sleep(3)  # Check every 3s — must be well under the 15s heartbeat window
            if not self.monitoring:
                break  # Monitoring was intentionally stopped
            
            if self.monitor_thread is None or not self.monitor_thread.is_alive():
                logger.warning("⚠️ Watchdog detected dead poll thread — restarting automatically")
                try:
                    # Ensure flag is set before starting the thread
                    # (it could have been cleared by stop_monitoring, in which case we
                    #  should NOT restart — check again after the loop condition)
                    if not self.monitoring:
                        break  # stop_monitoring was called; exit watchdog cleanly
                    self.monitor_thread = threading.Thread(
                        target=self._poll_bucket,
                        name="bucket-monitor-poll-restarted",
                        daemon=True
                    )
                    self.monitor_thread.start()
                    logger.info("✅ Watchdog successfully restarted poll thread")
                    # Emit an SSE event so the frontend knows it recovered
                    self._emit_progress({
                        'event': 'monitoring_restarted',
                        'message': 'Monitoring thread restarted automatically',
                        'timestamp': datetime.now().isoformat()
                    })
                except Exception as restart_err:
                    logger.error(f"❌ Watchdog failed to restart poll thread: {restart_err}")
        logger.info("🐕 Watchdog thread exiting (monitoring stopped)")

    def _poll_bucket(self):
        """Poll bucket for new files continuously."""
        logger.info(f"📡 Polling thread started for bucket: {self.bucket_name}")

        # Use an outer try/except BaseException so that even KeyboardInterrupt, 
        # MemoryError, or any other unexpected error is logged.
        try:
            while self.monitoring:
                try:
                    self._check_bucket_for_new_files()
                    time.sleep(self.poll_interval)
                except Exception as e:
                    logger.error(f"❌ Error in poll cycle: {e}", exc_info=True)
                    # Back off on error but keep the loop running
                    try:
                        time.sleep(self.poll_interval * 2)
                    except Exception:
                        pass
        except BaseException as fatal_err:
            # This catches EVERYTHING — including MemoryError, SystemExit, etc.
            logger.critical(
                f"🚨 CRITICAL: Poll thread caught fatal error: {type(fatal_err).__name__}: {fatal_err}",
                exc_info=True
            )
            # Emit SSE error event before dying so the frontend can show it
            try:
                self._emit_progress({
                    'event': 'monitoring_fatal_error',
                    'error': f"{type(fatal_err).__name__}: {str(fatal_err)}",
                    'timestamp': datetime.now().isoformat()
                })
            except Exception:
                pass
            # Do NOT reset self.monitoring — the watchdog will restart us

        logger.info("📡 Polling thread exiting")
    
    def _check_bucket_for_new_files(self):
        """Check bucket for new files in auto_ingest folder."""
        if not self.bucket_name:
            return
        
        try:
            logger.debug(f"🔍 Scanning bucket '{self.bucket_name}' auto_ingest/ folder...")
            
            handler = S3Handler('ddn_infinia')
            success, message = handler.create_client()
            if not success:
                logger.warning(f"Failed to create DDN INFINIA client: {message}")
                return
            
            # List objects in auto_ingest folder
            objects, message = handler.list_objects(prefix='auto_ingest/')
            
            logger.debug(f"   Found {len(objects)} total objects")
            logger.debug(f"   Already processed: {len(self.processed_files)} files")
            
            if not objects:
                logger.debug("   No objects found in auto_ingest/ folder")
                return
            
            # Supported file types
            SUPPORTED_EXTENSIONS = ('.pdf', '.txt', '.docx', '.doc', '.csv', '.xlsx', '.xls', '.pptx')
            
            new_files_count = 0
            for obj in objects:
                key = obj['Key']
                
                # Skip directory markers
                if key.endswith('/'):
                    continue
                
                # Check if file type is supported
                file_extension = key.lower().split('.')[-1]
                if not key.lower().endswith(SUPPORTED_EXTENSIONS):
                    logger.debug(f"⏭️  Skipping unsupported file: {key}")
                    continue
                
                # Skip if already processed
                if key in self.processed_files:
                    logger.debug(f"⏭️  Already processed: {key}")
                    continue
                
                logger.info(f"✅ Found new file for processing: {key}")
                new_files_count += 1
                self._process_bucket_file(key, handler)
            
            if new_files_count == 0:
                logger.debug(f"   No new files to process")
                
        except Exception as e:
            logger.error(f"❌ Error checking bucket: {e}", exc_info=True)
    
    def _add_chunks_with_progress(self, chunks: list, filename: str, s3_key: str) -> int:
        """Add all chunks in one batched call with real-time progress events via callback.
        
        Previously called add_chunks([chunk]) one-at-a-time (N calls), which bypassed
        all batching optimisations. Now calls add_chunks(all_chunks) once with a
        progress_callback that emits SSE events every 50 chunks — same fast path as
        the Documents page upload.
        """
        total_chunks = len(chunks)
        chunks_added = 0

        def _progress_cb(chunks_done, chunks_total, embeddings_per_sec, provider_write_stats):
            """Forward vector_store progress to the SSE event queue.
            
            Converts provider_write_stats from {latency_ms: X} → {avg_time: X/1000 (seconds)}
            because the frontend chart reads data.performance.ddn_infinia.avg_time in seconds.
            """
            # Convert {provider: {latency_ms: X}} → {provider: {avg_time: X/1000}}
            performance_for_chart = {
                provider: {
                    'avg_time': stats.get('latency_ms', 0) / 1000.0,  # ms → seconds
                    'success': stats.get('success', True)
                }
                for provider, stats in provider_write_stats.items()
            }
            self._emit_progress({
                'file': filename,
                's3_key': s3_key,
                'chunk_index': chunks_done,
                'total_chunks': chunks_total,
                'progress': round((chunks_done / chunks_total) * 100, 1) if chunks_total else 0,
                'embeddings_per_sec': embeddings_per_sec,
                'performance': performance_for_chart,
                'timestamp': datetime.now().isoformat()
            })


        try:
            result = self.vector_store.add_chunks(
                chunks,
                progress_callback=_progress_cb,
                aws_complete_callback=None,
                enable_s3=True,
                enable_aws_bg=False   # CRITICAL: prevents one 8-worker AWS ThreadPoolExecutor
                                      # per file from accumulating. For 5 files that was 40+
                                      # concurrent AWS threads → resource exhaustion → crash.
                                      # DDN upload still runs; S3 chart bars are simulated.
            )
            chunks_added = result.get('stored_chunks', 0)

            # Track storage comparison metrics for dashboard
            if result.get('provider_performance'):
                self.ttfb_monitor.add_storage_comparison(
                    provider_performance=result['provider_performance'],
                    operation_type='chunk_storage'
                )
        except Exception as e:
            logger.error(f"❌ add_chunks failed for {filename}: {e}", exc_info=True)

        return chunks_added


    
    def _process_bucket_file(self, s3_key: str, handler: S3Handler):
        """Download and process a file from the bucket."""
        import tempfile
        import os
        
        filename = os.path.basename(s3_key)
        
        # Start overall timing
        process_start_time = time.perf_counter()
        download_time_ms = 0
        parsing_time_ms = 0
        file_size_bytes = 0
        
        try:
            # Log vector store state BEFORE processing
            chunks_before = self.vector_store.total_chunks
            logger.info(f"📊 Vector store BEFORE processing '{filename}': {chunks_before} chunks (instance ID: {id(self.vector_store)})")
            
            logger.info(f"📥 Downloading: {s3_key}")
            
            # Download file with timing
            download_start = time.perf_counter()
            file_bytes, message = handler.download_bytes(s3_key)
            download_time_ms = (time.perf_counter() - download_start) * 1000
            
            if not file_bytes:
                logger.error(f"❌ Failed to download {s3_key}: {message}")
                return
            
            file_size_bytes = len(file_bytes)
            logger.info(f"✅ Downloaded {filename}: {file_size_bytes / (1024*1024):.2f} MB in {download_time_ms:.2f}ms")
            
            if file_size_bytes == 0:
                logger.error(f"❌ Zero bytes downloaded for {s3_key}")
                return
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
            
            logger.debug(f"💾 Saved to temp file: {tmp_path}")
            
            try:
                # Process document with timing
                logger.info(f"⚙️  Processing document: {filename}")
                parsing_start = time.perf_counter()
                chunks = self.document_processor.process_file(tmp_path)
                parsing_time_ms = (time.perf_counter() - parsing_start) * 1000
                
                # Validate chunks were created
                logger.info(f"⚙️  DocumentProcessor returned {len(chunks) if chunks else 0} chunks")
                
                if not chunks:
                    logger.warning(f"⚠️  No chunks generated from {filename} - file may be empty or text extraction failed")
                    return
                
                # Log sample chunk content
                if chunks and len(chunks) > 0:
                    sample_content = chunks[0].get('content', '')[:100]
                    logger.info(f"📦 Sample chunk preview: {sample_content}...")
                    logger.debug(f"📦 Chunk metadata: {chunks[0].get('metadata', {})}")
                
                # Process chunks in one batched call with real-time progress
                total_chunks_count = len(chunks)   # Save BEFORE del chunks below
                logger.info(f"💾 Processing {total_chunks_count} chunks in batched call...")
                chunks_added_progress = self._add_chunks_with_progress(chunks, filename, s3_key)

                # Explicitly free chunk memory before processing next file
                # (Python GC is lazy — without this, 5 large files accumulate ~10GB)
                del chunks
                gc.collect()
                logger.debug("🧹 Chunk memory freed via gc.collect()")
                
                # Verify chunks were added
                chunks_after = self.vector_store.total_chunks
                chunks_added = chunks_after - chunks_before
                
                logger.info(f"📊 Vector store AFTER processing '{filename}': {chunks_after} chunks (+{chunks_added} new)")
                
                if chunks_added == 0:
                    logger.error(f"❌ WARNING: No chunks were actually added to the vector store for {filename}!")
                    logger.error(f"   Expected to add {total_chunks_count} chunks but vector store size did not change")
                    # Don't re-raise — log and skip this file, continue with others
                    return
                
                # Mark as processed ONLY if chunks were successfully added
                self.processed_files.add(s3_key)
                
                # Emit a final 'completed' event so the SSE stream and frontend know this file finished
                self._emit_progress({
                    'file': filename,
                    's3_key': s3_key,
                    'status': 'completed',
                    'chunks_added': chunks_added,
                    'total_chunks': total_chunks_count,   # Use saved count (chunks was del'd above)
                    'progress': 100,
                    'timestamp': datetime.now().isoformat()
                })
                
                logger.info(f"✅ Successfully processed {filename}: {chunks_added} chunks added to vector store")
                
                # Track detailed metrics
                total_time_ms = (time.perf_counter() - process_start_time) * 1000
                # Embedding time is roughly the chunk processing time minus other operations
                embedding_time_ms = total_time_ms - download_time_ms - parsing_time_ms
                
                self.ttfb_monitor.add_file_operation(
                    filename=filename,
                    file_size_bytes=file_size_bytes,
                    chunks_created=chunks_added,
                    download_time_ms=download_time_ms,
                    parsing_time_ms=parsing_time_ms,
                    chunking_time_ms=0,  # Included in parsing_time
                    embedding_time_ms=max(0, embedding_time_ms),  # Ensure non-negative
                    total_time_ms=total_time_ms
                )
                
                logger.info(f"⏱️  Timing breakdown - Download: {download_time_ms:.0f}ms, Parsing: {parsing_time_ms:.0f}ms, Embedding: {embedding_time_ms:.0f}ms, Total: {total_time_ms:.0f}ms")
                
                # Move file to processed folder after successful processing
                try:
                    processed_key = s3_key.replace('auto_ingest/', 'processed/')
                    logger.info(f"📦 Moving {s3_key} to {processed_key}...")
                    
                    # Use S3 copy then delete (move operation)
                    bucket = self.bucket_name
                    handler.client.copy_object(
                        Bucket=bucket,
                        CopySource={'Bucket': bucket, 'Key': s3_key},
                        Key=processed_key
                    )
                    handler.delete_object(s3_key)
                    logger.info(f"✅ Moved {filename} to processed/ folder")
                except Exception as move_error:
                    logger.warning(f"⚠️ Could not move file to processed/: {move_error}")
                
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    logger.debug(f"🧹 Cleaned up temp file: {tmp_path}")
                    
        except Exception as e:
            logger.error(f"❌ FAILED to process {s3_key}: {e}", exc_info=True)
            # Do NOT re-raise — logging the error is sufficient.
            # Re-raising would propagate up through _check_bucket_for_new_files and
            # cause the poll thread to back off, potentially stopping the entire batch.
            # Instead, this file will be retried on the next poll cycle (it was never
            # added to self.processed_files so it stays eligible for retry).
            self._emit_progress({
                'file': filename,
                's3_key': s3_key,
                'status': 'error',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
