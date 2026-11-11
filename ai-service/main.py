import os, sys, hmac, logging, threading, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fastapi import FastAPI, APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from slotting_ml import run_slotting, run_slotting_audit
from load_ml import run_load_optimization
from forecast_ml import run_forecast, run_forecast_batch, ExponentialSmoothing
from anomaly_ml import run_anomalies, train_models, model_status
from expiry_waste_ml import run_expiry_waste

# Journal : méthode, chemin, statut, durée. Jamais le corps ni la clé.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("stokify.ai")

AI_ENV = os.getenv("AI_ENV", "development")
AI_KEY = os.getenv("AI_SERVICE_KEY", "")
if AI_ENV == "production" and len(AI_KEY) < 32:
    raise RuntimeError("AI_SERVICE_KEY (>=32 caractères) obligatoire en production")

try:
    _HEAVY_MAX = max(1, int(os.getenv("AI_MAX_HEAVY", "2")))
except ValueError:
    _HEAVY_MAX = 2

_HEAVY = threading.BoundedSemaphore(_HEAVY_MAX)
_BUSY = 0
_BUSY_LOCK = threading.Lock()

# Plafond anti-payload : listes de mouvements, articles, lots, pairs.
_MAX_ITEMS = 5000


class Busy(Exception):
    """Plus aucun slot de calcul disponible."""


def require_key(x_ai_key: str = Header(default="")):
    """Clé partagée Node ↔ FastAPI. En dev sans clé, l'accès reste ouvert."""
    if not AI_KEY:  # dev local sans clé : autorisé
        return
    provided = x_ai_key or ""
    try:
        ok = hmac.compare_digest(provided.encode(), AI_KEY.encode())
    except Exception:
        ok = False
    if not ok:
        raise HTTPException(status_code=401, detail="clé IA invalide")


def heavy():
    """Réserve un slot CPU. Au-delà, 429 : le threadpool et /health restent libres."""
    global _BUSY
    if not _HEAVY.acquire(timeout=1.0):
        raise HTTPException(status_code=429, detail="service IA occupé")
    try:
        with _BUSY_LOCK:
            _BUSY += 1
        yield
    finally:
        with _BUSY_LOCK:
            _BUSY = max(0, _BUSY - 1)
        _HEAVY.release()


def _busy_slots() -> int:
    with _BUSY_LOCK:
        return _BUSY


app = FastAPI(title="Stokify AI Service")
public = APIRouter()
secured = APIRouter(dependencies=[Depends(require_key)])


@app.middleware("http")
async def journal_requetes(request: Request, call_next):
    debut = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duree_ms = int((time.perf_counter() - debut) * 1000)
        log.info("%s %s %s %s", request.method, request.url.path, 500, duree_ms)
        raise
    duree_ms = int((time.perf_counter() - debut) * 1000)
    log.info("%s %s %s %s", request.method, request.url.path, response.status_code, duree_ms)
    return response


@public.get("/health")
async def health():
    # async + lecture d'un compteur : reste instantané pendant un entraînement.
    return {
        "status": "ok",
        "busy": _busy_slots(),
        "service": "stokify-ai-service",
        "capabilities": [
            "forecast",
            "forecast-nbeats",
            "forecast-hybrid",
            "forecast-batch",
            "anomalies",
            "anomalies-ensemble",
            "anomalies-autoencoder",
            "anomalies-supervised",
            "load-optimization",
            "slotting",
            "expiry-waste",
        ],
        "statsmodels": ExponentialSmoothing is not None,
        "nbeats": True,
        "anomalies": True,
    }


@public.get("/ready")
def ready():
    """Les modèles chargés doivent répondre, sans lancer d'entraînement."""
    try:
        status = model_status(None)
        if not isinstance(status, dict) or "unsupervised" not in status:
            raise RuntimeError("statut anomalies invalide")
        return {
            "status": "ready",
            "statsmodels": ExponentialSmoothing is not None,
            "nbeats": True,
            "anomalies": True,
            "persisted": bool(status.get("persisted")),
        }
    except Exception:
        return JSONResponse(status_code=503, content={"status": "not_ready"})


class ForecastPeer(BaseModel):
    articleId: Optional[int] = None
    code: Optional[str] = None
    historique: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)


