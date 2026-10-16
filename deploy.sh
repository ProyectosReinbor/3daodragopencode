#!/bin/bash
set -e

PROJECT_DIR="/home/aodase"
SERVICE_NAME="aodase"

echo "=== AODASE Pets - Deploy ==="

cd "$PROJECT_DIR"

echo "[1/4] Instalando dependencias..."
npm install --production=false
npm --prefix server install --omit=dev

echo "[2/4] Building frontend..."
rm -rf dist
npm run build

echo "[3/4] Instalando dependencias del servidor..."
cd server && npm install --omit=dev && cd ..

echo "[4/4] Configurando servicio systemd..."
# Conserva el JWT_SECRET ya desplegado (lo pisa un unit anterior: aodase o reinos)
JWT_SECRET_VALUE=$(grep -h '^Environment=JWT_SECRET=' \
  /etc/systemd/system/${SERVICE_NAME}.service /etc/systemd/system/reinos.service 2>/dev/null \
  | head -1 | cut -d= -f3- || true)

cat > /etc/systemd/system/${SERVICE_NAME}.service << 'EOF'
[Unit]
Description=AODASE Pets Game Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/aodase/server
ExecStart=/usr/local/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3002
Environment=HOST=127.0.0.1
Environment=PUBLIC_HOST=aodase.reinbor.cloud
Environment=ADMIN_HOST=aodaseadmin.reinbor.cloud
# Environment=JWT_SECRET=...  # obligatorio con NODE_ENV=production; conservar el valor ya desplegado
StandardOutput=journal
StandardError=journal
SyslogIdentifier=aodase

[Install]
WantedBy=multi-user.target
EOF

if [ -n "$JWT_SECRET_VALUE" ]; then
  echo "Environment=JWT_SECRET=${JWT_SECRET_VALUE}" >> /etc/systemd/system/${SERVICE_NAME}.service
else
  echo "AVISO: no se encontro JWT_SECRET previo; agregarlo al unit antes de producción."
fi

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

echo ""
echo "=== Listo! ==="
echo "Servicio: systemctl status ${SERVICE_NAME}"
echo "Logs:     journalctl -u ${SERVICE_NAME} -f"
echo "URL:      https://aodase.reinbor.cloud/"
echo "Admin:    https://aodaseadmin.reinbor.cloud/"
