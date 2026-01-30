const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const fotoInput = document.getElementById('fotoInput');

let comunidadActual = 'general';

// --- MODAL ---
const modal = document.getElementById('modal-politicas');
const btnAceptar = document.getElementById('btn-aceptar');
const btnRechazar = document.getElementById('btn-rechazar');

if (localStorage.getItem('politicasAceptadas') === 'true') {
    modal.style.display = 'none';
}

btnAceptar.onclick = () => {
    localStorage.setItem('politicasAceptadas', 'true');
    modal.style.display = 'none';
};

btnRechazar.onclick = () => window.location.href = "https://google.com";

// --- SEGURIDAD: FUNCIÓN ANTI-HACKERS ---
// Esta función convierte <script> en texto inofensivo
function escaparHTML(str) {
    if (!str) return "";
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- COMUNIDADES ---
async function cambiarComunidad(cat) {
    comunidadActual = cat;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        if(b.innerText.toLowerCase().includes(cat) || (cat === 'general' && b.innerText.includes('Inicio'))) {
            b.classList.add('active');
        }
    });
    
    const ph = {
        'general': '¿Qué está pasando?',
        'musica': 'Comparte tu playlist o canción favorita...',
        'tech': '¿Qué hay de nuevo en el mundo tech?'
    };
    input.placeholder = ph[cat] || ph['general'];
    
    await leerSecretos();
}

// --- COMPRESIÓN ---
async function comprimirImagen(archivo) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(archivo);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.7);
            };
        };
    });
}

// --- REACCIONES ---
async function reaccionar(id, valorActual, columna) {
    if (localStorage.getItem(`voto_${id}`)) return alert("Ya reaccionaste, broski.");
    const { error } = await _supabase.from('secretos').update({ [columna]: (valorActual || 0) + 1 }).eq('id', id);
    if (!error) {
        localStorage.setItem(`voto_${id}`, 'true');
        await leerSecretos();
    }
}

// --- ENVIAR ---
async function enviarSecreto() {
    const texto = input.value.trim();
    const captchaRes = turnstile.getResponse();
    const file = fotoInput.files[0];
    
    if (!captchaRes) return alert("Completa el captcha.");
    if (!texto && !file) return alert("Escribe algo...");

    btn.disabled = true;
    btn.innerText = "Enviando...";
    let urlFoto = null;

    try {
        if (file) {
            const { data: uploadData, error: uploadError } = await _supabase.storage
                .from('imagenes')
                .upload(`${Date.now()}.webp`, await comprimirImagen(file));
            if (!uploadError) {
                const { data: urlData } = _supabase.storage.from('imagenes').getPublicUrl(uploadData.path);
                urlFoto = urlData.publicUrl;
            }
        }

        const { error } = await _supabase.from('secretos').insert([{ 
            contenido: texto, 
            imagen_url: urlFoto, 
            categoria: comunidadActual,
            likes: 0, 
            dislikes: 0 
        }]);

        if (!error) {
            input.value = "";
            fotoInput.value = "";
            document.getElementById('preview-container').style.display = 'none';
            turnstile.reset();
            await leerSecretos();
        }
    } catch (e) { console.error(e); } 
    finally { btn.disabled = false; btn.innerText = "Publicar"; }
}

function cargarAds() {
    const ads = document.querySelectorAll('.ad-inline-active');
    ads.forEach(container => {
        if (container.getAttribute('data-loaded')) return;
        const script = document.createElement("script");
        script.src = "//pl16441576.highrevenuegate.com/22e5c3e32301ad5e2fdcfd392d705a30/invoke.js";
        script.async = true;
        container.appendChild(script);
        container.setAttribute('data-loaded', 'true');
    });
}

// --- LEER CON FILTRO Y SEGURIDAD ---
async function leerSecretos() {
    let consulta = _supabase.from('secretos').select('*');
    if (comunidadActual !== 'general') consulta = consulta.eq('categoria', comunidadActual);

    const { data: secretos } = await consulta.order('created_at', { ascending: false });
    
    if (secretos) {
        let htmlFinal = "";
        secretos.forEach((s, index) => {
            const yaVoto = localStorage.getItem(`voto_${s.id}`);
            const imgHtml = s.imagen_url ? `<img src="${s.imagen_url}" class="card-img" style="width:100%; border-radius:8px; margin:10px 0;">` : "";
            
            // ESCAPAMOS EL CONTENIDO ANTES DE MOSTRARLO
            const contenidoSeguro = escaparHTML(s.contenido);

            htmlFinal += `
                <div class="card">
                    <p>${contenidoSeguro}</p>
                    ${imgHtml}
                    <div class="footer-card">
                        <small>${new Date(s.created_at).toLocaleString()}</small>
                        <div class="actions">
                            <button class="like-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, ${s.likes}, 'likes')">🔥 ${s.likes || 0}</button>
                            <button class="dislike-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, ${s.dislikes}, 'dislikes')">💩 ${s.dislikes || 0}</button>
                        </div>
                    </div>
                </div>`;

            if ((index + 1) % 4 === 0) {
                htmlFinal += `
                    <div class="ad-inline-active" style="padding: 15px; text-align: center;">
                        <small style="color: #71767b; font-size: 10px;">PUBLICIDAD</small>
                        <div id="container-22e5c3e32301ad5e2fdcfd392d705a30"></div>
                    </div>`;
            }
        });
        container.innerHTML = htmlFinal;
        cargarAds();
    }
}

btn.onclick = enviarSecreto;
leerSecretos();
