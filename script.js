const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');
const fotoInput = document.getElementById('fotoInput');

// LÓGICA DEL MODA
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

btnRechazar.onclick = () => {
    window.location.href = "https://google.com";
};

// COMPRESIÓN DE IMAGEN
async function comprimirImagen(archivo) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(archivo);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Resolución económica
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Convertimos a WebP calidad 0.7 para ahorrar espacio extremo
                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.7);
            };
        };
    });
}

// LIMPIEZA AUTOMÁTICA (Máximo 50 mensajes)
async function mantenerBaseLigera() {
    const { count } = await _supabase
        .from('secretos')
        .select('*', { count: 'exact', head: true });

    if (count > 50) { // Límite de 50 para ahorrar espacio
        const { data: viejos } = await _supabase
            .from('secretos')
            .select('id')
            .order('created_at', { ascending: true })
            .limit(20); // Borra los 20 más antiguos si se pasa

        const ids = viejos.map(v => v.id);
        await _supabase.from('secretos').delete().in('id', ids);
    }
}

// --- REACCIONES ---
async function reaccionar(id, valorActual, columna) {
    if (localStorage.getItem(`voto_${id}`)) return alert("Ya reaccionaste, broski.");

    const { error } = await _supabase
        .from('secretos')
        .update({ [columna]: (valorActual || 0) + 1 })
        .eq('id', id);

    if (!error) {
        localStorage.setItem(`voto_${id}`, 'true');
        await leerSecretos();
    }
}

// ENVIAR CON MULTIMEDIA
async function enviarSecreto() {
    const texto = input.value.trim();
    const captchaRes = turnstile.getResponse();
    const file = fotoInput.files[0];
    
    if (!captchaRes) return alert("Completa el captcha.");
    if (!texto && !file) return alert("Escribe algo o sube una imagen.");

    btn.disabled = true;
    btn.innerText = "Enviando...";
    let urlFoto = null;

    try {
        // Subida de imagen al bucketimagenes
        if (file) {
            const fotoComprimida = await comprimirImagen(file);
            const fileName = `${Date.now()}.webp`;
            
            const { data, error: uploadError } = await _supabase.storage
                .from('imagenes')
                .upload(fileName, fotoComprimida);

            if (!uploadError) {
                const { data: urlData } = _supabase.storage
                    .from('imagenes')
                    .getPublicUrl(fileName);
                urlFoto = urlData.publicUrl;
            }
        }

        const { error } = await _supabase
            .from('secretos')
            .insert([{ contenido: texto, imagen_url: urlFoto, likes: 0, dislikes: 0 }]);

        if (!error) {
            input.value = "";
            fotoInput.value = "";
            document.getElementById('preview-container').style.display = 'none';
            turnstile.reset();
            await mantenerBaseLigera();
            await leerSecretos();
        }
    } catch (e) {
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = "Publicar";
    }
}

// FUNCIoN PARA REEJECUTAR SCRIPTS DE ANUNCIOS
function cargarAds() {
    const ads = document.querySelectorAll('.ad-inline script');
    ads.forEach(oldScript => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });
}

// LEER MENSAJES
async function leerSecretos() {
    const { data: secretos } = await _supabase
        .from('secretos')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (secretos) {
        let htmlFinal = "";
        
        secretos.forEach((s, index) => {
            const yaVoto = localStorage.getItem(`voto_${s.id}`);
            const imgHtml = s.imagen_url ? `<img src="${s.imagen_url}" class="card-img" style="width:100%; border-radius:8px; margin:10px 0;">` : "";
            
            htmlFinal += `
                <div class="card">
                    <p>${s.contenido}</p>
                    ${imgHtml}
                    <div class="footer-card">
                        <small>${new Date(s.created_at).toLocaleString()}</small>
                        <div class="actions">
                            <button class="like-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, ${s.likes}, 'likes')">🔥 ${s.likes || 0}</button>
                            <button class="dislike-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, ${s.dislikes}, 'dislikes')">💩 ${s.dislikes || 0}</button>
                        </div>
                    </div>
                </div>`;

            // Anuncio Native cada 3 mensajes
            if ((index + 1) % 3 === 0) {
                htmlFinal += `
                    <div class="ad-inline" style="padding: 15px; border-bottom: 1px solid var(--border-color); text-align: center; background: #0a0a0a;">
                        <small style="color: #71767b; display: block; margin-bottom: 10px; font-size: 10px;">PUBLICIDAD</small>
                        <script async="async" data-cfasync="false" src="//pl16441576.highrevenuegate.com/22e5c3e32301ad5e2fdcfd392d705a30/invoke.js"></script>
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
