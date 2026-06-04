import os
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
from torchvision.models import efficientnet_b3, EfficientNet_B3_Weights

# 38 Sorted PlantVillage Classes
CLASS_NAMES = [
    'Apple___Apple_scab',
    'Apple___Black_rot',
    'Apple___Cedar_apple_rust',
    'Apple___healthy',
    'Blueberry___healthy',
    'Cherry_(including_sour)___Powdery_mildew',
    'Cherry_(including_sour)___healthy',
    'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
    'Corn_(maize)___Common_rust_',
    'Corn_(maize)___Northern_Leaf_Blight',
    'Corn_(maize)___healthy',
    'Grape___Black_rot',
    'Grape___Esca_(Black_Measles)',
    'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
    'Grape___healthy',
    'Orange___Haunglongbing_(Citrus_greening)',
    'Peach___Bacterial_spot',
    'Peach___healthy',
    'Pepper,_bell___Bacterial_spot',
    'Pepper,_bell___healthy',
    'Potato___Early_blight',
    'Potato___Late_blight',
    'Potato___healthy',
    'Raspberry___healthy',
    'Soybean___healthy',
    'Squash___Powdery_mildew',
    'Strawberry___Leaf_scorch',
    'Strawberry___healthy',
    'Tomato___Bacterial_spot',
    'Tomato___Early_blight',
    'Tomato___Late_blight',
    'Tomato___Leaf_Mold',
    'Tomato___Septoria_leaf_spot',
    'Tomato___Spider_mites Two-spotted_spider_mite',
    'Tomato___Target_Spot',
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus',
    'Tomato___Tomato_mosaic_virus',
    'Tomato___healthy'
]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "best.pt")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = None
is_demo_mode = True

# Define PyTorch Image Preprocessing Transforms (Same as validation set)
transform = transforms.Compose([
    transforms.Resize((300, 300)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def load_model():
    global model, is_demo_mode
    if os.path.exists(MODEL_PATH):
        print(f"Loading trained weights from {MODEL_PATH}...")
        try:
            # 1. Initialize blank EfficientNet-B3 model template
            model = efficientnet_b3(weights=None)
            
            # 2. Match the classification output classes (38)
            num_classes = len(CLASS_NAMES)
            in_features = model.classifier[1].in_features
            model.classifier[1] = nn.Linear(in_features, num_classes)
            
            # 3. Load the best.pt weights
            state_dict = torch.load(MODEL_PATH, map_location=device)
            model.load_state_dict(state_dict)
            model = model.to(device)
            model.eval()
            is_demo_mode = False
            print("AI Model loaded successfully on device:", device)
        except Exception as e:
            print(f"Error loading model weights: {e}. Falling back to Demo/Simulation Mode.")
            model = None
            is_demo_mode = True
    else:
        print(f"Weights file not found at {MODEL_PATH}.")
        print("Backend running in Demo/Simulation Mode. Place 'best.pt' in backend/ folder to enable live AI classification.")
        model = None
        is_demo_mode = True

def parse_class_name(class_name: str):
    """
    Parses 'Tomato___Early_blight' into ('Tomato', 'Early Blight')
    """
    parts = class_name.split("___")
    crop = parts[0].replace("_", " ").title()
    disease = parts[1].replace("_", " ").replace("healthy", "Healthy").title()
    return crop, disease

def predict_leaf(image_path: str):
    """
    Classifies a leaf image and returns (crop, disease, confidence, is_demo)
    """
    global model, is_demo_mode
    
    # Reload model if best.pt was just placed in the folder
    if model is None and os.path.exists(MODEL_PATH):
        load_model()
        
    if is_demo_mode or model is None:
        # SIMULATION / DEMO MODE (For testing before placing best.pt)
        # We will parse the file name to simulate realistic outputs, or return a default
        filename = os.path.basename(image_path).lower()
        if "potato" in filename:
            crop, disease = "Potato", "Late Blight"
        elif "rice" in filename:
            crop, disease = "Rice", "Blast"
        elif "corn" in filename:
            crop, disease = "Corn (Maize)", "Common Rust"
        else:
            crop, disease = "Tomato", "Early Blight"
        return crop, disease, 96.85, True

    # LIVE AI INFERENCE MODE
    try:
        image = Image.open(image_path).convert('RGB')
        image_tensor = transform(image).unsqueeze(0).to(device) # Add batch dimension

        with torch.no_grad():
            outputs = model(image_tensor)
            probabilities = torch.nn.functional.softmax(outputs[0], dim=0)
            
            confidence, predicted_idx = torch.max(probabilities, 0)
            class_name = CLASS_NAMES[predicted_idx.item()]
            
            crop, disease = parse_class_name(class_name)
            confidence_percentage = round(confidence.item() * 100, 2)
            
            return crop, disease, confidence_percentage, False
    except Exception as e:
        print(f"Error during live inference: {e}. Falling back to Demo values.")
        return "Tomato", "Early Blight", 95.0, True

# Load model on startup
load_model()
