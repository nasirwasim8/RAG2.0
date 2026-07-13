"""
Performance metrics and TTFB monitoring service.
"""
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
import numpy as np


class TTFBMonitor:
    """Time To First Byte (TTFB) monitoring for storage operations."""

    def __init__(self):
        self.metrics: List[Dict] = []
        self.current_sessions: Dict[str, Dict] = {}
        self.storage_comparisons: List[Dict] = []
        self.retrieval_comparisons: List[Dict] = []
        
        # Detailed statistics tracking
        self.file_stats: List[Dict] = []  # Per-file statistics
        self.chunk_stats: List[Dict] = []  # Per-chunk statistics  
        self.operation_timings: List[Dict] = []  # Detailed operation breakdowns
        
        # NEW: AI-focused metrics
        self.llm_metrics = LLMMetrics()
        self.storage_ops = StorageOperationMetrics()

    def start_timing(self, operation_type: str, details: Dict = None) -> str:
        """Start timing an operation."""
        session_id = f"{operation_type}_{int(time.time() * 1000)}"
        self.current_sessions[session_id] = {
            'operation_type': operation_type,
            'start_time': time.perf_counter(),
            'details': details or {},
            'stages': []
        }
        return session_id

    def add_stage(self, session_id: str, stage_name: str, stage_data: Dict = None):
        """Add a stage timestamp to the current session."""
        if session_id in self.current_sessions:
            current_time = time.perf_counter()
            session = self.current_sessions[session_id]
            stage_info = {
                'stage': stage_name,
                'timestamp': current_time,
                'elapsed_from_start': current_time - session['start_time'],
                'data': stage_data or {}
            }
            session['stages'].append(stage_info)

    def end_timing(self, session_id: str, success: bool = True, error_msg: str = None) -> Optional[Dict]:
        """End timing and calculate metrics."""
        if session_id not in self.current_sessions:
            return None

        session = self.current_sessions[session_id]
        end_time = time.perf_counter()
        total_time = end_time - session['start_time']

        # Calculate TTFB (time to first stage)
        ttfb = session['stages'][0]['elapsed_from_start'] if session['stages'] else None

        metric = {
            'session_id': session_id,
            'operation_type': session['operation_type'],
            'timestamp': datetime.now().isoformat(),
            'total_time': total_time,
            'ttfb': ttfb,
            'success': success,
            'error_msg': error_msg,
            'details': session['details'],
            'stages': session['stages']
        }

        self.metrics.append(metric)
        del self.current_sessions[session_id]

        return metric

    def add_storage_comparison(self, provider_performance: Dict[str, Dict], operation_type: str):
        """Add storage provider comparison metric."""
        comparison = {
            'timestamp': datetime.now().isoformat(),
            'operation_type': operation_type,
            'provider_performance': provider_performance,
            'fastest_provider': min(
                provider_performance.keys(),
                key=lambda x: provider_performance[x].get('avg_time', float('inf'))
            ),
            'slowest_provider': max(
                provider_performance.keys(),
                key=lambda x: provider_performance[x].get('avg_time', 0)
            )
        }
        self.storage_comparisons.append(comparison)

    def add_retrieval_comparison(self, provider_times: Dict[str, float], query_info: Dict = None):
        """Add retrieval comparison metric."""
        comparison = {
            'timestamp': datetime.now().isoformat(),
            'query_info': query_info or {},
            'provider_times': provider_times,
            'fastest_provider': min(provider_times.keys(), key=lambda x: provider_times[x]),
            'slowest_provider': max(provider_times.keys(), key=lambda x: provider_times[x]),
            'ddn_fastest': provider_times.get('ddn_infinia', float('inf')) <= min(provider_times.values())
        }
        self.retrieval_comparisons.append(comparison)

    def get_storage_summary(self) -> Dict[str, Any]:
        """Get storage performance summary."""
        if not self.storage_comparisons:
            return {'message': 'No storage comparison data available'}

        provider_stats = {}
        for comparison in self.storage_comparisons:
            for provider, perf in comparison['provider_performance'].items():
                if provider not in provider_stats:
                    provider_stats[provider] = {
                        'total_operations': 0,
                        'total_time': 0,
                        'wins': 0
                    }

                provider_stats[provider]['total_operations'] += 1
                provider_stats[provider]['total_time'] += perf.get('avg_time', 0)
                if comparison['fastest_provider'] == provider:
                    provider_stats[provider]['wins'] += 1

        # Calculate averages
        for provider in provider_stats:
            ops = provider_stats[provider]['total_operations']
            if ops > 0:
                provider_stats[provider]['avg_time'] = provider_stats[provider]['total_time'] / ops

        total = len(self.storage_comparisons)
        ddn_wins = provider_stats.get('ddn_infinia', {}).get('wins', 0)

        # Check for simulated metrics
        aws_simulated = any(
            comp['provider_performance'].get('aws', {}).get('simulated', False)
            for comp in self.storage_comparisons
        )

        return {
            'provider_stats': provider_stats,
            'total_comparisons': total,
            'ddn_infinia_wins': ddn_wins,
            'ddn_infinia_win_rate': (ddn_wins / total * 100) if total > 0 else 0,
            'aws_simulated': aws_simulated
        }

    def get_retrieval_summary(self) -> Dict[str, Any]:
        """Get retrieval performance summary."""
        if not self.retrieval_comparisons:
            return {
                'message': 'No retrieval comparison data available',
                'total_retrievals': 0,
                'ddn_infinia_wins': 0,
                'ddn_infinia_win_rate': 0,
                'avg_retrieval_times': {},
                'ddn_avg_ttfb': 0,
                'aws_avg_ttfb': 0,
                'ttfb_improvement': {},
                'aws_simulated': False
            }

        ddn_wins = sum(1 for m in self.retrieval_comparisons if m['ddn_fastest'])
        total = len(self.retrieval_comparisons)

        avg_times = {}
        for comparison in self.retrieval_comparisons:
            for provider, time_taken in comparison['provider_times'].items():
                if provider not in avg_times:
                    avg_times[provider] = []
                avg_times[provider].append(time_taken)

        for provider in avg_times:
            avg_times[provider] = float(np.mean(avg_times[provider]))

        # Calculate improvement
        improvement = {}
        if 'aws' in avg_times and 'ddn_infinia' in avg_times:
            aws_time = avg_times['aws']
            ddn_time = avg_times['ddn_infinia']
            if aws_time > 0:
                improvement['vs_aws'] = ((aws_time - ddn_time) / aws_time) * 100

        # Check for simulated metrics
        aws_simulated = False
        if 'aws' in avg_times and 'ddn_infinia' in avg_times:
             # Heuristic: if perfect 35x ratio in ANY comparison?
             # Better: check if we stored 'simulated' flag. 
             # vector_store.py handles this logic but add_retrieval_comparison receives just numbers.
             # We should probably check if AWS not configured, but metrics doesn't know config.
             # Let's rely on storage simulation flag for now or update add_retrieval_comparison.
             pass
        
        # Actually vector_store.py passes provider_times. 
        # In search_with_provider_comparison, we set provider_times['aws'].
        # Let's inspect if the values are exactly 35x ratio? 
        # Or better, just return aws_simulated based on storage for now as they are usually tied.
        # But to be safe, let's update add_retrieval_comparison to accept metadata.
        
        # Check for simulated metrics based on storage comparisons as a proxy
        # since retrieval doesn't store metadata yet
        aws_simulated = any(
            comp['provider_performance'].get('aws', {}).get('simulated', False)
            for comp in self.storage_comparisons
        )
        
        # Extract flattened TTFB values for frontend (already in ms, no conversion needed)
        ddn_avg_ttfb = avg_times.get('ddn_infinia', 0)
        aws_avg_ttfb = avg_times.get('aws', 0)
        
        return {
            'total_retrievals': total,
            'ddn_infinia_wins': ddn_wins,
            'ddn_infinia_win_rate': (ddn_wins / total * 100) if total > 0 else 0,
            'avg_retrieval_times': avg_times,
            'ddn_avg_ttfb': ddn_avg_ttfb,  # Flattened for frontend (in ms)
            'aws_avg_ttfb': aws_avg_ttfb,   # Flattened for frontend (in ms)
            'ttfb_improvement': improvement,
            'aws_simulated': aws_simulated
        }
    
    def add_file_operation(self, filename: str, file_size_bytes: int, chunks_created: int,
                           download_time_ms: float = 0, parsing_time_ms: float = 0,
                           chunking_time_ms: float = 0, embedding_time_ms: float = 0,
                           total_time_ms: float = 0):
        """Track detailed file processing statistics."""
        file_stat = {
            'timestamp': datetime.now().isoformat(),
            'filename': filename,
            'file_size_bytes': file_size_bytes,
            'file_size_mb': file_size_bytes / (1024 * 1024),
            'chunks_created': chunks_created,
            'download_time_ms': download_time_ms,
            'parsing_time_ms': parsing_time_ms,
            'chunking_time_ms': chunking_time_ms,
            'embedding_time_ms': embedding_time_ms,
            'indexing_time_ms': total_time_ms - (download_time_ms + parsing_time_ms + chunking_time_ms + embedding_time_ms),
            'total_time_ms': total_time_ms
        }
        self.file_stats.append(file_stat)
        
    def get_detailed_statistics(self) -> Dict[str, Any]:
        """Get comprehensive statistics for dashboard display."""
        if not self.file_stats:
            return {
                'files': {
                    'total_processed': 0,
                    'total_size_mb': 0,
                    'average_size_mb': 0
                },
                'chunks': {
                    'total_created': 0,
                    'average_per_file': 0
                },
                'timings': {
                    'avg_download_ms': 0,
                    'avg_parsing_ms': 0,
                    'avg_chunking_ms': 0,
                    'avg_embedding_ms': 0,
                    'avg_indexing_ms': 0,
                    'avg_total_ms': 0
                },
                'throughput': {
                    'files_per_minute': 0,
                    'chunks_per_second': 0,
                    'mb_per_second': 0
                }
            }
        
        total_files = len(self.file_stats)
        total_size_mb = sum(f['file_size_mb'] for f in self.file_stats)
        total_chunks = sum(f['chunks_created'] for f in self.file_stats)
        
        avg_download = np.mean([f['download_time_ms'] for f in self.file_stats])
        avg_parsing = np.mean([f['parsing_time_ms'] for f in self.file_stats])
        avg_chunking = np.mean([f['chunking_time_ms'] for f in self.file_stats])
        avg_embedding = np.mean([f['embedding_time_ms'] for f in self.file_stats])
        avg_indexing = np.mean([f['indexing_time_ms'] for f in self.file_stats])
        avg_total = np.mean([f['total_time_ms'] for f in self.file_stats])
        
        # Calculate throughput
        total_time_seconds = sum(f['total_time_ms'] for f in self.file_stats) / 1000
        files_per_minute = (total_files / total_time_seconds) * 60 if total_time_seconds > 0 else 0
        chunks_per_second = total_chunks / total_time_seconds if total_time_seconds > 0 else 0
        mb_per_second = total_size_mb / total_time_seconds if total_time_seconds > 0 else 0
        
        return {
            'files': {
                'total_processed': total_files,
                'total_size_mb': round(total_size_mb, 2),
                'average_size_mb': round(total_size_mb / total_files, 2) if total_files > 0 else 0,
                'largest_size_mb': round(max(f['file_size_mb'] for f in self.file_stats), 2),
                'smallest_size_mb': round(min(f['file_size_mb'] for f in self.file_stats), 2)
            },
            'chunks': {
                'total_created': total_chunks,
                'average_per_file': round(total_chunks / total_files, 1) if total_files > 0 else 0,
                'max_per_file': max(f['chunks_created'] for f in self.file_stats),
                'min_per_file': min(f['chunks_created'] for f in self.file_stats)
            },
            'timings': {
                'avg_download_ms': round(avg_download, 2),
                'avg_parsing_ms': round(avg_parsing, 2),
                'avg_chunking_ms': round(avg_chunking, 2),
                'avg_embedding_ms': round(avg_embedding, 2),
                'avg_indexing_ms': round(avg_indexing, 2),
                'avg_total_ms': round(avg_total, 2)
            },
            'throughput': {
                'files_per_minute': round(files_per_minute, 2),
                'chunks_per_second': round(chunks_per_second, 2),
                'mb_per_second': round(mb_per_second, 3)
            }
        }

    def get_all_metrics(self) -> Dict[str, Any]:
        """Get all metrics summary."""
        return {
            'storage_summary': self.get_storage_summary(),
            'retrieval_summary': self.get_retrieval_summary(),
            'detailed_stats': self.get_detailed_statistics(),
            'llm_metrics': self.llm_metrics.get_summary(),
            'storage_ops': self.storage_ops.get_summary(),
            'total_operations': len(self.metrics)
        }

    def clear(self):
        """Clear all metrics."""
        self.metrics.clear()
        self.current_sessions.clear()
        self.storage_comparisons.clear()
        self.retrieval_comparisons.clear()
        self.file_stats.clear()
        self.chunk_stats.clear()
        self.operation_timings.clear()
        self.llm_metrics.clear()
        self.storage_ops.clear()


