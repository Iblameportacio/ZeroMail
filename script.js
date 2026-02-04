const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let tokenCaptcha = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;

const get = (id) => document.getElementById(id);

const inicializarTodo = () => {
    const modal = get('modal-politicas');
    const btnAceptar = get('btn-aceptar');
    if (localStorage.getItem('politicasAceptadas')) if (modal) modal.style.display = 'none';
    if (btnAceptar) {
        btnAceptar.onclick = () => {
            localStorage.setItem('politicasAceptadas', 'true');
            if (modal) modal.style.display = 'none';
        };
    }
    _supabase.channel('cambios').on('postgres_changes', { event: '*', schema: 'public', table: 'secretos' }, leerSecretos).subscribe();
    leerSecretos();
};

document.addEventListener('DOMContentLoaded', inicializarTodo);

function renderMedia(url) {
    if (!url) return '';
    return url.toLowerCase().match(/\.(mp4|webm|mov|ogg)/i) 
        ? `<video src="${url}" controls playsinline muted class="card-img"></video>`
        : `<img src="${url}" class="card-img" onclick="abrirCine('${url}')" loading="lazy">`;
}

get('enviarBtn').onclick = async () => {
    const btn = get('enviarBtn');
    if (!tokenCaptcha || btn.disabled) return;
    const txt = get('secretoInput').value.trim();
    if(!txt && !get('fotoInput').files[0]) return;

    btn.disabled = true;
    btn.innerText = "⏳";
    try {
        let url = null;
        const file = get('fotoInput').files[0];
        if (file) {
            const n = `${Date.now()}.${file.name.split('.').pop()}`;
            await _supabase.storage.from('imagenes').upload(n, file);
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }
        await _supabase.from('secretos').insert([{ contenido: txt, categoria: comunidadActual, padre_id: respondiendoA, imagen_url: url }]);
        get('secretoInput').value = ""; get('fotoInput').value = "";
        cancelarRespuesta(); if(window.turnstile) turnstile.reset();
        tokenCaptcha = null; leerSecretos();
    } catch(e) { alert("Error al publicar"); } finally { btn.disabled = false; btn.innerText = "Publicar"; }
};

async function leerSecretos() {
    const container = get('secretos-container');
    if (!container) return;
    let q = _supabase.from('secretos').select('*');
    if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.order('id', { ascending: false });

    const { data, error } = await q;
    if (error || !data) return;

    const renderizarRecursivo = (padreId, nivel = 0) => {
        const hijos = data.filter(r => r.padre_id === padreId);
        return hijos.map(r => {
            const yaLike = localStorage.getItem('v_' + r.id) ? 'like-active' : '';
            const tieneHijos = data.some(h => h.padre_id === r.id);
            return `
            <div class="post-group" style="margin-left: ${nivel > 0 ? 20 : 0}px; border-left: ${nivel > 0 ? '2px solid #ff4500' : 'none'}">
                <div class="card" id="post-${r.id}">
                    <span class="post-author" onclick="citarPost(${r.id})">#${r.id} ${nivel > 0 ? '↳' : '[+]'}</span>
                    <p style="white-space: pre-wrap; margin: 10px 0;">${escaparHTML(r.contenido)}</p>
                    ${renderMedia(r.imagen_url)}
                    <div class="footer-card" style="display:flex; gap:10px; align-items:center;">
                        <button class="reply-btn" onclick="prepararRespuesta(${r.id})">💬</button>
                        <button id="like-${r.id}" class="like-btn ${yaLike}" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                        ${tieneHijos ? `<button class="toggle-btn" onclick="toggleHilos(${r.id})">Ver/Ocultar</button>` : ''}
                    </div>
                </div>
                <div id="hijos-${r.id}" class="hilos-container">
                    ${renderizarRecursivo(r.id, nivel + 1)}
                </div>
            </div>`;
        }).join('');
    };
    container.innerHTML = renderizarRecursivo(null);
}

function toggleHilos(id) {
    const el = get(`hijos-${id}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function reaccionar(id) {
    const btn = get(`like-${id}`);
    const ya = localStorage.getItem('v_' + id);
    let count = parseInt(btn.innerText.replace('🔥 ', '')) || 0;
    if (ya) {
        btn.classList.remove('like-active'); btn.innerText = `🔥 ${Math.max(0, count - 1)}`;
        localStorage.removeItem('v_' + id);
        await _supabase.rpc('decrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    } else {
        btn.classList.add('like-active'); btn.innerText = `🔥 ${count + 1}`;
        localStorage.setItem('v_' + id, '1');
        await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    }
}

function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; get('enviarBtn').disabled = false; }
function citarPost(id) { get('secretoInput').value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { 
    respondiendoA = id; 
    get('reply-indicator').innerHTML = `<div style="color:#ff4500; font-size:12px; margin-bottom:5px;">Respondiendo a #${id} <span onclick="cancelarRespuesta()" style="cursor:pointer;">[X]</span></div>`; 
    get('secretoInput').focus();
}
function cancelarRespuesta() { respondiendoA = null; get('reply-indicator').innerHTML = ""; }
function abrirCine(url) { 
    get('lightbox-content').innerHTML = `<img src="${url}" style="max-width:95vw; max-height:95vh;">`;
    get('lightbox').style.display = 'flex'; 
}
window.verInicio = () => { filtroTop = false; leerSecretos(); };
window.verTop = () => { filtroTop = true; leerSecretos(); };
