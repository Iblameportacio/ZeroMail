const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');
const fotoInput = document.getElementById('fotoInput');
const previewContainer = document.getElementById('preview-container');

let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;
let tokenCaptcha = null;
let modeloNSFW = null;

// CARGAR IA
nsfwjs.load().then(m => { modeloNSFW = m; console.log("IA Lista"); });

// CONTROL ACCESO
const modal = document.getElementById('modal-politicas');
if (localStorage.getItem('politicasAceptadas')) modal.style.display = 'none';
document.getElementById('btn-aceptar').onclick = () => { localStorage.setItem('politicasAceptadas', 'true'); modal.style.display = 'none'; };

function mostrarPreview(inputElement) {
    const file = inputElement.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewContainer.style.display = "block";
            const isVid = file.type.startsWith('video/');
            previewContainer.innerHTML = isVid 
                ? `<video src="${e.target.result}" id="temp-media" controls style="max-width:100%; border-radius:12px;"></video>` 
                : `<img src="${e.target.result}" id="temp-media" style="max-width:100%; border-radius:12px;">`;
            previewContainer.innerHTML += `<b onclick="cancelarPreview()" style="position:absolute; top:10px; right:10px; cursor:pointer; background:black; color:white; padding:5px 10px; border-radius:50%;">✕</b>`;
        }
        reader.readAsDataURL(file);
    }
}
function cancelarPreview() { previewContainer.style.display = "none"; fotoInput.value = ""; }

async function esContenidoXXX() {
    const media = document.getElementById('temp-media');
    if (!modeloNSFW || !media || media.tagName === 'VIDEO') return false; 
    const predicciones = await modeloNSFW.classify(media);
    return predicciones.some(p => (p.className === 'Porn' || p.className === 'Hentai') && p.probability > 0.6);
}

function cambiarComunidad(c) { comunidadActual = c; filtroTop = false; actualizarTabs(c); leerSecretos(); }
function verTop() { filtroTop = true; actualizarTabs('top'); leerSecretos(); }
function actualizarTabs(id) { document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(id))); }

async function leerSecretos() {
    let q = _supabase.from('secretos').select('*');
    if (filtroTop) q = q.order('likes', { ascending: false });
    else q = q.eq('categoria', comunidadActual).order('ultima_actividad', { ascending: false });

    const { data } = await q;
    if (!data) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);

    container.innerHTML = principal.map(s => {
        const susResp = respuestas.filter(r => r.padre_id === s.id).reverse();
        return `<div class="post-group">
            <div class="card">
                <span style="color:gray; font-size:12px; cursor:pointer" onclick="citarPost(${s.id})">#${s.id} [+]</span>
                <p style="font-size:18px">${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url, s.es_nsfw, s.id)}
                <div class="footer-card">
                    <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                    <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => `<div style="margin-left:30px; border-left:2px solid #d32f2f; padding:15px">
                <span style="color:gray; font-size:11px">#${r.id} >> #${r.padre_id}</span>
                <p>${escaparHTML(r.contenido).replace(/>>(\d+)/g, '<b style="color:#d32f2f">>>$1</b>')}</p>
                ${renderMedia(r.imagen_url, r.es_nsfw, r.id)}
                <button class="like-btn" style="padding:5px 12px" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
            </div>`).join('')}
        </div>`;
    }).join('');
}

function renderMedia(url, nsfw, id) {
    if(!url) return '';
    const blur = nsfw ? 'media-censurada' : '';
    const isVid = url.toLowerCase().match(/\.(mp4|webm|mov)/i);
    let html = `<div style="position:relative; margin:10px 0;">`;
    if(nsfw) html += `<div class="nsfw-overlay" onclick="this.nextElementSibling.classList.remove('media-censurada'); this.remove()">NSFW - VER</div>`;
    
    const clickAction = nsfw ? '' : `onclick="abrirCine('${url}')" style="cursor:zoom-in"`;
    html += isVid ? `<video src="${url}" controls class="card-img ${blur}"></video>` : `<img src="${url}" class="card-img ${blur}" ${clickAction}>`;
    return html + `</div>`;
}

function abrirCine(url) {
    const lb = document.getElementById('lightbox');
    const content = document.getElementById('lightbox-content');
    const isVid = url.toLowerCase().match(/\.(mp4|webm|mov)/i);
    content.innerHTML = isVid ? `<video src="${url}" controls autoplay style="max-width:100%"></video>` : `<img src="${url}" style="max-width:100%">`;
    lb.style.display = 'flex';
}

async function reaccionar(id) {
    if(localStorage.getItem('v_'+id)) return;
    const btns = document.querySelectorAll(`button[onclick="reaccionar(${id})"]`);
    btns.forEach(b => {
        let n = parseInt(b.innerText.replace('🔥 ', ''));
        b.innerHTML = `🔥 ${n + 1}`;
        b.classList.add('like-active');
    });
    localStorage.setItem('v_'+id, '1');
    await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
}

btnEnviar.onclick = async () => {
    if (!tokenCaptcha) return alert("Captcha!");
    btnEnviar.disabled = true;
    btnEnviar.innerText = "Analizando...";
    let esNSFW = await esContenidoXXX();
    try {
        let url = null;
        if (fotoInput.files[0]) {
            const f = fotoInput.files[0];
            const n = `${Date.now()}.${f.name.split('.').pop()}`;
            await _supabase.storage.from('imagenes').upload(n, f);
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }
        await _supabase.from('secretos').insert([{ 
            contenido: input.value, categoria: comunidadActual, padre_id: respondiendoA, imagen_url: url, es_nsfw: esNSFW 
        }]);
        input.value = ""; cancelarPreview(); cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        leerSecretos();
    } catch(e) { alert("Error"); }
    finally { btnEnviar.innerText = "Publicar"; btnEnviar.disabled = false; }
};

function toggleRegistro() { const m = document.getElementById('modal-registro'); m.style.display = m.style.display === 'none' ? 'flex' : 'none'; }
async function registrarUsuario() {
    const u = document.getElementById('reg-user').value;
    const p = document.getElementById('reg-pass').value;
    const { error } = await _supabase.auth.signUp({ email: `${u}@zeromail.com`, password: p });
    if(error) alert(error.message); else alert("Listo broski!");
    toggleRegistro();
}

function citarPost(id) { input.value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; replyIndicator.innerHTML = `[Resp #${id} ✖]`; input.focus(); }
function cancelarRespuesta() { respondiendoA = null; replyIndicator.innerHTML = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; btnEnviar.disabled = false; }
leerSecretos();
