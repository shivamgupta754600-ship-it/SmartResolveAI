
from fastapi import FastAPI

from app.routes.grievance_routes import router as grievance_router


# ==========================================
# CREATE FASTAPI APPLICATION
# ==========================================

app = FastAPI(
    title="SmartResolve AI",
    description=(
        "AI-powered grievance classification "
        "and department suggestion system."
    ),
    version="1.0.0"
)


# ==========================================
# REGISTER ROUTES
# ==========================================

app.include_router(grievance_router)


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/")
def root():

    return {
        "message": "Welcome to SmartResolve AI",
        "status": "API is running"
    }


