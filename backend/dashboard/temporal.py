# routers/temporal.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import numpy as np

router = APIRouter(prefix="/temporal", tags=["Temporal EDA"])


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class TimeSeriesRow(BaseModel):
    time: float
    values: Dict[str, Optional[float]]   # { "Pos_1": 42.3, ... }


class TemporalRequest(BaseModel):
    time_series: List[TimeSeriesRow]      # full dataset forwarded from frontend
    positions: Optional[List[str]] = None  # None → all positions
    rolling_window: int = 10              # rows for rolling stats


class LinePlotPoint(BaseModel):
    time: float
    value: Optional[float]


class RatePoint(BaseModel):
    time: float
    rate: Optional[float]               # dT/dt  (°C / s)


class RollingPoint(BaseModel):
    time: float
    mean: Optional[float]
    std:  Optional[float]


class PositionAnalysis(BaseModel):
    position: str
    line_plot:    List[LinePlotPoint]
    rate_of_change: List[RatePoint]
    rolling_mean: List[RollingPoint]
    # summary stats
    trend:           str                # "heating" | "cooling" | "stable"
    steady_state_time: Optional[float]  # seconds when ΔT < threshold
    max_rate:        float
    min_rate:        float
    noise_level:     float              # std of dT/dt


class TemporalResponse(BaseModel):
    positions:   List[PositionAnalysis]
    global_summary: Dict


# ─── Helper functions ─────────────────────────────────────────────────────────

def _rate_of_change(times: List[float], temps: List[float]) -> List[Optional[float]]:
    """Central-difference dT/dt; forward diff at start, backward at end."""
    n = len(times)
    rates: List[Optional[float]] = [None] * n
    for i in range(n):
        if i == 0:
            if n > 1 and (times[1] - times[0]) != 0:
                rates[i] = (temps[1] - temps[0]) / (times[1] - times[0])
        elif i == n - 1:
            if (times[-1] - times[-2]) != 0:
                rates[i] = (temps[-1] - temps[-2]) / (times[-1] - times[-2])
        else:
            dt = times[i + 1] - times[i - 1]
            if dt != 0:
                rates[i] = (temps[i + 1] - temps[i - 1]) / dt
    return rates


def _rolling(values: List[Optional[float]], window: int):
    """Returns (rolling_mean, rolling_std) lists of same length."""
    arr = np.array([v if v is not None else np.nan for v in values], dtype=float)
    means, stds = [], []
    for i in range(len(arr)):
        start = max(0, i - window + 1)
        chunk = arr[start : i + 1]
        valid = chunk[~np.isnan(chunk)]
        means.append(float(np.mean(valid)) if len(valid) else None)
        stds.append(float(np.std(valid))   if len(valid) > 1 else None)
    return means, stds


def _detect_trend(temps: List[float]) -> str:
    if len(temps) < 3:
        return "stable"
    # linear regression slope
    x = np.arange(len(temps), dtype=float)
    y = np.array(temps, dtype=float)
    slope = float(np.polyfit(x, y, 1)[0])
    if slope > 0.02:
        return "heating"
    if slope < -0.02:
        return "cooling"
    return "stable"


def _steady_state_time(times: List[float], rates: List[Optional[float]],
                       threshold: float = 0.05) -> Optional[float]:
    """First time dT/dt stays below threshold for 10+ consecutive steps."""
    consecutive = 0
    for t, r in zip(times, rates):
        if r is not None and abs(r) < threshold:
            consecutive += 1
            if consecutive >= 10:
                return t
        else:
            consecutive = 0
    return None


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/analyze", response_model=TemporalResponse)
def analyze_temporal(req: TemporalRequest):
    if not req.time_series:
        raise HTTPException(status_code=400, detail="time_series is empty")

    times = [row.time for row in req.time_series]

    # Determine which positions to analyse
    all_positions = list(req.time_series[0].values.keys())
    positions = req.positions if req.positions else all_positions

    results: List[PositionAnalysis] = []

    for pos in positions:
        raw_temps = [row.values.get(pos) for row in req.time_series]

        # Fill None with linear interpolation for derivative calculation
        arr = np.array([v if v is not None else np.nan for v in raw_temps], dtype=float)
        valid_mask = ~np.isnan(arr)
        if valid_mask.sum() < 2:
            continue
        # Interpolate NaNs
        arr_filled = np.interp(
            np.arange(len(arr)),
            np.where(valid_mask)[0],
            arr[valid_mask]
        ).tolist()

        rates      = _rate_of_change(times, arr_filled)
        roll_m, roll_s = _rolling(arr_filled, req.rolling_window)
        trend      = _detect_trend(arr_filled)
        ss_time    = _steady_state_time(times, rates)

        valid_rates = [r for r in rates if r is not None]
        noise_level = float(np.std(valid_rates)) if valid_rates else 0.0

        results.append(PositionAnalysis(
            position=pos,
            line_plot=[
                LinePlotPoint(time=t, value=v)
                for t, v in zip(times, raw_temps)
            ],
            rate_of_change=[
                RatePoint(time=t, rate=r)
                for t, r in zip(times, rates)
            ],
            rolling_mean=[
                RollingPoint(time=t, mean=m, std=s)
                for t, m, s in zip(times, roll_m, roll_s)
            ],
            trend=trend,
            steady_state_time=ss_time,
            max_rate=max(valid_rates) if valid_rates else 0.0,
            min_rate=min(valid_rates) if valid_rates else 0.0,
            noise_level=round(noise_level, 4),
        ))

    # Global summary
    trends_count = {"heating": 0, "cooling": 0, "stable": 0}
    for r in results:
        trends_count[r.trend] += 1

    global_summary = {
        "total_positions_analysed": len(results),
        "trend_breakdown": trends_count,
        "positions_at_steady_state": sum(1 for r in results if r.steady_state_time is not None),
        "highest_noise_position": max(results, key=lambda r: r.noise_level).position if results else None,
        "time_span": round(times[-1] - times[0], 3) if len(times) > 1 else 0,
    }

    return TemporalResponse(positions=results, global_summary=global_summary)