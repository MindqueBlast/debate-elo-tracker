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

const viewerOnlyEmails = ['mindqueblast@gmail.com', 'viewer2@gmail.com'];

let isViewer = false;

const loginBtn = document.getElementById('loginBtn');
const loginScreen = document.getElementById('loginScreen');
const logoutBtn = document.getElementById('logoutBtn');
const authBar = document.getElementById('authBar');
const viewerContainer = document.getElementById('viewer-container');
const mainContainer = document.querySelector('.container');

// Bypass login if using file://
const isLocalFile = window.location.protocol === 'file:';

if (isLocalFile) {
    console.warn('Local file mode detected. Bypassing Firebase login.');
    loginScreen.style.display = 'none';
    mainContainer.style.display = 'block';
    authBar.style.display = 'flex';

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
            if (!user) {
                loginScreen.style.display = 'flex';
                document.getElementById('loadingOverlay').style.display =
                    'none';
                mainContainer.style.display = 'none';
                authBar.style.display = 'none';
                viewerContainer.style.display = 'none';
                return;
            }

            const email = user.email;
            if (allowedEmails.includes(email)) {
                isViewer = false;
            } else if (viewerOnlyEmails.includes(email)) {
                isViewer = true;
            } else {
                alert('Access denied. Your account is not authorized.');
                firebase.auth().signOut();
                return;
            }

            // Step 1: Hide login screen, show loading
            loginScreen.style.display = 'none';
            document.getElementById('loadingOverlay').style.display = 'flex';

            try {
                await loadData();

                // Animate out the loading screen
                const loadingOverlay =
                    document.getElementById('loadingOverlay');
                loadingOverlay.style.transition = 'opacity 0.6s ease';
                loadingOverlay.style.opacity = '0';

                setTimeout(() => {
                    loadingOverlay.remove();
                    if (isViewer) {
                        viewerContainer.style.display = 'block';
                        mainContainer.style.display = 'none';
                        authBar.style.display = 'none';
                    } else {
                        mainContainer.style.display = 'block';
                        authBar.style.display = 'flex';
                        viewerContainer.style.display = 'none';
                    }
                }, 600);
            } catch (err) {
                console.error('❌ Failed to load app data:', err);
                alert('Something went wrong while loading. Try refreshing.');
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
                location.reload(); // Force reset everything
            });
    };
}
