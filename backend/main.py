import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import database
import classifier
import advisor

# Initialize Database Schema
database.init_db()

app = FastAPI(title="AgriVision AI API", version="1.0.0")

# Enable CORS for Next.js frontend (port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits all connections during local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files to serve uploaded leaf images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# --- AUTH SCHEMAS & ROUTES ---

class AuthRequest(BaseModel):
    username: str
    password: str

class SignupRequest(BaseModel):
    username: str
    password: str
    role: str # 'farmer' or 'admin'

@app.post("/api/auth/signup")
def signup(payload: SignupRequest):
    role = payload.role.strip().lower()
    if role != "farmer":
        raise HTTPException(status_code=400, detail="Only 'farmer' accounts can be registered online. Admins are pre-seeded.")
        
    success = database.create_user(payload.username, payload.password, role)
    if not success:
        raise HTTPException(status_code=400, detail="Username already exists.")
        
    return {"message": "User registered successfully."}

@app.post("/api/auth/login")
def login(payload: AuthRequest):
    user = database.authenticate_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    return {
        "message": "Login successful",
        "user": user
    }

# --- PREDICTION & HISTORY ROUTES ---

@app.post("/api/predict")
async def predict(
    user_id: int = Form(...),
    image: UploadFile = File(...)
):
    # 1. Validate file extension
    file_ext = image.filename.split(".")[-1].lower()
    allowed_extensions = ["jpg", "jpeg", "png", "webp", "bmp", "jfif", "tiff"]
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported format. Supported formats: {', '.join(allowed_extensions).upper()}"
        )
        
    # 2. Save image to local uploads folder with unique UUID name
    unique_filename = f"{uuid.uuid4()}.{file_ext}"
    image_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    try:
        with open(image_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save image: {e}")
        
    # 3. Classify Image using pre-trained EfficientNet model
    crop, disease, confidence, is_demo = classifier.predict_leaf(image_path)
    
    # 4. Generate Advisory using Groq Llama-3.3 (or local offline fallback)
    advisory_report = advisor.generate_advisory(crop, disease)
    
    # 5. Log the prediction to SQLite
    # Store relative path so frontend can fetch it easily (e.g. /uploads/image.jpg)
    db_image_path = f"/uploads/{unique_filename}"
    prediction_id = database.save_prediction(
        user_id=user_id,
        crop=crop,
        disease=disease,
        confidence=confidence,
        image_path=db_image_path,
        advisory_data=advisory_report
    )
    
    return {
        "id": prediction_id,
        "crop": crop,
        "disease": disease,
        "confidence": confidence,
        "image_path": db_image_path,
        "advisory": advisory_report,
        "is_demo": is_demo
    }

@app.get("/api/history")
def get_history(user_id: int = None, role: str = "farmer"):
    """
    Returns history of predictions. Farmers get their own, Admins get all records.
    """
    if role == "admin":
        return database.get_all_history()
    elif user_id is not None:
        return database.get_user_history(user_id)
    else:
        raise HTTPException(status_code=400, detail="User ID or Admin role required.")

@app.get("/api/stats")
def get_stats():
    """
    Returns global system statistics for dashboard charts.
    """
    return database.get_statistics()

# Run using Uvicorn if run directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
