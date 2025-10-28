from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import numpy as np
import tensorflow as tf
from tensorflow import keras
import torch
from diffusers import AmusedPipeline
from PIL import Image
import io
import base64
import json
import logging
from datetime import datetime
import os
import requests
from langchain_core.prompts import PromptTemplate
from langchain_ollama import OllamaLLM
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel, Field


# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURACIÓN DE LA API
# ============================================================================

app = FastAPI(
    title="Dinosaur Generator API",
    description="API para generar nombres e imágenes de dinosaurios usando IA",
    version="1.0.0"
)

# Configurar CORS para permitir requests desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# MODELOS PYDANTIC PARA REQUESTS/RESPONSES
# ============================================================================

class NameGenerationRequest(BaseModel):
    num_names: int = Field(default=1, ge=1, le=20, description="Número de nombres a generar")
    sampling_method: str = Field(default="top_p", description="Método de muestreo: temperature, top_k, top_p")
    temperature: float = Field(default=1.0, ge=0.1, le=5.0, description="Temperatura para muestreo")
    top_k: int = Field(default=5, ge=1, le=20, description="Top-K para muestreo")
    top_p: float = Field(default=0.9, ge=0.1, le=1.0, description="Top-P para muestreo")
    min_length: int = Field(default=6, ge=3, le=10, description="Longitud mínima del nombre")
    max_length: int = Field(default=18, ge=10, le=30, description="Longitud máxima del nombre")

class DinosaurName(BaseModel):
    name: str
    features: str
    score: float
    generation_params: Dict

class NameGenerationResponse(BaseModel):
    success: bool
    count: int
    dinosaurs: List[DinosaurName]
    timestamp: str

class ImageGenerationRequest(BaseModel):
    name: str = Field(..., description="Nombre del dinosaurio")
    features: str = Field(..., description="Características del dinosaurio")
    num_inference_steps: int = Field(default=12, ge=8, le=30, description="Pasos de inferencia")
    height: int = Field(default=512, ge=256, le=1024, description="Alto de la imagen")
    width: int = Field(default=512, ge=256, le=1024, description="Ancho de la imagen")
    seed: Optional[int] = Field(default=None, description="Semilla para reproducibilidad")

class ImageGenerationResponse(BaseModel):
    success: bool
    name: str
    image_base64: str
    format: str
    dimensions: Dict[str, int]
    timestamp: str

class ModelInfoResponse(BaseModel):
    model_name: str
    model_type: str
    architecture: Dict
    training_info: Dict
    vocabulary: Dict
    performance: Dict

class HealthResponse(BaseModel):
    status: str
    rnn_model_loaded: bool
    diffusion_model_loaded: bool
    device: str
    timestamp: str

class ChatRequest(BaseModel):
    dinosaur_name: str
    features: str
    question: str = Field(..., description="Question to ask about the dinosaur")

class ChatResponse(BaseModel):
    success: bool
    dinosaur_name: str
    answer: str
    timestamp: str

# ============================================================================
# VARIABLES GLOBALES Y CONFIGURACIÓN
# ============================================================================

