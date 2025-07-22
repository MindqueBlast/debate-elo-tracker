const firebaseConfig = {
    apiKey: 'AIzaSyBMefj4U2hwFJ023PUzqM6C0YN_JP8PGgY',
    authDomain: 'syossetelotracker.firebaseapp.com',
    projectId: 'syossetelotracker',
    appId: '1:113119703269:web:3ad5ec93a3a0cd3fbe640c',
};

firebase.initializeApp(firebaseConfig);

const fullAccessEmails = [
    'jiayimeng12@gmail.com',
    'aadityasahu26@gmail.com',
    'zile.zhao@gmail.com',
];

const viewerEmails = ['altjiayi@gmail.com', 'mindqueblast@gmail.com'];

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
    document.addEventListener('DOMContentLoaded', () => {
        firebase.auth().onAuthStateChanged(async (user) => {
            const loginScreen = document.getElementById('loginScreen');
            const loadingOverlay = document.getElementById('loadingOverlay');
            const mainContainer = document.querySelector('.container');
            const authBar = document.getElementById('authBar');

            if (user) {
                const email = user.email;
                const mainContainer = document.querySelector('.container');
                const viewerContainer =
                    document.querySelector('.viewer-container');

                if (fullAccessEmails.includes(email)) {
                    // Full access
                    loginScreen.style.display = 'none';
                    loadingOverlay.style.display = 'flex';
                    loadingOverlay.style.opacity = '1';

                    try {
                        await loadData();
                        loadingOverlay.style.transition = 'opacity 0.6s ease';
                        loadingOverlay.style.opacity = '0';

                        setTimeout(() => {
                            loadingOverlay.remove();
                            mainContainer.style.display = 'block';
                            authBar.style.display = 'flex';
                        }, 600);
                    } catch (err) {
                        console.error('❌ Failed to load app data:', err);
                        alert(
                            'Something went wrong while loading. Try refreshing.'
                        );
                    }
                } else if (viewerOnlyEmails.includes(email)) {
                    // Viewer-only mode
                    loginScreen.style.display = 'none';
                    viewerContainer.style.display = 'block';
                    renderViewerDebaters(); // ⬅️ render viewer version
                } else {
                    alert('Access denied. Your account is not authorized.');
                    firebase.auth().signOut();
                }
            }
        });
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
