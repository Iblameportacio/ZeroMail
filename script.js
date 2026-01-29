const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');

// MODAL
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

// REACCIONES (CON BLOQUEO INFINITO)
async function reaccionar(id, valorActual, columna) {
    // Verificar si ya votó por este chisme
    if (localStorage.getItem(`voto_${id}`)) {
        return alert("Ya reaccionaste a este chisme, broski.");
    }

    const { error } = await _supabase
        .from('secretos')
        .update({ [columna]: (valorActual || 0) + 1 })
        .eq('id', id);

    if (error) {
        console.error(error);
    } else {
        // Guardar voto en el navegador
        localStorage.setItem(`voto_${id}`, 'true');
        await leerSecretos(); 
    }
}

// ENVIAR (CON CAPTCHA)
async function enviarSecreto() {
    const texto = input.value.trim();
    
    // Verificar Captcha de Cloudflare
    const captchaRes = turnstile.getResponse();
    if (!captchaRes) {
        return alert("Completa el captcha para demostrar que no eres un bot.");
    }

    if(!texto) return alert("Escribe algo...");

    const { error } = await _supabase
        .from('secretos')
        .insert([{ contenido: texto, likes: 0, dislikes: 0 }]);

    if (error) {
        console.error(error);
    } else { 
        input.value = ""; 
        turnstile.reset(); // Resetear para el siguiente
        await leerSecretos(); 
    }
}

async function leerSecretos() {
    const { data: secretos } = await _supabase.from('secretos').select('*').order('created_at', { ascending: false });
    
    if (secretos) {
        container.innerHTML = secretos.map(s => {
            const yaVoto = localStorage.getItem(`voto_${s.id}`);
            return `
                <div class="card">
                    <p>${s.contenido}</p>
                    <div class="footer-card">
                        <small>${new Date(s.created_at).toLocaleString()}</small>
                        <div class="actions">
                            <button class="like-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, ${s.likes}, 'likes')">
                                🔥 ${s.likes || 0}
                            </button>
                            <button class="dislike-btn" ${yaVoto ? 'disabled' : ''} onclick="reaccionar(${s.id}, ${s.dislikes}, 'dislikes')">
                                💩 ${s.dislikes || 0}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

btn.onclick = enviarSecreto;
leerSecretos();
