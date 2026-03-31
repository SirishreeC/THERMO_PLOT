# main.py - All API endpoints
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from passlib.context import CryptContext
from datetime import datetime, timedelta
import secrets
import uvicorn
from dashboard.upload import router as upload_router  
from dashboard.data_process import router as data_process_router 
from dashboard.Project import router as project_router
from dashboard.temporal import router as temporal_router
from dashboard.SpatialAnalysis import router as SpatialAnalysis_router
from dashboard.export import router as export_router
from dashboard.search import router as search_router

from fastapi.staticfiles import StaticFiles


# Import database stuff from models.py
from models import User, UserSession,FileUpload,ThermalData, get_db

# Creates API server
app = FastAPI(title="ThermoPlot API")


# CORS - Allows React frontend to call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")



# Pydantic models (data validation)
class UserLogin(BaseModel):
    username: str
    password: str

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: str = ""
    organization: str = ""

class DataFilter(BaseModel):
    start_date: str = None
    end_date: str = None
    sensor_id: str = None
    experiment_id: str = None



def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def create_token(user_id: int):
    return secrets.token_urlsafe(32)

# API ENDPOINTS
@app.post("/login")
def login(user: UserLogin, request: Request, db=Depends(get_db)):
    # Find user in database
    db_user = db.query(User).filter(User.username == user.username).first()
    
    # Check password
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session token
    token = create_token(db_user.id)
    
    # Save session to database
    session = UserSession(
        user_id=db_user.id,
        token_hash=token,
        ip_address=request.client.host,
        user_agent=str(request.headers.get("user-agent")),
        expires_at=datetime.now() + timedelta(days=7)
    )
    db.add(session)
    db.commit()
    
    return {
        "access_token": token,
        "user": {
            "id": db_user.id,
            "username": db_user.username,
            "full_name": db_user.full_name,
            "email": db_user.email,
            "organization": db_user.organization
        }
    }

@app.post("/register")
def register(user_data: UserRegister, db=Depends(get_db)):
    # Check if user already exists or not
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(400, "Username already exists")
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(400, "Email already exists")
    
    # Create new user
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        organization=user_data.organization
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return {"message": "User created successfully!", "user_id": db_user.id}

@app.get("/user")
def get_user(token: str, db=Depends(get_db)):
    # Verify token exists and if it is valid
    session = db.query(UserSession).filter(
        UserSession.token_hash == token,
        UserSession.is_active == True,
        UserSession.expires_at > datetime.now()
    ).first()
    
    if not session:
        raise HTTPException(401, "Invalid or expired token")
    
    # Get user data
    user = db.query(User).filter(User.id == session.user_id).first()
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "organization": user.organization
    }



@app.get("/")
def root():
    return {"message": "Thermo Plot API - Ready!"}

@app.get("/docs")
def docs_redirect():
    return {"docs": "http://127.0.0.1:8000/docs"}

app.mount("/static", StaticFiles(directory="uploads"), name="uploads")

# Dashboard routes

app.include_router(upload_router, prefix="/upload", tags=["Upload"])
app.include_router(data_process_router, prefix="/process", tags=["Process"])
app.include_router(project_router, tags=["Project"])
app.include_router(temporal_router)
app.include_router(SpatialAnalysis_router)
app.include_router(export_router)
app.include_router(search_router)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
 