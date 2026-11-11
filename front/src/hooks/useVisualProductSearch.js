import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Promesse partagée pour toute l'app.
 * Reste nulle au chargement de ce module : les import() dynamiques
 * ci-dessous ne s'exécutent qu'au premier appel de classifyImage
 * ou de preloadModel, jamais à l'évaluation du fichier.
 */
let mobileNetPromise = null;
let cachedModel = null;
const imageVectorCache = new Map();

/** La capture utilisateur passe devant l'indexation du catalogue. */
let priorityDepth = 0;
const indexResumes = [];

function acquirePriority() {
  priorityDepth += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    priorityDepth = Math.max(0, priorityDepth - 1);
    if (priorityDepth === 0) {
      const pending = indexResumes.splice(0);
      pending.forEach((resolve) => resolve());
    }
  };
}

function waitUntilIndexAllowed() {
  if (priorityDepth === 0) return Promise.resolve();
  return new Promise((resolve) => indexResumes.push(resolve));
}

let inferQueue = Promise.resolve();

function enqueueInfer(task) {
  const run = inferQueue.then(task, task);
  inferQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * L'URL TF Hub du paquet (@tensorflow-models/mobilenet) renvoie 404
 * depuis le déménagement vers Kaggle. Ce fichier est le même MobileNet v2
 * 1.0 / 224, au format TensorFlow.js, avec CORS ouvert.
 * inputRange [0, 1] : plage documentée par le paquet pour la v2.
 */
const MOBILENET_V2_MODEL_URL =
  "https://storage.googleapis.com/tfjs-models/savedmodel/mobilenet_v2_1.0_224/model.json";

function loadMobileNetModel() {
  if (cachedModel) return Promise.resolve(cachedModel);
  if (!mobileNetPromise) {
    mobileNetPromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      const mobilenet = await import("@tensorflow-models/mobilenet");
      const model = await mobilenet.load({
        version: 2,
        alpha: 1.0,
        modelUrl: MOBILENET_V2_MODEL_URL,
        inputRange: [0, 1],
      });
      cachedModel = model;
      return model;
    })().catch((error) => {
      mobileNetPromise = null;
      throw error;
    });
  }
  return mobileNetPromise;
}

const DESCRIPTOR_VERSION = 3;

function loadCorsImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      image.src = "";
      reject(new Error("image"));
    }, 7000);
    image.crossOrigin = "anonymous";
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("image"));
    };
    image.src = url;
  });
}

function sourceSize(source) {
  const width = source.videoWidth || source.naturalWidth || source.width || 0;
  const height = source.videoHeight || source.naturalHeight || source.height || 0;
  return { width, height };
}

function drawContain(context, source, sx, sy, sw, sh, size, fill) {
  context.fillStyle = fill;
  context.fillRect(0, 0, size, size);
  const fit = Math.min(size / sw, size / sh);
  const dw = sw * fit;
  const dh = sh * fit;
  context.drawImage(source, sx, sy, sw, sh, (size - dw) / 2, (size - dh) / 2, dw, dh);
}

/**
 * Recadre sur le produit. Le fond (bords de la photo) est ignoré,
 * pour comparer le même objet que sur une photo catalogue.
 */
