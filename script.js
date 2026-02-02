const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ELEMENTOS
const modal = document.getElementById('modal-politicas');
const btnAceptar = document.getElementById('btn-aceptar');
const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');

let comunidadActual = 'general';
let respondiendoA = null;
let tokenCaptcha = null;

// --- FIX: LÓGICA DEL MODAL ---
if (localStorage.getItem('politicasAceptadas')) {
    if (modal) modal.style.display = 'none';
}

if (btnAceptar) {
    btnAceptar.onclick = () => {
        localStorage.setItem('politicasAceptadas', 'true');
        modal.style.display = 'none';
        console.log("Acceso concedido broski");
    };
}

// --- CAPTCHA ---
function captchaResuelto(token) { tokenCaptcha = token; if(btnEnviar) btnEnviar.disabled = false; }

// --- RENDERIZADO ---
async function leerSecretos() {
    const { data, error } = await _supabase
        .from('secretos')
        .select('*')
        .eq('categoria', comunidadActual)
        .order('created_at', { ascending: false });

    if (error || !data) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);
    
    container.innerHTML = principal.map(s => {
        const susRespuestas = respuestas.filter(r => r.padre_id === s.id).reverse();
        
        const renderMedia = (url, isReply) => {
            if(!url) return '';
            const isVideo = url.toLowerCase().match(/\.(mp4|webm|ogg|mov)/i);
            const clase = isReply ? 'card-img-reply' : 'card-img';
            return isVideo ? 
                `<video src="${url}" controls playsinline class="${clase}"></video>` : 
                `<img src="${url}" class="${clase}" loading="lazy">`;
        };

        return `
            <div class="post-group">
                <div class="card">
                    <div class="post-header">
                        <span class="post-author">Anónimo</span>
                        <span class="post-id" onclick="citarPost(${s.id})">No.${s.id} [+]</span>
                    </div>
                    <p>${s.contenido}</p>
                    ${renderMedia(s.imagen_url, false)}
                    <div class="footer-card">
                        <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬 Responder</button>
                        <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                    </div>
                </div>
                <div class="replies-container">
                    ${susRespuestas.map(r => `
                        <div class="reply-card" style="margin-left: 60px; border-left: 2px solid #333; padding: 10px 20px;">
                            <span class="post-id">No.${r.id}</span>
                            <p>${r.contenido}</p>
                            ${renderMedia(r.imagen_url, true)}
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }).join('');
}

// Inicializar
leerSecretos();
