const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const fotoInput = document.getElementById('fotoInput');

let comunidadActual = 'general';
let respondiendoA = null;
let tokenCaptcha = null;

// --- CAPTCHA ---
function captchaResuelto(token) { tokenCaptcha = token; btn.disabled = false; }
function captchaExpirado() { tokenCaptcha = null; btn.disabled = true; }

// --- FUNCIONES DE APOYO ---
function escaparHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function citarPost(id) {
    input.value += (input.value ? '\n' : '') + `>>${id} `;
    input.focus();
    if (!respondiendoA) prepararRespuesta(id);
}

function prepararRespuesta(id) {
    respondiendoA = id;
    input.placeholder = `Respondiendo al No.${id}...`;
    input.focus();
    if(!document.getElementById('btn-cancelar')) {
        const c = document.createElement('span');
        c.id = 'btn-cancelar';
        c.innerHTML = " [✖ Cancelar]";
        c.className = "cancelar-text";
        c.onclick = () => { 
            respondiendoA = null; 
            input.value = ""; 
            input.placeholder = "¿Qué está pasando?"; 
            c.remove(); 
        };
        input.parentNode.insertBefore(c, input);
    }
}

// --- RENDERING ---
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

        const rHtml = susRespuestas.map(r => `
            <div class="reply-card">
                <div class="post-header">
                    <span class="post-author">Anónimo</span>
                    <span class="post-id" onclick="citarPost(${r.id})">No.${r.id} [+]</span>
                </div>
                <p>${escaparHTML(r.contenido).replace(/&gt;&gt;(\d+)/g, '<span class="mention">>>$1</span>')}</p>
                ${renderMedia(r.imagen_url, true)}
                <div class="footer-card">
                    <button class="like-btn" onclick="reaccionar(${r.id})">🔥 ${r.likes || 0}</button>
                </div>
            </div>
        `).join('');

        return `
            <div class="post-group">
                <div class="card">
                    <div class="post-header">
                        <span class="post-author">Anónimo</span>
                        <span class="post-id" onclick="citarPost(${s.id})">No.${s.id} [+]</span>
                    </div>
                    <p>${escaparHTML(s.contenido).replace(/&gt;&gt;(\d+)/g, '<span class="mention">>>$1</span>')}</p>
                    ${renderMedia(s.imagen_url, false)}
                    <div class="footer-card">
                        <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬 Responder</button>
                        <button class="like-btn" onclick="reaccionar(${s.id})">🔥 ${s.likes || 0}</button>
                    </div>
                </div>
                <div class="replies-container">${rHtml}</div>
            </div>`;
    }).join('');
}

// --- ACCIONES ---
async function reaccionar(id) {
    if (localStorage.getItem(`voto_${id}`)) return;
    const { error } = await _supabase.rpc('incrementar_reaccion', { row_id: id, columna_nombre: 'likes' });
    if (!error) { 
        localStorage.setItem(`voto_${id}`, 'true'); 
        leerSecretos(); 
    }
}

btn.onclick = async () => {
    if (!tokenCaptcha) { alert("Resuelve el captcha primero."); return; }
    const texto = input.value.trim();
    const file = fotoInput.files[0];
    if(!texto && !file) return;
    
    btn.disabled = true;
    btn.innerText = "Subiendo...";
    let urlFoto = null;

    try {
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error: uploadError } = await _supabase.storage.from('imagenes').upload(fileName, file);
            if (uploadError) throw uploadError;
            const { data } = _supabase.storage.from('imagenes').getPublicUrl(fileName);
            urlFoto = data.publicUrl;
        }

        const { error: insertError } = await _supabase.from('secretos').insert([{
            contenido: texto, 
            categoria: comunidadActual,
            padre_id: respondiendoA, 
            imagen_url: urlFoto, 
            likes: 0
        }]);

        if (insertError) throw insertError;
        
        input.value = "";
        fotoInput.value = "";
        document.getElementById('preview-container').style.display = 'none';
        respondiendoA = null;
        leerSecretos();
    } catch (err) {
        alert("Fallo al publicar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Publicar";
    }
};

leerSecretos();
