// Definición de la URL base de la API
const API_BASE = "http://localhost:8000";

// Tipos para las respuestas de la API
export interface DinosaurName {
  name: string;
  description: string;
}

export interface DinosaurImage {
  url: string; // Puede ser una URL o un base64 string
}

/**
 * Llama al endpoint para generar un nombre y descripción de dinosaurio.
 * @returns Una promesa que se resuelve con el nombre y descripción del dinosaurio.
 */
export const generateDinosaurName = async (): Promise<DinosaurName> => {
  const response = await fetch(`${API_BASE}/generate/names`, {
    method: "POST",
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
export const generateDinosaurImage = async (name: string): Promise<DinosaurImage> => {
  const response = await fetch(`${API_BASE}/generate/image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
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
