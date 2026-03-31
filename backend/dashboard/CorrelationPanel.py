"""
thermal_api.py  —  ThermalViz FastAPI Backend
Serves all data required by:
  StatisticsPanel, HeatmapPanel, HeatmapPanel2D,
  TimeSeriesPanel, SpatialPanel, CorrelationPanel, AnomalyPanel

Run:
    pip install fastapi uvicorn pandas openpyxl scipy numpy
    uvicorn thermal_api:app --reload --port 8000
"""

from __future__ import annotations

import math
from io import BytesIO
from typing import Any

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from scipy import stats as scipy_stats

# ──────────────────────────────────────────────────────────────
#  App
# ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="ThermalViz API",
    description="Spatial-temporal thermal analysis backend",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────────────────────

def _safe(val: Any) -> Any:
    """Convert numpy scalars / nan / inf → JSON-safe Python types."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    return val


def _col_stats(series: pd.Series) -> dict:
    """Descriptive stats for one numeric column."""
    s = series.dropna()
    if s.empty:
        return {k: None for k in ("mean", "median", "std", "min", "max", "range",
                                   "cv", "q25", "q75", "iqr", "skewness", "kurtosis")}
    mean  = s.mean()
    std   = s.std()
    q25   = s.quantile(0.25)
    q75   = s.quantile(0.75)
    return {
        "mean":     round(float(mean), 4),
        "median":   round(float(s.median()), 4),
        "std":      round(float(std), 4),
        "min":      round(float(s.min()), 4),
        "max":      round(float(s.max()), 4),
        "range":    round(float(s.max() - s.min()), 4),
        "cv":       round(float(std / mean * 100) if mean != 0 else 0, 2),
        "q25":      round(float(q25), 4),
        "q75":      round(float(q75), 4),
        "iqr":      round(float(q75 - q25), 4),
        "skewness": round(float(s.skew()), 4),
        "kurtosis": round(float(s.kurtosis()), 4),
        "count":    int(s.count()),
    }


def _detect_anomalies(series: pd.Series, time_col: pd.Series) -> dict | None:
    """IQR-based outlier detection. Returns None when no outliers found."""
    s = series.dropna()
    q25, q75 = s.quantile(0.25), s.quantile(0.75)
    iqr = q75 - q25
    lower = q25 - 1.5 * iqr
    upper = q75 + 1.5 * iqr

    mask    = (series < lower) | (series > upper)
    outlier_idx = series[mask].index

    if outlier_idx.empty:
        return None

    return {
        "count":       int(mask.sum()),
        "percentage":  round(float(mask.sum() / len(series) * 100), 2),
        "lower_bound": round(float(lower), 4),
        "upper_bound": round(float(upper), 4),
        "outliers": [
            {
                "time":  _safe(time_col.loc[i]),
                "value": _safe(series.loc[i]),
                "index": int(i),
            }
            for i in outlier_idx[:50]   # cap at 50 for payload size
        ],
    }


def _pearson_matrix(df: pd.DataFrame) -> list[list[float | None]]:
    """Full Pearson correlation matrix (list-of-lists, JSON safe)."""
    corr = df.corr(method="pearson")
    result = []
    for _, row in corr.iterrows():
        result.append([_safe(round(v, 6)) for v in row])
    return result


def _spatial_snapshots(df: pd.DataFrame, time_col: str, pos_cols: list[str],
                        n_snapshots: int = 10) -> list[dict]:
    """
    Pick ~n_snapshots evenly-spaced time points.
    Each snapshot: { time, pos1: temp, pos2: temp, ... }
    """
    indices = np.linspace(0, len(df) - 1, num=min(n_snapshots, len(df)), dtype=int)
    snapshots = []
    for idx in indices:
        row = df.iloc[idx]
        snap: dict = {"time": _safe(row[time_col])}
        for p in pos_cols:
            snap[p] = _safe(row[p])
        snapshots.append(snap)
    return snapshots


def _read_excel(content: bytes) -> pd.DataFrame:
    """Read xlsx/xls from bytes, auto-detect time column."""
    df = pd.read_excel(BytesIO(content))
    df.columns = [str(c).strip() for c in df.columns]

    # Drop fully-empty rows/cols
    df.dropna(how="all", inplace=True)
    df.dropna(axis=1, how="all", inplace=True)

    return df


def _identify_columns(df: pd.DataFrame) -> tuple[str, list[str]]:
    """
    Heuristic: the time column is the first numeric column whose name
    contains 'time', 't', 's', 'sec', or is simply the first column.
    Everything else numeric is treated as a position/sensor.
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        raise ValueError("No numeric columns found in the uploaded file.")

    time_keywords = {"time", "t", "sec", "second", "s", "timestamp", "ts"}
    time_col = None
    for col in numeric_cols:
        if col.lower().strip() in time_keywords or any(kw in col.lower() for kw in time_keywords):
            time_col = col
            break
    if time_col is None:
        time_col = numeric_cols[0]   # fallback: first numeric col

    pos_cols = [c for c in numeric_cols if c != time_col]
    return time_col, pos_cols


