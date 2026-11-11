# Configuración de IA - Opciones Gratuitas

Tu aplicación está configurada para usar **proveedores de IA gratuitos** para el procesamiento de lenguaje natural. Aquí te explico cómo configurar cada opción.

## 🎯 Recomendación rápida

**Para empezar rápido:** Usa **Gemini** (5 minutos de configuración)  
**Para uso intensivo sin límites:** Usa **Ollama** (10 minutos de configuración)  
**Para máxima velocidad:** Usa **Groq** (5 minutos de configuración)
---

## 1️⃣ Gemini (Google) - **RECOMENDADO** ⭐

### ✅ Ventajas
- ✨ Gratuito con límites muy generosos (1500 peticiones/día)
- 🚀 Muy rápido y preciso
- ⚡ Configuración en 2 minutos

### 📝 Pasos

1. **Obtén tu API key gratis:**
   - Ve a: https://aistudio.google.com/app/apikey
   - Inicia sesión con tu cuenta de Google
   - Haz clic en "Create API Key"
   - Copia la clave

2. **Configura tu `.env`:**
   ```bash
   LLM_PROVIDERS=gemini,ollama
   GEMINI_API_KEY=tu_clave_aqui
   ```

3. **¡Listo!** Reinicia el servidor y prueba

### 🔧 Configuración avanzada (opcional)
```bash
# Usar modelo más reciente (experimental, puede ser más preciso)
GEMINI_MODEL=gemini-2.0-flash-exp

# Aumentar timeout si tienes conexión lenta
GEMINI_TIMEOUT_MS=30000
```

---

## 2️⃣ Ollama - **SIN LÍMITES** 🔓

### ✅ Ventajas
- 🆓 Completamente gratis, sin límites
- 🔒 Privado: corre en tu computadora, no envía datos a internet
- ⚡ Sin dependencia de servicios externos

### ⚠️ Desventajas
- Requiere descargar el modelo (~2GB)
- Más lento que opciones en la nube
- Usa RAM y CPU de tu computadora

### 📝 Pasos

1. **Instala Ollama:**
   - Windows: https://ollama.com/download/windows
   - Mac: `brew install ollama`
   - Linux: `curl -fsSL https://ollama.com/install.sh | sh`

2. **Descarga el modelo:**
   ```bash
   # Modelo ligero y rápido (recomendado)
   ollama pull qwen2.5-coder:3b
   
   # O un modelo más grande y preciso (requiere más RAM)
   # ollama pull llama3.1:8b
   ```

3. **Inicia el servidor Ollama:**
   ```bash
   # En Windows/Mac normalmente se inicia automáticamente
   # En Linux ejecuta:
   ollama serve
   ```

4. **Configura tu `.env`:**
   ```bash
   LLM_PROVIDERS=ollama
   # No necesitas API key para Ollama
   ```

5. **¡Listo!** Reinicia el servidor

### 🔧 Configuración avanzada (opcional)
```bash
# Usar otro modelo
OLLAMA_MODEL=llama3.1:8b

# Si cambiaste el puerto de Ollama
OLLAMA_BASE_URL=http://localhost:11434/v1

# Timeout mayor para modelos grandes
OLLAMA_TIMEOUT_MS=180000
```

### 💡 Modelos recomendados para Ollama

| Modelo | Tamaño | RAM mínima | Velocidad | Precisión |
|--------|--------|------------|-----------|-----------|
| `qwen2.5-coder:3b` | ~2GB | 8GB | ⚡⚡⚡ | ⭐⭐⭐ |
| `llama3.1:8b` | ~5GB | 16GB | ⚡⚡ | ⭐⭐⭐⭐ |
| `llama3.3:70b` | ~40GB | 64GB | ⚡ | ⭐⭐⭐⭐⭐ |

---

## 3️⃣ Groq - **MUY RÁPIDO** 🚀

