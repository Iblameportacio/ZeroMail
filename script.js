const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL ---
let tokenCaptcha = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;
let procesandoLike = false;

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');
const fotoInput = document.getElementById('fotoInput');
const previewContainer = document.getElementById('preview-container');

// --- INICIALIZACIÓN ---
window.onload = () => {
    // Manejo del Modal de Términos
    const modal = document.getElementById('modal-politicas');
    const btnAceptar = document.getElementById('btn-aceptar');
    
    if (localStorage.getItem('politicasAceptadas')) {
        modal.style.display = 'none';
    }
    
    btnAceptar.onclick = () => {
        localStorage.setItem('politicasAceptadas', 'true');
        modal.style.display = 'none';
    };

    leerSecretos();
};

// --- NAVEGACIÓN ---
window.verInicio = () => { filtroTop = false; comunidadActual = 'general'; actualizarTabs('inicio'); leerSecretos(); };
window.verTop = () => { filtroTop = true; actualizarTabs('top'); leerSecretos(); };

function actualizarTabs(tipo) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.innerText.toLowerCase().includes(tipo));
    });
}

// --- PUBLICACIÓN ---
btnEnviar.onclick = async () => {
    if (!tokenCaptcha) return alert("Resuelve el captcha primero");
    btnEnviar.disabled = true;
    btnEnviar.innerText = "Subiendo...";

    try {
        let url = null;
        if (fotoInput.files[0]) {
            const f = fotoInput.files[0];
            const n = `${Date.now()}.${f.name.split('.').pop()}`;
            const { error: upErr } = await _supabase.storage.from('imagenes').upload(n, f);
            if (upErr) throw upErr;
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }

        const { error: insErr } = await _supabase.from('secretos').insert([{ 
            contenido: input.value, 
            categoria: comunidadActual, 
            padre_id: respondiendoA, 
            imagen_url: url 
        }]);

        if (insErr) throw insErr;

        input.value = ""; fotoInput.value = "";
        cancelarPreview(); cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        tokenCaptcha = null;
        btnEnviar.disabled = true;
        leerSecretos();

    } catch(e) { 
        alert("Fallo al publicar"); 
    } finally { 
        btnEnviar.innerText = "Publicar";
    }
};

// --- CARGA DE POSTS ---
async function leerSecretos() {
    let q = _supabase.from('secretos').select('*');
    if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.eq('categoria', comunidadActual).order('ultima_actividad', { ascending: false });

    const { data } = await q;
    if (!data) return;

    const hilos = data.filter(s => !s.padre_id);
    container.innerHTML = hilos.map(s => {
        const susResp = data.filter(r => r.padre_id === s.id).sort((a,b) => a.id - b.id);
        const yaLike = localStorage.getItem('v_' + s.id) ? 'style="color:#ff4500"' : '';
        return `
        <div class="post-group">
            <div class="card">
                <span class="post-author" onclick="citarPost(${s.id})">#${s.id} [+]</span>
                <p>${escaparHTML(s.contenido)}</p>
                ${s.imagen_url ? `<img src="${s.imagen_url}" class="card-img" onclick="abrirCine('${s.imagen_url}')">` : ''}
                <div class="footer-card">
                    <button onclick="prepararRespuesta(${s.id})">💬</button>
                    <button class="like-btn" ${yaLike} onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => `
                <div class="reply-card" style="margin-left:20px; border-left: 2px solid #444;">
                    <p>${escaparHTML(r.contenido)}</p>
                    ${r.imagen_url ? `<img src="${r.imagen_url}" class="card-img">` : ''}
                    <button onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                </div>`).join('')}
        </div>`;
    }).join('');
}

// --- UTILIDADES ---
async function reaccionar(id) {
    if (procesandoLike) return;
    procesandoLike = true;
    const yaLike = localStorage.getItem('v_' + id);
    const rpc = yaLike ? 'decrementar_reaccion' : 'incrementar_reaccion';
    await _supabase.rpc(rpc, { row_id: id, columna_nombre: 'likes' });
    yaLike ? localStorage.removeItem('v_'+id) : localStorage.setItem('v_'+id, '1');
    procesandoLike = false;
    leerSecretos();
}

function mostrarPreview(inputElement) {
    const file = inputElement.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewContainer.style.display = "block";
            previewContainer.innerHTML = `<img src="${e.target.result}" style="max-width:100%; border-radius:12px;">
            <b onclick="cancelarPreview()" style="position:absolute; top:10px; right:10px; cursor:pointer; background:black; color:white; padding:5px 10px; border-radius:50%;">✕</b>`;
        };
        reader.readAsDataURL(file);
    }
}

function citarPost(id) { input.value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; replyIndicator.innerHTML = `[Resp #${id} ✖]`; input.focus(); }
function cancelarRespuesta() { respondiendoA = null; replyIndicator.innerHTML = ""; }
function cancelarPreview() { previewContainer.style.display = "none"; fotoInput.value = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; btnEnviar.disabled = false; }
function abrirCine(url) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightbox-content').innerHTML = `<img src="${url}" style="max-width:100%">`;
    lb.style.display = 'flex';
}
