# backend/dashboard/Project.py
#
# Uses raw SQL (sqlalchemy text()) for all project CRUD so that the actual
# PostgreSQL column names are used directly — no dependency on the ORM model
# definition in models.py which may be out of sync with the live DB schema.

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime
import pandas as pd
import numpy as np
import io
from scipy import stats
import warnings

from models import get_db, UserSession

warnings.filterwarnings('ignore')

router = APIRouter(tags=["Projects & Thermal Analysis"])


# ══════════════════════════════════════════════════════════════════════════════
# AUTH HELPER
# ══════════════════════════════════════════════════════════════════════════════

def get_user_from_token(token: str, db: Session) -> int:
    """Validate token → return user_id. Falls back to 1 in dev (no token)."""
    if not token:
        return 1  # dev fallback

    session = db.query(UserSession).filter(
        UserSession.token_hash == token,
        UserSession.is_active  == True,
        UserSession.expires_at  > datetime.now()
    ).first()

    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return session.user_id


# ══════════════════════════════════════════════════════════════════════════════
# HELPER — discover the real owner column name at runtime
# ══════════════════════════════════════════════════════════════════════════════

def _owner_col(db: Session) -> str:
    """
    Checks the live DB to find whether the projects table uses
    'owner_id' or 'user_id' as the FK column. Returns the correct name.
    """
    result = db.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = 'projects' "
        "AND column_name IN ('owner_id', 'user_id') "
        "LIMIT 1"
    )).fetchone()

    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Cannot find owner column in projects table. Expected 'owner_id' or 'user_id'."
        )
    return result[0]


def _row_to_dict(row) -> dict:
    return dict(row._mapping)


def _fmt(d: dict) -> dict:
    for key in ('created_at', 'updated_at'):
        val = d.get(key)
        if val and hasattr(val, 'isoformat'):
            d[key] = val.isoformat()
        elif val is None:
            d[key] = None
    return d


# ══════════════════════════════════════════════════════════════════════════════
# PYDANTIC SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class ProjectCreate(BaseModel):
    name:        str
    description: Optional[str] = ""
    status:      Optional[str] = "active"


# ══════════════════════════════════════════════════════════════════════════════
# PROJECT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/projects", summary="Create a new project")
def create_project(
    payload: ProjectCreate,
    token:   Optional[str] = None,
    db:      Session       = Depends(get_db)
):
    user_id = get_user_from_token(token, db)
    col     = _owner_col(db)

    valid_statuses = {"active", "archived", "completed"}
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Choose from: {valid_statuses}"
        )

    existing = db.execute(text(
        f"SELECT id FROM projects WHERE {col} = :uid AND name = :name LIMIT 1"
    ), {"uid": user_id, "name": payload.name.strip()}).fetchone()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A project named '{payload.name}' already exists."
        )

    row = db.execute(text(
        f"""
        INSERT INTO projects ({col}, name, description, status)
        VALUES (:uid, :name, :desc, :status)
        RETURNING id, {col} AS owner_col, name, description, status,
                  created_at, updated_at
        """
    ), {
        "uid":    user_id,
        "name":   payload.name.strip(),
        "desc":   payload.description or "",
        "status": payload.status,
    }).fetchone()

    db.commit()
    result = _row_to_dict(row)
    result["owner_id"] = result.pop("owner_col", user_id)
    return _fmt(result)


@router.get("/projects", summary="List all projects for the current user")
def list_projects(
    token:  Optional[str] = None,
    status: Optional[str] = None,
    db:     Session        = Depends(get_db)
):
    user_id = get_user_from_token(token, db)
    col     = _owner_col(db)

    if status:
        rows = db.execute(text(
            f"SELECT * FROM projects WHERE {col} = :uid AND status = :status "
            f"ORDER BY created_at DESC"
        ), {"uid": user_id, "status": status}).fetchall()
    else:
        rows = db.execute(text(
            f"SELECT * FROM projects WHERE {col} = :uid ORDER BY created_at DESC"
        ), {"uid": user_id}).fetchall()

    projects = [_fmt(_row_to_dict(r)) for r in rows]
    return {"total": len(projects), "projects": projects}