function productFrame(source) {
  const { width, height } = sourceSize(source);
  const size = 224;
  const frame = document.createElement("canvas");
  frame.width = size;
  frame.height = size;
  const frameContext = frame.getContext("2d", { willReadFrequently: true });
  if (!width || !height) return frame;

  const sampleSide = 140;
  const scale = Math.min(1, sampleSide / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  const sample = document.createElement("canvas");
  sample.width = sw;
  sample.height = sh;
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  sampleContext.drawImage(source, 0, 0, sw, sh);
  const { data } = sampleContext.getImageData(0, 0, sw, sh);
  const edge = Math.max(2, Math.round(Math.min(sw, sh) * 0.1));
  const border = [];
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      if (x >= edge && y >= edge && x < sw - edge && y < sh - edge) continue;
      const index = (y * sw + x) * 4;
      border.push([data[index], data[index + 1], data[index + 2]]);
    }
  }
  const channelMedian = (channel) => {
    const values = border.map((pixel) => pixel[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] || 255;
  };
  const background = [channelMedian(0), channelMedian(1), channelMedian(2)];
  let minX = sw;
  let minY = sh;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const index = (y * sw + x) * 4;
      const distance =
        Math.abs(data[index] - background[0]) +
        Math.abs(data[index + 1] - background[1]) +
        Math.abs(data[index + 2] - background[2]);
      if (distance < 55) continue;
      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const boxWidth = maxX - minX;
  const boxHeight = maxY - minY;
  const found =
    count > sw * sh * 0.03 && boxWidth > sw * 0.12 && boxHeight > sh * 0.12 && boxWidth * boxHeight < sw * sh * 0.92;
  const fill = `rgb(${background[0]}, ${background[1]}, ${background[2]})`;
  if (!found) {
    const side = Math.min(width, height) * 0.78;
    drawContain(frameContext, source, (width - side) / 2, (height - side) / 2, side, side, size, fill);
    return frame;
  }
  const padX = boxWidth * 0.1;
  const padY = boxHeight * 0.1;
  const cropX = Math.max(0, (minX - padX) / scale);
  const cropY = Math.max(0, (minY - padY) / scale);
  const cropWidth = Math.min(width - cropX, (boxWidth + padX * 2) / scale);
  const cropHeight = Math.min(height - cropY, (boxHeight + padY * 2) / scale);
  drawContain(frameContext, source, cropX, cropY, cropWidth, cropHeight, size, fill);
  return frame;
}

function spatialColor(frame) {
  const side = 3;
  const context = frame.getContext("2d", { willReadFrequently: true });
  const { data, width, height } = context.getImageData(0, 0, frame.width, frame.height);
  const bins = new Float32Array(side * side * 3);
  const counts = new Uint16Array(side * side);
  const cellWidth = width / side;
  const cellHeight = height / side;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      if (max > 242 && min > 230) continue;
      const cellX = Math.min(side - 1, Math.floor(x / cellWidth));
      const cellY = Math.min(side - 1, Math.floor(y / cellHeight));
      const cell = cellY * side + cellX;
      bins[cell * 3] += red;
      bins[cell * 3 + 1] += green;
      bins[cell * 3 + 2] += blue;
      counts[cell] += 1;
    }
  }
  for (let cell = 0; cell < counts.length; cell += 1) {
    const count = counts[cell] || 1;
    bins[cell * 3] /= count * 255;
    bins[cell * 3 + 1] /= count * 255;
    bins[cell * 3 + 2] /= count * 255;
  }
  return normalizeVector(bins);
}

function cachedDescriptor(url) {
  const hit = imageVectorCache.get(url);
  if (hit?.version !== DESCRIPTOR_VERSION || !hit.vector || !hit.color) return null;
  return hit;
}

function normalizeVector(values) {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i] * values[i];
  const norm = Math.sqrt(sum) || 1;
  const vector = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) vector[i] = values[i] / norm;
  return vector;
}

async function describeSource(model, source) {
  return enqueueInfer(async () => {
    const frame = productFrame(source);
    const color = spatialColor(frame);
    let tensor;
    try {
      tensor = model.infer(frame, true);
    } catch {
      tensor = model.infer(frame, false);
    }
    try {
      const values = await tensor.data();
      return { version: DESCRIPTOR_VERSION, vector: normalizeVector(values), color };
    } finally {
      tensor.dispose();
    }
  });
}

/**
 * Recherche visuelle côté navigateur.
 * Aucun import TensorFlow en tête de fichier. Le modèle part au premier
 * appel de classifyImage (ou de preloadModel), puis reste en cache.
 */
