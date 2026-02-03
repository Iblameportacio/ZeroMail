const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL ---
let tokenCaptcha = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;
let procesandoLike = false; // Bloqueo anti-spam

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');
const fotoInput = document.getElementById('fotoInput');
const previewContainer = document.getElementById('preview-container');

// --- 1. INICIALIZACIÓN ---
async function inicializar() {
    leerSecretos();
}
inicializar();

// --- 2. NAVEGACIÓN (INICIO / TOP) ---
const modal = document.getElementById('modal-politicas');
if (localStorage.getItem('politicasAceptadas')) modal.style.display = 'none';

document.getElementById('btn-aceptar').onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modal.style.display = 'none';
};

window.verTop = function() { 
    filtroTop = true; 
    actualizarTabs('top'); 
    leerSecretos(); 
};

window.verInicio = function() {
    filtroTop = false;
    actualizarTabs('inicio');
    leerSecretos();
};

function actualizarTabs(tipo) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        const text = b.innerText.toLowerCase();
        b.classList.toggle('active', text.includes(tipo));
    });
}

// --- 3. MULTIMEDIA ---
function renderMedia(url, nsfw) {
    if(!url) return '';
    const blur = nsfw ? 'media-censurada' : '';
    const isVid = url.toLowerCase().match(/\.(mp4|webm|mov|ogg)/i);
    
    let html = `<div style="position:relative; margin:10px 0;">`;
    if(nsfw) html += `<div class="nsfw-overlay" onclick="this.nextElementSibling.classList.remove('media-censurada'); this.remove()">NSFW - VER</div>`;
    
    if(isVid) {
        html += `<video src="${url}" controls class="card-img ${blur}"></video>`;
    } else {
        html += `<img src="${url}" class="card-img ${blur}" onclick="abrirCine('${url}')" style="cursor:zoom-in">`;
    }
    return html + `</div>`;
}

// --- 4. LEER POSTS ---
async function leerSecretos() {
    let q = _supabase.from('secretos').select('*');
    if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.eq('categoria', comunidadActual).order('ultima_actividad', { ascending: false });

    const { data } = await q;
    if (!data) return;

    const hilos = data.filter(s => !s.padre_id);
    
    container.innerHTML = hilos.map(s => {
        const susResp = data.filter(r => r.padre_id === s.id).sort((a,b) => a.id - b.id);
        const yaTieneLike = localStorage.getItem('v_' + s.id) ? 'style="color:#ff4500"' : '';
        
        return `<div class="post-group">
            <div class="card">
                <span class="post-author" onclick="citarPost(${s.id})">#${s.id} [+]</span>
                <p style="font-size:18px">${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url, s.es_nsfw)}
                <div class="footer-card">
                    <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                    <button class="like-btn" ${yaTieneLike} onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => {
                const yaLikeR = localStorage.getItem('v_' + r.id) ? 'style="color:#ff4500"' : '';
                return `<div class="reply-card" style="margin-left:30px; border-left:2px solid red; padding:10px; background:#111; margin-bottom:5px;">
                    <span style="color:red; font-size:11px;">#${r.id} >> #${r.padre_id}</span>
                    <p>${escaparHTML(r.contenido)}</p>
                    ${renderMedia(r.imagen_url, r.es_nsfw)}
                    <button class="like-btn" ${yaLikeR} onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                </div>`}).join('')}
        </div>`;
    }).join('');
}

// --- 5. REACCIONES (CON BLOQUEO ANTI-SPAM) ---
async function reaccionar(id) {
    if (procesandoLike) return; // Evita el spam de clics
    
    procesandoLike = true;
    const yaLike = localStorage.getItem('v_' + id);
    const rpc = yaLike ? 'decrementar_reaccion' : 'incrementar_reaccion';
    const incremento = yaLike ? -1 : 1;

    // UI Optimista
    const btns = document.querySelectorAll(`button[onclick="reaccionar(${id})"]`);
    btns.forEach(b => {
        let n = parseInt(b.innerText.replace('🔥 ', '')) || 0;
        b.innerHTML = `🔥 ${Math.max(0, n + incremento)}`;
        b.style.color = yaLike ? "" : "#ff4500";
    });

    try {
        await _supabase.rpc(rpc, { row_id: id, columna_nombre: 'likes' });
        if(yaLike) localStorage.removeItem('v_'+id); 
        else localStorage.setItem('v_'+id, '1');
    } catch(e) { console.error("Error like"); }
    finally { procesandoLike = false; }
}

// --- 6. PUBLICAR ---
btnEnviar.onclick = async () => {
    if (!tokenCaptcha) return alert("Resuelve el captcha");
    btnEnviar.disabled = true;
    try {
        let url = null;
        if (fotoInput.files[0]) {
            const f = fotoInput.files[0];
            const n = `${Date.now()}.${f.name.split('.').pop()}`;
            await _supabase.storage.from('imagenes').upload(n, f);
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }
        await _supabase.from('secretos').insert([{ 
            contenido: input.value, categoria: comunidadActual, padre_id: respondiendoA, imagen_url: url 
        }]);
        input.value = ""; cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        tokenCaptcha = null;
        leerSecretos();
    } catch(e) { alert("Error al publicar"); }
    finally { btnEnviar.disabled = false; }
};

// --- UTILIDADES ---
function citarPost(id) { input.value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; replyIndicator.innerHTML = `[Resp #${id} ✖]`; input.focus(); }
function cancelarRespuesta() { respondiendoA = null; replyIndicator.innerHTML = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; btnEnviar.disabled = false; }
function abrirCine(url) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightbox-content').innerHTML = `<img src="${url}" style="max-width:100%">`;
    lb.style.display = 'flex';
}
