const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const fotoInput = document.getElementById('fotoInput');

let comunidadActual = 'general';
let ultimaPublicacion = 0;
let respondiendoA = null;

// --- SEGURIDAD: ANTI-XSS ---
function escaparHTML(str) {
    if (!str) return "";
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- TOGGLE DE RESPUESTAS ---
function toggleRespuestas(id) {
    const div = document.getElementById(`respuestas-${id}`);
    const btnToggle = document.getElementById(`btn-toggle-${id}`);
    if (div.style.display === "none") {
        div.style.display = "block";
        btnToggle.innerText = "Ocultar respuestas";
    } else {
        div.style.display = "none";
        btnToggle.innerText = `Ver respuestas`;
    }
}

// --- SISTEMA DE RESPUESTAS MEJORADO ---
function prepararRespuesta(id, mencionId = null) {
    respondiendoA = id;
    if (mencionId) {
        input.value = `>>${mencionId} `; // Estilo tipo foro para citar
        input.placeholder = `Respondiendo al comentario #${mencionId}...`;
    } else {
        input.placeholder = `Respondiendo al post #${id}...`;
    }
    input.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if(!document.getElementById('btn-cancelar-reply')) {
        const cancel = document.createElement('span');
        cancel.id = 'btn-cancelar-reply';
        cancel.innerHTML = " [✖ Cancelar]";
        cancel.className = "cancelar-text";
        cancel.onclick = () => {
            respondiendoA = null;
            input.value = "";
            input.placeholder = "¿Qué está pasando?";
            cancel.remove();
        };
        input.parentNode.insertBefore(cancel, input);
    }
}

// --- LEER CON HILOS ANIDADOS ---
async function leerSecretos() {
    const { data: todos } = await _supabase.from('secretos').select('*').order('created_at', { ascending: false });
    
    if (todos) {
        const principales = todos.filter(s => !s.padre_id);
        const respuestas = todos.filter(s => s.padre_id);
        let htmlFinal = "";

        principales.forEach((s, index) => {
            const yaVoto = localStorage.getItem(`voto_${s.id}`);
            const imgHtml = s.imagen_url ? `<img src="${s.imagen_url}" class="card-img">` : "";
            
            const susRespuestas = respuestas.filter(r => r.padre_id === s.id);
            let respuestasHtml = "";
            
            susRespuestas.forEach(r => {
                const rImg = r.imagen_url ? `<img src="${r.imagen_url}" class="card-img-reply">` : "";
                const rVoto = localStorage.getItem(`voto_${r.id}`);
                
                respuestasHtml += `
                    <div class="reply-card">
                        <small style="color:var(--accent-red); font-size:10px;">ID: ${r.id}</small>
                        <p>${escaparHTML(r.contenido)}</p>
                        ${rImg}
                        <div class="footer-card">
                            <small>${new Date(r.created_at).toLocaleString()}</small>
                            <div class="actions">
                                <button class="reply-btn-inner" onclick="prepararRespuesta(${s.id}, ${r.id})">↩ Responder</button>
                                <button class="like-btn" ${rVoto ? 'disabled' : ''} onclick="reaccionar(${r.id}, 'likes')">🔥 ${r.likes || 0}</button>
                            </div>
                        </div>
                    </div>`;
            });

            const btnToggle = susRespuestas.length > 0 
                ? `<button id="btn-toggle-${s.id}" class="toggle-btn" onclick="toggleRespuestas(${s.id})">Ver ${susRespuestas.length} respuestas</button>` 
                : "";

            htmlFinal += `
                <div class="post-group">
                    <div class="card">
                        <small style="color:var(--text-dim); font-size:10px;">ID: ${s.id}</small>
                        <p>${escaparHTML(s.contenido)}</p>
                        ${imgHtml}
                        <div class="footer-card">
                            <small>${new Date(s.created_at).toLocaleString()}</small>
                            <div class="actions">
                                <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                                <button class="like-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, 'likes')">🔥 ${s.likes || 0}</button>
                            </div>
                        </div>
                    </div>
                    ${btnToggle}
                    <div id="respuestas-${s.id}" class="replies-container" style="display:none;">
                        ${respuestasHtml}
                    </div>
                </div>`;
            // ... resto del loop (ads)
        });
        container.innerHTML = htmlFinal || '<p style="text-align:center;">No hay secretos...</p>';
    }
}
// ... resto de funciones (enviar, comprimir, etc.)
