"""Validated request and response schemas for the public API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

FoodCategory = Literal[
	"fruits", "vegetables", "dairy", "meat", "seafood", "bakery",
	"grains", "snacks", "beverages", "frozen", "spices", "oils",
]
Level = Literal["low", "medium", "high"]


class FoodProfile(BaseModel):
	"""Food composition and logistics fields consumed by the saved ML pipelines."""

	model_config = ConfigDict(extra="forbid")

	food_category: FoodCategory
	moisture_content: float = Field(ge=0, le=100)
	fat_content: float = Field(ge=0, le=100)
	pH: float = Field(ge=0, le=14)
	water_activity: float = Field(ge=0, le=1)
	respiration_rate: Level
	oxygen_sensitivity: Level
	light_sensitivity: Level
	storage_temp: float = Field(ge=-40, le=60)
	relative_humidity: float = Field(ge=0, le=100)
	transport_days: int = Field(ge=0, le=365)
	required_shelf_life_days: int = Field(ge=1, le=1095)
	budget_level: Level
	sustainability_priority: Level


class MaterialRecommendation(BaseModel):
	"""One material option with model confidence and decision details."""

	material: str
	probability: float = Field(ge=0, le=1)
	predicted_shelf_life_days: float = Field(ge=0)
	suitability_score: float = Field(ge=0, le=100)
	cost_level: str
	sustainability_score: float = Field(ge=0, le=100)
	recyclability: float = Field(ge=0, le=100)
	biodegradability: float = Field(ge=0, le=100)
	pros: list[str]
	cons: list[str]
	explanation: str
	warnings: list[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
	"""Recommendation result returned by the inference endpoint."""

	recommendations: list[MaterialRecommendation]
	explanation: str
	safety_filtered_materials: list[str]


class CompareRequest(FoodProfile):
	"""Food profile and two or three user-selected materials to compare."""

	material_names: list[str] = Field(min_length=2, max_length=3)

	@model_validator(mode="after")
	def unique_material_names(self) -> "CompareRequest":
		"""Reject repeated choices so each comparison column is distinct."""
		if len(set(self.material_names)) != len(self.material_names):
			raise ValueError("material_names must contain distinct material names")
		return self


class HistoryRecord(BaseModel):
	"""Persisted recommendation history row."""

	id: int
	created_at: datetime
	food_category: str
	input_data: dict[str, object]
	result: RecommendationResponse


class HistoryPage(BaseModel):
	"""Paginated history response."""

	items: list[HistoryRecord]
	total: int
	limit: int
	offset: int


class CompareResponse(BaseModel):
	"""Comparison table data for selected materials."""

	materials: list[MaterialRecommendation]
