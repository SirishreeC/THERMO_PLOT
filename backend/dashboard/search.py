# backend/dashboard/search.py
#
# Endpoints:
#   POST /search/index          — rebuild searchable_items for the user (call after upload/project create)
#   GET  /search?q=&token=      — search across searchable_items, saves to search_history
#   GET  /search/history?token= — return user's recent search_history rows
#   DELETE /search/history?token= — clear all search_history for the user

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func as sqlfunc
from typing import Optional
from datetime import datetime
import json

from models import (
    get_db, UserSession, FileUpload, Project,
    SearchHistory, SearchableItem
)

router = APIRouter(prefix="/search", tags=["Search"])

# ── Static pages always available in search ───────────────────
STATIC_PAGES = [
    {"name": "Dashboard",       "description": "Overview and stats",                "route": "/dashboard"  },
    {"name": "Upload Files",    "description": "ThermalVisuals analysis tool",      "route": "/upload"     },
    {"name": "Projects",        "description": "Manage your research projects",     "route": "/projects"   },
    {"name": "Thermal Analysis","description": "Browse files by project folder",    "route": "/data_visual"},
    {"name": "Doc Exports",     "description": "Export PDF, Excel, CSV, Word",      "route": "/exports"    },
    {"name": "Search",          "description": "Search across all your data",       "route": "/search"     },
]


# ── Auth helper ───────────────────────────────────────────────
def _get_user_id(token: Optional[str], db: Session) -> Optional[int]:
    if not token:
        return None
    session = db.query(UserSession).filter(
        UserSession.token_hash == token,
        UserSession.is_active  == True,
        UserSession.expires_at  > datetime.now()
    ).first()
    return session.user_id if session else None


# ══════════════════════════════════════════════════════════════
# POST /search/index
# Rebuild the searchable_items table for this user.
# Call this after creating a project or uploading a file.
# ══════════════════════════════════════════════════════════════
@router.post("/index")
def rebuild_index(
    token: Optional[str] = Query(None),
    db:    Session        = Depends(get_db)
):
    user_id = _get_user_id(token, db)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or missing token")

    # ── Delete all existing index rows for this user ──────────
    db.query(SearchableItem).filter(SearchableItem.user_id == user_id).delete()

    rows_added = 0

    # ── Index projects ────────────────────────────────────────
    projects = db.query(Project).filter(Project.owner_id == user_id).all()
    for p in projects:
        db.add(SearchableItem(
            user_id     = user_id,
            item_type   = "project",
            item_id     = p.id,
            name        = p.name,
            description = p.description or "",
            extra_data  = {
                "status"     : p.status,
                "created_at" : p.created_at.isoformat() if p.created_at else None,
            }
        ))
        rows_added += 1

    # ── Index files ───────────────────────────────────────────
    files = db.query(FileUpload).filter(FileUpload.user_id == user_id).all()
    # Build project name lookup
    proj_map = {p.id: p.name for p in projects}
    for f in files:
        db.add(SearchableItem(
            user_id     = user_id,
            item_type   = "file",
            item_id     = f.id,
            name        = f.original_filename,
            description = f"{f.rows_count or 0} rows · {f.file_size_mb or 0} MB",
            extra_data  = {
                "rows"        : f.rows_count,
                "size_mb"     : f.file_size_mb,
                "saved_as"    : f.saved_filename,
                "file_path"   : f.file_path,
                "project_id"  : f.project_id,
                "project_name": proj_map.get(f.project_id, ""),
                "status"      : f.status,
                "uploaded_at" : f.uploaded_at.isoformat() if f.uploaded_at else None,
            }
        ))
        rows_added += 1

    # ── Index static pages (shared across all users) ──────────
    for page in STATIC_PAGES:
        db.add(SearchableItem(
            user_id     = user_id,
            item_type   = "page",
            item_id     = None,
            name        = page["name"],
            description = page["description"],
            extra_data  = {"route": page["route"]}
        ))
        rows_added += 1

    db.commit()
    return {"message": f"✅ Index rebuilt — {rows_added} items indexed", "total": rows_added}


# ══════════════════════════════════════════════════════════════
# GET /search?q=<term>&token=
# Full-text search across searchable_items.
# Saves every submitted search to search_history.
# ══════════════════════════════════════════════════════════════
@router.get("")
def search(
    q:     str           = Query(..., min_length=1),
    token: Optional[str] = Query(None),
    db:    Session        = Depends(get_db)
):
    user_id = _get_user_id(token, db)

    results = []

    if user_id:
        # ── Query searchable_items ────────────────────────────
        term    = f"%{q.lower()}%"
        matches = db.query(SearchableItem).filter(
            SearchableItem.user_id == user_id,
            or_(
                sqlfunc.lower(SearchableItem.name).like(term),
                sqlfunc.lower(SearchableItem.description).like(term),
            )
        ).order_by(SearchableItem.item_type, SearchableItem.name).all()

        for item in matches:
            results.append({
                "id"         : item.id,
                "item_type"  : item.item_type,
                "item_id"    : item.item_id,
                "name"       : item.name,
                "description": item.description,
                "extra_data" : item.extra_data or {},
            })

        # ── Save to search_history ────────────────────────────
        history_row = SearchHistory(
            user_id      = user_id,
            search_term  = q,
            result_count = len(results),
            searched_at  = datetime.now(),
        )
        db.add(history_row)
        db.commit()

    else:
        # No token — still search static pages only
        q_lower = q.lower()
        for page in STATIC_PAGES:
            if q_lower in page["name"].lower() or q_lower in page["description"].lower():
                results.append({
                    "id"         : None,
                    "item_type"  : "page",
                    "item_id"    : None,
                    "name"       : page["name"],
                    "description": page["description"],
                    "extra_data" : {"route": page["route"]},
                })

    return {
        "query"       : q,
        "result_count": len(results),
        "results"     : results,
    }


# ══════════════════════════════════════════════════════════════
# GET /search/history?token=
# Return the user's recent search history from the DB.
# ══════════════════════════════════════════════════════════════
@router.get("/history")
def get_search_history(
    token: Optional[str] = Query(None),
    limit: int           = Query(10, ge=1, le=50),
    db:    Session        = Depends(get_db)
):
    user_id = _get_user_id(token, db)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or missing token")

    rows = (
        db.query(SearchHistory)
        .filter(SearchHistory.user_id == user_id)
        .order_by(SearchHistory.searched_at.desc())
        .limit(limit)
        .all()
    )

    return {
        "history": [
            {
                "id"          : r.id,
                "search_term" : r.search_term,
                "result_count": r.result_count,
                "searched_at" : r.searched_at.isoformat() if r.searched_at else None,
            }
            for r in rows
        ]
    }


# ══════════════════════════════════════════════════════════════
# DELETE /search/history?token=
# Clear all search history for the user.
# ══════════════════════════════════════════════════════════════
@router.delete("/history")
def clear_search_history(
    token: Optional[str] = Query(None),
    db:    Session        = Depends(get_db)
):
    user_id = _get_user_id(token, db)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or missing token")

    deleted = db.query(SearchHistory).filter(SearchHistory.user_id == user_id).delete()
    db.commit()
    return {"message": f"✅ Cleared {deleted} search history entries"}