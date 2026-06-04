import sqlite3
import os
import json
import bcrypt

DB_PATH = os.path.join(os.path.dirname(__file__), "agrivision.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Returns query results as dictionary-like rows
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Create Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('farmer', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # 2. Create Predictions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        crop TEXT NOT NULL,
        disease TEXT NOT NULL,
        confidence REAL NOT NULL,
        image_path TEXT NOT NULL,
        advisory TEXT NOT NULL, -- Stored as JSON string
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)
    # 3. Seed Default Admin Account if not exists
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
    if cursor.fetchone()[0] == 0:
        pw_hash = hash_password("admin123")
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            ("admin", pw_hash, "admin")
        )
        print("Default admin account seeded (username: admin, password: admin123)")
        
    conn.commit()
    conn.close()
    print("Database tables initialized successfully.")

# --- USER AUTHENTICATION HELPERS ---

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_user(username: str, password_raw: str, role: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    try:
        pw_hash = hash_password(password_raw)
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username.strip().lower(), pw_hash, role.strip().lower())
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False  # Username already exists
    finally:
        conn.close()

def authenticate_user(username: str, password_raw: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username.strip().lower(),))
    user = cursor.fetchone()
    conn.close()
    
    if user and check_password(password_raw, user['password_hash']):
        return {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"]
        }
    return None

# --- SCAN HISTORY & PREDICTION HELPERS ---

def save_prediction(user_id: int, crop: str, disease: str, confidence: float, image_path: str, advisory_data: dict) -> int:
    conn = get_db()
    cursor = conn.cursor()
    advisory_str = json.dumps(advisory_data)
    cursor.execute(
        """INSERT INTO predictions (user_id, crop, disease, confidence, image_path, advisory) 
           VALUES (?, ?, ?, ?, ?, ?)""",
        (user_id, crop, disease, confidence, image_path, advisory_str)
    )
    conn.commit()
    prediction_id = cursor.lastrowid
    conn.close()
    return prediction_id

def get_user_history(user_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM predictions WHERE user_id = ? ORDER BY created_at DESC", 
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for r in rows:
        history.append({
            "id": r["id"],
            "crop": r["crop"],
            "disease": r["disease"],
            "confidence": r["confidence"],
            "image_path": r["image_path"],
            "advisory": json.loads(r["advisory"]),
            "created_at": r["created_at"]
        })
    return history

def get_all_history():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT p.*, u.username FROM predictions p 
           JOIN users u ON p.user_id = u.id 
           ORDER BY p.created_at DESC"""
    )
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for r in rows:
        history.append({
            "id": r["id"],
            "username": r["username"],
            "crop": r["crop"],
            "disease": r["disease"],
            "confidence": r["confidence"],
            "image_path": r["image_path"],
            "advisory": json.loads(r["advisory"]),
            "created_at": r["created_at"]
        })
    return history

# --- DASHBOARD STATISTICS HELPERS ---

def get_statistics():
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Total count
    cursor.execute("SELECT COUNT(*) FROM predictions")
    total_scans = cursor.fetchone()[0]
    
    # 2. Crop distribution
    cursor.execute("SELECT crop, COUNT(*) as count FROM predictions GROUP BY crop ORDER BY count DESC")
    crop_rows = cursor.fetchall()
    crop_distribution = {row["crop"]: row["count"] for row in crop_rows}
    
    # 3. Disease distribution (Top diseases)
    cursor.execute("SELECT disease, COUNT(*) as count FROM predictions GROUP BY disease ORDER BY count DESC LIMIT 5")
    disease_rows = cursor.fetchall()
    disease_distribution = {row["disease"]: row["count"] for row in disease_rows}
    
    # 4. Total users count
    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'farmer'")
    total_farmers = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        "total_scans": total_scans,
        "total_farmers": total_farmers,
        "crop_distribution": crop_distribution,
        "disease_distribution": disease_distribution
    }

# Run initialization when database.py is executed directly
if __name__ == "__main__":
    init_db()
