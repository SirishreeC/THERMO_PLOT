# routers/spatial_analysis.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import numpy as np

router = APIRouter(prefix="/spatial", tags=["Spatial Analysis"])


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class TimeSnapshot(BaseModel):
    time: float
    temperatures: Dict[str, Optional[float]]  # { "Pos_1": 45.2, ... }


class SpatialRequest(BaseModel):
    time_series: List[TimeSnapshot]
    position_locations: Optional[Dict[str, float]] = None  # { "Pos_1": 0.0, "Pos_2": 10.0, ... } in mm
    use_indices_as_location: bool = True  # If true and position_locations=None, use 0,1,2,3...


class ProfilePoint(BaseModel):
    position: str
    location: float       # mm or index
    temperature: Optional[float]


class GradientPoint(BaseModel):
    position: str
    location: float
    gradient: Optional[float]   # dT/dx  (°C/mm or °C/position)


class TimeSliceAnalysis(BaseModel):
    time: float
    profile: List[ProfilePoint]
    gradients: List[GradientPoint]
    # Summary stats
    max_temp_position: str
    min_temp_position: str
    temperature_range: float
    max_gradient: float
    min_gradient: float
    gradient_direction: str     # "left_to_right" | "right_to_left" | "bidirectional" | "uniform"
    uniformity_score: float     # 0-100%, higher = more uniform


class SpatialResponse(BaseModel):
    time_slices: List[TimeSliceAnalysis]
    global_summary: Dict


# ─── Helper Functions ─────────────────────────────────────────────────────────

def _compute_gradients(locations: List[float], temps: List[Optional[float]]) -> List[Optional[float]]:
    """
    Compute spatial gradient dT/dx using central differences.
    Returns same-length list with None at invalid points.
    """
    n = len(locations)
    gradients: List[Optional[float]] = [None] * n
    
    for i in range(n):
        if temps[i] is None:
            continue
            
        if i == 0:
            # Forward difference
            if n > 1 and temps[1] is not None:
                dx = locations[1] - locations[0]
                if dx != 0:
                    gradients[i] = (temps[1] - temps[0]) / dx
                    
        elif i == n - 1:
            # Backward difference
            if temps[-2] is not None:
                dx = locations[-1] - locations[-2]
                if dx != 0:
                    gradients[i] = (temps[-1] - temps[-2]) / dx
                    
        else:
            # Central difference
            if temps[i-1] is not None and temps[i+1] is not None:
                dx = locations[i+1] - locations[i-1]
                if dx != 0:
                    gradients[i] = (temps[i+1] - temps[i-1]) / dx
    
    return gradients


def _gradient_direction(gradients: List[Optional[float]]) -> str:
    """Determine overall heat flow direction."""
    valid = [g for g in gradients if g is not None]
    if not valid:
        return "uniform"
    
    positive = sum(1 for g in valid if g > 0.1)
    negative = sum(1 for g in valid if g < -0.1)
    total = len(valid)
    
    if positive > 0.7 * total:
        return "left_to_right"
    elif negative > 0.7 * total:
        return "right_to_left"
    elif positive > 0.3 * total and negative > 0.3 * total:
        return "bidirectional"
    else:
        return "uniform"