# ──────────────────────────────────────────────────────────────
#  Main endpoint
# ──────────────────────────────────────────────────────────────

@app.post("/thermal/analyze")
async def analyze_thermal(file: UploadFile = File(...)) -> dict:
    """
    Accepts an .xlsx / .xls file.
    Returns a single JSON payload consumed by all frontend panels.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx / .xls files are accepted.")

    content = await file.read()

    try:
        df = _read_excel(content)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {exc}")

    try:
        time_col, pos_cols = _identify_columns(df)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not pos_cols:
        raise HTTPException(status_code=422, detail="No position/sensor columns found (need at least 2 numeric columns).")

    # ── Coerce all position columns to float ──────────────────
    for c in pos_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df[time_col] = pd.to_numeric(df[time_col], errors="coerce")

    pos_df = df[pos_cols]

    # ── 1. Metadata ───────────────────────────────────────────
    total_cells  = df[pos_cols].size
    missing_vals = int(df[pos_cols].isna().sum().sum())
    completeness = round((total_cells - missing_vals) / total_cells * 100, 2) if total_cells else 0

    t_min = _safe(df[time_col].min())
    t_max = _safe(df[time_col].max())

    metadata = {
        "rows":             int(len(df)),
        "position_columns": int(len(pos_cols)),
        "position_names":   pos_cols,
        "time_column":      time_col,
        "time_range":       [t_min, t_max],
        "missing_values":   missing_vals,
        "completeness":     completeness,
        "global_min":       _safe(round(float(pos_df.min().min()), 4)),
        "global_max":       _safe(round(float(pos_df.max().max()), 4)),
    }

    # ── 2. Statistics (per position) ──────────────────────────
    statistics = {col: _col_stats(df[col]) for col in pos_cols}

    # ── 3. Time series (full, for Heatmap / TimeSeries panels) ─
    time_series = []
    for _, row in df.iterrows():
        record: dict = {time_col: _safe(row[time_col])}
        for p in pos_cols:
            record[p] = _safe(row[p])
        time_series.append(record)

    # ── 4. Spatial snapshots (for SpatialPanel) ──────────────
    spatial_snapshots = _spatial_snapshots(df, time_col, pos_cols, n_snapshots=10)

    # ── 5. Correlation (for CorrelationPanel) ─────────────────
    corr_matrix = _pearson_matrix(pos_df.dropna())
    correlation = {
        "positions": pos_cols,
        "matrix":    corr_matrix,
    }

    # ── 6. Anomalies (for AnomalyPanel) ──────────────────────
    anomalies: dict = {}
    for col in pos_cols:
        result = _detect_anomalies(df[col], df[time_col])
        if result is not None:
            anomalies[col] = result

    # ── 7. Trend analysis (bonus — used by SpatialPanel insight) ─
    trends: dict = {}
    for col in pos_cols:
        s = df[col].dropna()
        if len(s) >= 3:
            x = np.arange(len(s))
            slope, intercept, r_val, p_val, _ = scipy_stats.linregress(x, s.values)
            trends[col] = {
                "slope":     round(float(slope), 6),
                "intercept": round(float(intercept), 4),
                "r_squared": round(float(r_val ** 2), 4),
                "p_value":   round(float(p_val), 6),
                "direction": "increasing" if slope > 0 else "decreasing" if slope < 0 else "stable",
            }

    # ── 8. Heatmap2D data (compact matrix for canvas rendering) ─
    heatmap2d = {
        "positions": pos_cols,
        "times":     [_safe(df[time_col].iloc[i]) for i in range(len(df))],
        "matrix":    [
            [_safe(df[col].iloc[i]) for col in pos_cols]
            for i in range(len(df))
        ],
        "global_min": metadata["global_min"],
        "global_max": metadata["global_max"],
    }

    return {
        "metadata":          metadata,
        "statistics":        statistics,
        "time_series":       time_series,
        "spatial_snapshots": spatial_snapshots,
        "correlation":       correlation,
        "anomalies":         anomalies,
        "trends":            trends,
        "heatmap2d":         heatmap2d,
    }


# ──────────────────────────────────────────────────────────────
#  Health check
# ──────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "service": "ThermalViz API", "version": "2.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