class ForecastRequest(BaseModel):
    article_id: int
    historique: List[dict] = Field(max_length=_MAX_ITEMS)
    horizon: int = 3
    peers: Optional[List[ForecastPeer]] = Field(default=None, max_length=_MAX_ITEMS)
    features: Optional[dict] = None
    articleCode: Optional[str] = None
    articleLibelle: Optional[str] = None


class ForecastBatchItem(BaseModel):
    article_id: Optional[int] = None
    articleId: Optional[int] = None
    code: Optional[str] = None
    libelle: Optional[str] = None
    historique: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    familleId: Optional[int] = None
    stockActuel: Optional[float] = None
    features: Optional[dict] = None


class ForecastBatchRequest(BaseModel):
    items: List[ForecastBatchItem] = Field(max_length=_MAX_ITEMS)
    peers: Optional[List[ForecastPeer]] = Field(default=None, max_length=_MAX_ITEMS)
    horizon: int = 3


class AnomalyRequest(BaseModel):
    mouvements: List[dict] = Field(max_length=_MAX_ITEMS)
    labels: Optional[List[dict]] = Field(default=None, max_length=_MAX_ITEMS)
    societeId: Optional[int] = None
    retrain: bool = False


class AnomalyTrainRequest(BaseModel):
    mouvements: List[dict] = Field(max_length=_MAX_ITEMS)
    labels: Optional[List[dict]] = Field(default=None, max_length=_MAX_ITEMS)
    societeId: Optional[int] = None


class ArticleToLoad(BaseModel):
    articleId: int
    code: str
    libelle: str
    quantite: float
    poidsUnitaire: float
    volumeUnitaire: float
    destination: Optional[str] = None
    fragile: bool = False
    dangereuxChimique: bool = False
    prixVente: float = 0.0
    imageUrl: Optional[str] = None
    destLat: Optional[float] = None
    destLng: Optional[float] = None


class Vehicule(BaseModel):
    nom: str
    capacitePoids: float
    capaciteVolume: float


class LoadDepot(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    libelle: Optional[str] = None


class LoadOptimizationRequest(BaseModel):
    articles: List[ArticleToLoad] = Field(max_length=_MAX_ITEMS)
    vehicule: Vehicule
    depot: Optional[LoadDepot] = None
    cooccurrence: Optional[List[dict]] = Field(default=None, max_length=_MAX_ITEMS)


def _dump(model):
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


@secured.post("/forecast", dependencies=[Depends(heavy)])
def forecast(req: ForecastRequest):
    payload = _dump(req)
    try:
        return run_forecast(payload)
    except Exception:
        try:
            return run_forecast({**payload, "peers": []})
        except Exception:
            hist = payload.get("historique") or []
            return {
                "article_id": payload.get("article_id"),
                "predictions": [],
                "historique": hist,
                "tendance": "stable",
                "variationPct": 0,
                "picSaisonnier": None,
                "recommendedStock": 0,
                "reorderPoint": 0,
                "confidence": 40,
                "explication": "Prévision indisponible — réessayez dans un instant.",
                "modele": "indisponible",
                "mode": "error",
                "pipeline": [],
                "story": ["Le moteur de prévision a rencontré une erreur interne."],
            }


@secured.post("/forecast/batch", dependencies=[Depends(heavy)])
def forecast_batch(req: ForecastBatchRequest):
    payload = _dump(req)
    try:
        return run_forecast_batch(payload)
    except Exception:
        items = []
        for it in payload.get("items") or []:
            try:
                items.append(run_forecast({
                    "article_id": it.get("article_id") or it.get("articleId"),
                    "historique": it.get("historique") or [],
                    "horizon": payload.get("horizon") or 3,
                    "features": it.get("features") or {},
                    "articleCode": it.get("code"),
                    "articleLibelle": it.get("libelle"),
                }))
            except Exception:
                items.append({
                    "article_id": it.get("article_id") or it.get("articleId"),
                    "predictions": [],
                    "modele": "indisponible",
                    "mode": "error",
                    "confidence": 40,
                })
        return {"items": items, "portfolio": None, "mode": "error", "reconciled": False}


@secured.post("/anomalies", dependencies=[Depends(heavy)])
def detect_anomalies(req: AnomalyRequest):
    payload = _dump(req)
    try:
        return run_anomalies(payload)
    except Exception:
        return {"anomalies": [], "mode": "error", "modele": "indisponible", "studio": None}


@secured.post("/anomalies/train", dependencies=[Depends(heavy)])
def train_anomalies(req: AnomalyTrainRequest):
    payload = _dump(req)
    try:
        return train_models(payload)
    except Exception as e:
        return {"ok": False, "reason": str(e)[:200], "status": model_status(payload.get("societeId"))}


@secured.get("/anomalies/status")
def anomalies_status(societeId: Optional[int] = None):
    return model_status(societeId)


@secured.post("/load-optimization", dependencies=[Depends(heavy)])
def load_optimization(data: LoadOptimizationRequest):
    payload = _dump(data)
    return run_load_optimization(payload)


class SlottingRequest(BaseModel):
    articleId: int
    articles: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    candidates: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    occupants: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    cooccurrence: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    currentEmplacementId: Optional[int] = None
    currentEmplacementCode: Optional[str] = None


class SlottingAuditRequest(BaseModel):
    articles: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    candidates: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    occupants: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    cooccurrence: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    currents: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)
    eligible: List[dict] = Field(default_factory=list, max_length=_MAX_ITEMS)


