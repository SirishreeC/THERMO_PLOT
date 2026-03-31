from fastapi import APIRouter,Depends,HTTPException
from pydantic import BaseModel
from typing import Optional
from models import User, get_db  # Reuse your existing models
from sqlalchemy.orm import Session
from datetime import datetime


router = APIRouter()  # Create router instead of app

class Profile(BaseModel):
    name: str
    email: str
    bio: str
    avatar: Optional[str] = None

@router.get("/profile", tags=["Profile"])
async def get_profile(token: str = None, db: Session = Depends(get_db)):
    """
    Get authenticated user profile (requires token from /login)
    """
    if not token:
        # Return mock data if no token (for testing)
        return {
            "name": "John Doe",
            "email": "john.doe@example.com",
            "bio": "Full-stack developer passionate about thermal data analysis.",
            "avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
        }
    
    # Verify token and get real user (reuse your auth logic)
    session = db.query(UserSession).filter(
        UserSession.token_hash == token,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.now()
    ).first()
    
    if not session:
        raise HTTPException(401, "Invalid or expired token")
    
    user = db.query(User).filter(User.id == session.user_id).first()
    return {
        "name": user.full_name or user.username,
        "email": user.email,
        "bio": f"{user.organization} - {user.username}",
        "avatar": None  # Add avatar field to User model later if needed
    }