@router.get("/projects/{project_id}", summary="View a single project")
def get_project(
    project_id: int,
    token:      Optional[str] = None,
    db:         Session        = Depends(get_db)
):
    user_id = get_user_from_token(token, db)
    col     = _owner_col(db)

    row = db.execute(text(
        "SELECT * FROM projects WHERE id = :pid LIMIT 1"
    ), {"pid": project_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found.")

    project = _row_to_dict(row)

    if project.get(col) != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")

    return _fmt(project)


@router.delete("/projects/{project_id}", summary="Delete a project")
def delete_project(
    project_id: int,
    token:      Optional[str] = None,
    db:         Session        = Depends(get_db)
):
    user_id = get_user_from_token(token, db)
    col     = _owner_col(db)

    row = db.execute(text(
        "SELECT * FROM projects WHERE id = :pid LIMIT 1"
    ), {"pid": project_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found.")

    project = _row_to_dict(row)

    if project.get(col) != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")

    db.execute(text("""
    INSERT INTO project_deletion_logs
        (user_id, project_id, project_name, project_status,
         project_desc, project_created, ip_address, status)
    VALUES
        (:uid, :pid, :name, :pstatus,
         :desc, :pcreated, :ip, 'success')
"""), {
    "uid":      user_id,
    "pid":      project_id,
    "name":     project["name"],
    "pstatus":  project.get("status"),
    "desc":     project.get("description"),
    "pcreated": project.get("created_at"),
    "ip":       None,   # pass request.client.host if you add Request param
})


    db.execute(text("DELETE FROM projects WHERE id = :pid"), {"pid": project_id})
    db.commit()

    return {
        "message":    f"Project '{project['name']}' deleted successfully.",
        "project_id": project_id,
        "deleted":    True,
    }


# ══════════════════════════════════════════════════════════════════════════════
# THERMAL ANALYSIS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/thermal/analyze", summary="Run thermal analysis on an uploaded Excel file")
async def analyze_temperature_data(file: UploadFile = File(...)):
    print(f"📁 Received file: {file.filename}")
    try:
        content = await file.read()
        df      = pd.read_excel(io.BytesIO(content))
        df.columns = df.columns.str.strip()

        if len(df.columns) < 2:
            raise HTTPException(status_code=400, detail="Need at least a Time column + one Position column.")

        time_col          = df.columns[0]
        all_position_cols = df.columns[1:].tolist()

        df[time_col] = pd.to_numeric(df[time_col], errors='coerce')
        df           = df.dropna(subset=[time_col])

        position_cols = []
        for col in all_position_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            if df[col].notna().sum() > 0:
                position_cols.append(col)

        if not position_cols:
            raise HTTPException(status_code=400, detail="No valid numeric position columns found.")

        statistics = {}
        for col in position_cols:
            col_data = df[col].dropna()
            if len(col_data) == 0:
                continue
            q1, q3 = col_data.quantile(0.25), col_data.quantile(0.75)
            iqr    = q3 - q1
            # scipy < 1.9 doesn't support keepdims; use numpy fallback for mode
            try:
                mode_r = stats.mode(col_data.round(2), keepdims=True)
                mode_val = float(mode_r.mode[0])
            except TypeError:
                import numpy as np_inner
                mode_r = stats.mode(col_data.round(2))
                raw = mode_r.mode
                mode_val = float(raw[0]) if hasattr(raw, '__len__') else float(raw)
            statistics[col] = {
                "mean":     round(float(col_data.mean()),     4),
                "median":   round(float(col_data.median()),   4),
                "mode":     round(mode_val,                   4),
                "std":      round(float(col_data.std()),      4),
                "variance": round(float(col_data.var()),      4),
                "min":      round(float(col_data.min()),      4),
                "max":      round(float(col_data.max()),      4),
                "q1":       round(float(q1),                  4),
                "q3":       round(float(q3),                  4),
                "iqr":      round(float(iqr),                 4),
                "skewness": round(float(col_data.skew()),     4),
                "kurtosis": round(float(col_data.kurtosis()), 4),
                "count":    int(col_data.count()),
            }

        sample_df   = df[[time_col] + position_cols].head(500)
        time_series = []
        for _, row in sample_df.iterrows():
            entry = {time_col: _safe_val(row[time_col])}
            for col in position_cols:
                entry[col] = _safe_val(row[col])
            time_series.append(entry)

        anomalies = {}
        for col in position_cols:
            col_data = df[col].dropna()
            if len(col_data) < 4:
                continue
            q1, q3  = col_data.quantile(0.25), col_data.quantile(0.75)
            iqr     = q3 - q1
            lower   = q1 - 1.5 * iqr
            upper   = q3 + 1.5 * iqr
            outliers = col_data[(col_data < lower) | (col_data > upper)]
            anomalies[col] = {
                "count":       int(len(outliers)),
                "percentage":  round(len(outliers) / len(col_data) * 100, 2),
                "lower_bound": round(float(lower), 4),
                "upper_bound": round(float(upper), 4),
                "outliers":    [round(float(v), 4) for v in outliers.tolist()[:20]],
            }

        correlation = {}
        if len(position_cols) > 1:
            corr_matrix = df[position_cols].corr()
            for col in position_cols:
                correlation[col] = {
                    other: round(float(corr_matrix.loc[col, other]), 4)
                    for other in position_cols
                }

        metadata = {
            "filename":         file.filename,
            "total_rows":       int(len(df)),
            "position_columns": int(len(position_cols)),
            "position_names":   position_cols,
            "time_column":      time_col,
            "time_range":       [_safe_val(df[time_col].min()), _safe_val(df[time_col].max())],
            "global_min":       _safe_val(df[position_cols].min().min()),
            "global_max":       _safe_val(df[position_cols].max().max()),
        }

        return {
            "status":      "success",
            "metadata":    metadata,
            "statistics":  statistics,
            "time_series": time_series,
            "anomalies":   anomalies,
            "correlation": correlation,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ {type(e).__name__}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


def _safe_val(v):
    try:
        if v is None:
            return None
        f = float(v)
        if np.isnan(f) or np.isinf(f):
            return None
        return round(f, 4)
    except Exception:
        return None


@router.get("/files", summary="List all uploaded files for the current user")
def list_files(
    token: Optional[str] = None,
    db:    Session        = Depends(get_db)
):
    user_id = get_user_from_token(token, db)

    rows = db.execute(text(
        """
        SELECT id, original_filename, file_size_mb, rows_count,
               status, uploaded_at
        FROM file_uploads
        WHERE user_id = :uid
        ORDER BY uploaded_at DESC
        """
    ), {"uid": user_id}).fetchall()

    files = []
    for r in rows:
        d = _row_to_dict(r)
        val = d.get("uploaded_at")
        if val and hasattr(val, "isoformat"):
            d["uploaded_at"] = val.isoformat()
        files.append(d)

    return {"total": len(files), "files": files}

@router.get("/dashboard/stats", summary="Live dashboard stat counts for the current user")
def dashboard_stats(
    token: Optional[str] = None,
    db:    Session        = Depends(get_db)
):
    user_id = get_user_from_token(token, db)
    col     = _owner_col(db)

    total_files = db.execute(text(
        "SELECT COUNT(*) FROM file_uploads WHERE user_id = :uid"
    ), {"uid": user_id}).scalar() or 0

    total_analyses = db.execute(text(
        "SELECT COUNT(*) FROM analysis_results WHERE user_id = :uid"
    ), {"uid": user_id}).scalar() or 0

    if total_analyses == 0:
        total_analyses = db.execute(text(
            "SELECT COUNT(*) FROM file_uploads WHERE user_id = :uid AND status = 'uploaded'"
        ), {"uid": user_id}).scalar() or 0

    active_projects = db.execute(text(
        f"SELECT COUNT(*) FROM projects WHERE {col} = :uid AND status = 'active'"
    ), {"uid": user_id}).scalar() or 0

    total_projects = db.execute(text(
        f"SELECT COUNT(*) FROM projects WHERE {col} = :uid"
    ), {"uid": user_id}).scalar() or 0

    return {
        "total_files":     int(total_files),
        "total_analyses":  int(total_analyses),
        "active_projects": int(active_projects),
        "total_projects":  int(total_projects),  
    }


__all__ = ['router']