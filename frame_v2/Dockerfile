FROM python:3.11-slim

# Install PostgreSQL client libraries and Nginx
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    nginx \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY templates/ ./templates/
COPY static/ ./static/
COPY nginx-container.conf /etc/nginx/conf.d/app.conf
COPY entrypoint.sh .
RUN chmod +x /app/entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["/app/entrypoint.sh"]

