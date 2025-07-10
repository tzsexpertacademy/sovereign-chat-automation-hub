#!/bin/bash

# Script para corrigir dependências do Puppeteer automaticamente
# Arquivo: scripts/fix-puppeteer-dependencies.sh

echo "🔧 CORREÇÃO AUTOMÁTICA - DEPENDÊNCIAS PUPPETEER"
echo "==============================================="

# Verificar se é root ou tem sudo
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    echo "❌ Este script precisa de privilégios sudo"
    echo "Execute: sudo $0"
    exit 1
fi

# Detectar sistema operacional
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Não foi possível detectar o sistema operacional"
    exit 1
fi

echo "🔍 Sistema detectado: $OS"

# Atualizar repositórios
echo ""
echo "1️⃣ ATUALIZANDO REPOSITÓRIOS"
echo "=========================="
case $OS in
    "ubuntu"|"debian")
        sudo apt update
        ;;
    "centos"|"rhel"|"fedora")
        if command -v dnf &> /dev/null; then
            sudo dnf update -y
        else
            sudo yum update -y
        fi
        ;;
    *)
        echo "⚠️ Sistema não suportado automaticamente: $OS"
        ;;
esac

# Instalar Chrome/Chromium
echo ""
echo "2️⃣ INSTALANDO CHROME/CHROMIUM"
echo "============================"

# Verificar se Chrome já está instalado
if command -v google-chrome &> /dev/null || command -v google-chrome-stable &> /dev/null; then
    echo "✅ Google Chrome já está instalado"
elif command -v chromium &> /dev/null || command -v chromium-browser &> /dev/null; then
    echo "✅ Chromium já está instalado"
else
    echo "📦 Instalando Chrome/Chromium..."
    
    case $OS in
        "ubuntu"|"debian")
            # Tentar instalar Google Chrome primeiro
            echo "🔍 Tentando instalar Google Chrome..."
            if ! command -v google-chrome &> /dev/null; then
                # Baixar e instalar Google Chrome
                cd /tmp
                wget -q -O google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
                if [ $? -eq 0 ]; then
                    sudo dpkg -i google-chrome.deb
                    sudo apt-get install -f -y  # Corrigir dependências quebradas
                    echo "✅ Google Chrome instalado"
                else
                    echo "⚠️ Falha ao baixar Chrome, tentando Chromium..."
                    sudo apt install -y chromium-browser
                fi
                rm -f google-chrome.deb
            fi
            ;;
        "centos"|"rhel"|"fedora")
            # Instalar Chromium
            if command -v dnf &> /dev/null; then
                sudo dnf install -y chromium
            else
                sudo yum install -y chromium
            fi
            ;;
    esac
fi

# Instalar dependências do sistema
echo ""
echo "3️⃣ INSTALANDO DEPENDÊNCIAS DO SISTEMA"
echo "===================================="

case $OS in
    "ubuntu"|"debian")
        echo "📦 Instalando bibliotecas necessárias..."
        sudo apt install -y \
            libx11-6 \
            libxcomposite1 \
            libxdamage1 \
            libxext6 \
            libxfixes3 \
            libxrandr2 \
            libxss1 \
            libxtst6 \
            libatspi2.0-0 \
            libdrm2 \
            libgtk-3-0 \
            libgdk-pixbuf2.0-0 \
            libasound2 \
            libatk-bridge2.0-0 \
            libcairo-gobject2 \
            libgbm1 \
            libnss3 \
            libxkbcommon0 \
            fonts-liberation \
            libappindicator3-1 \
            xdg-utils \
            ca-certificates \
            libgconf-2-4 \
            libxrender1 \
            libxtst6 \
            libxi6 \
            libglib2.0-0
        ;;
    "centos"|"rhel"|"fedora")
        if command -v dnf &> /dev/null; then
            sudo dnf install -y \
                libX11 \
                libXcomposite \
                libXdamage \
                libXext \
                libXfixes \
                libXrandr \
                libXss \
                libXtst \
                at-spi2-atk \
                libdrm \
                gtk3 \
                gdk-pixbuf2 \
                alsa-lib \
                atk \
                cairo-gobject \
                mesa-libgbm \
                nss \
                libxkbcommon
        else
            sudo yum install -y \
                libX11 \
                libXcomposite \
                libXdamage \
                libXext \
                libXfixes \
                libXrandr \
                libXScrnSaver \
                libXtst \
                at-spi2-atk \
                libdrm \
                gtk3 \
                gdk-pixbuf2 \
                alsa-lib \
                atk \
                cairo-gobject \
                mesa-libgbm \
                nss \
                libxkbcommon
        fi
        ;;
esac

# Verificar e corrigir permissões
echo ""
echo "4️⃣ VERIFICANDO PERMISSÕES"
echo "======================="

# Criar diretórios necessários
sudo mkdir -p /tmp/chrome-user-data
sudo chmod 777 /tmp/chrome-user-data

# Verificar permissões do usuário atual
USER_HOME=$(eval echo ~$SUDO_USER)
if [ -n "$SUDO_USER" ]; then
    echo "🔍 Configurando permissões para usuário: $SUDO_USER"
    
    # Criar diretório de sessões se não existir
    if [ -d "$USER_HOME/sovereign-chat-automation-hub" ]; then
        sudo mkdir -p "$USER_HOME/sovereign-chat-automation-hub/server/sessions"
        sudo chown -R $SUDO_USER:$SUDO_USER "$USER_HOME/sovereign-chat-automation-hub/server/sessions"
        echo "✅ Permissões de sessões configuradas"
    fi
fi

# Limpar processos Chrome órfãos
echo ""
echo "5️⃣ LIMPANDO PROCESSOS ÓRFÃOS"
echo "==========================="
sudo pkill -f "chrome|chromium" 2>/dev/null || true
sudo rm -rf /tmp/.com.google.Chrome.* 2>/dev/null || true
sudo rm -rf /tmp/chrome-user-data/* 2>/dev/null || true
echo "✅ Processos Chrome limpos"

# Teste final
echo ""
echo "6️⃣ TESTE FINAL"
echo "============="

# Verificar se Chrome está funcionando
if command -v google-chrome &> /dev/null; then
    CHROME_CMD="google-chrome"
elif command -v google-chrome-stable &> /dev/null; then
    CHROME_CMD="google-chrome-stable"
elif command -v chromium &> /dev/null; then
    CHROME_CMD="chromium"
elif command -v chromium-browser &> /dev/null; then
    CHROME_CMD="chromium-browser"
else
    echo "❌ Nenhum navegador encontrado após instalação"
    exit 1
fi

echo "🔍 Testando Chrome: $CHROME_CMD"

# Teste básico do Chrome headless
if timeout 30 $CHROME_CMD --headless --no-sandbox --disable-gpu --dump-dom --virtual-time-budget=1000 about:blank &>/dev/null; then
    echo "✅ Chrome headless funcionando!"
else
    echo "❌ Chrome headless não está funcionando"
    echo "💡 Teste manual: $CHROME_CMD --headless --no-sandbox --disable-gpu --dump-dom about:blank"
fi

echo ""
echo "🎉 CORREÇÃO CONCLUÍDA!"
echo "===================="
echo "✅ Dependências do Puppeteer instaladas"
echo "✅ Chrome/Chromium configurado"
echo "✅ Permissões ajustadas"
echo ""
echo "💡 Próximo passo: Reiniciar o servidor WhatsApp"
echo "   ./scripts/fix-whatsapp-definitive.sh"
echo ""
echo "📅 Correção concluída em: $(date)"