const SUPABASE_URL = "https://ksqrflkejlpojqhyktwf.supabase.co";
const SUPABASE_KEY = "sb_publishable_uFWqkx-ygAhFBS5Z_va8tg_qXi7z1QV";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const input = document.getElementById('secretoInput');
const btn = document.getElementById('enviarBtn');
const container = document.getElementById('secretos-container');

// FILTRO DE SEGURIDAD
const bannedWords = ["pornografía infantil", "cp", "enlace-peligroso.com"]; 

// FUNCIÓN PARA REACCIONAR (Likes/Dislikes)
async function reaccionar(id, valorActual, columna) {
    const nuevaData = {};
    nuevaData[columna] = (valorActual || 0) + 1;

    const { error } = await _supabase
        .from('secretos')
        .update(nuevaData)
        .eq('id', id);

    if (error) {
        console.error("Error al reaccionar:", error);
    } else {
        leerSecretos(); 
    }
}

async function enviarSecreto() {
    const texto = input.value.trim();

    if(!texto) return alert("Escribe algo, no seas tímido.");

    const tieneIlegal = bannedWords.some(palabra => texto.toLowerCase().includes(palabra));
    const tieneLink = /(http|https|www)/i.test(texto);

    if (tieneIlegal || tieneLink) {
        return alert("Contenido prohibido o links no permitidos.");
    }

    const { error } = await _supabase
        .from('secretos')
        .insert([{ contenido: texto, likes: 0, dislikes: 0 }]); // Inicializamos contadores

    if (error) {
        console.error("Error al enviar:", error);
        alert("Error al publicar. Verifica que las columnas 'likes' y 'dislikes' existan en Supabase.");
    } else {
        input.value = "";
        leerSecretos(); 
    }
}

async function leerSecretos() {
    const { data: secretos, error } = await _supabase
        .from('secretos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al leer:", error);
    }

    if (secretos) {
        container.innerHTML = secretos.map(s => `
            <div class="card">
                <p>${s.contenido}</p>
                <div class="footer-card">
                    <small>${new Date(s.created_at).toLocaleString()}</small>
                    <div class="actions">
                        <button class="like-btn" onclick="reaccionar(${s.id}, ${s.likes}, 'likes')">
                            🔥 ${s.likes || 0}
                        </button>
                        <button class="dislike-btn" onclick="reaccionar(${s.id}, ${s.dislikes}, 'dislikes')">
                            💩 ${s.dislikes || 0}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

btn.onclick = enviarSecreto;
leerSecretos();
