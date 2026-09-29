"""Integration coverage for FastAPI endpoints and persisted history."""

from fastapi.testclient import TestClient


def test_health_reports_loaded_models(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "model_status": "loaded"}


def test_recommendation_returns_three_options_and_saves_history(
    client: TestClient,
    food_payload: dict[str, object],
) -> None:
    response = client.post("/api/recommend", json=food_payload)
    assert response.status_code == 200
    body = response.json()
    assert len(body["recommendations"]) == 3
    assert all(0 <= item["probability"] <= 1 for item in body["recommendations"])
    assert all(0 <= item["suitability_score"] <= 100 for item in body["recommendations"])
    assert body["explanation"]

    history = client.get("/api/history")
    assert history.status_code == 200
    assert history.json()["total"] == 1
    assert history.json()["items"][0]["input_data"]["food_category"] == "fruits"
    assert len(history.json()["items"][0]["result"]["recommendations"]) == 3


def test_material_catalogue_and_not_found(client: TestClient) -> None:
    response = client.get("/api/materials", params={"cost_level": "low"})
    assert response.status_code == 200
    assert response.json()["total"] > 0
    assert all(item["cost_level"] == "low" for item in response.json()["materials"])

    detail = client.get("/api/materials/PET")
    assert detail.status_code == 200
    assert detail.json()["name"] == "PET"
    assert client.get("/api/materials/not-a-material").status_code == 404


def test_food_presets_include_all_supported_categories(client: TestClient) -> None:
    response = client.get("/api/foods")
    assert response.status_code == 200
    categories = {item["name"] for item in response.json()["categories"]}
    assert len(categories) == 12
    assert "seafood" in categories
    assert "defaults" in response.json()["categories"][0]


def test_history_filters_paginates_and_deletes(
    client: TestClient,
    food_payload: dict[str, object],
) -> None:
    client.post("/api/recommend", json=food_payload)
    other = {**food_payload, "food_category": "bakery"}
    client.post("/api/recommend", json=other)

    filtered = client.get("/api/history", params={"food_category": "fruits", "limit": 1})
    assert filtered.status_code == 200
    assert filtered.json()["total"] == 1
    assert len(filtered.json()["items"]) == 1

    history_id = filtered.json()["items"][0]["id"]
    deleted = client.delete(f"/api/history/{history_id}")
    assert deleted.status_code == 204
    assert client.delete(f"/api/history/{history_id}").status_code == 404


def test_model_metrics_include_charts_data(client: TestClient) -> None:
    response = client.get("/api/model/metrics")
    assert response.status_code == 200
    body = response.json()
    assert body["material_classifier"]["holdout_accuracy"] > 0
    assert body["feature_importance"]
    assert len(body["confusion_matrix"]["labels"]) == 13
    assert "classification" in body["comparison"]
    assert "regression" in body["comparison"]


def test_compare_warns_for_unsafe_selected_materials(
    client: TestClient,
    food_payload: dict[str, object],
) -> None:
    fatty_profile = {
        **food_payload,
        "food_category": "oils",
        "moisture_content": 0.2,
        "fat_content": 99,
        "pH": 6.0,
        "water_activity": 0.1,
        "respiration_rate": "low",
        "oxygen_sensitivity": "high",
        "light_sensitivity": "high",
    }
    response = client.post(
        "/api/compare",
        json={**fatty_profile, "material_names": ["LDPE film", "PET"]},
    )
    assert response.status_code == 200
    by_name = {item["material"]: item for item in response.json()["materials"]}
    assert by_name["LDPE film"]["warnings"]
    assert by_name["LDPE film"]["suitability_score"] < by_name["PET"]["suitability_score"]


def test_recommendation_safety_filter_excludes_weak_barriers(
    client: TestClient,
    food_payload: dict[str, object],
) -> None:
    fatty_profile = {
        **food_payload,
        "food_category": "oils",
        "moisture_content": 0.2,
        "fat_content": 99,
        "pH": 6.0,
        "water_activity": 0.1,
        "respiration_rate": "low",
        "oxygen_sensitivity": "high",
        "light_sensitivity": "high",
    }
    response = client.post("/api/recommend", json=fatty_profile)
    assert response.status_code == 200
    assert "LDPE film" in response.json()["safety_filtered_materials"]
    assert "LDPE film" not in {item["material"] for item in response.json()["recommendations"]}


def test_invalid_food_input_returns_clear_validation_error(
    client: TestClient,
    food_payload: dict[str, object],
) -> None:
    response = client.post("/api/recommend", json={**food_payload, "pH": 18})
    assert response.status_code == 422
    assert "pH" in response.text
