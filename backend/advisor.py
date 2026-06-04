import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Initialize Groq client
api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key) if api_key else None

# Local high-quality backup database for offline/fallback mode
FALLBACK_ADVISORY = {
    "tomato_early_blight": {
        "description": "Early Blight is a common fungal disease caused by Alternaria solani. It primarily affects leaves, stems, and fruits of tomatoes, potato, and eggplant.",
        "symptoms": [
            "Dark, circular spots with concentric rings (target-like pattern) on older leaves.",
            "Yellow halo surrounding the brown spots.",
            "Leaves turn completely yellow, wither, and drop off starting from the bottom of the plant."
        ],
        "severity": "Medium",
        "organic_treatment": [
            "Prune infected lower branches to increase airflow and prevent soil contact.",
            "Apply a copper-based organic spray or neem oil weekly.",
            "Mulch around the base of the plant to prevent soil spores from splashing onto leaves."
        ],
        "chemical_treatment": [
            "Apply Chlorothalonil or Mancozeb fungicides early in the morning.",
            "Use copper hydroxide sprays when weather conditions are warm and humid."
        ],
        "prevention": [
            "Rotate crops annually; do not plant tomatoes or potatoes in the same soil for 3 years.",
            "Drip-water at the roots. Never use overhead sprinklers, as wet leaves encourage fungal growth.",
            "Space plants at least 2 feet apart to ensure dry leaf canopies."
        ]
    },
    "potato_late_blight": {
        "description": "Late Blight is a highly destructive disease caused by Phytophthora infestans. It is famous for causing the Irish Potato Famine and can destroy entire fields in days.",
        "symptoms": [
            "Dark green, water-soaked spots on leaf tips and margins.",
            "White fuzzy growth of mold appearing on the underside of infected leaves in wet weather.",
            "Dark brown or purple bruising on tubers under the skin."
        ],
        "severity": "Critical",
        "organic_treatment": [
            "Harvest and destroy all infected foliage immediately.",
            "Apply compost tea sprays to boost leaf microflora defenses.",
            "Keep potato tubers deeply hilled with soil to protect them from washing spores."
        ],
        "chemical_treatment": [
            "Use systemic fungicides like Metalaxyl or Fluazinam immediately at the first sign of weather alert.",
            "Spray protectant fungicides like Mancozeb preventatively."
        ],
        "prevention": [
            "Always buy certified disease-free seed tubers.",
            "Plant resistant cultivars (like Defender or Elba).",
            "Promptly destroy volunteer potato plants and cull piles from last season."
        ]
    },
    "corn_(maize)___common_rust_": {
        "description": "Common Rust is a fungal disease caused by Puccinia sorghi, favored by cool temperatures and high relative humidity.",
        "symptoms": [
            "Elongated golden-brown to red pustules on both upper and lower leaf surfaces.",
            "Pustules rupture, releasing powdery red-orange spores.",
            "Severe cases cause leaf yellowing and premature drying."
        ],
        "severity": "Low",
        "organic_treatment": [
            "Most cases do not require treatment. Destroy severely infected plant residues post-harvest.",
            "Apply organic bio-fungicides containing Bacillus subtilis."
        ],
        "chemical_treatment": [
            "Fungicides (like Pyraclostrobin or Tebuconazole) are rarely needed unless the crop is a sensitive sweet corn or seed corn."
        ],
        "prevention": [
            "Plant rust-resistant hybrids (the most effective method).",
            "Till crop residues deep into the soil to bury surviving spores.",
            "Ensure proper drainage and plant spacing to limit leaf moisture duration."
        ]
    }
}

def generate_advisory(crop: str, disease: str) -> dict:
    """
    Generates dynamic treatment advisory from Groq LLM, with local JSON fallback.
    """
    crop_lower = crop.lower().strip()
    disease_lower = disease.lower().strip()
    lookup_key = f"{crop_lower}_{disease_lower}".replace(" ", "_")

    # If Groq client is not available or key is empty, use local fallback
    if not client or not api_key:
        print("Groq API not configured. Loading local offline fallback.")
        return FALLBACK_ADVISORY.get(lookup_key, get_generic_fallback(crop, disease))

    # Prompts Groq for structured JSON output
    prompt = f"""
    You are an expert agricultural botanist and crop disease advisor.
    Provide a detailed, farmer-friendly disease advisory for:
    Crop: {crop}
    Disease/Condition: {disease}

    Return your response EXACTLY as a JSON object with these keys:
    {{
        "description": "A 2-3 sentence simple explanation of the disease.",
        "symptoms": [
            "Bullet point 1 detailing what to look for",
            "Bullet point 2 detailing what to look for",
            "Bullet point 3"
        ],
        "severity": "Low or Medium or Critical",
        "organic_treatment": [
            "Organic/Natural remedy 1",
            "Organic/Natural remedy 2"
        ],
        "chemical_treatment": [
            "Chemical/Fungicide remedy 1",
            "Chemical/Fungicide remedy 2"
        ],
        "prevention": [
            "Preventative practice 1",
            "Preventative practice 2"
        ]
    }}

    Return ONLY the raw JSON string. Do not include any intro, markdown formatting, or explainers.
    """

    try:
        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        response_text = completion.choices[0].message.content
        advisory_data = json.loads(response_text)
        return advisory_data
        
    except Exception as e:
        print(f"Groq API call failed: {e}. Falling back to local advisory.")
        return FALLBACK_ADVISORY.get(lookup_key, get_generic_fallback(crop, disease))

def get_generic_fallback(crop: str, disease: str) -> dict:
    """
    Generates a default generic advisory if both Groq and custom fallbacks are unavailable.
    """
    is_healthy = "healthy" in disease.lower()
    
    if is_healthy:
        return {
            "description": f"The {crop} leaf appears healthy and shows no signs of active disease.",
            "symptoms": ["Leaf color is vibrant and normal.", "No visible spots, mold, or insect infestation."],
            "severity": "Low",
            "organic_treatment": ["Maintain regular watering and organic composting."],
            "chemical_treatment": ["No chemical treatments needed."],
            "prevention": ["Clean tools before working on crops.", "Monitor daily for any leaf color changes."]
        }
    
    return {
        "description": f"This leaf shows symptoms of {disease} on {crop}.",
        "symptoms": [
            "Irregular spots or lesions visible on the leaf surface.",
            "Slight discoloration or yellowing of the surrounding tissue."
        ],
        "severity": "Medium",
        "organic_treatment": [
            "Isolate the plant if potted, or prune infected leaves.",
            "Apply neem oil or organic copper soap sprays."
        ],
        "chemical_treatment": [
            "Use general-purpose broad-spectrum fungicides if the disease continues to spread."
        ],
        "prevention": [
            "Water the plants early in the morning to allow leaves to dry.",
            "Maintain clean soil hygiene and avoid handling plants when wet."
        ]
    }
