// Definición de la URL base de la API
const API_BASE = "http://localhost:8000";

// Tipos para las respuestas de la API
export interface DinosaurName {
  success: boolean
  count: number
  dinosaurs : {
    name : string
    features : string
    score: 0
    generation_params :{}
  }[]
  timestamp : string
}

export interface DinosaurImage {
  success: boolean;
  name: string;
  image_base64: string
}

export interface ModelInfoResponse {
  model_name: string;
  model_type: string;
  architecture: any;
  training_info: any;
  vocabulary: any;
  performance: any;
}

/**
 * Llama al endpoint para generar un nombre y descripción de dinosaurio.
 * @returns Una promesa que se resuelve con el nombre y descripción del dinosaurio.
 */
export const generateDinosaurName = async (): Promise<DinosaurName> => {
  const requestBody = {
    num_names: 1,
    sampling_method: "top_p",
    temperature: 1,
    top_k: 5,
    top_p: 0.9,
    min_length: 6,
    max_length: 18
  };

  const response = await fetch(`${API_BASE}/generate/names`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error("Error al generar el nombre del dinosaurio.");
  }
  return response.json();
};

/**
 * Llama al endpoint para generar una imagen de dinosaurio a partir de un nombre.
 * @param name - El nombre del dinosaurio.
 * @returns Una promesa que se resuelve con la URL de la imagen.
 */
export const generateDinosaurImage = async (name: string, features:string): Promise<DinosaurImage> => {
  const requestBody = {
    name: name,
    features: features,
    num_inference_steps: 12,
    height: 512,
    width: 512,
    seed: 0
  }

  const response = await fetch(`${API_BASE}/generate/image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    throw new Error("Error al generar la imagen del dinosaurio.");
  }
  return response.json();
};

/**
 * Llama al endpoint para generar una imagen de dinosaurio por stream.
 * @param name - El nombre del dinosaurio.
 * @returns La URL del endpoint de stream.
 */
export const getDinosaurImageStream = (name: string): string => {
  return `${API_BASE}/generate/image/stream/${name}`;
};

export const getModelInfo = async (): Promise<ModelInfoResponse> => {
  const response = await fetch(`${API_BASE}/model/info`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Error fetching model info.");
  }
  return response.json();
};


// Add these interfaces
export interface ChatRequest {
  dinosaur_name: string;
  features: string;
  question: string;
}

export interface ChatResponse {
  success: boolean;
  dinosaur_name: string;
  answer: string;
  timestamp: string;
}

// Add this function
export const chatWithDinosaur = async (
  name: string,
  features: string,
  question: string
): Promise<ChatResponse> => {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dinosaur_name: name,
      features: features,
      question: question,
    }),
  });

  if (!response.ok) {
    throw new Error("Error chatting with dinosaur");
  }
  return response.json();
};