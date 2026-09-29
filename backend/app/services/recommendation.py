"""Model loading, safety filtering, and explainable material ranking."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.schemas import FoodProfile, MaterialRecommendation, RecommendationResponse

logger = logging.getLogger(__name__)


class RecommendationService:
    """Own the loaded model pipelines and recommendation domain logic."""

    def __init__(
        self,
        model_artifact_dir: Path,
        materials_path: Path,
        metrics_path: Path,
    ) -> None:
        self.model_artifact_dir = model_artifact_dir
        self.materials_path = materials_path
        self.metrics_path = metrics_path
        self.classifier: Any = None
        self.shelf_life_regressor: Any = None
        self.materials: dict[str, dict[str, Any]] = {}
        self.metrics: dict[str, Any] = {}
        self.feature_order: list[str] = []

    def load(self) -> None:
        """Load trained pipelines, metrics, and material properties from disk."""
        classifier_path = self.model_artifact_dir / "best_material_classifier.joblib"
        regressor_path = self.model_artifact_dir / "best_shelf_life_regressor.joblib"
        for required_path in (classifier_path, regressor_path, self.materials_path, self.metrics_path):
            if not required_path.is_file():
                raise FileNotFoundError(f"Required model resource is missing: {required_path}")

        self.classifier = joblib.load(classifier_path)
        self.shelf_life_regressor = joblib.load(regressor_path)
        self.materials = json.loads(self.materials_path.read_text(encoding="utf-8"))
        self.metrics = json.loads(self.metrics_path.read_text(encoding="utf-8"))
        self.feature_order = self.metrics["dataset"]["features"]
        model_classes = set(str(name) for name in self.classifier.classes_)
        if model_classes != set(self.materials):
            missing_metadata = sorted(model_classes.difference(self.materials))
            if missing_metadata:
                raise ValueError(f"Material properties are missing for trained classes: {missing_metadata}")
        logger.info("Loaded recommendation models with %d material classes", len(model_classes))

    def material_list(self) -> list[dict[str, Any]]:
        """Return material catalogue entries with their names included."""
        return [
            {"name": name, **properties}
            for name, properties in sorted(self.materials.items())
        ]

    def material_detail(self, name: str) -> dict[str, Any] | None:
        """Return one material property record, or None if it is unknown."""
        properties = self.materials.get(name)
        return {"name": name, **properties} if properties is not None else None

    def _input_frame(self, profile: FoodProfile) -> pd.DataFrame:
        """Build a one-row frame in the exact feature order used by training."""
        values = profile.model_dump()
        return pd.DataFrame([{feature: values[feature] for feature in self.feature_order}])

    @staticmethod
    def _safety_reasons(profile: FoodProfile, material: str, properties: dict[str, Any]) -> list[str]:
        """Describe material exclusions for conditions where barrier risk is high."""
        reasons: list[str] = []
        if (
            profile.fat_content >= 20
            and profile.oxygen_sensitivity == "high"
            and float(properties.get("otr", float("inf"))) > 500
        ):
            reasons.append("Insufficient oxygen barrier for a high-fat, oxygen-sensitive food.")
        if profile.food_category == "frozen" and profile.storage_temp <= -12 and material in {
            "PLA biodegradable", "Glass", "Edible coating"
        }:
            reasons.append("Material is a poor fit for prolonged deep-frozen storage.")
        return reasons

    @staticmethod
    def _explanation(profile: FoodProfile, material: str, properties: dict[str, Any]) -> str:
        """Create a concise explanation grounded in the submitted food profile."""
        reasons: list[str] = []
        if profile.fat_content >= 15 and profile.oxygen_sensitivity in {"medium", "high"}:
            reasons.append("the food's fat and oxygen sensitivity make oxidation control important")
        if profile.food_category in {"fruits", "vegetables"} and profile.respiration_rate == "high":
            reasons.append("fresh produce with high respiration benefits from gas exchange management")
        if profile.light_sensitivity == "high":
            reasons.append("light exposure is a stated quality risk")
        if profile.storage_temp <= -10:
            reasons.append("the package must tolerate low-temperature storage")
        if profile.transport_days >= 14:
            reasons.append("the longer transport period raises the value of protective barrier performance")
        if profile.sustainability_priority == "high":
            reasons.append("sustainability is a high priority")
        if profile.budget_level == "low":
            reasons.append("the option is compatible with a cost-conscious budget")
        if not reasons:
            reasons.append("its barrier profile and model ranking fit the submitted food and storage conditions")
        return f"{material} is recommended because " + "; ".join(reasons) + "."

    @staticmethod
    def _suitability_score(
        profile: FoodProfile,
        material_properties: dict[str, Any],
        probability: float,
        shelf_life_days: float,
    ) -> float:
        """Combine model confidence and explicit requirement-fit heuristics."""
        confidence_component = min(probability * 1.75, 1.0) * 48
        life_ratio = min(shelf_life_days / profile.required_shelf_life_days, 1.4) / 1.4
        shelf_life_component = life_ratio * 28
        sustainability_weight = {"low": 4, "medium": 9, "high": 14}[profile.sustainability_priority]
        sustainability_component = (
            float(material_properties.get("sustainability_score", 0)) / 100 * sustainability_weight
        )
        cost_rank = {"low": 0, "medium": 1, "high": 2}
        budget_rank = {"low": 0, "medium": 1, "high": 2}[profile.budget_level]
        material_cost_rank = cost_rank.get(str(material_properties.get("cost_level", "high")), 2)
        budget_component = 10 if material_cost_rank <= budget_rank else 2
        return round(min(100.0, confidence_component + shelf_life_component + sustainability_component + budget_component), 1)

    def _predict(self, profile: FoodProfile) -> tuple[dict[str, float], float]:
        """Predict material probabilities and profile-level shelf-life estimate."""
        frame = self._input_frame(profile)
        probability_vector = self.classifier.predict_proba(frame)[0]
        probabilities = {
            str(material): float(probability)
            for material, probability in zip(self.classifier.classes_, probability_vector)
        }
        shelf_life = max(0.0, float(self.shelf_life_regressor.predict(frame)[0]))
        return probabilities, shelf_life

    def _build_option(
        self,
        profile: FoodProfile,
        material: str,
        probability: float,
        shelf_life_days: float,
        include_safety_warning: bool = False,
    ) -> tuple[MaterialRecommendation, list[str]]:
        """Assemble a typed material option and return any critical exclusions."""
        properties = self.materials[material]
        safety_reasons = self._safety_reasons(profile, material, properties)
        warnings = list(safety_reasons)
        if profile.light_sensitivity == "high" and material in {"Glass", "PET"}:
            warnings.append("Clear packaging may require secondary protection from light.")
        if profile.food_category in {"fruits", "vegetables"} and profile.respiration_rate == "high" and material in {
            "Vacuum packaging", "Aluminium foil laminate", "Tin/metal can"
        }:
            warnings.append("Confirm the package atmosphere and respiration needs for this fresh produce.")
        score = self._suitability_score(profile, properties, probability, shelf_life_days)
        if safety_reasons and include_safety_warning:
            score = max(0.0, score - 45)
        option = MaterialRecommendation(
            material=material,
            probability=round(probability, 6),
            predicted_shelf_life_days=round(shelf_life_days, 1),
            suitability_score=score,
            cost_level=str(properties.get("cost_level", "unknown")),
            sustainability_score=float(properties.get("sustainability_score", 0)),
            recyclability=float(properties.get("recyclability", 0)),
            biodegradability=float(properties.get("biodegradability", 0)),
            pros=list(properties.get("pros", [])),
            cons=list(properties.get("cons", [])),
            explanation=self._explanation(profile, material, properties),
            warnings=warnings,
        )
        return option, safety_reasons

    def recommend(self, profile: FoodProfile) -> RecommendationResponse:
        """Return the top three model-ranked materials after safety filtering."""
        probabilities, shelf_life_days = self._predict(profile)
        ranked = sorted(probabilities.items(), key=lambda item: item[1], reverse=True)
        filtered_materials: list[str] = []
        options: list[MaterialRecommendation] = []
        for material, probability in ranked:
            properties = self.materials[material]
            safety_reasons = self._safety_reasons(profile, material, properties)
            if safety_reasons:
                filtered_materials.append(material)
                continue
            option, _ = self._build_option(profile, material, probability, shelf_life_days)
            options.append(option)
        options.sort(key=lambda option: option.suitability_score, reverse=True)
        options = options[:3]
        if not options:
            raise RuntimeError("Safety rules excluded every trained material class.")
        summary = (
            f"The model estimates about {shelf_life_days:.1f} days for this food and storage profile. "
            "Material probabilities come from the trained classifier; suitability scores also include "
            "budget, shelf-life target, and sustainability heuristics. Shelf life is profile-level: "
            "the saved regressor does not take a candidate material as an input."
        )
        return RecommendationResponse(
            recommendations=options,
            explanation=summary,
            safety_filtered_materials=filtered_materials,
        )

    def compare(self, profile: FoodProfile, material_names: list[str]) -> list[MaterialRecommendation]:
        """Score two or three requested materials without hiding unsafe choices."""
        unknown = [name for name in material_names if name not in self.materials]
        if unknown:
            raise KeyError(unknown[0])
        probabilities, shelf_life_days = self._predict(profile)
        options = [
            self._build_option(
                profile,
                material,
                probabilities.get(material, 0.0),
                shelf_life_days,
                include_safety_warning=True,
            )[0]
            for material in material_names
        ]
        return options

    def model_metrics(self) -> dict[str, Any]:
        """Return saved evaluation metrics and chart-friendly feature importance."""
        classifier = self.metrics.get("material_classifier", {})
        regressor = self.metrics.get("shelf_life_regressor", {})
        return {
            "dataset": self.metrics.get("dataset", {}),
            "comparison": self.metrics.get("comparison", {}),
            "material_classifier": classifier,
            "shelf_life_regressor": regressor,
            "feature_importance": classifier.get("feature_importance", []),
            "confusion_matrix": {
                "labels": classifier.get("confusion_matrix_labels", []),
                "values": classifier.get("confusion_matrix", []),
            },
        }