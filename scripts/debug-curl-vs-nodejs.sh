#!/bin/bash

# Debug definitivo da diferença entre CURL e Node.js
echo "🔍 DEBUG: CURL vs NODE.JS - POR QUE UM FUNCIONA E OUTRO NÃO?"
echo "==========================================================="

echo ""
echo "🧪 TESTE 1: VERIFICAR VERSÃO SUPABASE-JS"
echo "========================================"

cd server || exit 1

echo "📦 Versão do @supabase/supabase-js:"
npm list @supabase/supabase-js

echo ""
echo "🧪 TESTE 2: INTERCEPTAR REQUISIÇÃO DO NODE.JS"
echo "============================================="

# Criar script para ver exatamente o que o Node.js está enviando
cat > debug-supabase-request.js << 'EOF'
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 DEBUG: O QUE O NODE.JS ESTÁ ENVIANDO?');
console.log('========================================');

const SUPABASE_URL = 'https://ymygyagbvbsdfkduxmgu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY';

console.log('URL:', SUPABASE_URL);
console.log('KEY:', SUPABASE_SERVICE_KEY.substring(0, 20) + '...');

// MÉTODO 1: Requisição direta com fetch (como CURL faz)
console.log('\n🧪 MÉTODO 1: FETCH DIRETO (IGUAL CURL)');
console.log('====================================');

const testDirectFetch = async () => {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_instances?limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Headers:', [...response.headers.entries()]);
    console.log('Body:', text);
    
    if (response.ok) {
      console.log('✅ FETCH DIRETO FUNCIONOU!');
    } else {
      console.log('❌ FETCH DIRETO FALHOU');
    }
  } catch (error) {
    console.error('💥 Erro no fetch direto:', error);
  }
};

// MÉTODO 2: Biblioteca Supabase (que está falhando)
console.log('\n🧪 MÉTODO 2: BIBLIOTECA SUPABASE');
console.log('===============================');

const testSupabaseClient = async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('Cliente Supabase criado');
    
    const { data, error } = await supabase.from('whatsapp_instances').select('id').limit(1);
    
    if (error) {
      console.log('❌ BIBLIOTECA SUPABASE FALHOU:', error);
    } else {
      console.log('✅ BIBLIOTECA SUPABASE FUNCIONOU:', data);
    }
  } catch (error) {
    console.error('💥 Erro na biblioteca Supabase:', error);
  }
};

// Executar ambos os testes
(async () => {
  await testDirectFetch();
  await testSupabaseClient();
  process.exit(0);
})();
EOF

echo "🚀 Executando debug das requisições..."
node debug-supabase-request.js

echo ""
echo "🧪 TESTE 3: TENTAR DIFERENTES CONFIGURAÇÕES"
echo "=========================================="

# Testar com configurações diferentes do client
cat > test-supabase-configs.js << 'EOF'
const { createClient } = require('@supabase/supabase-js');

console.log('🧪 TESTANDO DIFERENTES CONFIGURAÇÕES DO SUPABASE CLIENT');
console.log('======================================================');

const SUPABASE_URL = 'https://ymygyagbvbsdfkduxmgu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY';

// Teste 1: Configuração básica
console.log('\n🔧 TESTE 1: Configuração básica');
const testBasic = async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase.from('whatsapp_instances').select('id').limit(1);
    console.log('Básica - Error:', error?.message || 'Nenhum');
    console.log('Básica - Data:', data ? 'Dados recebidos' : 'Sem dados');
  } catch (err) {
    console.log('Básica - Erro crítico:', err.message);
  }
};

// Teste 2: Com auth especificado
console.log('\n🔧 TESTE 2: Com autoRefreshToken false');
const testNoRefresh = async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { data, error } = await supabase.from('whatsapp_instances').select('id').limit(1);
    console.log('NoRefresh - Error:', error?.message || 'Nenhum');
    console.log('NoRefresh - Data:', data ? 'Dados recebidos' : 'Sem dados');
  } catch (err) {
    console.log('NoRefresh - Erro crítico:', err.message);
  }
};

// Teste 3: Com global headers
console.log('\n🔧 TESTE 3: Com headers globais');
const testWithHeaders = async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: {
        headers: {
          'X-Client-Info': 'whatsapp-server/1.0.0'
        }
      }
    });
    const { data, error } = await supabase.from('whatsapp_instances').select('id').limit(1);
    console.log('Headers - Error:', error?.message || 'Nenhum');
    console.log('Headers - Data:', data ? 'Dados recebidos' : 'Sem dados');
  } catch (err) {
    console.log('Headers - Erro crítico:', err.message);
  }
};

(async () => {
  await testBasic();
  await testNoRefresh();
  await testWithHeaders();
  process.exit(0);
})();
EOF

echo "🚀 Testando configurações diferentes..."
node test-supabase-configs.js

echo ""
echo "🧪 TESTE 4: VERIFICAR SE É PROBLEMA DE REDE/SSL"
echo "=============================================="

echo "🔍 Testando conectividade direta ao Supabase..."
curl -v -X GET "https://ymygyagbvbsdfkduxmgu.supabase.co/rest/v1/whatsapp_instances?limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlteWd5YWdidmJzZGZrZHV4bWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDQ1NDE2OSwiZXhwIjoyMDY2MDMwMTY5fQ.NVHSdQAUw8a8HkHdFQKqfTNAT2dFuuSlZRhzqpnV3dY"

# Limpar arquivos de teste
rm debug-supabase-request.js test-supabase-configs.js

cd ..

echo ""
echo "🎯 CONCLUSÃO DO DEBUG"
echo "===================="
echo "Se o FETCH DIRETO funcionou mas a BIBLIOTECA SUPABASE falhou:"
echo "-> O problema é na biblioteca ou na sua configuração"
echo "-> Podemos substituir a biblioteca por requisições fetch diretas"
echo ""
echo "Se ambos falharam:"
echo "-> O problema é de rede/conectividade do Node.js para o Supabase"