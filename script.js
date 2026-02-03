const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- ESTADO GLOBAL ---
let usuarioLogueado = null;
let modeloNSFW = null;
let tokenCaptcha = null;
let comunidadActual = 'general';
let filtroTop = false;
let respondiendoA = null;

const input = document.getElementById('secretoInput');
const btnEnviar = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const replyIndicator = document.getElementById('reply-indicator');
const fotoInput = document.getElementById('fotoInput');
const previewContainer = document.getElementById('preview-container');

// --- 1. CARGAR IA Y SESIÓN (CRÍTICO) ---
async function inicializar() {
    // Cargar sesión de usuario
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        usuarioLogueado = session.user.user_metadata.username;
        const btnNav = document.getElementById('btn-login-nav') || document.getElementById('user-display');
        if(btnNav) btnNav.innerText = `@${usuarioLogueado}`;
    }

    // Cargar IA con manejo de errores para que no bloquee el sitio
    try {
        if (typeof nsfwjs !== 'undefined') {
            modeloNSFW = await nsfwjs.load();
            console.log("IA Lista para patrullar");
        }
    } catch (e) {
        console.error("Error cargando IA, pero el sitio sigue funcional", e);
    }
}
inicializar();

// --- 2. CONTROL DE ACCESO (MODAL) ---
const modal = document.getElementById('modal-politicas');
if (localStorage.getItem('politicasAceptadas')) modal.style.display = 'none';

document.getElementById('btn-aceptar').onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modal.style.display = 'none';
};

// --- 3. GESTIÓN DE CONTENIDO (PREVIEW E IA) ---
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
    try {
        const predicciones = await modeloNSFW.classify(media);
        return predicciones.some(p => (p.className === 'Porn' || p.className === 'Hentai') && p.probability > 0.6);
    } catch (e) { return false; }
}

// --- 4. RENDERIZADO Y FILTROS ---
function cambiarComunidad(c) { 
    comunidadActual = c; 
    filtroTop = false; 
    actualizarTabs(c); 
    leerSecretos(); 
}

function verTop() { 
    filtroTop = true; 
    actualizarTabs('top'); 
    leerSecretos(); 
}

async function verMiPerfil() {
    if (!usuarioLogueado) return alert("Inicia sesión para ver tu historial, broski");
    filtroTop = false;
    actualizarTabs('perfil');
    leerSecretos(true);
}

function actualizarTabs(id) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        const text = b.innerText.toLowerCase();
        b.classList.toggle('active', text.includes(id));
    });
}

async function leerSecretos(soloMios = false) {
    let q = _supabase.from('secretos').select('*');
    
    if (soloMios) {
        q = q.eq('usuario_nombre', usuarioLogueado);
    } else if (filtroTop) {
        q = q.order('likes', { ascending: false });
    } else {
        q = q.eq('categoria', comunidadActual).order('ultima_actividad', { ascending: false });
    }

    const { data } = await q;
    if (!data) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);

    container.innerHTML = principal.map(s => {
        const susResp = respuestas.filter(r => r.padre_id === s.id).reverse();
        const autor = s.usuario_nombre && s.usuario_nombre !== 'Anónimo' ? `@${s.usuario_nombre}` : `#${s.id}`;
        
        return `<div class="post-group">
            <div class="card">
                <span style="color:var(--accent-red); font-size:12px; cursor:pointer; font-weight:bold" onclick="citarPost(${s.id})">${autor} [+]</span>
                <p style="font-size:18px">${escaparHTML(s.contenido)}</p>
                ${renderMedia(s.imagen_url, s.es_nsfw, s.id)}
                <div class="footer-card">
                    <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬</button>
                    <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                </div>
            </div>
            ${susResp.map(r => {
                const autorResp = r.usuario_nombre && r.usuario_nombre !== 'Anónimo' ? `@${r.usuario_nombre}` : `#${r.id}`;
                return `<div style="margin-left:30px; border-left:2px solid #d32f2f; padding:15px">
                    <span style="color:var(--accent-red); font-size:11px; font-weight:bold">${autorResp} >> #${r.padre_id}</span>
                    <p>${escaparHTML(r.contenido).replace(/>>(\d+)/g, '<b style="color:#d32f2f">>>$1</b>')}</p>
                    ${renderMedia(r.imagen_url, r.es_nsfw, r.id)}
                    <button class="like-btn" style="padding:5px 12px" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                </div>`}).join('')}
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

// --- 5. INTERACCIONES ---
async function reaccionar(id) {
    if(localStorage.getItem('v_'+id)) return;
    
    // Optimistic UI (Like instantáneo)
    const btns = document.querySelectorAll(`button[onclick="reaccionar(${id})"]`);
    btns.forEach(b => {
        let n = parseInt(b.innerText.replace('🔥 ', '')) || 0;
        b.innerHTML = `🔥 ${n + 1}`;
        b.style.color = "#ff4500";
        b.style.borderColor = "#ff4500";
    });
    
    localStorage.setItem('v_'+id, '1');
    await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
}

btnEnviar.onclick = async () => {
    if (!tokenCaptcha) return alert("Resuelve el captcha, broski");
    
    const texto = input.value.trim();
    if(!texto && !fotoInput.files[0]) return;

    btnEnviar.disabled = true;
    btnEnviar.innerText = "Analizando...";
    
    let esNSFW = await esContenidoXXX();
    const nombrePublicador = usuarioLogueado || 'Anónimo';

    try {
        let url = null;
        if (fotoInput.files[0]) {
            const f = fotoInput.files[0];
            const n = `${Date.now()}.${f.name.split('.').pop()}`;
            await _supabase.storage.from('imagenes').upload(n, f);
            url = _supabase.storage.from('imagenes').getPublicUrl(n).data.publicUrl;
        }

        await _supabase.from('secretos').insert([{ 
            contenido: texto, 
            categoria: comunidadActual, 
            padre_id: respondiendoA, 
            imagen_url: url, 
            es_nsfw: esNSFW,
            usuario_nombre: nombrePublicador
        }]);

        input.value = ""; 
        cancelarPreview(); 
        cancelarRespuesta();
        if(window.turnstile) turnstile.reset();
        leerSecretos();
    } catch(e) { alert("Error al publicar"); }
    finally { btnEnviar.innerText = "Publicar"; btnEnviar.disabled = false; }
};

// --- 6. REGISTRO Y AUTH ---
function toggleRegistro() { 
    const m = document.getElementById('modal-registro'); 
    m.style.display = m.style.display === 'none' ? 'flex' : 'none'; 
}

async function registrarUsuario() {
    const u = document.getElementById('reg-user').value.trim();
    const p = document.getElementById('reg-pass').value;
    
    if(u.length < 3) return alert("Nombre de usuario muy corto");

    const { data, error } = await _supabase.auth.signUp({ 
        email: `${u}@zeromail.com`, 
        password: p,
        options: { data: { username: u } }
    });
    
    if(error) alert(error.message); 
    else {
        alert("¡Cuenta creada! Ya puedes publicar como " + u);
        usuarioLogueado = u;
        location.reload(); // Recargar para activar sesión
    }
}

// --- 7. UTILIDADES ---
function citarPost(id) { input.value += `>>${id} `; prepararRespuesta(id); }
function prepararRespuesta(id) { respondiendoA = id; replyIndicator.innerHTML = `[Resp #${id} ✖]`; input.focus(); }
function cancelarRespuesta() { respondiendoA = null; replyIndicator.innerHTML = ""; }
function escaparHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function captchaResuelto(t) { tokenCaptcha = t; btnEnviar.disabled = false; }

leerSecretos();