class LLMMetrics:
    """Track LLM generation metrics (TTFT, ITL, tokens/sec)."""
    
    def __init__(self):
        self.queries: List[Dict] = []
    
    def track_llm_generation(
        self,
        query: str,
        ttft_ms: float,
        inter_token_latencies: List[float],
        total_tokens: int,
        total_time_ms: float
    ):
        """Track a single LLM generation event."""
        avg_itl = float(np.mean(inter_token_latencies)) if inter_token_latencies else 0
        tokens_per_sec = (total_tokens / total_time_ms) * 1000 if total_time_ms > 0 else 0
        
        self.queries.append({
            'timestamp': datetime.now().isoformat(),
            'query': query[:100],
            'ttft_ms': ttft_ms,
            'avg_itl_ms': avg_itl,
            'max_itl_ms': float(max(inter_token_latencies)) if inter_token_latencies else 0,
            'total_tokens': total_tokens,
            'tokens_per_sec': tokens_per_sec,
            'total_time_ms': total_time_ms
        })
    
    def get_summary(self) -> Dict[str, Any]:
        """Get aggregate LLM metrics."""
        if not self.queries:
            return {
                'total_queries': 0,
                'avg_ttft_ms': 0,
                'avg_itl_ms': 0,
                'avg_tokens_per_sec': 0,
                'p50_ttft_ms': 0,
                'p95_ttft_ms': 0,
                'p99_ttft_ms': 0
            }
        
        ttfts = [q['ttft_ms'] for q in self.queries]
        itls = [q['avg_itl_ms'] for q in self.queries]
        tps = [q['tokens_per_sec'] for q in self.queries]
        
        return {
            'total_queries': len(self.queries),
            'avg_ttft_ms': float(np.mean(ttfts)),
            'avg_itl_ms': float(np.mean(itls)),
            'avg_tokens_per_sec': float(np.mean(tps)),
            'p50_ttft_ms': float(np.percentile(ttfts, 50)),
            'p95_ttft_ms': float(np.percentile(ttfts, 95)),
            'p99_ttft_ms': float(np.percentile(ttfts, 99))
        }
    
    def clear(self):
        """Clear LLM metrics."""
        self.queries.clear()


