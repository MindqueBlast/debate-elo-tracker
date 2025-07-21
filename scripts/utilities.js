 // --- SUPABASE CONNECTION ---
 const SUPABASE_URL = 'https://fuxqbiiyrpvpxvyswzyz.supabase.co'; // Paste your Project URL here
 const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1eHFiaWl5cnB2cHh2eXN3enl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjkzOTksImV4cCI6MjA2ODYwNTM5OX0.nMfZW__cQllAKmmCBEWI5rjXFhBGEv1O0gB1p64UKOE'; // Paste your anon public Project API Key here
 const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

 // --- GLOBAL STATE ---
 let appData = {
     debaters: [],
     annotations: [],
     previousRanks: {}
 };

 let tournamentParticipants = new Map();
 let eloChart = null;

function toggleFullscreen() {
    const container = document.getElementById("chartContainer");
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => {
            alert(`Error attempting fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

// --- DATE HELPER ---
function getLocalDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}