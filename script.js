const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');

// --- LÓGICA MENÚ BURGER (MEJORADA) ---
const menuToggle = document.getElementById('menu-toggle');
const sideMenu = document.getElementById('side-menu');
const verPoliticasBtn = document.getElementById('ver-politicas-btn');

menuToggle.onclick = (e) => {
    e.stopPropagation(); // Evita que el clic se propague al body
    sideMenu.classList.toggle('active');
};

// Cerrar menú al hacer clic fuera (Toque pro)
document.addEventListener('click', (e) => {
    if (!sideMenu.contains(e.target) && e.target !== menuToggle) {
        sideMenu.classList.remove('active');
    }
});

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

verPoliticasBtn.onclick = () => {
    modal.style.display = 'flex';
    sideMenu.classList.remove('active');
};

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
    } else {
        console.error("Error al reaccionar:", error);
    }
}

// --- ENVIAR ---
async function enviarSecreto() {
    const texto = input.value.trim();
    
    // Validación del Captcha
    let captchaRes;
    try {
        captchaRes = turnstile.getResponse();
    } catch (e) {
        console.error("Captcha no cargado aún");
    }
    
    if (!captchaRes) return alert("Completa el captcha, no seas bot.");
    if (!texto) return alert("Escribe algo, el chisme no se cuenta solo...");

    btn.disabled = true; // Evita doble envío
    btn.innerText = "Publicando...";

    const { error } = await _supabase
        .from('secretos')
        .insert([{ contenido: texto, likes: 0, dislikes: 0 }]);

    if (!error) {
        input.value = "";
        if (window.turnstile) turnstile.reset();
        await leerSecretos();
    } else {
        alert("Error al publicar, intenta de nuevo.");
    }
    
    btn.disabled = false;
    btn.innerText = "Publicar";
}

// --- LEER CHISMES (CON MAPA DE REACCIONES) ---
async function leerSecretos() {
    const { data: secretos, error } = await _supabase
        .from('secretos')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        container.innerHTML = `<p style="color:var(--danger); text-align:center;">Error al cargar chismes.</p>`;
        return;
    }
    
    if (secretos && secretos.length > 0) {
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
                </div>`;
        }).join('');
    } else {
        container.innerHTML = `<p style="text-align:center; color:var(--text-dim); padding:20px;">Aún no hay chismes. ¡Sé el primero!</p>`;
    }
}

// Event Listeners finales
btn.onclick = enviarSecreto;
window.onload = leerSecretos; // Cargar al abrir la página
