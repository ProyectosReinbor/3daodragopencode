#!/bin/bash
set -e

PROJECT_DIR="/home/3daodrag"
SERVICE_NAME="reinos"

echo "=== Reinos Ancestrales - Deploy ==="

cd "$PROJECT_DIR"

echo "[1/4] Instalando dependencias..."
npm install --production=false

echo "[2/4] Building frontend..."
npm run build

echo "[3/4] Instalando dependencias del servidor..."
cd server && npm install --production && cd ..

echo "[4/4] Configurando servicio systemd..."
cat > /etc/systemd/system/${SERVICE_NAME}.service << 'EOF'
[Unit]
Description=Reinos Ancestrales Game Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/3daodrag/server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
StandardOutput=journal
StandardError=journal
SyslogIdentifier=reinos

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

echo ""
echo "=== Listo! ==="
echo "Servicio: systemctl status ${SERVICE_NAME}"
echo "Logs:     journalctl -u ${SERVICE_NAME} -f"
echo "URL:      http://localhost:3000"
