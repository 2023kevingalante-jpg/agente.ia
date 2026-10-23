// Esperar a que el DOM esté totalmente cargado
document.addEventListener('DOMContentLoaded', () => {
    // Referencias a las zonas del DOM indicadas en el boceto
    const zonaChat = document.getElementById('zona-de-chat');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');

    // Configuración de tiempos de espera y bloqueos
    const TIMEOUT_MS = 10000; // Tiempo límite de respuesta (10 seg)
    const COOLDOWN_MS = 2000; // Tiempo de espera entre envíos (2 seg)
    let enCooldown = false;

    // Enviar con tecla Enter (sin Shift)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    // Manejar envío del formulario
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const mensajeTexto = userInput.value.trim();
        if (!mensajeTexto || enCooldown) return;

        // 1. Mostrar mensaje del usuario
        agregarMensaje(mensajeTexto, 'user');
        userInput.value = '';

        // 2. Bloquear UI
        setEstadoEnviando(true);

        // 3. Crear indicador de "Pensando..."
        const idCargando = agregarIndicadorCargando();

        // Configurar AbortController para cancelar si tarda demasiado
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            // Realizar la petición POST asíncrona
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mensaje: mensajeTexto }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Error en el servidor (${response.status})`);
            }

            const data = await response.json();
            
            // Remover indicador de carga
            removerMensaje(idCargando);

            // Mostrar respuesta del agente (se admite campo 'respuesta' o 'message')
            const textoRespuesta = data.respuesta || data.message || "¡Mensaje recibido con éxito!";
            agregarMensaje(textoRespuesta, 'bot');

        } catch (error) {
            clearTimeout(timeoutId);
            removerMensaje(idCargando);

            // Manejo visual del error
            if (error.name === 'AbortError') {
                agregarMensaje('El servidor tardó demasiado en responder. Inténtalo de nuevo.', 'bot error');
            } else {
                // Si el webhook de prueba falla/no responde, se muestra una respuesta simulada para pruebas
                agregarMensaje('Respuesta de prueba: He recibido tu consulta correctamente.', 'bot');
            }
        } finally {
            // Iniciar temporizador de cooldown entre envíos
            enCooldown = true;
            setTimeout(() => {
                enCooldown = false;
                setEstadoEnviando(false);
            }, COOLDOWN_MS);
        }
    });

    // Función auxiliar para agregar mensajes a la zona de chat
    function agregarMensaje(texto, tipo) {
        const divMensaje = document.createElement('div');
        divMensaje.className = `mensaje ${tipo}`;
        
        const divBurbuja = document.createElement('div');
        divBurbuja.className = 'burbuja';
        divBurbuja.textContent = texto;

        divMensaje.appendChild(divBurbuja);
        zonaChat.appendChild(divMensaje);

        // Auto-scroll al último mensaje
        zonaChat.scrollTop = zonaChat.scrollHeight;
        return divMensaje;
    }

    // Función para mostrar animación de cargando
    function agregarIndicadorCargando() {
        const id = 'cargando-' + Date.now();
        const divMensaje = document.createElement('div');
        divMensaje.className = 'mensaje bot';
        divMensaje.id = id;

        const divBurbuja = document.createElement('div');
        divBurbuja.className = 'burbuja';
        divBurbuja.innerHTML = `
            <div class="cargando-dots">
                <span></span><span></span><span></span>
            </div>
        `;

        divMensaje.appendChild(divBurbuja);
        zonaChat.appendChild(divMensaje);
        zonaChat.scrollTop = zonaChat.scrollHeight;
        return id;
    }

    // Función para remover elemento por ID
    function removerMensaje(id) {
        const elem = document.getElementById(id);
        if (elem) elem.remove();
    }

    // Estado del botón y campo mientras se envía
    function setEstadoEnviando(deshabilitar) {
        sendBtn.disabled = deshabilitar;
        userInput.disabled = deshabilitar;
        if (!deshabilitar) userInput.focus();
    }
});