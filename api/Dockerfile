FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini worker.py ./
COPY migrations ./migrations
COPY app ./app
COPY data/sample.csv ./data/sample.csv

ENV PYTHONUNBUFFERED=1
ENV PORT=8765
EXPOSE 8765

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