### ✅ Ventajas
- ⚡ Extremadamente rápido (el más rápido de todos)
- 🆓 Gratis con límites (30 peticiones/minuto)
- 🎯 Muy preciso

### 📝 Pasos

1. **Obtén tu API key gratis:**
   - Ve a: https://console.groq.com/keys
   - Crea una cuenta
   - Haz clic en "Create API Key"
   - Copia la clave

2. **Configura tu `.env`:**
   ```bash
   LLM_PROVIDERS=groq,ollama
   GROQ_API_KEY=tu_clave_aqui
   ```

3. **¡Listo!** Reinicia el servidor

---

## 🔄 Usar múltiples proveedores (Fallback automático)

Puedes configurar varios proveedores. Si el primero falla (por límites, red, etc.), automáticamente probará el siguiente:

```bash
# Intenta Gemini primero, si falla usa Groq, si falla usa Ollama local
LLM_PROVIDERS=gemini,groq,ollama

GEMINI_API_KEY=tu_clave_gemini
GROQ_API_KEY=tu_clave_groq
# Ollama no necesita clave
```

### 🎯 Configuraciones recomendadas

**Para uso personal:**
```bash
LLM_PROVIDERS=gemini,ollama
GEMINI_API_KEY=tu_clave
```

**Para máxima velocidad:**
```bash
LLM_PROVIDERS=groq,gemini
GROQ_API_KEY=tu_clave
GEMINI_API_KEY=tu_clave
```

**Para máxima disponibilidad:**
```bash
LLM_PROVIDERS=gemini,groq,ollama
GEMINI_API_KEY=tu_clave
GROQ_API_KEY=tu_clave
```

**Para privacidad total (sin internet):**
```bash
LLM_PROVIDERS=ollama
# Solo Ollama, todo local
```

---

## 🧪 Probar la configuración

Una vez configurado, prueba con:

```bash
# Inicia el servidor
npm start

# En otro terminal, prueba una consulta
curl http://localhost:3000/api/informes/nl \
  -H "Content-Type: application/json" \
  -d '{"pregunta": "¿Cuántas transacciones hubo ayer?"}'
```

Si todo está bien, deberías ver una respuesta JSON con el pipeline generado.

---

## ❓ Preguntas frecuentes

### ¿Cuál es la mejor opción?
- **Gemini** es el mejor balance entre facilidad, velocidad y costo (gratis)
- **Ollama** es mejor si quieres privacidad total y sin límites
- **Groq** es el más rápido pero tiene menos peticiones gratis

### ¿Puedo usar OpenAI?
Sí, pero es de pago. Agrega a tu `.env`:
```bash
LLM_PROVIDERS=openai
OPENAI_API_KEY=tu_clave
```

### ¿Qué pasa si no configuro ninguna IA?
El servidor devolverá error 503 indicando que necesitas configurar al menos un proveedor.

### ¿Los modelos gratuitos son buenos?
Sí, para este caso de uso (generar queries de MongoDB) funcionan excelentemente. Gemini 2.0 y Llama 3.3 son modelos muy potentes.

---

## 🆘 Solución de problemas

### Error: "límite de peticiones alcanzado"
- **Solución:** Configura un proveedor de respaldo (Ollama) o espera unos minutos

### Error: "no se pudo conectar" (Ollama)
- **Verifica** que Ollama esté corriendo: `ollama list`
- **Reinicia** Ollama: cierra y abre la aplicación

### Error: "clave inválida"
- **Verifica** que copiaste la clave completa
- **Regenera** una nueva clave en el sitio del proveedor

### Las respuestas son lentas con Ollama
- **Solución:** Usa un modelo más pequeño (`qwen2.5-coder:3b`)
- **O** agrega Gemini/Groq como proveedor primario

---

## 📚 Más información

- Documentación de Gemini: https://ai.google.dev/docs
- Documentación de Ollama: https://ollama.com/docs
- Documentación de Groq: https://console.groq.com/docs
- Lista de modelos de Ollama: https://ollama.com/library
