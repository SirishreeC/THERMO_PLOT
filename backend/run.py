import uvicorn
import os
from fastapi.staticfiles import StaticFiles

if __name__ == "__main__":
    os.chdir(os.path.dirname(__file__))
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