@secured.post("/slotting", dependencies=[Depends(heavy)])
def slotting(req: SlottingRequest):
    payload = _dump(req)
    return run_slotting(payload)


@secured.post("/slotting/audit", dependencies=[Depends(heavy)])
def slotting_audit(req: SlottingAuditRequest):
    payload = _dump(req)
    return run_slotting_audit(payload)


class ExpiryWasteLot(BaseModel):
    lot_id: Optional[int] = None
    lotId: Optional[int] = None
    quantite_restante: Optional[float] = None
    quantite_initiale: Optional[float] = None
    jours_restants: Optional[float] = None
    duree_vie: Optional[float] = None
    age: Optional[float] = None
    prix_unitaire: float = 0
    strategie_sortie: Optional[str] = None
    q_devant: Optional[float] = None
    ventes_28j: Optional[List[float]] = Field(default=None, max_length=28)
    ventes_30j: Optional[float] = None
    dow: Optional[int] = None
    quantite_restante_asof: Optional[float] = None
    vitesse_moyenne_journaliere: Optional[float] = None
    jours_restants_avant_expiration: Optional[float] = None


class ExpiryWasteRequest(BaseModel):
    lots: List[ExpiryWasteLot] = Field(default_factory=list, max_length=_MAX_ITEMS)


class ExpiryTrainRequest(BaseModel):
    realRows: Optional[List[Dict[str, Any]]] = Field(default=None, max_length=20000)
    synthetic: int = Field(default=60000, ge=500, le=200000)
    epochs: int = Field(default=40, ge=1, le=80)


@secured.post("/expiry-waste")
def expiry_waste(req: ExpiryWasteRequest):
    # Léger : pas de garde heavy, mais synchrone pour ne pas bloquer la boucle.
    payload = _dump(req)
    try:
        return run_expiry_waste(payload)
    except Exception:
        log.exception("expiry-waste en échec")
        return {
            "kind": "heuristic_expiry_waste",
            "version": "2.0.0",
            "mode": "heuristic",
            "model": {
                "mode": "heuristic",
                "trainedAt": None,
                "data": {"synthetic": 0, "real": 0, "realDataSufficient": False},
                "metrics": {},
            },
            "items": [],
        }


@secured.post("/expiry-waste/train", status_code=202)
def expiry_waste_train(req: ExpiryTrainRequest):
    from expiry.serve import enqueue_train
    job_id = enqueue_train(req.realRows, synthetic=req.synthetic, epochs=req.epochs)
    return JSONResponse(status_code=202, content={"jobId": job_id})


@secured.get("/expiry-waste/status")
def expiry_waste_status():
    from expiry.serve import status_payload
    return status_payload()


@app.on_event("startup")
def _expiry_boot():
    try:
        from expiry.serve import maybe_autostart
        maybe_autostart()
    except Exception:
        log.exception("démarrage expiry")


app.include_router(public)
app.include_router(secured)