def _uniformity_score(temps: List[Optional[float]]) -> float:
    """
    Returns 0-100 score. 100 = perfectly uniform (std=0).
    Score = 100 * exp(-std/mean)  (normalized)
    """
    valid = [t for t in temps if t is not None]
    if len(valid) < 2:
        return 100.0
    
    mean_temp = np.mean(valid)
    std_temp = np.std(valid)
    
    if mean_temp == 0:
        return 0.0
    
    # Coefficient of variation
    cv = std_temp / mean_temp
    
    # Score: exp decay with CV
    score = 100.0 * np.exp(-cv * 3)  # 3 is tuning factor
    return round(min(100.0, max(0.0, score)), 2)


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=SpatialResponse)
def analyze_spatial(req: SpatialRequest):
    if not req.time_series:
        raise HTTPException(status_code=400, detail="time_series is empty")
    
    # Get position names (ordered)
    first_snapshot = req.time_series[0]
    positions = sorted(first_snapshot.temperatures.keys())
    
    # Determine spatial locations
    if req.position_locations:
        # Use provided locations (mm)
        locations = [req.position_locations.get(pos, 0.0) for pos in positions]
    elif req.use_indices_as_location:
        # Use 0, 1, 2, 3... as positions
        locations = list(range(len(positions)))
    else:
        raise HTTPException(status_code=400, detail="Must provide position_locations or set use_indices_as_location=True")
    
    # Analyze each time slice
    time_slices: List[TimeSliceAnalysis] = []
    
    for snapshot in req.time_series:
        temps = [snapshot.temperatures.get(pos) for pos in positions]
        gradients = _compute_gradients(locations, temps)
        
        # Profile points
        profile = [
            ProfilePoint(position=pos, location=loc, temperature=temp)
            for pos, loc, temp in zip(positions, locations, temps)
        ]
        
        # Gradient points
        gradient_points = [
            GradientPoint(position=pos, location=loc, gradient=grad)
            for pos, loc, grad in zip(positions, locations, gradients)
        ]
        
        # Summary stats
        valid_temps = [(pos, t) for pos, t in zip(positions, temps) if t is not None]
        valid_grads = [g for g in gradients if g is not None]
        
        if valid_temps:
            max_temp_pos = max(valid_temps, key=lambda x: x[1])[0]
            min_temp_pos = min(valid_temps, key=lambda x: x[1])[0]
            temp_range = max(t for _, t in valid_temps) - min(t for _, t in valid_temps)
        else:
            max_temp_pos = positions[0] if positions else ""
            min_temp_pos = positions[0] if positions else ""
            temp_range = 0.0
        
        max_grad = max(valid_grads) if valid_grads else 0.0
        min_grad = min(valid_grads) if valid_grads else 0.0
        grad_dir = _gradient_direction(gradients)
        uniformity = _uniformity_score(temps)
        
        time_slices.append(TimeSliceAnalysis(
            time=snapshot.time,
            profile=profile,
            gradients=gradient_points,
            max_temp_position=max_temp_pos,
            min_temp_position=min_temp_pos,
            temperature_range=round(temp_range, 3),
            max_gradient=round(max_grad, 4),
            min_gradient=round(min_grad, 4),
            gradient_direction=grad_dir,
            uniformity_score=uniformity,
        ))
    
    # Global summary
    all_max_grads = [ts.max_gradient for ts in time_slices]
    all_uniformities = [ts.uniformity_score for ts in time_slices]
    
    # Find most/least uniform time
    most_uniform_idx = max(range(len(time_slices)), key=lambda i: time_slices[i].uniformity_score)
    least_uniform_idx = min(range(len(time_slices)), key=lambda i: time_slices[i].uniformity_score)
    
    # Gradient direction distribution
    dir_counts = {"left_to_right": 0, "right_to_left": 0, "bidirectional": 0, "uniform": 0}
    for ts in time_slices:
        dir_counts[ts.gradient_direction] += 1
    
    global_summary = {
        "total_time_slices": len(time_slices),
        "total_positions": len(positions),
        "peak_gradient": round(max(all_max_grads) if all_max_grads else 0.0, 4),
        "average_uniformity": round(np.mean(all_uniformities) if all_uniformities else 0.0, 2),
        "most_uniform_time": round(time_slices[most_uniform_idx].time, 2),
        "least_uniform_time": round(time_slices[least_uniform_idx].time, 2),
        "gradient_direction_distribution": dir_counts,
        "spatial_extent": f"{locations[0]} - {locations[-1]} {'mm' if req.position_locations else 'indices'}",
    }
    
    return SpatialResponse(
        time_slices=time_slices,
        global_summary=global_summary,
    )