# backend/dashboard/upload.py

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import os
import shutil
import json
from datetime import datetime
from models import get_db, FileUpload, UserSession
from dashboard.Project import get_user_from_token 
router = APIRouter(tags=["Upload"])


def _get_user_id(token: Optional[str], db: Session) -> int:
    if not token:
        return 1
    session = db.query(UserSession).filter(
        UserSession.token_hash == token,
        UserSession.is_active  == True,
        UserSession.expires_at  > datetime.now()
    ).first()
    return session.user_id if session else 1


# ─────────────────────────────────────────────────────────────
# POST /upload/   — save file, link to project immediately
# ─────────────────────────────────────────────────────────────
@router.post("/")
async def upload_files(
    files: List[UploadFile] = File(...),
    token: Optional[str] = None,
    project_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
  # avoid circular import
    user_id = get_user_from_token(token, db)

    results = []
    os.makedirs("uploads", exist_ok=True)

    for file in files:
        if file.size and file.size > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File {file.filename} too large")

        timestamp      = int(datetime.now().timestamp())
        saved_filename = f"{timestamp}_{file.filename}"
        file_path      = f"uploads/{saved_filename}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            df = pd.read_csv(file_path) if file.filename.lower().endswith(".csv") \
                 else pd.read_excel(file_path)

            file_upload = FileUpload(
                user_id           = user_id,
                project_id        = project_id,   # ✅ linked at upload time
                original_filename = file.filename,
                saved_filename    = saved_filename,
                file_path         = file_path,
                file_size_mb      = round(os.path.getsize(file_path) / (1024 * 1024), 2),
                rows_count        = len(df),
                columns_json      = json.dumps(df.columns.tolist()),
                status            = "uploaded"
            )
            db.add(file_upload)
            db.commit()
            db.refresh(file_upload)

            results.append({
                "id": file_upload.id, "filename": file.filename,
                "saved_as": saved_filename, "rows": len(df),
                "columns": df.columns[:5].tolist(), "file_path": file_path,
                "project_id": project_id, "database_id": file_upload.id, "status": "uploaded"
            })

        except Exception as e:
            file_upload = FileUpload(
                user_id=user_id, project_id=project_id,
                original_filename=file.filename, saved_filename=saved_filename,
                file_path=file_path,
                file_size_mb=round(os.path.getsize(file_path) / (1024*1024), 2),
                rows_count=0, columns_json="[]", status=f"error: {str(e)[:50]}"
            )
            db.add(file_upload)
            db.commit()
            results.append({"filename": file.filename, "error": str(e),
                            "project_id": project_id, "database_id": file_upload.id})

    return {"preview": results, "message": f"✅ Uploaded {len(files)} file(s)!",
            "saved_to_db": len([r for r in results if "database_id" in r])}


# ─────────────────────────────────────────────────────────────
# GET /upload/list
# project_id supplied  → only files with that project_id
# no project_id        → all user files (for breadcrumb dropdowns)
# ✅ NO cross-project fallback — each project shows only its own files
# ─────────────────────────────────────────────────────────────
@router.get("/list")
async def list_uploads(
    token:      Optional[str] = Query(None),
    project_id: Optional[int] = Query(None),
    db:         Session       = Depends(get_db)
):
    try:
        user_id = _get_user_id(token, db)
        query   = db.query(FileUpload).filter(FileUpload.user_id == user_id)

        if project_id is not None:
            # ✅ STRICT filter — only this project's files
            query = query.filter(FileUpload.project_id == project_id)

        uploads = query.order_by(FileUpload.id.desc()).all()

        result = []
        for u in uploads:
            try:    cols = json.loads(u.columns_json) if u.columns_json else []
            except: cols = []
            result.append({
                "id"          : u.id,
                "filename"    : u.original_filename,
                "saved_as"    : u.saved_filename,
                "file_path"   : u.file_path,
                "file_size_mb": u.file_size_mb,
                "rows"        : u.rows_count,
                "columns"     : cols,
                "status"      : u.status,
                "project_id"  : u.project_id,
                "uploaded_at" : u.uploaded_at.isoformat() if u.uploaded_at else None
            })

        return {"files": result, "total": len(result)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch uploads: {str(e)}")


# ─────────────────────────────────────────────────────────────
# PATCH /upload/{file_id}/project  — retroactively link a file
# ─────────────────────────────────────────────────────────────
@router.patch("/{file_id}/project")
async def assign_to_project(
    file_id:    int,
    project_id: int           = Query(...),
    token:      Optional[str] = Query(None),
    db:         Session       = Depends(get_db)
):
    user_id = _get_user_id(token, db)
    record  = db.query(FileUpload).filter(
        FileUpload.id == file_id, FileUpload.user_id == user_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    record.project_id = project_id
    db.commit()
    return {"message": f"✅ File '{record.original_filename}' linked to project {project_id}"}


# ─────────────────────────────────────────────────────────────
# DELETE /upload/{file_id}
# ─────────────────────────────────────────────────────────────
@router.delete("/{file_id}")
async def delete_upload(
    file_id: int, token: Optional[str] = Query(None), db: Session = Depends(get_db)
):
    r = db.query(FileUpload).filter(FileUpload.id == file_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.exists(r.file_path):
        try: os.remove(r.file_path)
        except: pass
    db.delete(r)
    db.commit()
    return {"message": f"✅ File '{r.original_filename}' deleted"}


# ─────────────────────────────────────────────────────────────
# GET /upload/{file_id}
# ─────────────────────────────────────────────────────────────
@router.get("/{file_id}")
async def get_upload(file_id: int, db: Session = Depends(get_db)):
    r = db.query(FileUpload).filter(FileUpload.id == file_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="File not found")
    try:    cols = json.loads(r.columns_json) if r.columns_json else []
    except: cols = []
    return {
        "id": r.id, "filename": r.original_filename, "saved_as": r.saved_filename,
        "file_path": r.file_path, "file_size_mb": r.file_size_mb,
        "rows": r.rows_count, "columns": cols, "status": r.status,
        "project_id": r.project_id,
        "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None
    }