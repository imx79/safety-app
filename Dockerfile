FROM node:20-slim

# أدوات البناء لـ better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# مجلد البيانات الدائمة
RUN mkdir -p /data/db /data/uploads

EXPOSE 3000

ENV DATA_DIR=/data
ENV UPLOADS_DIR=/data/uploads

CMD ["node", "server.js"]
