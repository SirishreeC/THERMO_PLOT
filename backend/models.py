# models.py - Complete Database Schema for ThermoPlot
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, Boolean, Text,
    ForeignKey, Float, JSON, BigInteger
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func

#  Database connection
DATABASE_URL = "postgresql://postgres:1234@localhost:5432/users_db"
engine       = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(80),  unique=True, index=True)
    email         = Column(String(120), unique=True, index=True)
    password_hash = Column(String(255))
    full_name     = Column(String(100))
    organization  = Column(String(100))

    sessions         = relationship("UserSession",        back_populates="user")
    reset_tokens     = relationship("PasswordResetToken", back_populates="user")
    file_uploads     = relationship("FileUpload",         back_populates="user")
    projects         = relationship("Project",            back_populates="user")
    preferences      = relationship("UserPreference",     back_populates="user", uselist=False)
    notifications    = relationship("Notification",       back_populates="user")
    audit_logs       = relationship("AuditLog",           back_populates="user")
    api_keys         = relationship("ApiKey",             back_populates="user")
    export_records   = relationship("ExportRecord",       back_populates="user")
    shared_reports   = relationship("SharedReport",       back_populates="owner")
    search_histories = relationship("SearchHistory",      back_populates="user")  
    deletion_logs = relationship("ProjectDeletionLog",    back_populates=None)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active  = Column(Boolean, default=True)

    user       = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"))
    token      = Column(String, index=True, unique=True)
    is_used    = Column(Boolean, default=False)
    expires_at = Column(DateTime)

    user       = relationship("User", back_populates="reset_tokens")


class ThermalData(Base):
    __tablename__ = "thermal_data"

    id            = Column(Integer, primary_key=True)
    timestamp     = Column(DateTime(timezone=True), server_default=func.now())
    temperature   = Column(Float)
    sensor_id     = Column(String(50))
    location_x    = Column(Float)
    location_y    = Column(Float)
    experiment_id = Column(String(50))


class FileUpload(Base):
    __tablename__ = "file_uploads"

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, ForeignKey("users.id"),    nullable=False)
    project_id        = Column(Integer, ForeignKey("projects.id"), nullable=True)
    original_filename = Column(String(255), nullable=False)
    saved_filename    = Column(String(255), nullable=False)
    file_path         = Column(String(500), nullable=False)
    file_size_mb      = Column(Float)
    rows_count        = Column(Integer, default=0)
    columns_json      = Column(Text)
    status            = Column(String(50), default="uploaded")
    uploaded_at       = Column(DateTime(timezone=True), server_default=func.now())

    user             = relationship("User",           back_populates="file_uploads")
    project          = relationship("Project",        back_populates="file_uploads")
    analyses         = relationship("AnalysisResult", back_populates="file_upload")
    sensor_positions = relationship("SensorPosition", back_populates="file_upload")
    anomaly_logs     = relationship("AnomalyLog",     back_populates="file_upload")
    export_records   = relationship("ExportRecord",   back_populates="file_upload")


class Project(Base):
    __tablename__ = "projects"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    name        = Column(String(200), nullable=False)
    description = Column(Text)
    status      = Column(String(50), default="active")
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    user         = relationship("User",           back_populates="projects")
    file_uploads = relationship("FileUpload",     back_populates="project")
    analyses     = relationship("AnalysisResult", back_populates="project")
    exports      = relationship("ExportRecord",   back_populates="project")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id             = Column(Integer, primary_key=True, index=True)
    file_upload_id = Column(Integer, ForeignKey("file_uploads.id"), nullable=False)
    project_id     = Column(Integer, ForeignKey("projects.id"))
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    analysis_type  = Column(String(100), nullable=False)
    result_json    = Column(JSON)
    status         = Column(String(50), default="completed")
    duration_ms    = Column(Integer)
    error_message  = Column(Text)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    file_upload    = relationship("FileUpload",    back_populates="analyses")
    project        = relationship("Project",       back_populates="analyses")
    user           = relationship("User")
    anomaly_logs   = relationship("AnomalyLog",    back_populates="analysis")
    shared_reports = relationship("SharedReport",  back_populates="analysis")


class AnomalyLog(Base):
    __tablename__ = "anomaly_logs"

    id              = Column(Integer, primary_key=True, index=True)
    analysis_id     = Column(Integer, ForeignKey("analysis_results.id"), nullable=False)
    file_upload_id  = Column(Integer, ForeignKey("file_uploads.id"),     nullable=False)
    position_name   = Column(String(100), nullable=False)
    outlier_value   = Column(Float, nullable=False)
    time_seconds    = Column(Float)
    lower_bound     = Column(Float)
    upper_bound     = Column(Float)
    severity        = Column(String(20), default="medium")
    is_acknowledged = Column(Boolean, default=False)
    detected_at     = Column(DateTime(timezone=True), server_default=func.now())

    analysis    = relationship("AnalysisResult", back_populates="anomaly_logs")
    file_upload = relationship("FileUpload",     back_populates="anomaly_logs")


class ExportRecord(Base):
    __tablename__ = "export_records"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"),        nullable=False)
    project_id      = Column(Integer, ForeignKey("projects.id"))
    file_upload_id  = Column(Integer, ForeignKey("file_uploads.id"))
    export_type     = Column(String(20), nullable=False)
    export_filename = Column(String(255))
    file_size_kb    = Column(Float)
    status          = Column(String(30), default="completed")
    download_count  = Column(Integer, default=0)
    exported_at     = Column(DateTime(timezone=True), server_default=func.now())
    last_downloaded = Column(DateTime(timezone=True))

    user        = relationship("User",       back_populates="export_records")
    project     = relationship("Project",    back_populates="exports")
    file_upload = relationship("FileUpload", back_populates="export_records")


