const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 1. ESTADO GLOBAL ---
let tokenCaptcha = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;
let procesandoLike = false; 
let modeloNSFW = null;

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');
const fotoInput = document.getElementById('fotoInput');
const previewContainer = document.getElementById('preview-container');

// --- 2. FUNCIONES DE APOYO (DEBEN IR ARRIBA) ---
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renderMedia(url, nsfw) {
    if(!url) return '';
    const blur = nsfw ? 'media-censurada' : '';
    const isVid = url.toLowerCase().match(/\.(mp4|webm|mov|ogg)/i);
    let html = `<div style="position:relative; margin:10px 0;">`;
    if(nsfw) html += `<div class="nsfw-overlay" onclick="this.nextElementSibling.classList.remove('media-censurada'); this.remove()">NSFW - VER</div>`;
    html += isVid ? `<video src="${url}" controls class="card-img ${blur}"></video>` 
                  : `<img src="${url}" class="card-img ${blur}" onclick="abrirCine('${url}')" style="cursor:zoom-in">`;
    return html + `</div>`;
}

async function cargarImagenLocal(file) {
    return new Promise((res) => {
        const r = new FileReader();
        r.onload = (e) => res(e.target.result);
        r.readAsDataURL(file);
    });
}

// --- 3. INICIALIZACIÓN ---
async function inicializar() {
    if (container) leerSecretos();
    try {
        if (typeof nsfwjs !== 'undefined') {
            modeloNSFW = await nsfwjs.load();
        }
    } catch (e) { console.warn("IA cargando en segundo plano..."); }
}
inicializar();

// --- 4. NAVEGACIÓN ---
window.cambiarComunidad = (comunidad) => {
    comunidadActual = comunidad;
    filtroTop = false;
    actualizarTabs('inicio');
    leerSecretos();
};

window.verTop = () => { filtroTop = true; actualizarTabs('top'); leerSecretos(); };
window.verInicio = () => { filtroTop = false; comunidadActual = 'general'; actualizarTabs('inicio'); leerSecretos(); };

function actualizarTabs(tipo) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.innerText.toLowerCase().includes(tipo));
    });
}

// --- 5. LÓGICA DE PUBLICACIÓN (EL FIX) ---
btnEnviar.onclick = async () => {
    if (!tokenCaptcha) return alert("Resuelve el captcha primero");
    
    btnEnviar.disabled = true;
    btnEnviar.innerText = "Subiendo...";

    try {
        let url = null;
        let esNSFW = false;

        // Si hay foto, la procesamos
        if (fotoInput.files[0]) {
            const f = fotoInput.files[0];
            
            // 1. Escaneo NSFW (Si falla, sigue adelante)
            try {
                if (f.type.startsWith('image/') && modeloNSFW) {
                    const img = new Image();
                    img.src = await cargarImagenLocal(f);
                    await img.decode();
                    const pred = await modeloNSFW.classify(img);
                    esNSFW = pred.some(p => (p.className === 'Porn' || p.className === 'Hentai') && p.probability > 0.5);
                }
            } catch (iaErr) { console.error("Error IA:", iaErr); }

            // 2. Subida a Supabase Storage
            const n = `${Date.now()}.${f.name.split('.').pop()}`;
            const { error: upErr } = await _supabase.storage.from('imagenes').upload(n, f);
            if (upErr) throw upErr;
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }

        // 3. Insertar en la tabla (Asegúrate que las columnas coincidan: contenido, categoria, padre_id, imagen_url, es_nsfw)
        const { error: insErr } = await _supabase.from('secretos').insert([{ 
            contenido: input.value, 
            categoria: comunidadActual, 
            padre_id: respondiendoA, 
            imagen_url: url,
            es_nsfw: esNSFW 
        }]);

        if (insErr) throw insErr;

        // 4. Limpiar interfaz
        input.value = ""; 
        fotoInput.value = "";
        cancelarPreview(); 
        cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        tokenCaptcha = null;
        
        // Actualizar lista
        leerSecretos();

    } catch(e) { 
        console.error("Error completo:", e);
        alert("Fallo al publicar. Revisa tu conexión."); 
    } finally { 
        btnEnviar.disabled = false; 
        btnEnviar.innerText = "Publicar";
    }
};

// --- 6. LEER POSTS ---
async function leerSecretos() {
    if (!container) return;
    let q = _supabase.from('secretos').select('*');
    if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.eq('categoria', comunidadActual).order('ultima_actividad', { ascending: false });

    const { data, error } = await q;
    if (error || !data) return;

    const hilos = data.filter(s => !s.padre_id);
    container.innerHTML = hilos.map(s => {
        const susResp = data.filter(r => r.padre_id === s.id).sort((a,b) => a.id - b.id);
        const yaLike = localStorage.getItem('v_' + s.id) ? 'style="color:#ff4500"' : '';
        return `<div class="post-group">
            <div class="card">
                <span class="post-author" onclick="citarPost(${s.id})">#${s.id} [+]</span>
                <p style="font-size:18px">${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url, s.es_nsfw)}
                <div class="footer-card">
                    <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                    <button class="like-btn" ${yaLike} onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => {
                const yaLR = localStorage.getItem('v_' + r.id) ? 'style="color:#ff4500"' : '';
                return `<div class="reply-card" style="margin-left:30px; border-left:2px solid red; padding:10px; background:#111; margin-bottom:5px;">
                    <p>${escaparHTML(r.contenido)}</p>
                    ${renderMedia(r.imagen_url, r.es_nsfw)}
                    <button class="like-btn" ${yaLR} onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                </div>`}).join('')}
        </div>`;
    }).join('');
}

// --- 7. UTILIDADES ---
async function reaccionar(id) {
    if (procesandoLike) return;
    procesandoLike = true;
    const yaLike = localStorage.getItem('v_' + id);
    const rpc = yaLike ? 'decrementar_reaccion' : 'incrementar_reaccion';
    try {
        await _supabase.rpc(rpc, { row_id: id, columna_nombre: 'likes' });
        yaLike ? localStorage.removeItem('v_'+id) : localStorage.setItem('v_'+id, '1');
        leerSecretos();
    } finally { procesandoLike = false; }
}

function mostrarPreview(inputElement) {
    const file = inputElement.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewContainer.style.display = "block";
            previewContainer.innerHTML = `<img src="${e.target.result}" style="max-width:100%; border-radius:12px;">
            <b onclick="cancelarPreview()" style="position:absolute; top:10px; right:10px; cursor:pointer; background:black; color:white; padding:5px 10px; border-radius:50%;">✕</b>`;
        }
        reader.readAsDataURL(file);
    }
}

function citarPost(id) { input.value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; replyIndicator.innerHTML = `[Resp #${id} ✖]`; input.focus(); }
function cancelarRespuesta() { respondiendoA = null; replyIndicator.innerHTML = ""; }
function cancelarPreview() { previewContainer.style.display = "none"; fotoInput.value = ""; }
function captchaResuelto(t) { tokenCaptcha = t; if(btnEnviar) btnEnviar.disabled = false; }
function abrirCine(url) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightbox-content').innerHTML = `<img src="${url}" style="max-width:100%">`;
    lb.style.display = 'flex';
}
