import { useState } from "react";
import {
  generateDinosaurName,
  generateDinosaurImage,
  getDinosaurImageStream,
  getModelInfo,
  chatWithDinosaur,
  type DinosaurName,
  type ModelInfoResponse,
  type ChatResponse,
} from "./api";
import "./App.css";

const TOP_DINOSAURS = [
  { name: "Neuquenraptor", score: 14, temp: 0.7 },
  { name: "Bonapartesaurus", score: 14, temp: 0.7 },
  { name: "Diabloceratops", score: 14, temp: 0.7 },
  { name: "Serinosaurus", score: 14, temp: 0.7 },
  { name: "Apatodon", score: 14, temp: 0.7 },
  { name: "Europasaurus", score: 14, temp: 0.7 },
  { name: "Centrosaurus", score: 14, temp: 0.7 },
  { name: "Barrosasaurus", score: 14, temp: 0.7 },
  { name: "Sauroposeidon", score: 14, temp: 0.7 },
  { name: "Leptoceratops", score: 14, temp: 0.7 },
];

function App() {
  // Estado para la generación automática
  const [autoDinosaur, setAutoDinosaur] = useState<DinosaurName | null>(null);
  const [autoImage, setAutoImage] = useState<string | null>(null);
  const [isLoadingAuto, setIsLoadingAuto] = useState<boolean>(false);
  const [errorAuto, setErrorAuto] = useState<string | null>(null);

  // Estado para la generación manual
  const [manualName, setManualName] = useState<string>("");
  const [manualImage, setManualImage] = useState<string | null>(null);
  const [isLoadingManual, setIsLoadingManual] = useState<boolean>(false);
  const [errorManual, setErrorManual] = useState<string | null>(null);

  // Nuevo estado para info del modelo
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [isLoadingModelInfo, setIsLoadingModelInfo] = useState<boolean>(false);
  const [errorModelInfo, setErrorModelInfo] = useState<string | null>(null);

  // Add these new states
  const [topImages, setTopImages] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [errorImages, setErrorImages] = useState<Record<string, string>>({});

  // Add these new states for chat
  const [chatMessages, setChatMessages] = useState<Record<string, ChatResponse[]>>({});
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const [loadingChats, setLoadingChats] = useState<Record<string, boolean>>({});
  const [chatErrors, setChatErrors] = useState<Record<string, string>>({});

  /**
   * Maneja la generación automática de un dinosaurio.
   */
  const handleGenerateAutomatically = async () => {
    setIsLoadingAuto(true);
    setErrorAuto(null);
    setAutoDinosaur(null);
    setAutoImage(null);

    try {
      const nameData = await generateDinosaurName();
      setAutoDinosaur(nameData);

      const dino = nameData.dinosaurs[0]

      const imageData = await generateDinosaurImage(dino.name, dino.features);
      setAutoImage(imageData.image_base64);
    } catch (error) {
      setErrorAuto(
        error instanceof Error
          ? error.message
          : "Ocurrió un error desconocido."
      );
    } finally {
      setIsLoadingAuto(false);
    }
  };

  /**
   * Maneja la generación manual de la imagen de un dinosaurio.
   */
  const handleGenerateManually = () => {
    if (!manualName.trim()) {
      setErrorManual("Por favor, introduce un nombre para el dinosaurio.");
      return;
    }
    setIsLoadingManual(true);
    setErrorManual(null);
    setManualImage(null);

    // Simulación de carga y luego mostrar la imagen del stream
    // El endpoint de stream no se "llama" con fetch, sino que se usa como fuente de imagen.
    setTimeout(() => {
      setManualImage(getDinosaurImageStream(manualName));
      setIsLoadingManual(false);
    }, 1000); // Pequeño delay para simular la carga
  };

  const handleFetchModelInfo = async () => {
    setIsLoadingModelInfo(true);
    setErrorModelInfo(null);
    setModelInfo(null);
    try {
      const info = await getModelInfo();
      setModelInfo(info);
    } catch (err) {
      setErrorModelInfo(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoadingModelInfo(false);
    }
  };

  // Add this new function
  const handleGenerateTopImages = async (dinoName: string) => {
    setLoadingImages(prev => ({ ...prev, [dinoName]: true }));
    setErrorImages(prev => ({ ...prev, [dinoName]: '' }));

    try {
      const imageData = await generateDinosaurImage(dinoName,
        `A detailed description of a ${dinoName}, a unique dinosaur species`);
      setTopImages(prev => ({
        ...prev,
        [dinoName]: imageData.image_base64
      }));
    } catch (error) {
      setErrorImages(prev => ({
        ...prev,
        [dinoName]: error instanceof Error ? error.message : "Error generating image"
      }));
    } finally {
      setLoadingImages(prev => ({ ...prev, [dinoName]: false }));
    }
  };

  // Add this new function to handle chat
  const handleChat = async (dinoName: string, features: string) => {
    const question = chatInputs[dinoName]?.trim();
    if (!question) return;

    setLoadingChats(prev => ({ ...prev, [dinoName]: true }));
    setChatErrors(prev => ({ ...prev, [dinoName]: '' }));

    try {
      const response = await chatWithDinosaur(dinoName, features, question);
      setChatMessages(prev => ({
        ...prev,
        [dinoName]: [...(prev[dinoName] || []), response]
      }));
      setChatInputs(prev => ({ ...prev, [dinoName]: '' }));
    } catch (error) {
      setChatErrors(prev => ({
        ...prev,
        [dinoName]: error instanceof Error ? error.message : "Error in chat"
      }));
    } finally {
      setLoadingChats(prev => ({ ...prev, [dinoName]: false }));
    }
  };

  return (
    <div className="container">
      <h1>Generador de Dinosaurios</h1>

      {/* Sección de Generación Automática */}
      <div className="section">
        <h2>Generar Dinosaurio Automáticamente</h2>
        <button
          onClick={handleGenerateAutomatically}
          disabled={isLoadingAuto}
          className="button"
        >
          {isLoadingAuto ? "Generando..." : "Generar Dinosaurio"}
        </button>

        {isLoadingAuto && <p className="loading">Generando, por favor espera...</p>}
        {errorAuto && <p className="error">{errorAuto}</p>}

        {autoDinosaur && (
          <div className="result">
            <h3>{autoDinosaur.dinosaurs[0].name}</h3>
            <p>{autoDinosaur.dinosaurs[0].features}</p>
            <div className="chat-section">
              <h4>Chat con {autoDinosaur.dinosaurs[0].name}</h4>
              <div className="chat-messages">
                {chatMessages[autoDinosaur.dinosaurs[0].name]?.map((msg, index) => (
                  <div key={index} className="chat-message">
                    <p className="chat-answer">{msg.answer}</p>
                  </div>
                ))}
              </div>
              <div className="chat-input-container">
                <input
                  type="text"
                  value={chatInputs[autoDinosaur.dinosaurs[0].name] || ''}
                  onChange={(e) => setChatInputs(prev => ({
                    ...prev,
                    [autoDinosaur.dinosaurs[0].name]: e.target.value
                  }))}
                  placeholder="Hazle una pregunta..."
                  className="chat-input"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleChat(
                        autoDinosaur.dinosaurs[0].name,
                        autoDinosaur.dinosaurs[0].features
                      );
                    }
                  }}
                />
                <button
                  onClick={() => handleChat(
                    autoDinosaur.dinosaurs[0].name,
                    autoDinosaur.dinosaurs[0].features
                  )}
                  disabled={loadingChats[autoDinosaur.dinosaurs[0].name]}
                  className="chat-button"
                >
                  {loadingChats[autoDinosaur.dinosaurs[0].name] ? "Enviando..." : "Enviar"}
                </button>
              </div>
              {chatErrors[autoDinosaur.dinosaurs[0].name] && (
                <p className="error">{chatErrors[autoDinosaur.dinosaurs[0].name]}</p>
              )}
            </div>
          </div>

        )}
        {autoImage && (
          <div className="image-container">
            <img
              src={`data:image/png;base64,${autoImage}`}
              alt="Generated dinosaur"
              className="dino-image"
            />
          </div>
        )}
      </div>

      {/* Sección de Generación Manual */}
      <div className="section">
        <h2>Generar Imagen Manualmente</h2>
        <input
          type="text"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          placeholder="Escribe un nombre de dinosaurio"
          className="input"
        />
        <button
          onClick={handleGenerateManually}
          disabled={isLoadingManual}
          className="button"
        >
          {isLoadingManual ? "Generando..." : "Generar Imagen por Nombre"}
        </button>

        {isLoadingManual && <p className="loading">Generando imagen...</p>}
        {errorManual && <p className="error">{errorManual}</p>}

        {manualImage && (
          <div className="image-container">
            <img
              src={`data:image/png;base64,${manualImage}`}
              alt="Generated dinosaur"
              className="dino-image"
            />
          </div>
        )}
      </div>

      {/* Sección: Información del modelo */}
      <div className="section">
        <h2>Info del Modelo</h2>
        <button onClick={handleFetchModelInfo} disabled={isLoadingModelInfo} className="button">
          {isLoadingModelInfo ? "Cargando..." : "Obtener Info del Modelo"}
        </button>

        {isLoadingModelInfo && <p className="loading">Consultando modelo...</p>}
        {errorModelInfo && <p className="error">{errorModelInfo}</p>}

        {modelInfo && (
          <div className="result">
            <h3>{modelInfo.model_name}</h3>
            <p>Tipo: {modelInfo.model_type}</p>

            {/* Mostrar algunos campos importantes si existen */}
            {modelInfo.architecture?.total_params && (
              <p>Parámetros totales: {modelInfo.architecture.total_params}</p>
            )}
            {modelInfo.vocabulary && (
              <p>Vocab size: {modelInfo.vocabulary.size ?? "N/A"}</p>
            )}

            {/* Fallback: mostrar JSON legible */}
            <details style={{ marginTop: 8 }}>
              <summary>Mostrar JSON completo</summary>
              <pre style={{ maxHeight: 280, overflow: "auto" }}>
                {JSON.stringify(modelInfo, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
      {modelInfo && (
        <div className="model-info-container">
          <div className="model-header">
            <h3>{modelInfo.model_name}</h3>
            <span className="model-type-badge">{modelInfo.model_type}</span>
          </div>

          <div className="model-stats-grid">
            {modelInfo.architecture?.total_params && (
              <div className="stat-card">
                <span className="stat-label">Total Parámetros</span>
                <span className="stat-value">
                  {Number(modelInfo.architecture.total_params).toLocaleString()}
                </span>
              </div>
            )}

            {modelInfo.vocabulary?.size && (
              <div className="stat-card">
                <span className="stat-label">Tamaño del Vocabulario</span>
                <span className="stat-value">
                  {Number(modelInfo.vocabulary.size).toLocaleString()}
                </span>
              </div>
            )}

            {modelInfo.performance?.accuracy && (
              <div className="stat-card">
                <span className="stat-label">Precisión</span>
                <span className="stat-value">
                  {(modelInfo.performance.accuracy * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>

          <details className="model-details">
            <summary>Información Detallada</summary>
            <div className="details-grid">
              {modelInfo.training_info && (
                <div className="detail-section">
                  <h4>Información de Entrenamiento</h4>
                  <pre>{JSON.stringify(modelInfo.training_info, null, 2)}</pre>
                </div>
              )}

              {modelInfo.architecture && (
                <div className="detail-section">
                  <h4>Arquitectura</h4>
                  <pre>{JSON.stringify(modelInfo.architecture, null, 2)}</pre>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* Nueva sección: Imágenes de los mejores dinosaurios
    <div className="section">
      <h2>Mejores Dinosaurios</h2>
      <div className="top-dinosaurs-grid">
        {TOP_DINOSAURS.map((dino) => (
          <div key={dino.name} className="top-dino-card">
            <h3>{dino.name}</h3>
            <button
              onClick={() => handleGenerateTopImages(dino.name)}
              disabled={loadingImages[dino.name]}
              className="button"
            >
              {loadingImages[dino.name] ? "Cargando..." : "Generar Imagen"}
            </button>

            {errorImages[dino.name] && <p className="error">{errorImages[dino.name]}</p>}

            {topImages[dino.name] && (
              <div className="image-container">
                <img 
                  src={`data:image/png;base64,${topImages[dino.name]}`} 
                  alt={`Imagen de ${dino.name}`} 
                  className="dino-image" 
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div> */}

      {/* Sección: Top 10 Ejemplos */}
      <div className="section">
        <h2>Top 10 Mejores Ejemplos</h2>
        <div className="top-dinos-grid">
          {TOP_DINOSAURS.map((dino) => (
            <div key={dino.name} className="dino-card">
              <div className="dino-info">
                <h3>{dino.name}</h3>
                <div className="dino-stats">
                  <span className="dino-score">Score: {dino.score}</span>
                  <span className="dino-temp">Temp: {dino.temp}</span>
                </div>
                <button
                  onClick={() => handleGenerateTopImages(dino.name)}
                  disabled={loadingImages[dino.name]}
                  className="button"
                >
                  {loadingImages[dino.name] ? "Generando..." : "Generar Imagen"}
                </button>
                {errorImages[dino.name] && (
                  <p className="error">{errorImages[dino.name]}</p>
                )}
                {topImages[dino.name] && (
                  <div className="image-container">
                    <img
                      src={`data:image/png;base64,${topImages[dino.name]}`}
                      alt={`Generated ${dino.name}`}
                      className="dino-image"
                    />
                  </div>
                )}
                <div className="chat-section">
                  <div className="chat-messages">
                    {chatMessages[dino.name]?.map((msg, index) => (
                      <div key={index} className="chat-message">
                        <p className="chat-answer">{msg.answer}</p>
                      </div>
                    ))}
                  </div>
                  <div className="chat-input-container">
                    <input
                      type="text"
                      value={chatInputs[dino.name] || ''}
                      onChange={(e) => setChatInputs(prev => ({
                        ...prev,
                        [dino.name]: e.target.value
                      }))}
                      placeholder="Hazle una pregunta..."
                      className="chat-input"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleChat(dino.name, `A ${dino.name} is a unique dinosaur species`);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleChat(dino.name, `A ${dino.name} is a unique dinosaur species`)}
                      disabled={loadingChats[dino.name]}
                      className="chat-button"
                    >
                      {loadingChats[dino.name] ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                  {chatErrors[dino.name] && (
                    <p className="error">{chatErrors[dino.name]}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
