
#!/bin/bash

# Script para corrigir certificado SSL incompatível
# Arquivo: scripts/fix-ssl-certificate.sh

echo "🔐 CORRIGINDO CERTIFICADO SSL INCOMPATÍVEL"
echo "========================================="

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Execute como root: sudo ./scripts/fix-ssl-certificate.sh"
    exit 1
fi

DOMAIN="146.59.227.248"

echo "🛑 Parando Nginx..."
systemctl stop nginx

echo "🧹 Removendo certificados antigos..."
rm -rf /etc/ssl/whatsapp-multi-client/*
rm -rf /etc/ssl/whatsapp/*

# Criar diretório se não existir
mkdir -p /etc/ssl/whatsapp-multi-client

echo "🔐 Criando certificado SSL COMPATÍVEL..."

# Criar configuração SSL corrigida
cat > /tmp/ssl-compatible.conf << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = BR
ST = SP
L = Sao Paulo
O = WhatsApp Multi Client
CN = $DOMAIN

[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = localhost
IP.1 = $DOMAIN
IP.2 = 127.0.0.1
EOF

# Gerar chave privada
openssl genrsa -out /etc/ssl/whatsapp-multi-client/private.key 2048

# Gerar certificado com a configuração corrigida
openssl req -new -x509 -key /etc/ssl/whatsapp-multi-client/private.key \
    -out /etc/ssl/whatsapp-multi-client/certificate.crt \
    -days 365 \
    -config /tmp/ssl-compatible.conf \
    -extensions v3_req

# Definir permissões corretas
chmod 600 /etc/ssl/whatsapp-multi-client/private.key
chmod 644 /etc/ssl/whatsapp-multi-client/certificate.crt

echo "✅ Certificado SSL COMPATÍVEL criado!"

# Verificar certificado
echo "🔍 Verificando certificado criado..."
openssl x509 -in /etc/ssl/whatsapp-multi-client/certificate.crt -text -noout | grep -A2 "X509v3 Key Usage"

echo "🚀 Iniciando Nginx..."
systemctl start nginx

# Aguardar Nginx inicializar
sleep 3

echo "🧪 Testando certificado SSL..."
if curl -k -s https://$DOMAIN/health > /dev/null; then
    echo "✅ Certificado SSL funcionando!"
else
    echo "⚠️ Certificado pode precisar ser aceito no navegador"
fi

echo ""
echo "🎉 CERTIFICADO SSL CORRIGIDO!"
echo "============================"
echo ""
echo "✅ Certificado compatível criado"
echo "✅ Nginx reiniciado"
echo "✅ Configuração SSL corrigida"
echo ""
echo "🌐 Teste agora:"
echo "  • Acesse: https://$DOMAIN/health"
echo "  • Aceite o certificado no navegador"
echo "  • Clique em 'Avançado' > 'Prosseguir'"
echo ""
echo "🔍 Verificar logs:"
echo "  • tail -f /var/log/nginx/error.log"
echo ""

# Limpar arquivos temporários
rm -f /tmp/ssl-compatible.conf

