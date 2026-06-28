FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev git \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch separately so the index URL is configurable.
# Default: CUDA 12.4. For CPU-only builds pass:
#   --build-arg TORCH_INDEX=https://download.pytorch.org/whl/cpu
ARG TORCH_INDEX=https://download.pytorch.org/whl/cu124
RUN pip install --no-cache-dir torch --index-url ${TORCH_INDEX}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
