from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from sqlalchemy.orm import Session
import pandas as pd
import json
import tempfile
import os
from models import get_db, FileUpload

# ✅ NO prefix here - main.py provides /process
router = APIRouter(tags=["Process"])

@router.post("/")
async def process_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV/Excel files allowed")
    
    try:
        # ✅ FIXED: Save to temp file first, then read
        with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename[-4:]) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # Read from saved file
        if file.filename.lower().endswith('.csv'):
            df = pd.read_csv(tmp_path)
        else:
            df = pd.read_excel(tmp_path)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        # Rest of analysis code stays SAME...
        analysis = {
            "filename": file.filename,
            "rows": len(df),
            "columns": df.columns.tolist(),
            "shape": df.shape,
            "memory_usage_mb": round(df.memory_usage(deep=True).sum() / 1024**2, 2),
            "missing_values": df.isnull().sum().to_dict(),
            "data_types": df.dtypes.astype(str).to_dict(),
            "sample_data": json.loads(df.head(5).to_json(orient='records')),  # First 5 rows
            "summary_stats": {
                "numeric_columns": [col for col in df.columns if df[col].dtype in ['int64', 'float64']],
                "categorical_columns": [col for col in df.columns if df[col].dtype == 'object']
            }
        }
        
        return analysis
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
