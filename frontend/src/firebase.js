import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';

let app = null;
let auth = null;

export async function inicializarFirebase() {
    if (app) return { app, auth };
    
    try {
        const baseUrl = import.meta.env.DEV ? '/api' : 'https://peer-5gq5.onrender.com/api';
        const res = await fetch(`${baseUrl}/auth/firebase-config`);
        const config = await res.json();
        
        if (!config.apiKey) {
            console.warn('Firebase API Key não configurada no backend.');
            return { app: null, auth: null };
        }
        
        app = initializeApp(config);
        auth = getAuth(app);
        return { app, auth };
    } catch (e) {
        console.error('Erro ao inicializar Firebase:', e);
        return { app: null, auth: null };
    }
}

export async function enviarSMSFirebase(numeroTelefone, containerId = 'recaptcha-container') {
    const { auth } = await inicializarFirebase();
    if (!auth) throw new Error('Firebase não inicializado.');
    
    if (window._recaptchaVerifier) {
        window._recaptchaVerifier.clear();
    }
    
    const verifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {}
    });
    window._recaptchaVerifier = verifier;
    
    const confirmationResult = await signInWithPhoneNumber(auth, numeroTelefone, verifier);
    window._confirmationResult = confirmationResult;
    return confirmationResult;
}

export async function confirmarSMSFirebase(codigo) {
    if (!window._confirmationResult) {
        throw new Error('Nenhum SMS pendente. Solicite um novo código.');
    }
    const result = await window._confirmationResult.confirm(codigo);
    const idToken = await result.user.getIdToken();
    return idToken;
}