export function useVisualProductSearch() {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const aliveRef = useRef(true);
  const loadingCountRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const beginLoading = useCallback(() => {
    const needsLoad = cachedModel == null;
    if (!needsLoad) return () => {};
    loadingCountRef.current += 1;
    if (aliveRef.current) setIsModelLoading(true);
    return () => {
      loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);
      if (loadingCountRef.current === 0 && aliveRef.current) setIsModelLoading(false);
    };
  }, []);

  const preloadModel = useCallback(async () => {
    const endLoading = beginLoading();
    try {
      await loadMobileNetModel();
    } catch {
      // L'échec sera retenté à la capture. Pas de log : rien à afficher tant qu'aucune photo n'est envoyée.
    } finally {
      endLoading();
    }
  }, [beginLoading]);

  const embedImage = useCallback(async (imageElementOrCanvas) => {
    if (!imageElementOrCanvas) {
      throw new Error("Image manquante pour la comparaison.");
    }
    const release = acquirePriority();
    try {
      const model = await loadMobileNetModel();
      return await describeSource(model, imageElementOrCanvas);
    } finally {
      release();
    }
  }, []);

  /**
   * Prépare les vecteurs du catalogue une seule fois.
   * Les images se téléchargent en avance, l'inférence reste une par une,
   * et une capture en cours passe devant le reste du catalogue.
   */
  const indexCatalogueImages = useCallback(async (entries, { onProgress, signal } = {}) => {
    const model = await loadMobileNetModel();
    const jobs = (Array.isArray(entries) ? entries : []).filter((entry) => entry?.url && entry?.article);
    const total = jobs.length;
    let done = 0;
    onProgress?.(0, total);

    const preload = new Map();
    const ahead = 4;
    const startLoad = (index) => {
      if (index < 0 || index >= jobs.length || preload.has(index)) return;
      const url = jobs[index].url;
      if (imageVectorCache.has(url) && cachedDescriptor(url)) {
        preload.set(index, Promise.resolve(null));
        return;
      }
      preload.set(index, loadCorsImage(url).catch(() => null));
    };
    for (let i = 0; i < Math.min(ahead, jobs.length); i += 1) startLoad(i);

    const indexed = [];
    for (let i = 0; i < jobs.length; i += 1) {
      if (signal?.aborted) break;
      await waitUntilIndexAllowed();
      if (signal?.aborted) break;
      startLoad(i + ahead);
      const { article, url } = jobs[i];
      const cached = cachedDescriptor(url);
      let vector = cached?.vector;
      let color = cached?.color;
      if (!vector) {
        const image = await preload.get(i);
        await waitUntilIndexAllowed();
        if (image && !signal?.aborted) {
          const described = await describeSource(model, image);
          vector = described.vector;
          color = described.color;
          imageVectorCache.set(url, { version: DESCRIPTOR_VERSION, vector, color });
        }
      }
      if (vector) indexed.push({ article, vector, color });
      done += 1;
      onProgress?.(done, total);
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
    }
    return indexed;
  }, []);

  const embedImageUrl = useCallback(async (url) => {
    if (!url) throw new Error("Image manquante pour la comparaison.");
    if (cachedDescriptor(url)) return cachedDescriptor(url);
    const model = await loadMobileNetModel();
    const image = await loadCorsImage(url);
    const described = await describeSource(model, image);
    imageVectorCache.set(url, described);
    return described;
  }, []);

  const classifyImage = useCallback(async (imageElementOrCanvas) => {
    if (!imageElementOrCanvas) {
      throw new Error("Image manquante pour la classification.");
    }

    const release = acquirePriority();
    const endLoading = beginLoading();
    try {
      const model = await loadMobileNetModel();
      const predictions = await enqueueInfer(() => model.classify(imageElementOrCanvas, 5));
      return predictions.map((prediction) => ({
        label: prediction.className,
        score: prediction.probability,
      }));
    } finally {
      endLoading();
      release();
    }
  }, [beginLoading]);

  return { classifyImage, embedImage, embedImageUrl, indexCatalogueImages, preloadModel, isModelLoading };
}
