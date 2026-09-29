"""Compare, tune, evaluate, and save food packaging recommendation models."""

from __future__ import annotations

import json
import warnings
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
	accuracy_score,
	confusion_matrix,
	f1_score,
	mean_squared_error,
	r2_score,
	top_k_accuracy_score,
)
from sklearn.model_selection import (
	GridSearchCV,
	KFold,
	StratifiedKFold,
	cross_validate,
	train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "data" / "food_packaging_dataset.csv"
ARTIFACT_DIR = ROOT / "ml" / "artifacts"
RANDOM_STATE = 42
TEST_SIZE = 0.2
CV_SPLITS = 5

CATEGORICAL_FEATURES = [
	"food_category",
	"respiration_rate",
	"oxygen_sensitivity",
	"light_sensitivity",
	"budget_level",
	"sustainability_priority",
]
NUMERIC_FEATURES = [
	"moisture_content",
	"fat_content",
	"pH",
	"water_activity",
	"storage_temp",
	"relative_humidity",
	"transport_days",
	"required_shelf_life_days",
]
FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES
CLASS_TARGET = "recommended_material"
REGRESSION_TARGET = "predicted_shelf_life_days"


def _json_value(value: Any) -> Any:
	"""Convert NumPy and other scalar values to JSON-compatible Python values."""
	if isinstance(value, dict):
		return {str(key): _json_value(item) for key, item in value.items()}
	if isinstance(value, (list, tuple)):
		return [_json_value(item) for item in value]
	if isinstance(value, np.ndarray):
		return value.tolist()
	if isinstance(value, np.generic):
		return value.item()
	if isinstance(value, Path):
		return str(value)
	return value


def _load_dataset(path: Path = DATASET_PATH) -> pd.DataFrame:
	"""Load and validate the generated training data."""
	if not path.exists():
		raise FileNotFoundError(f"Dataset not found at {path}. Run generate_dataset.py first.")
	dataset = pd.read_csv(path)
	required = set(FEATURES + [CLASS_TARGET, REGRESSION_TARGET, "suitability_score"])
	missing = sorted(required.difference(dataset.columns))
	if missing:
		raise ValueError(f"Dataset is missing required columns: {', '.join(missing)}")
	if dataset[list(required)].isna().any().any():
		raise ValueError("Dataset contains missing values in required model columns.")
	if dataset[CLASS_TARGET].nunique() < 2:
		raise ValueError("At least two material classes are required for classification.")
	rare_classes = dataset[CLASS_TARGET].value_counts()
	if int(rare_classes.min()) < CV_SPLITS:
		raise ValueError(f"Every material class needs at least {CV_SPLITS} rows for stratified cross-validation.")
	return dataset


def _preprocessor() -> ColumnTransformer:
	"""Build imputation, one-hot encoding, and scaling shared by all models."""
	numeric = Pipeline(
		steps=[
			("imputer", SimpleImputer(strategy="median")),
			("scaler", StandardScaler()),
		]
	)
	categorical = Pipeline(
		steps=[
			("imputer", SimpleImputer(strategy="most_frequent")),
			("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
		]
	)
	return ColumnTransformer(
		transformers=[
			("numeric", numeric, NUMERIC_FEATURES),
			("categorical", categorical, CATEGORICAL_FEATURES),
		],
		verbose_feature_names_out=False,
	)


def _pipeline(estimator: Any) -> Pipeline:
	"""Create a complete preprocessing and estimator pipeline."""
	return Pipeline([("preprocessor", _preprocessor()), ("model", estimator)])


def _classifier_candidates() -> dict[str, Pipeline]:
	"""Return the classifier families included in model comparison."""
	return {
		"Random Forest": _pipeline(
			RandomForestClassifier(
				n_estimators=100,
				min_samples_leaf=2,
				class_weight="balanced_subsample",
				random_state=RANDOM_STATE,
				n_jobs=-1,
			)
		),
		"Gradient Boosting": _pipeline(
			GradientBoostingClassifier(
				n_estimators=70,
				learning_rate=0.08,
				max_depth=2,
				random_state=RANDOM_STATE,
			)
		),
		"Logistic Regression": _pipeline(
			LogisticRegression(
				C=1.0,
				max_iter=2000,
				class_weight="balanced",
				random_state=RANDOM_STATE,
			)
		),
	}


def _regressor_candidates() -> dict[str, Pipeline]:
	"""Return regression families included in shelf-life comparison."""
	return {
		"Random Forest": _pipeline(
			RandomForestRegressor(
				n_estimators=100,
				min_samples_leaf=2,
				random_state=RANDOM_STATE,
				n_jobs=-1,
			)
		),
		"Gradient Boosting": _pipeline(
			GradientBoostingRegressor(
				n_estimators=70,
				learning_rate=0.06,
				max_depth=2,
				loss="huber",
				random_state=RANDOM_STATE,
			)
		),
	}


def _search_grid(model_name: str, task: str) -> dict[str, list[Any]]:
	"""Return a small, deterministic hyperparameter search for a selected model."""
	if model_name == "Random Forest":
		return {
			"model__n_estimators": [100, 160],
			"model__max_depth": [None, 24],
		}
	if model_name == "Gradient Boosting":
		return {
			"model__n_estimators": [70, 110],
			"model__learning_rate": [0.05, 0.1],
		}
	if task == "classification":
		return {"model__C": [0.5, 1.0, 2.0]}
	raise ValueError(f"No search grid configured for {model_name} ({task}).")


def _cross_validate_candidates(
	candidates: dict[str, Pipeline],
	features: pd.DataFrame,
	target: pd.Series,
	task: str,
) -> tuple[dict[str, dict[str, float]], pd.DataFrame]:
	"""Calculate five-fold candidate scores and return a display-ready table."""
	if task == "classification":
		cv = StratifiedKFold(n_splits=CV_SPLITS, shuffle=True, random_state=RANDOM_STATE)
		scoring = {"accuracy": "accuracy", "f1_macro": "f1_macro"}
	else:
		cv = KFold(n_splits=CV_SPLITS, shuffle=True, random_state=RANDOM_STATE)
		scoring = {"rmse": "neg_root_mean_squared_error", "r2": "r2"}

	summary: dict[str, dict[str, float]] = {}
	rows: list[dict[str, Any]] = []
	for name, pipeline in candidates.items():
		scores = cross_validate(
			pipeline,
			features,
			target,
			cv=cv,
			scoring=scoring,
			n_jobs=1,
			return_train_score=False,
		)
		if task == "classification":
			metrics = {
				"cv_accuracy_mean": float(scores["test_accuracy"].mean()),
				"cv_accuracy_std": float(scores["test_accuracy"].std()),
				"cv_f1_macro_mean": float(scores["test_f1_macro"].mean()),
				"cv_f1_macro_std": float(scores["test_f1_macro"].std()),
			}
			rows.append({
				"Model": name,
				"5-fold accuracy": f"{metrics['cv_accuracy_mean']:.4f} +/- {metrics['cv_accuracy_std']:.4f}",
				"5-fold macro F1": f"{metrics['cv_f1_macro_mean']:.4f} +/- {metrics['cv_f1_macro_std']:.4f}",
			})
		else:
			metrics = {
				"cv_rmse_mean": float(-scores["test_rmse"].mean()),
				"cv_rmse_std": float(scores["test_rmse"].std()),
				"cv_r2_mean": float(scores["test_r2"].mean()),
				"cv_r2_std": float(scores["test_r2"].std()),
			}
			rows.append({
				"Model": name,
				"5-fold RMSE (days)": f"{metrics['cv_rmse_mean']:.3f} +/- {metrics['cv_rmse_std']:.3f}",
				"5-fold R2": f"{metrics['cv_r2_mean']:.4f} +/- {metrics['cv_r2_std']:.4f}",
			})
		summary[name] = metrics
	return summary, pd.DataFrame(rows)


def _feature_importance(pipeline: Pipeline, limit: int = 20) -> list[dict[str, float | str]]:
	"""Extract ranked transformed-feature importances from a fitted pipeline."""
	model = pipeline.named_steps["model"]
	feature_names = pipeline.named_steps["preprocessor"].get_feature_names_out()
	if hasattr(model, "feature_importances_"):
		values = np.asarray(model.feature_importances_, dtype=float)
	elif hasattr(model, "coef_"):
		values = np.mean(np.abs(np.asarray(model.coef_, dtype=float)), axis=0)
	else:
		return []
	order = np.argsort(values)[::-1][:limit]
	return [
		{"feature": str(feature_names[index]), "importance": float(values[index])}
		for index in order
	]


def train_models(dataset_path: Path = DATASET_PATH, artifact_dir: Path = ARTIFACT_DIR) -> dict[str, Any]:
	"""Train and evaluate material classification and shelf-life regression pipelines."""
	dataset = _load_dataset(dataset_path)
	features = dataset[FEATURES]
	classifier_target = dataset[CLASS_TARGET]
	regressor_target = dataset[REGRESSION_TARGET].astype(float)

	x_train, x_test, y_class_train, y_class_test, y_days_train, y_days_test = train_test_split(
		features,
		classifier_target,
		regressor_target,
		test_size=TEST_SIZE,
		random_state=RANDOM_STATE,
		stratify=classifier_target,
	)

	classifier_cv, classifier_table = _cross_validate_candidates(
		_classifier_candidates(), x_train, y_class_train, "classification"
	)
	regressor_cv, regressor_table = _cross_validate_candidates(
		_regressor_candidates(), x_train, y_days_train, "regression"
	)

	best_classifier_name = max(
		classifier_cv,
		key=lambda name: (classifier_cv[name]["cv_f1_macro_mean"], classifier_cv[name]["cv_accuracy_mean"]),
	)
	best_regressor_name = min(regressor_cv, key=lambda name: regressor_cv[name]["cv_rmse_mean"])

	classifier_search = GridSearchCV(
		_classifier_candidates()[best_classifier_name],
		param_grid=_search_grid(best_classifier_name, "classification"),
		scoring="f1_macro",
		cv=StratifiedKFold(n_splits=CV_SPLITS, shuffle=True, random_state=RANDOM_STATE),
		n_jobs=1,
		refit=True,
	)
	regressor_search = GridSearchCV(
		_regressor_candidates()[best_regressor_name],
		param_grid=_search_grid(best_regressor_name, "regression"),
		scoring="neg_root_mean_squared_error",
		cv=KFold(n_splits=CV_SPLITS, shuffle=True, random_state=RANDOM_STATE),
		n_jobs=1,
		refit=True,
	)
	classifier_search.fit(x_train, y_class_train)
	regressor_search.fit(x_train, y_days_train)
	best_classifier: Pipeline = classifier_search.best_estimator_
	best_regressor: Pipeline = regressor_search.best_estimator_

	class_predictions = best_classifier.predict(x_test)
	class_probabilities = best_classifier.predict_proba(x_test)
	class_names = [str(value) for value in best_classifier.classes_]
	material_metrics = {
		"selected_model": best_classifier_name,
		"best_parameters": classifier_search.best_params_,
		"holdout_accuracy": float(accuracy_score(y_class_test, class_predictions)),
		"holdout_f1_macro": float(f1_score(y_class_test, class_predictions, average="macro", zero_division=0)),
		"holdout_f1_weighted": float(f1_score(y_class_test, class_predictions, average="weighted", zero_division=0)),
		"holdout_top_3_accuracy": float(top_k_accuracy_score(y_class_test, class_probabilities, k=3, labels=best_classifier.classes_)),
		"cv": classifier_cv[best_classifier_name],
		"confusion_matrix": confusion_matrix(y_class_test, class_predictions, labels=best_classifier.classes_).tolist(),
		"confusion_matrix_labels": class_names,
		"feature_importance": _feature_importance(best_classifier),
	}

	shelf_life_predictions = best_regressor.predict(x_test)
	material_metrics_regression = {
		"selected_model": best_regressor_name,
		"best_parameters": regressor_search.best_params_,
		"holdout_rmse_days": float(np.sqrt(mean_squared_error(y_days_test, shelf_life_predictions))),
		"holdout_r2": float(r2_score(y_days_test, shelf_life_predictions)),
		"cv": regressor_cv[best_regressor_name],
		"feature_importance": _feature_importance(best_regressor),
	}

	artifact_dir.mkdir(parents=True, exist_ok=True)
	classifier_path = artifact_dir / "best_material_classifier.joblib"
	regressor_path = artifact_dir / "best_shelf_life_regressor.joblib"
	joblib.dump(best_classifier, classifier_path)
	joblib.dump(best_regressor, regressor_path)

	comparison = {
		"classification": classifier_cv,
		"regression": regressor_cv,
	}
	metrics: dict[str, Any] = {
		"dataset": {
			"path": str(dataset_path),
			"rows": int(len(dataset)),
			"features": FEATURES,
			"material_classes": class_names,
			"train_rows": int(len(x_train)),
			"test_rows": int(len(x_test)),
			"random_state": RANDOM_STATE,
			"cross_validation_folds": CV_SPLITS,
		},
		"comparison": comparison,
		"material_classifier": material_metrics,
		"shelf_life_regressor": material_metrics_regression,
		"artifacts": {
			"material_classifier": str(classifier_path),
			"shelf_life_regressor": str(regressor_path),
		},
	}
	metrics_path = artifact_dir / "metrics.json"
	metrics_path.write_text(
		json.dumps(_json_value(metrics), indent=2, allow_nan=False),
		encoding="utf-8",
	)
	classifier_table.to_csv(artifact_dir / "classifier_comparison.csv", index=False)
	regressor_table.to_csv(artifact_dir / "regressor_comparison.csv", index=False)

	print("\nMaterial classifier comparison (five-fold CV on training split)")
	print(classifier_table.to_string(index=False))
	print("\nShelf-life regressor comparison (five-fold CV on training split)")
	print(regressor_table.to_string(index=False))
	print("\nHoldout metrics")
	print(
		f"Classifier: {best_classifier_name}; accuracy={material_metrics['holdout_accuracy']:.4f}; "
		f"macro F1={material_metrics['holdout_f1_macro']:.4f}; "
		f"top-3 accuracy={material_metrics['holdout_top_3_accuracy']:.4f}"
	)
	print(
		f"Shelf life: {best_regressor_name}; RMSE={material_metrics_regression['holdout_rmse_days']:.3f} days; "
		f"R2={material_metrics_regression['holdout_r2']:.4f}"
	)
	print(f"Saved pipelines and metrics under {artifact_dir}")
	return metrics


def main() -> None:
	"""Run reproducible model selection and save the resulting artifacts."""
	warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")
	train_models()


if __name__ == "__main__":
	main()
