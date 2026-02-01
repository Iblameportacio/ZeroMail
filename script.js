const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const fotoInput = document.getElementById('fotoInput');

let comunidadActual = 'general';
let respondiendoA = null;

// --- POLÍTICAS ---
const modal = document.getElementById('modal-politicas');
if (localStorage.getItem('politicasAceptadas')) modal.style.display = 'none';
document.getElementById('btn-aceptar').onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modal.style.display = 'none';
};

function escaparHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function cambiarComunidad(c) {
    comunidadActual = c;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    leerSecretos();
}

function prepararRespuesta(id, esComentario = false) {
    respondiendoA = id;
    input.placeholder = esComentario ? "Respondiendo al comentario..." : "Respondiendo al post...";
    input.value = esComentario ? ">> " : ""; 
    input.focus();
    if(!document.getElementById('btn-cancelar')) {
        const c = document.createElement('span');
        c.id = 'btn-cancelar';
        c.innerHTML = " [✖ Cancelar]";
        c.className = "cancelar-text";
        c.onclick = () => { respondiendoA = null; input.value = ""; c.remove(); };
        input.parentNode.insertBefore(c, input);
    }
}

async function leerSecretos() {
    const { data } = await _supabase.from('secretos').select('*').eq('categoria', comunidadActual).order('created_at', { ascending: false });
    if (!data) return;

    const principal = data.filter(s => !s.padre_id);
    const respuestas = data.filter(s => s.padre_id);
    
    container.innerHTML = principal.map(s => {
        const susRespuestas = respuestas.filter(r => r.padre_id === s.id).reverse();
        const rHtml = susRespuestas.map(r => `
            <div class="reply-card ${r.contenido.includes('>>') ? 'nested-reply' : ''}">
                <p>${escaparHTML(r.contenido).replace('&gt;&gt;', '<span class="mention">Hilo</span>')}</p>
                ${r.imagen_url ? `<img src="${r.imagen_url}" class="card-img-reply">` : ''}
                <button class="reply-btn-inner" onclick="prepararRespuesta(${s.id}, true)">↩</button>
            </div>
        `).join('');

        return `
            <div class="post-group">
                <div class="card">
                    <p>${escaparHTML(s.contenido)}</p>
                    ${s.imagen_url ? `<img src="${s.imagen_url}" class="card-img">` : ''}
                    <div class="footer-card">
                        <button class="reply-btn" onclick="prepararRespuesta(${s.id})">💬 Responder</button>
                        <button class="like-btn" onclick="reaccionar(${s.id}, 'likes')">🔥 ${s.likes || 0}</button>
                    </div>
                </div>
                <div class="replies-container">${rHtml}</div>
            </div>`;
    }).join('');
}

btn.onclick = async () => {
    const texto = input.value.trim();
    if(!texto && !fotoInput.files[0]) return;
    
    btn.disabled = true;
    await _supabase.from('secretos').insert([{
        contenido: texto,
        categoria: comunidadActual,
        padre_id: respondiendoA,
        likes: 0
    }]);
    
    input.value = "";
    respondiendoA = null;
    if(document.getElementById('btn-cancelar')) document.getElementById('btn-cancelar').remove();
    btn.disabled = false;
    leerSecretos();
};

leerSecretos();
