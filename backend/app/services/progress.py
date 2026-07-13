"""
Progress tracking service using Server-Sent Events (SSE).
Provides real-time progress updates for long-running document processing tasks.
"""
import asyncio
import json
import time
from typing import Dict, Any, Optional, Callable
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ProgressTracker:
    """Track and broadcast progress updates for document processing."""
    
    def __init__(self):
        self._active_tasks: Dict[str, Dict[str, Any]] = {}
        self._subscribers: Dict[str, list] = {}
    
    def create_task(self, task_id: str, total_items: int, description: str = "") -> None:
        """
        Create a new progress tracking task.
        
        Args:
            task_id: Unique identifier for the task
            total_items: Total number of items to process
            description: Human-readable description
        """
        self._active_tasks[task_id] = {
            "task_id": task_id,
            "description": description,
            "total_items": total_items,
            "processed_items": 0,
            "status": "running",
            "current_message": "",
            "start_time": time.time(),
            "progress_percent": 0.0,
            "estimated_remaining_seconds": None,
            "errors": []
        }
        logger.info(f"📊 Created progress task: {task_id} ({total_items} items)")
    
    def update(
        self,
        task_id: str,
        processed_items: Optional[int] = None,
        increment: int = 0,
        message: str = "",
        status: Optional[str] = None
    ) -> None:
        """
        Update task progress.
        
        Args:
            task_id: Task identifier
            processed_items: Absolute count of processed items
            increment: Increment processed count by this amount
            message: Status message
            status: Task status (running, completed, error)
        """
        if task_id not in self._active_tasks:
            logger.warning(f"Task {task_id} not found")
            return
        
        task = self._active_tasks[task_id]
        
        # Update processed count
        if processed_items is not None:
            task["processed_items"] = processed_items
        elif increment > 0:
            task["processed_items"] += increment
        
        # Update message and status
        if message:
            task["current_message"] = message
        if status:
            task["status"] = status
        
        # Calculate progress
        if task["total_items"] > 0:
            task["progress_percent"] = (task["processed_items"] / task["total_items"]) * 100
        
        # Estimate remaining time
        elapsed = time.time() - task["start_time"]
        if task["processed_items"] > 0 and task["processed_items"] < task["total_items"]:
            items_per_sec = task["processed_items"] / elapsed
            remaining_items = task["total_items"] - task["processed_items"]
            task["estimated_remaining_seconds"] = int(remaining_items / items_per_sec) if items_per_sec > 0 else None
        
        # Broadcast update
        self._broadcast(task_id, task)
    
    def add_error(self, task_id: str, error_message: str) -> None:
        """Add an error message to the task."""
        if task_id in self._active_tasks:
            self._active_tasks[task_id]["errors"].append({
                "message": error_message,
                "timestamp": datetime.now().isoformat()
            })
            self._broadcast(task_id, self._active_tasks[task_id])
    
    def complete_task(self, task_id: str, message: str = "Completed") -> None:
        """Mark task as completed."""
        if task_id in self._active_tasks:
            task = self._active_tasks[task_id]
            task["status"] = "completed"
            task["progress_percent"] = 100.0
            task["current_message"] = message
            task["estimated_remaining_seconds"] = 0
            self._broadcast(task_id, task)
            logger.info(f"✅ Task completed: {task_id}")
    
    def fail_task(self, task_id: str, error_message: str) -> None:
        """Mark task as failed."""
        if task_id in self._active_tasks:
            task = self._active_tasks[task_id]
            task["status"] = "error"
            task["current_message"] = error_message
            self.add_error(task_id, error_message)
            self._broadcast(task_id, task)
            logger.error(f"❌ Task failed: {task_id} - {error_message}")
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get current task state."""
        return self._active_tasks.get(task_id)
    
    def cleanup_task(self, task_id: str) -> None:
        """Remove completed/failed task from tracking."""
        if task_id in self._active_tasks:
            del self._active_tasks[task_id]
        if task_id in self._subscribers:
            del self._subscribers[task_id]
    
    def _broadcast(self, task_id: str, task_data: Dict[str, Any]) -> None:
        """Broadcast progress update to all subscribers."""
        # This is called synchronously; actual SSE streaming is handled in routes
        pass
    
    async def subscribe(self, task_id: str):
        """
        Subscribe to progress updates for a task (SSE generator).
        
        Yields:
            SSE formatted progress messages
        """
        max_wait = 300  # 5 minutes timeout
        start = time.time()
        
        while True:
            if time.time() - start > max_wait:
                yield f"data: {json.dumps({'status': 'timeout', 'message': 'Task timeout'})}\n\n"
                break
            
            task = self.get_task(task_id)
            if not task:
                yield f"data: {json.dumps({'status': 'not_found', 'message': 'Task not found'})}\n\n"
                break
            
            # Send current state
            yield f"data: {json.dumps(task)}\n\n"
            
            # Check if complete
            if task["status"] in ["completed", "error"]:
                break
            
            await asyncio.sleep(1)  # Update every second


# Global progress tracker instance
progress_tracker = ProgressTracker()


def create_progress_callback(task_id: str, total: int) -> Callable:
    """
    Create a progress callback function for document processors.
    
    Args:
        task_id: Progress task ID
        total: Total number of items
    
    Returns:
        Callback function that can be called with (current, message)
    """
    def callback(current: int, message: str = ""):
        progress_tracker.update(task_id, processed_items=current, message=message)
    
    return callback
