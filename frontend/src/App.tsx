import React, { useState } from "react";
import {
  generateDinosaurName,
  generateDinosaurImage,
  getDinosaurImageStream,
  DinosaurName,
} from "./api";
import "./App.css";

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

      const imageData = await generateDinosaurImage(nameData.name);
      setAutoImage(imageData.url);
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
            <h3>{autoDinosaur.name}</h3>
            <p>{autoDinosaur.description}</p>
          </div>
        )}
        {autoImage && (
          <div className="image-container">
            <img src={autoImage} alt={autoDinosaur?.name} className="dino-image" />
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
            <img src={manualImage} alt={manualName} className="dino-image" />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
