FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	DATABASE_URL=sqlite:////app/var/food_packaging.db

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
	&& pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY ml ./ml
COPY data ./data

# Model/data outputs are git-ignored, so build reproducible artifacts into the image.
RUN python ml/generate_dataset.py \
	&& python ml/train.py \
	&& mkdir -p /app/var \
	&& useradd --system --uid 10001 --create-home appuser \
	&& chown -R appuser:appuser /app/var

USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
