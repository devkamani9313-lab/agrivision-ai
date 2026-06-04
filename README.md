# 🌱 AgriVision AI - Crop Disease Detector & Advisory System

AgriVision AI is a full-stack, intelligent agricultural platform designed to help farmers quickly identify plant diseases from leaf photos and receive actionable, AI-generated treatment advice.

## 🚀 Features

- **Leaf Disease Classification**: Upload a photo of a single crop leaf, and the system will detect the specific disease (or verify if it's healthy).
- **Expert Advisory Engine**: Integrates with Groq (Llama 3.3) to generate comprehensive, easy-to-understand treatment plans, organic remedies, and preventive measures.
- **Role-based Dashboards**: 
  - **Farmers**: Can upload images, view past scans, and track their crop health.
  - **Admins / Experts**: Can view global statistics, monitor disease distributions, and analyze system usage.
- **Secure Authentication**: User accounts with securely hashed passwords.

## 🧠 Machine Learning Model & Fine-Tuning

The core of the image classification engine relies on a custom-trained PyTorch model. 

- **Base Architecture**: EfficientNet (optimized for high accuracy and efficiency on edge/CPU deployments).
- **Dataset**: Fine-tuned on the renowned **PlantVillage** and **New Plant Diseases** datasets, covering 38 distinct classes across 14 different crop types (including Apple, Potato, Tomato, Pepper, Peach, etc.).
- **Fine-Tuning Process**: The model was transfer-learned from pre-trained ImageNet weights. The final fully connected layers were replaced and fine-tuned specifically to recognize agricultural leaf diseases, focusing on common blight, rust, and spot anomalies.
- **Inference**: The model (`best.pt`) runs locally on the backend via PyTorch, classifying images in milliseconds and providing confidence scores for its predictions.

## 💻 Tech Stack

- **Frontend**: Next.js (React), TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), SQLite (Local Database), Uvicorn
- **AI/ML**: PyTorch, Torchvision, Groq Cloud API (Llama 3.3)

## 🛠️ Installation & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/devkamani9313-lab/agrivision-ai.git
cd agrivision-ai
```

### 2. Backend Setup
```bash
cd backend
# Create a virtual environment (optional but recommended)
python -m venv venv
# Activate virtual environment
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Environment Setup
# Create a .env file in the backend directory and add your Groq API key:
# GROQ_API_KEY=your_groq_api_key_here

# Download Model
# Place your trained PyTorch weights file as `best.pt` in the backend directory.

# Run the API server
python main.py
```
*The backend will run at `http://127.0.0.1:8000`.*

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
*The frontend will run at `http://localhost:3000`.*

## 🔒 Security
API Keys, local SQLite databases (`agrivision.db`), and heavy ML model files (`best.pt`) are strictly excluded from the repository via `.gitignore` to ensure security and privacy.
