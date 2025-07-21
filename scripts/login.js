const firebaseConfig = {
    apiKey: 'AIzaSyBMefj4U2hwFJ023PUzqM6C0YN_JP8PGgY',
    authDomain: 'syossetelotracker.firebaseapp.com',
    projectId: 'syossetelotracker',
    appId: '1:113119703269:web:3ad5ec93a3a0cd3fbe640c',
};

firebase.initializeApp(firebaseConfig);

const allowedEmails = [
    'jiayimeng12@gmail.com',
    'aadityasahu26@gmail.com',
    'zile.zhao@gmail.com',
];

const loginBtn = document.getElementById('loginBtn');
const loginScreen = document.getElementById('loginScreen');
const logoutBtn = document.getElementById('logoutBtn');
const authBar = document.getElementById('authBar');

// Bypass login completely if opened via file://
const isLocalFile = window.location.protocol === 'file:';

if (isLocalFile) {
    console.warn('Local file mode detected. Bypassing Firebase login.');
    loginScreen.style.display = 'none';
    document.querySelector('.container').style.display = 'block';
    authBar.style.display = 'flex';

    // Create a test mode badge
    const testModeBadge = document.createElement('div');
    testModeBadge.textContent = 'TEST MODE – Not Signed In';
    testModeBadge.style.position = 'fixed';
    testModeBadge.style.bottom = '20px';
    testModeBadge.style.right = '20px';
    testModeBadge.style.background = '#f39c12';
    testModeBadge.style.color = '#000';
    testModeBadge.style.padding = '10px 16px';
    testModeBadge.style.borderRadius = '8px';
    testModeBadge.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    testModeBadge.style.fontWeight = 'bold';
    testModeBadge.style.zIndex = '1000';
    testModeBadge.style.opacity = '0.9';
    document.body.appendChild(testModeBadge);
} else {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            const email = user.email;
            if (allowedEmails.includes(email)) {
                loginScreen.style.display = 'none';

                // ✅ Show loading screen now
                const loadingOverlay =
                    document.getElementById('loadingOverlay');
                loadingOverlay.style.display = 'flex'; // show immediately
                await loadData(); // assuming this fetches all necessary app data

                // ✅ Then fade it out and show main content
                loadingOverlay.style.opacity = '0';
                loadingOverlay.style.transition = 'opacity 0.6s ease';

                setTimeout(() => {
                    loadingOverlay.remove();
                    document.querySelector('.container').style.display =
                        'block';
                    authBar.style.display = 'flex';
                }, 600);
            } else {
                alert('Access denied. Your account is not authorized.');
                firebase.auth().signOut();
            }
        } else {
            loginScreen.style.display = 'flex';
            document.querySelector('.container').style.display = 'none';
            authBar.style.display = 'none';
        }
    });

    loginBtn.onclick = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase
            .auth()
            .signInWithPopup(provider)
            .catch((error) => {
                alert('Login failed: ' + error.message);
            });
    };

    logoutBtn.onclick = () => {
        firebase
            .auth()
            .signOut()
            .then(() => {
                alert('Logged out successfully.');
            });
    };
}
