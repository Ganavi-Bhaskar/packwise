"""Generate reproducible synthetic examples for packaging recommendations.

The generated data is suitable for exercising the ML pipeline, not for making
real food-safety or commercial shelf-life claims.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATASET_PATH = DATA_DIR / "food_packaging_dataset.csv"
MATERIALS_PATH = DATA_DIR / "materials.json"

FOOD_CATEGORIES = (
	"fruits",
	"vegetables",
	"dairy",
	"meat",
	"seafood",
	"bakery",
	"grains",
	"snacks",
	"beverages",
	"frozen",
	"spices",
	"oils",
)
LEVELS = ("low", "medium", "high")
MATERIAL_PROPERTIES: dict[str, dict[str, Any]] = {
	"LDPE film": {
		"otr": 7800,
		"wvtr": 18,
		"cost_level": "low",
		"recyclability": 55,
		"biodegradability": 0,
		"sustainability_score": 48,
		"pros": ["Low cost", "Flexible", "Good moisture barrier"],
		"cons": ["Weak oxygen and light barrier", "Limited curbside recycling"],
	},
	"HDPE": {
		"otr": 1800,
		"wvtr": 5,
		"cost_level": "low",
		"recyclability": 72,
		"biodegradability": 0,
		"sustainability_score": 62,
		"pros": ["Moisture resistant", "Widely recyclable", "Tough"],
		"cons": ["Moderate oxygen barrier", "Opaque appearance"],
	},
	"PET": {
		"otr": 90,
		"wvtr": 4,
		"cost_level": "medium",
		"recyclability": 78,
		"biodegradability": 0,
		"sustainability_score": 68,
		"pros": ["Clear and strong", "Good gas barrier", "Established recycling"],
		"cons": ["Not biodegradable", "Performance depends on package format"],
	},
	"PP": {
		"otr": 1500,
		"wvtr": 3,
		"cost_level": "low",
		"recyclability": 52,
		"biodegradability": 0,
		"sustainability_score": 55,
		"pros": ["Good moisture barrier", "Heat tolerant", "Lightweight"],
		"cons": ["Moderate oxygen barrier", "Recycling access varies"],
	},
	"PLA biodegradable": {
		"otr": 4500,
		"wvtr": 35,
		"cost_level": "high",
		"recyclability": 20,
		"biodegradability": 85,
		"sustainability_score": 78,
		"pros": ["Bio-based option", "Industrial compostability in suitable conditions"],
		"cons": ["Limited barrier performance", "Composting infrastructure required"],
	},
	"Aluminium foil laminate": {
		"otr": 0.1,
		"wvtr": 0.1,
		"cost_level": "high",
		"recyclability": 18,
		"biodegradability": 0,
		"sustainability_score": 42,
		"pros": ["Excellent oxygen, moisture, and light barrier", "Long shelf-life potential"],
		"cons": ["Difficult to recycle in composite form", "Higher material complexity"],
	},
	"Glass": {
		"otr": 0,
		"wvtr": 0,
		"cost_level": "high",
		"recyclability": 90,
		"biodegradability": 0,
		"sustainability_score": 75,
		"pros": ["Inert and highly recyclable", "Excellent gas and moisture barrier"],
		"cons": ["Heavy and breakable", "Higher transport footprint"],
	},
	"Tin/metal can": {
		"otr": 0,
		"wvtr": 0,
		"cost_level": "medium",
		"recyclability": 88,
		"biodegradability": 0,
		"sustainability_score": 73,
		"pros": ["Excellent barrier", "Robust and widely recyclable"],
		"cons": ["Opaque", "Requires forming and sealing equipment"],
	},
	"Paperboard": {
		"otr": 9000,
		"wvtr": 80,
		"cost_level": "low",
		"recyclability": 82,
		"biodegradability": 75,
		"sustainability_score": 80,
		"pros": ["Renewable fibre", "Easy to print and recycle"],
		"cons": ["Poor standalone moisture and oxygen barrier"],
	},
	"Modified Atmosphere Packaging (MAP)": {
		"otr": 15,
		"wvtr": 2,
		"cost_level": "high",
		"recyclability": 48,
		"biodegradability": 0,
		"sustainability_score": 58,
		"pros": ["Tailored gas mixture can slow spoilage", "Useful for fresh foods"],
		"cons": ["Needs gas control and seal integrity", "Higher process cost"],
	},
	"Vacuum packaging": {
		"otr": 8,
		"wvtr": 2,
		"cost_level": "medium",
		"recyclability": 35,
		"biodegradability": 0,
		"sustainability_score": 52,
		"pros": ["Reduces oxygen exposure", "Compact package"],
		"cons": ["Can crush delicate foods", "Requires vacuum-compatible film"],
	},
	"Active packaging (oxygen absorber)": {
		"otr": 25,
		"wvtr": 3,
		"cost_level": "high",
		"recyclability": 35,
		"biodegradability": 0,
		"sustainability_score": 50,
		"pros": ["Controls residual oxygen", "Helps protect oxidation-sensitive foods"],
		"cons": ["Adds component and handling requirements", "Not suitable for every food"],
	},
	"Edible coating": {
		"otr": 3200,
		"wvtr": 24,
		"cost_level": "medium",
		"recyclability": 100,
		"biodegradability": 100,
		"sustainability_score": 90,
		"pros": ["Can reduce moisture loss on produce", "Low packaging waste"],
		"cons": ["Food- and process-specific", "Limited standalone barrier"],
	},
}

_CATEGORY_RANGES: dict[str, dict[str, tuple[float, float]]] = {
	"fruits": {"moisture_content": (75, 94), "fat_content": (0, 3), "pH": (2.8, 5.2), "water_activity": (0.94, 0.99)},
	"vegetables": {"moisture_content": (82, 97), "fat_content": (0, 2), "pH": (4.5, 7.0), "water_activity": (0.95, 0.99)},
	"dairy": {"moisture_content": (35, 90), "fat_content": (0.2, 38), "pH": (4.0, 7.0), "water_activity": (0.90, 0.99)},
	"meat": {"moisture_content": (55, 78), "fat_content": (3, 42), "pH": (5.2, 6.8), "water_activity": (0.94, 0.99)},
	"seafood": {"moisture_content": (65, 85), "fat_content": (0.5, 28), "pH": (5.8, 7.4), "water_activity": (0.95, 0.99)},
	"bakery": {"moisture_content": (8, 48), "fat_content": (1, 32), "pH": (4.5, 7.0), "water_activity": (0.35, 0.92)},
	"grains": {"moisture_content": (7, 16), "fat_content": (1, 12), "pH": (5.2, 7.2), "water_activity": (0.25, 0.65)},
	"snacks": {"moisture_content": (1, 18), "fat_content": (2, 45), "pH": (3.5, 7.0), "water_activity": (0.10, 0.60)},
	"beverages": {"moisture_content": (85, 100), "fat_content": (0, 12), "pH": (2.5, 7.2), "water_activity": (0.95, 1.0)},
	"frozen": {"moisture_content": (25, 90), "fat_content": (0, 35), "pH": (3.5, 7.0), "water_activity": (0.80, 0.99)},
	"spices": {"moisture_content": (5, 18), "fat_content": (2, 25), "pH": (4.0, 7.0), "water_activity": (0.20, 0.65)},
	"oils": {"moisture_content": (0, 1), "fat_content": (95, 100), "pH": (5.0, 7.0), "water_activity": (0.0, 0.2)},
}
_SHELF_LIFE_BASE = {
	"fruits": 18, "vegetables": 20, "dairy": 24, "meat": 12,
	"seafood": 10, "bakery": 18, "grains": 220, "snacks": 150,
	"beverages": 75, "frozen": 260, "spices": 300, "oils": 240,
}


def _level_effect(value: str) -> int:
	"""Map an ordinal low/medium/high category to -1/0/1."""
	return LEVELS.index(value) - 1


def _material_utility(row: dict[str, Any], material: str, rng: np.random.Generator) -> float:
	"""Score a material against food, barrier, budget, and sustainability needs."""
	properties = MATERIAL_PROPERTIES[material]
	category = row["food_category"]
	score = 0.0

	category_preferences = {
		"fruits": {"MAP": 3.5, "Edible coating": 2.7, "LDPE film": 1.6, "PLA biodegradable": 1.3},
		"vegetables": {"MAP": 3.0, "Edible coating": 3.0, "LDPE film": 1.7, "PLA biodegradable": 1.2},
		"dairy": {"Aluminium foil laminate": 2.4, "HDPE": 1.7, "PP": 1.2, "Tin/metal can": 1.0},
		"meat": {"Vacuum packaging": 3.2, "MAP": 2.8, "Active packaging (oxygen absorber)": 2.0},
		"seafood": {"MAP": 3.0, "Vacuum packaging": 2.8, "Active packaging (oxygen absorber)": 2.2},
		"bakery": {"Paperboard": 2.4, "LDPE film": 1.8, "PP": 1.2, "Active packaging (oxygen absorber)": 1.4},
		"grains": {"Paperboard": 1.8, "HDPE": 1.8, "PP": 1.5, "Aluminium foil laminate": 1.4},
		"snacks": {"Aluminium foil laminate": 2.4, "PP": 1.8, "PET": 1.5, "Active packaging (oxygen absorber)": 1.6},
		"beverages": {"Glass": 2.3, "PET": 2.0, "Tin/metal can": 1.8, "HDPE": 1.2},
		"frozen": {"LDPE film": 1.4, "HDPE": 1.8, "PP": 1.6, "Aluminium foil laminate": 1.8},
		"spices": {"Aluminium foil laminate": 2.4, "Glass": 1.6, "PET": 1.7, "Active packaging (oxygen absorber)": 1.4},
		"oils": {"Glass": 2.4, "PET": 1.5, "Tin/metal can": 2.0, "Aluminium foil laminate": 1.5},
	}
	score += category_preferences[category].get(material, 0.0)

	oxygen_sensitive = row["oxygen_sensitivity"] == "high"
	light_sensitive = row["light_sensitivity"] == "high"
	high_fat = row["fat_content"] >= 15
	high_moisture = row["moisture_content"] >= 65
	barrier_materials = {"Aluminium foil laminate", "Glass", "Tin/metal can", "Vacuum packaging", "MAP"}
	if oxygen_sensitive or high_fat:
		score += 2.1 if material in barrier_materials else -0.8
	if light_sensitive and material in {"Aluminium foil laminate", "Tin/metal can", "HDPE", "Glass"}:
		score += 1.3
	if high_moisture and material in {"PP", "HDPE", "PET", "MAP", "Vacuum packaging"}:
		score += 0.7
	if category in {"fruits", "vegetables"} and row["respiration_rate"] == "high":
		score += 1.7 if material in {"MAP", "Edible coating", "LDPE film"} else -0.2
	if category == "frozen":
		score += 1.7 if material in {"LDPE film", "HDPE", "PP", "Aluminium foil laminate"} else -0.5

	budget_level = row["budget_level"]
	cost = properties["cost_level"]
	score += {"low": 1.2, "medium": 0.2, "high": -0.8}[cost] if budget_level == "low" else 0.0
	if budget_level == "high" and cost == "high":
		score += 0.6

	sustainability_priority = row["sustainability_priority"]
	score += (properties["sustainability_score"] - 60) / 18 * (0.3 + 0.7 * (_level_effect(sustainability_priority) + 1) / 2)
	return score + float(rng.normal(0, 0.55))


def _make_row(rng: np.random.Generator) -> dict[str, Any]:
	"""Sample one food profile and derive a noisy material/shelf-life target."""
	category = str(rng.choice(FOOD_CATEGORIES))
	ranges = _CATEGORY_RANGES[category]
	row: dict[str, Any] = {"food_category": category}
	for feature, (minimum, maximum) in ranges.items():
		row[feature] = round(float(rng.uniform(minimum, maximum)), 2)

	if category in {"fruits", "vegetables"}:
		respiration = rng.choice(LEVELS, p=[0.18, 0.37, 0.45])
	elif category in {"grains", "snacks", "spices", "oils"}:
		respiration = rng.choice(LEVELS, p=[0.65, 0.28, 0.07])
	else:
		respiration = rng.choice(LEVELS, p=[0.42, 0.43, 0.15])
	row["respiration_rate"] = str(respiration)
	row["oxygen_sensitivity"] = str(rng.choice(LEVELS, p=[0.22, 0.44, 0.34] if row["fat_content"] > 10 else [0.35, 0.45, 0.20]))
	row["light_sensitivity"] = str(rng.choice(LEVELS, p=[0.25, 0.4, 0.35] if category in {"dairy", "oils", "beverages", "spices"} else [0.48, 0.38, 0.14]))

	temperature_ranges = {
		"frozen": (-24, -12), "meat": (-1, 5), "seafood": (-2, 5), "dairy": (2, 8),
		"fruits": (3, 18), "vegetables": (2, 15),
	}
	temp_min, temp_max = temperature_ranges.get(category, (12, 26))
	row["storage_temp"] = round(float(rng.uniform(temp_min, temp_max)), 1)
	row["relative_humidity"] = round(float(rng.uniform(30, 98)), 1)
	row["transport_days"] = int(rng.integers(1, 31))
	row["required_shelf_life_days"] = int(max(3, round(_SHELF_LIFE_BASE[category] * rng.uniform(0.45, 1.65))))
	row["budget_level"] = str(rng.choice(LEVELS, p=[0.42, 0.42, 0.16]))
	row["sustainability_priority"] = str(rng.choice(LEVELS, p=[0.25, 0.45, 0.30]))

	utilities = np.array([_material_utility(row, material, rng) for material in MATERIAL_PROPERTIES])
	probabilities = np.exp((utilities - utilities.max()) / 1.25)
	probabilities /= probabilities.sum()
	material = str(rng.choice(list(MATERIAL_PROPERTIES), p=probabilities))
	row["recommended_material"] = material

	material_utility = _material_utility(row, material, rng)
	barrier = material in {"Aluminium foil laminate", "Glass", "Tin/metal can", "MAP", "Vacuum packaging", "Active packaging (oxygen absorber)"}
	category_baseline = _SHELF_LIFE_BASE[category]
	barrier_factor = 1.35 if barrier else 0.88
	temperature_factor = float(np.clip(1.0 - max(row["storage_temp"] - 4, 0) * 0.035, 0.28, 1.15))
	transport_factor = max(0.55, 1.0 - row["transport_days"] * 0.008)
	predicted_shelf_life = category_baseline * barrier_factor * temperature_factor * transport_factor
	predicted_shelf_life *= float(np.clip(0.85 + material_utility * 0.025, 0.7, 1.25))
	predicted_shelf_life *= float(rng.lognormal(mean=0, sigma=0.16))
	row["predicted_shelf_life_days"] = round(float(np.clip(predicted_shelf_life, 2, 540)), 1)

	target_ratio = row["predicted_shelf_life_days"] / row["required_shelf_life_days"]
	score = 48 + 27 * min(target_ratio, 1.4) + 2.4 * material_utility
	score += float(rng.normal(0, 7.5))
	row["suitability_score"] = round(float(np.clip(score, 0, 100)), 1)
	return row


def generate_dataset(rows: int = 5000, seed: int = 42) -> pd.DataFrame:
	"""Generate a reproducible synthetic dataset with food and target features."""
	if rows < 100:
		raise ValueError("rows must be at least 100 to support reliable model evaluation")
	rng = np.random.default_rng(seed)
	dataset = pd.DataFrame([_make_row(rng) for _ in range(rows)])
	return dataset


def write_materials(path: Path = MATERIALS_PATH) -> None:
	"""Write packaging material properties as human-readable JSON."""
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(json.dumps(MATERIAL_PROPERTIES, indent=2), encoding="utf-8")


def main() -> None:
	"""Generate and save the dataset and material catalogue."""
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--rows", type=int, default=5000, help="Number of synthetic examples (default: 5000).")
	parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducible generation.")
	parser.add_argument("--output", type=Path, default=DATASET_PATH, help="CSV output path.")
	parser.add_argument("--materials-output", type=Path, default=MATERIALS_PATH, help="Material JSON output path.")
	args = parser.parse_args()

	dataset = generate_dataset(rows=args.rows, seed=args.seed)
	args.output.parent.mkdir(parents=True, exist_ok=True)
	dataset.to_csv(args.output, index=False)
	write_materials(args.materials_output)
	print(f"Generated {len(dataset):,} rows at {args.output}")
	print(f"Wrote {len(MATERIAL_PROPERTIES)} material definitions at {args.materials_output}")
	print(f"Material target distribution: {dataset['recommended_material'].nunique()} classes")


if __name__ == "__main__":
	main()
