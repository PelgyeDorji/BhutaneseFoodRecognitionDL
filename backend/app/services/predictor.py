"""The prediction seam: the rest of the app only calls `get_predictor().predict()`.

Until a model is trained, `PlaceholderPredictor` answers. It is deterministic
(the same photo always gets the same answer) so the UI can be demoed, and every
result it gives is labelled `placeholder-v0` in `model_used`.

When the model is ready, implement `KerasPredictor` with exactly the
preprocessing used in training and set MODEL_PATH in .env.
"""

import hashlib
import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from PIL import Image

from app.core.config import get_settings
from app.services.dishes import DISHES


@dataclass(frozen=True)
class Guess:
    slug: str
    confidence: float


class Predictor(Protocol):
    name: str
    is_placeholder: bool

    def predict(self, image: Image.Image, top_k: int = 3) -> list[Guess]: ...


class PlaceholderPredictor:
    name = "placeholder-v0"
    is_placeholder = True

    def predict(self, image: Image.Image, top_k: int = 3) -> list[Guess]:
        digest = hashlib.sha256(image.resize((32, 32)).tobytes()).digest()
        # Sharp enough that some answers clear the confidence threshold and some do not.
        logits = [digest[i] / 255 * 11 for i in range(len(DISHES))]
        peak = max(logits)
        exps = [math.exp(x - peak) for x in logits]
        total = sum(exps)
        ranked = sorted(
            (Guess(dish["slug"], e / total) for dish, e in zip(DISHES, exps, strict=True)),
            key=lambda guess: guess.confidence,
            reverse=True,
        )
        return ranked[:top_k]


class KerasPredictor:
    is_placeholder = False

    def __init__(self, model_path: str) -> None:
        self.name = model_path.replace("\\", "/").rsplit("/", 1)[-1]
        raise NotImplementedError(
            "Load the trained model here (tf.keras.models.load_model) and apply the "
            "same resize and normalisation as training in predict()."
        )

    def predict(self, image: Image.Image, top_k: int = 3) -> list[Guess]:
        raise NotImplementedError


@lru_cache
def get_predictor() -> Predictor:
    model_path = get_settings().model_path
    return KerasPredictor(model_path) if model_path else PlaceholderPredictor()
