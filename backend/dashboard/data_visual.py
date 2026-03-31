from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import numpy as np
import pandas as pd
from models import ThermalData, get_db  

router = APIRouter(prefix="/dashboard/visuals", tags=["dashboard-visuals"])

class DataFilter(BaseModel):
    start_date: str = None
    end_date: str = None
    sensor_id: str = None
    experiment_id: str = None

@router.get("/temperature-trends")
def get_temperature_trends(filter: DataFilter = Depends(), db: Session = Depends(get_db)):
    """Line charts for temperature trends (REQ-DASH-005)"""
    query = db.query(ThermalData.timestamp, ThermalData.temperature, ThermalData.sensor_id)
    
    if filter.sensor_id:
        query = query.filter(ThermalData.sensor_id == filter.sensor_id)
    if filter.experiment_id:
        query = query.filter(ThermalData.experiment_id == filter.experiment_id)
    
    data = query.order_by(ThermalData.timestamp).limit(1000).all()
    
    chart_data = [
        {
            "timestamp": d.timestamp.isoformat(),
            "temperature": float(d.temperature),
            "sensor_id": d.sensor_id
        } for d in data
    ]
    
    return {
        "data": chart_data,
        "chart_type": "line",
        "title": "Temperature Trends Over Time"
    }

@router.get("/heatmaps")
def get_heatmaps(filter: DataFilter = Depends(), db: Session = Depends(get_db)):
    """Heatmaps for spatial distribution (REQ-DASH-005)"""
    query = db.query(ThermalData.location_x, ThermalData.location_y, ThermalData.temperature)
    data = query.limit(500).all()
    
    heatmap_data = [
        {"x": float(d.location_x), "y": float(d.location_y), "z": float(d.temperature)}
        for d in data
    ]
    
    return {
        "data": heatmap_data,
        "chart_type": "heatmap",
        "title": "Spatial Temperature Distribution",
        "colorscale": "Viridis"
    }

@router.get("/sensor-comparison")
def get_sensor_comparison(filter: DataFilter = Depends(), db: Session = Depends(get_db)):
    """Bar charts for comparative analysis (REQ-DASH-005)"""
    query = db.query(
        ThermalData.sensor_id,
        func.avg(ThermalData.temperature).label('avg_temp'),
        func.count().label('count')
    ).group_by(ThermalData.sensor_id)
    
    data = query.all()
    
    return {
        "data": [
            {
                "sensor": d.sensor_id,
                "avg_temp": float(d.avg_temp),
                "count": d.count
            } for d in data
        ],
        "chart_type": "bar",
        "title": "Average Temperature by Sensor"
    }

@router.get("/correlation-scatter")
def get_correlation_scatter(filter: DataFilter = Depends(), db: Session = Depends(get_db)):
    """Scatter plots for correlation analysis (REQ-DASH-005)"""
    query = db.query(ThermalData.location_x, ThermalData.temperature)
    data = query.limit(200).all()
    
    return {
        "data": [
            {"x": float(d.location_x), "y": float(d.temperature)}
            for d in data
        ],
        "chart_type": "scatter",
        "title": "Temperature vs Position Correlation"
    }
