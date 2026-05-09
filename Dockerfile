FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    espeak-ng \
    ffmpeg \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Download models during build
RUN python download_models.py

# Expose port (Render will detect this, but we'll also use $PORT)
EXPOSE 5000

# Start server with dynamic port support
CMD gunicorn --bind 0.0.0.0:${PORT:-5000} jara:app