class StorageOperationMetrics:
    """Track storage PUT/GET operations per second and throughput."""
    
    def __init__(self):
        self.operations: List[Dict] = []
        self.window_start = time.time()
    
    def track_operation(
        self,
        op_type: str,  # 'PUT' or 'GET'
        provider: str,  # 'ddn_infinia' or 'aws'
        bytes_transferred: int,
        latency_ms: float,
        success: bool
    ):
        """Track a single storage operation."""
        self.operations.append({
            'timestamp': time.time(),
            'op_type': op_type,
            'provider': provider,
            'bytes': bytes_transferred,
            'latency_ms': latency_ms,
            'success': success
        })
    
    def get_ops_per_sec(self, op_type: str = None, provider: str = None, window_sec: int = 60) -> float:
        """Calculate operations per second in the last N seconds."""
        now = time.time()
        cutoff = now - window_sec
        
        filtered_ops = [
            op for op in self.operations
            if op['timestamp'] >= cutoff
            and (op_type is None or op['op_type'] == op_type)
            and (provider is None or op['provider'] == provider)
            and op['success']
        ]
        
        return len(filtered_ops) / window_sec if window_sec > 0 else 0
    
    def get_throughput_mbps(self, op_type: str = None, provider: str = None, window_sec: int = 60) -> float:
        """Calculate throughput in MB/s for the last N seconds."""
        now = time.time()
        cutoff = now - window_sec
        
        filtered_ops = [
            op for op in self.operations
            if op['timestamp'] >= cutoff
            and (op_type is None or op['op_type'] == op_type)
            and (provider is None or op['provider'] == provider)
            and op['success']
        ]
        
        total_bytes = sum(op['bytes'] for op in filtered_ops)
        total_mb = total_bytes / (1024 * 1024)
        
        return total_mb / window_sec if window_sec > 0 else 0
    
    def get_latency_percentiles(self, op_type: str = None, provider: str = None) -> Dict[str, float]:
        """Calculate latency percentiles."""
        filtered_ops = [
            op for op in self.operations
            if (op_type is None or op['op_type'] == op_type)
            and (provider is None or op['provider'] == provider)
            and op['success']
        ]
        
        if not filtered_ops:
            return {'p50': 0, 'p95': 0, 'p99': 0}
        
        latencies = [op['latency_ms'] for op in filtered_ops]
        
        return {
            'p50': float(np.percentile(latencies, 50)),
            'p95': float(np.percentile(latencies, 95)),
            'p99': float(np.percentile(latencies, 99))
        }
    
    def _get_success_rate(self, provider: str) -> float:
        """Calculate success rate for a provider."""
        provider_ops = [op for op in self.operations if op['provider'] == provider]
        if not provider_ops:
            return 100.0
        
        successful = len([op for op in provider_ops if op['success']])
        return (successful / len(provider_ops)) * 100
    
    def get_summary(self) -> Dict[str, Any]:
        """Get comprehensive storage operation metrics."""
        # Check if AWS is configured
        from app.core.config import storage_config
        aws_configured = bool(storage_config.aws_config.get('access_key'))
        
        # Get DDN metrics
        ddn_metrics = {
            'put_ops_per_sec': self.get_ops_per_sec('PUT', 'ddn_infinia'),
            'get_ops_per_sec': self.get_ops_per_sec('GET', 'ddn_infinia'),
            'read_throughput_mbps': self.get_throughput_mbps('GET', 'ddn_infinia'),
            'write_throughput_mbps': self.get_throughput_mbps('PUT', 'ddn_infinia'),
            'put_latency': self.get_latency_percentiles('PUT', 'ddn_infinia'),
            'get_latency': self.get_latency_percentiles('GET', 'ddn_infinia'),
            'total_operations': len([op for op in self.operations if op['provider'] == 'ddn_infinia']),
            'success_rate': self._get_success_rate('ddn_infinia')
        }
        
        # Get real AWS metrics if configured, otherwise return None
        if aws_configured:
            # Real AWS metrics from actual operations
            aws_metrics = {
                'put_ops_per_sec': self.get_ops_per_sec('PUT', 'aws'),
                'get_ops_per_sec': self.get_ops_per_sec('GET', 'aws'),
                'read_throughput_mbps': self.get_throughput_mbps('GET', 'aws'),
                'write_throughput_mbps': self.get_throughput_mbps('PUT', 'aws'),
                'put_latency': self.get_latency_percentiles('PUT', 'aws'),
                'get_latency': self.get_latency_percentiles('GET', 'aws'),
                'total_operations': len([op for op in self.operations if op['provider'] == 'aws']),
                'success_rate': self._get_success_rate('aws'),
                'simulated': False
            }
        else:
            # NO SIMULATION: AWS metrics not available when credentials are not configured
            aws_metrics = None
        
        result = {'ddn_infinia': ddn_metrics}
        
        # Only include AWS metrics if configured (real data only)
        if aws_metrics is not None:
            result['aws'] = aws_metrics
        
        return result
    
    def clear(self):
        """Clear storage operation metrics."""
        self.operations.clear()
        self.window_start = time.time()