class ModelManager:
    def __init__(self):
        self.rnn_model = None
        self.diffusion_pipe = None
        self.char_to_idx = None
        self.idx_to_char = None
        self.vocab_size = None
        self.max_length = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_info = {}
        
    def load_rnn_model(self, model_path: str = "dinosaur_name_model.h5"):
        """Carga el modelo RNN guardado"""
        try:
            logger.info(f"Cargando modelo RNN desde {model_path}...")
            self.rnn_model = keras.models.load_model(model_path)
            
            # Cargar metadatos (asumiendo que fueron guardados)
            metadata_path = model_path.replace('.h5', '_metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    self.char_to_idx = metadata['char_to_idx']
                    self.idx_to_char = {int(k): v for k, v in metadata['idx_to_char'].items()}
                    self.vocab_size = metadata['vocab_size']
                    self.max_length = metadata['max_length']
                    self.model_info = metadata.get('model_info', {})
            else:
                # Si no hay metadata, crear vocabulario básico
                self._initialize_default_vocab()
            
            logger.info("✅ Modelo RNN cargado exitosamente")
            return True
        except Exception as e:
            logger.error(f"❌ Error cargando modelo RNN: {e}")
            self._initialize_default_vocab()  # Fallback
            return False
    
    def _initialize_default_vocab(self):
        """Inicializa vocabulario por defecto si no hay metadata"""
        chars = ['\t', '\n'] + list('abcdefghijklmnopqrstuvwxyz')
        self.char_to_idx = {ch: i for i, ch in enumerate(chars)}
        self.idx_to_char = {i: ch for i, ch in enumerate(chars)}
        self.vocab_size = len(chars)
        self.max_length = 25
        
    def load_diffusion_model(self, model_name: str = "amused/amused-512"):
        """Carga el modelo de difusión"""
        try:
            logger.info(f"Cargando modelo de difusión {model_name}...")
            self.diffusion_pipe = AmusedPipeline.from_pretrained(
                model_name,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                variant="fp16" if self.device == "cuda" else None
            )
            self.diffusion_pipe = self.diffusion_pipe.to(self.device)
            
            if self.device == "cuda":
                self.diffusion_pipe.enable_attention_slicing()
                self.diffusion_pipe.enable_vae_slicing()
            
            logger.info("✅ Modelo de difusión cargado exitosamente")
            return True
        except Exception as e:
            logger.error(f"❌ Error cargando modelo de difusión: {e}")
            return False

# Instancia global del gestor de modelos
model_manager = ModelManager()

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def sample_with_temperature(predictions, temperature=1.0):
    """Muestreo con temperatura"""
    predictions = np.asarray(predictions).astype('float64')
    predictions = np.log(predictions + 1e-10) / temperature
    exp_preds = np.exp(predictions)
    predictions = exp_preds / np.sum(exp_preds)
    probas = np.random.multinomial(1, predictions, 1)
    return np.argmax(probas)

def sample_top_k(predictions, k=5):
    """Muestreo Top-K"""
    sorted_indices = np.argsort(predictions)[::-1]
    top_k_indices = sorted_indices[:k]
    top_k_probs = predictions[top_k_indices]
    top_k_probs = top_k_probs / np.sum(top_k_probs)
    return np.random.choice(top_k_indices, p=top_k_probs)

def sample_top_p(predictions, p=0.9):
    """Muestreo Top-P (nucleus sampling)"""
    sorted_indices = np.argsort(predictions)[::-1]
    sorted_probs = predictions[sorted_indices]
    cumulative_probs = np.cumsum(sorted_probs)
    cutoff_index = np.where(cumulative_probs > p)[0]
    if len(cutoff_index) > 0:
        cutoff_index = cutoff_index[0] + 1
    else:
        cutoff_index = len(sorted_indices)
    nucleus_indices = sorted_indices[:cutoff_index]
    nucleus_probs = predictions[nucleus_indices]
    nucleus_probs = nucleus_probs / np.sum(nucleus_probs)
    return np.random.choice(nucleus_indices, p=nucleus_probs)

def generate_dinosaur_name(
    model,
    char_to_idx,
    idx_to_char,
    max_length,
    sampling_method='top_p',
    temperature=1.0,
    top_k=5,
    top_p=0.9
):
    """Genera un nombre de dinosaurio"""
    START_TOKEN = '\t'
    END_TOKEN = '\n'
    
    name = [char_to_idx[START_TOKEN]]
    
    for _ in range(max_length):
        x = np.zeros((1, max_length - 1))
        for t, idx in enumerate(name[-min(len(name), max_length - 1):]):
            x[0, t] = idx
        
        predictions = model.predict(x, verbose=0)[0]
        
        # Aplicar método de muestreo
        if sampling_method == 'temperature':
            next_idx = sample_with_temperature(predictions, temperature)
        elif sampling_method == 'top_k':
            next_idx = sample_top_k(predictions, k=top_k)
        elif sampling_method == 'top_p':
            next_idx = sample_top_p(predictions, p=top_p)
        else:
            next_idx = np.argmax(predictions)
        
        if idx_to_char[next_idx] == END_TOKEN:
            break
        
        name.append(next_idx)
    
    return ''.join([idx_to_char[i] for i in name[1:]])

def generate_features(name: str) -> str:
    """Genera características descriptivas para un dinosaurio usando Ollama"""
    
    # Replace with your ngrok URL
    OLLAMA_ENDPOINT = "https://muffy-nolan-postnasal.ngrok-free.dev/api/generate"
    
    prompt = f"""Create a concise description of a dinosaur named {name}. 
    Include these aspects:
    - Diet (carnivore/herbivore)
    - Physical features (scales, spikes, horns, etc.)
    - Size and build
    - Habitat or behavior
    Keep it to 1-2 sentences only.
    """

    try:
        headers = {
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "llama2",
            "prompt": prompt,
            "stream": False
        }

        response = requests.post(OLLAMA_ENDPOINT, headers=headers, json=data)
        
        if response.status_code == 200:
            result = response.json()
            return result['response'].strip()
        else:
            return _generate_fallback_features()
            
    except Exception as e:
        logger.error(f"Error generating features with Ollama: {e}")
        return _generate_fallback_features()

def _generate_fallback_features() -> str:
    """Fallback method using templates when API fails"""
    feature_templates = [
        "carnívoro ágil con garras afiladas y escamas {color}, cazador veloz de tamaño {size}",
        "herbívoro masivo con {feature} prominente, piel {color}, cuadrúpedo robusto"
    ]
    
    colors = ["verde oscuro", "gris azulado", "rojo carmesí"]
    features = ["cresta dorsal", "cola con púas", "cuerno frontal"]
    sizes = ["mediano", "grande", "colosal"]
    
    template = np.random.choice(feature_templates)
    features_dict = {
        'color': np.random.choice(colors),
        'feature': np.random.choice(features),
        'size': np.random.choice(sizes)
    }
    
    return template.format(**features_dict)

def score_name(name: str) -> float:
    """Calcula un puntaje de calidad para el nombre"""
    score = 0.0
    
    # Longitud ideal
    if 8 <= len(name) <= 15:
        score += 3.0
    elif 6 <= len(name) <= 18:
        score += 2.0
    else:
        score += 1.0
    
    # Terminaciones típicas
    endings = ['saurus', 'don', 'raptor', 'ceratops', 'titan', 'aurus', 'ops']
    for ending in endings:
        if name.endswith(ending):
            score += 4.0
            break
    
    # Pronunciabilidad
    vowels = set('aeiou')
    alternating = sum(1 for i in range(len(name) - 1) 
                     if (name[i] in vowels) != (name[i+1] in vowels))
    score += min(alternating * 0.5, 3.0)
    
    return round(score, 2)

def image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convierte imagen PIL a base64"""
    buffered = io.BytesIO()
    image.save(buffered, format=format)
    return base64.b64encode(buffered.getvalue()).decode()

# ============================================================================
# ENDPOINTS DE LA API
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Carga los modelos al iniciar la aplicación"""
    logger.info("🚀 Iniciando API de Generación de Dinosaurios...")
    
    # Cargar modelo RNN
    model_manager.load_rnn_model("dino_model.h5")
    
    # Cargar modelo de difusión (opcional, puede ser pesado)
    model_manager.load_diffusion_model("amused/amused-512")
    
    logger.info("✅ API lista para recibir requests")

@app.get("/", response_model=Dict)
async def root():
    """Endpoint raíz con información de la API"""
    return {
        "message": "Dinosaur Generator API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "model_info": "/model/info",
            "generate_names": "/generate/names",
            "generate_image": "/generate/image",
            "docs": "/docs"
        }
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Verifica el estado de salud de la API"""
    return HealthResponse(
        status="healthy",
        rnn_model_loaded=model_manager.rnn_model is not None,
        diffusion_model_loaded=model_manager.diffusion_pipe is not None,
        device=model_manager.device,
        timestamp=datetime.now().isoformat()
    )

@app.get("/model/info", response_model=ModelInfoResponse)
async def get_model_info():
    """Retorna información detallada del modelo RNN"""
    if model_manager.rnn_model is None:
        raise HTTPException(status_code=503, detail="Modelo RNN no cargado")
    
    model = model_manager.rnn_model
    
    # Extraer arquitectura del modelo
    architecture = {
        "layers": [],
        "total_params": int(model.count_params()),
        "trainable_params": int(sum([tf.size(w).numpy() for w in model.trainable_weights]))
    }
    
    for layer in model.layers:
        layer_info = {
            "name": layer.name,
            "type": layer.__class__.__name__,
            # "output_shape": str(layer.output_shape),
        }
        
        # Agregar configuración específica según el tipo de capa
        if isinstance(layer, keras.layers.Embedding):
            layer_info["input_dim"] = layer.input_dim
            layer_info["output_dim"] = layer.output_dim
        elif isinstance(layer, keras.layers.LSTM):
            layer_info["units"] = layer.units
            layer_info["return_sequences"] = layer.return_sequences
        elif isinstance(layer, keras.layers.Dense):
            layer_info["units"] = layer.units
            layer_info["activation"] = layer.activation.__name__
        elif isinstance(layer, keras.layers.Dropout):
            layer_info["rate"] = layer.rate
        
        architecture["layers"].append(layer_info)
    
    return ModelInfoResponse(
        model_name="Dinosaur Name Generator RNN",
        model_type="Character-level LSTM",
        architecture=architecture,
        training_info=model_manager.model_info.get('training_info', {
            "epochs": "Unknown",
            "optimizer": "adam",
            "loss": "sparse_categorical_crossentropy"
        }),
        vocabulary={
            "size": model_manager.vocab_size,
            "characters": ''.join(model_manager.char_to_idx.keys()),
            "max_sequence_length": model_manager.max_length
        },
        performance=model_manager.model_info.get('performance', {
            "final_loss": "N/A",
            "final_accuracy": "N/A"
        })
    )

@app.post("/generate/names", response_model=NameGenerationResponse)
async def generate_names(request: NameGenerationRequest):
    """Genera nombres de dinosaurios con características"""
    if model_manager.rnn_model is None:
        raise HTTPException(status_code=503, detail="Modelo RNN no cargado")
    
    try:
        generated_dinosaurs = []
        attempts = 0
        max_attempts = request.num_names * 10
        
        while len(generated_dinosaurs) < request.num_names and attempts < max_attempts:
            # Generar nombre
            name = generate_dinosaur_name(
                model=model_manager.rnn_model,
                char_to_idx=model_manager.char_to_idx,
                idx_to_char=model_manager.idx_to_char,
                max_length=model_manager.max_length,
                sampling_method=request.sampling_method,
                temperature=request.temperature,
                top_k=request.top_k,
                top_p=request.top_p
            )
            
            # Validar nombre
            if (request.min_length <= len(name) <= request.max_length and 
                name not in [d.name for d in generated_dinosaurs]):
                
                # Capitalizar nombre
                capitalized_name = name.capitalize()
                
                # Generar características
                features = generate_features(capitalized_name)
                
                # Calcular score
                score = score_name(name)
                
                # Crear objeto dinosaurio
                dino = DinosaurName(
                    name=capitalized_name,
                    features=features,
                    score=score,
                    generation_params={
                        "sampling_method": request.sampling_method,
                        "temperature": request.temperature,
                        "top_k": request.top_k,
                        "top_p": request.top_p
                    }
                )
                
                generated_dinosaurs.append(dino)
            
            attempts += 1
        
        # Ordenar por score (mayor a menor)
        generated_dinosaurs.sort(key=lambda x: x.score, reverse=True)
        
        return NameGenerationResponse(
            success=True,
            count=len(generated_dinosaurs),
            dinosaurs=generated_dinosaurs,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error generando nombres: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate/image", response_model=ImageGenerationResponse)
async def generate_image(request: ImageGenerationRequest):
    """Genera imagen de un dinosaurio"""
    if model_manager.diffusion_pipe is None:
        raise HTTPException(
            status_code=503,
            detail="Modelo de difusión no cargado. Ejecuta model_manager.load_diffusion_model()"
        )
    
    try:
        # Crear prompt optimizado
        prompt = (
            f"A prehistoric dinosaur called {request.name}, {request.features}, "
            f"realistic digital art, detailed scales, natural prehistoric environment, "
            f"high quality illustration, dramatic lighting, photorealistic"
        )
        
        # Generar imagen
        generator = None
        if request.seed is not None:
            generator = torch.Generator(device=model_manager.device).manual_seed(request.seed)
        
        image = model_manager.diffusion_pipe(
            prompt=prompt,
            num_inference_steps=request.num_inference_steps,
            height=request.height,
            width=request.width,
            generator=generator
        ).images[0]
        
        # Convertir a base64
        image_base64 = image_to_base64(image, format="PNG")
        
        # Limpiar memoria
        if model_manager.device == "cuda":
            torch.cuda.empty_cache()
        
        return ImageGenerationResponse(
            success=True,
            name=request.name,
            image_base64=image_base64,
            format="PNG",
            dimensions={"height": request.height, "width": request.width},
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error generando imagen: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    


@app.post("/chat", response_model=ChatResponse)
async def chat_with_dinosaur(request: ChatRequest):
    """Permite chatear con un dinosaurio específico usando sus características"""
    try:
        # Initialize Ollama LLM
        llm = OllamaLLM(
            base_url="https://muffy-nolan-postnasal.ngrok-free.dev/api",
            model="llama2"
        )

        # Create prompt template
        chat_template = PromptTemplate(
            input_variables=["name", "features", "question"],
            template="""You are {name}, a dinosaur with these characteristics: {features}.
            Answer the following question as if you were this dinosaur, in first person.
            Keep the answer concise (2-3 sentences) and relevant to your characteristics.
            
            Question: {question}
            
            Answer:"""
        )

        # Create LLMChain
        chain = chat_template | llm | StrOutputParser()

        # Generate response
        response = chain.invoke({
            "name": request.dinosaur_name,
            "features": request.features,
            "question": request.question
        })

        return ChatResponse(
            success=True,
            dinosaur_name=request.dinosaur_name,
            answer=response.strip(),
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating chat response: {str(e)}"
        )

@app.get("/generate/image/stream/{dinosaur_name}")
async def generate_image_stream(
    dinosaur_name: str,
    features: str = "carnívoro prehistórico con escamas verdes",
    steps: int = 12,
    height: int = 512,
    width: int = 512
):
    """Genera y retorna imagen como stream (sin base64)"""
    if model_manager.diffusion_pipe is None:
        raise HTTPException(status_code=503, detail="Modelo de difusión no cargado")
    
    try:
        prompt = (
            f"A prehistoric dinosaur called {dinosaur_name}, {features}, "
            f"realistic digital art, detailed, high quality"
        )
        
        image = model_manager.diffusion_pipe(
            prompt=prompt,
            num_inference_steps=steps,
            height=height,
            width=width
        ).images[0]
        
        # Convertir a bytes
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        return StreamingResponse(img_byte_arr, media_type="image/png")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║     🦖 DINOSAUR GENERATOR API - BACKEND SERVER 🦖        ║
    ╚═══════════════════════════════════════════════════════════╝
    
    Servidor FastAPI para generación de nombres e imágenes
    
    Endpoints disponibles:
    - GET  /                    → Información de la API
    - GET  /health              → Estado del servidor
    - GET  /model/info          → Descripción del modelo
    - POST /generate/names      → Generar nombres
    - POST /generate/image      → Generar imagen
    - GET  /docs                → Documentación interactiva (Swagger)
    
    Iniciando servidor en http://localhost:8000
    """)
    
    uvicorn.run(
        "main:app",  
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload en desarrollo
        log_level="info"
    )