class SensorPosition(Base):
    __tablename__ = "sensor_positions"

    id             = Column(Integer, primary_key=True, index=True)
    file_upload_id = Column(Integer, ForeignKey("file_uploads.id"), nullable=False)
    user_id        = Column(Integer, ForeignKey("users.id"),        nullable=False)
    position_name  = Column(String(100), nullable=False)
    location_mm    = Column(Float)
    location_x     = Column(Float)
    location_y     = Column(Float)
    description    = Column(String(255))
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    file_upload    = relationship("FileUpload", back_populates="sensor_positions")
    user           = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, ForeignKey("users.id"), nullable=False)
    title             = Column(String(200), nullable=False)
    message           = Column(Text, nullable=False)
    notification_type = Column(String(50), default="info")
    related_table     = Column(String(100))
    related_id        = Column(Integer)
    is_read           = Column(Boolean, default=False)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    read_at           = Column(DateTime(timezone=True))

    user              = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id            = Column(BigInteger, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"))
    action        = Column(String(100), nullable=False)
    resource_type = Column(String(100))
    resource_id   = Column(Integer)
    ip_address    = Column(String(45))
    user_agent    = Column(Text)
    extra_data    = Column(JSON)
    status        = Column(String(20), default="success")
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    user          = relationship("User", back_populates="audit_logs")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id                     = Column(Integer, primary_key=True, index=True)
    user_id                = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    theme                  = Column(String(20),  default="dark")
    default_chart_type     = Column(String(50),  default="line")
    temperature_unit       = Column(String(10),  default="celsius")
    anomaly_threshold      = Column(Float,       default=1.5)
    rolling_window_default = Column(Integer,     default=10)
    enable_email_alerts    = Column(Boolean,     default=False)
    alert_email            = Column(String(200))
    dashboard_layout       = Column(JSON)
    updated_at             = Column(DateTime(timezone=True), onupdate=func.now())

    user                   = relationship("User", back_populates="preferences")


class SharedReport(Base):
    __tablename__ = "shared_reports"

    id            = Column(Integer, primary_key=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"),            nullable=False)
    analysis_id   = Column(Integer, ForeignKey("analysis_results.id"), nullable=False)
    share_token   = Column(String(64), unique=True, nullable=False, index=True)
    title         = Column(String(200))
    is_public     = Column(Boolean, default=False)
    password_hash = Column(String(255))
    view_count    = Column(Integer, default=0)
    expires_at    = Column(DateTime(timezone=True))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    owner         = relationship("User",           back_populates="shared_reports")
    analysis      = relationship("AnalysisResult", back_populates="shared_reports")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id            = Column(Integer,     primary_key=True, index=True)
    user_id       = Column(Integer,     ForeignKey("users.id"), nullable=False)
    key_hash      = Column(String(255), unique=True, nullable=False)
    key_prefix    = Column(String(10),  nullable=False)
    name          = Column(String(100), nullable=False)
    scopes        = Column(JSON)
    is_active     = Column(Boolean, default=True)
    last_used_at  = Column(DateTime(timezone=True))
    request_count = Column(BigInteger, default=0)
    expires_at    = Column(DateTime(timezone=True))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    user          = relationship("User", back_populates="api_keys")


# TABLE 11: search_history 
class SearchHistory(Base):
    __tablename__ = "search_history"

    id           = Column(Integer,  primary_key=True, index=True)
    user_id      = Column(Integer,  ForeignKey("users.id"), nullable=False, index=True)
    search_term  = Column(String(500), nullable=False)   
    result_count = Column(Integer,  default=0)            
    searched_at  = Column(DateTime(timezone=True),
                          server_default=func.now(), index=True)

    user         = relationship("User", back_populates="search_histories")

# TABLE 12: searchable_items 
class SearchableItem(Base):
    __tablename__ = "searchable_items"

    id          = Column(Integer,  primary_key=True, index=True)
    user_id     = Column(Integer,  ForeignKey("users.id"), nullable=False, index=True)
    item_type   = Column(String(20),  nullable=False, index=True)  
    item_id     = Column(Integer,  nullable=True)            
    name        = Column(String(500), nullable=False)
    description = Column(Text)
    extra_data  = Column(JSON)                                  
    updated_at  = Column(DateTime(timezone=True),
                         server_default=func.now(),
                         onupdate=func.now())

    user        = relationship("User")


# TABLE 13: project_deletion_logs

class ProjectDeletionLog(Base):
    __tablename__ = "project_deletion_logs"

    id               = Column(Integer,     primary_key=True, index=True)
    user_id          = Column(Integer,     ForeignKey("users.id"), nullable=False, index=True)
    project_id       = Column(Integer,     nullable=False, index=True) 
    project_name     = Column(String(200), nullable=False)
    project_status   = Column(String(50))                                
    project_desc     = Column(Text)
    project_created  = Column(DateTime(timezone=True))          
    files_deleted    = Column(Integer, default=0)
    analyses_deleted = Column(Integer, default=0)   
    exports_deleted  = Column(Integer, default=0)   
    ip_address       = Column(String(45))           
    user_agent       = Column(Text)
    deleted_at       = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    status           = Column(String(20), default="success")   
    notes            = Column(Text)                             

    user             = relationship("User")



Base.metadata.create_all(bind=engine)


#  DB session dependency 
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()