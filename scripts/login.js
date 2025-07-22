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

const viewerOnlyEmails = [
    'altjiayi@gmail.com',
    'mindqueblast@gmail.com',
    'example@gmail.com',
];

const loginBtn = document.getElementById('loginBtn');
const loginScreen = document.getElementById('loginScreen');
const loadingOverlay = document.getElementById('loadingOverlay');
const mainContainer = document.querySelector('.container');
const viewerContainer = document.querySelector('.viewer-container');
const authBar = document.getElementById('authBar');
const logoutBtn = document.getElementById('logoutBtn');

// Local dev bypass
const isLocalFile = window.location.protocol === 'file:';
if (isLocalFile) {
    console.warn('Local file mode detected. Bypassing Firebase login.');
    loginScreen.style.display = 'none';
    loadingOverlay.style.display = 'none';
    mainContainer.style.display = 'block';
    authBar.style.display = 'flex';

    // Add TEST MODE badge
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
            if (user) {
                const email = user.email;

                loginScreen.style.display = 'none';
                loadingOverlay.style.display = 'flex';
                loadingOverlay.style.opacity = '1';

                if (allowedEmails.includes(email)) {
                    // Admin
                    try {
                        await loadData();

                        loadingOverlay.style.transition = 'opacity 0.6s ease';
                        loadingOverlay.style.opacity = '0';

                        setTimeout(() => {
                            loadingOverlay.remove();
                            mainContainer.style.display = 'block';
                            authBar.style.display = 'flex';
                            logoutBtn.style.display = 'inline-block';
                        }, 600);
                    } catch (err) {
                        console.error('❌ Failed to load admin data:', err);
                        alert('Something went wrong while loading admin data.');
                        loadingOverlay.style.display = 'none';
                        loginScreen.style.display = 'flex';
                    }
                } else if (viewerOnlyEmails.includes(email)) {
                    // Viewer
                    try {
                        await loadData();

                        loadingOverlay.style.transition = 'opacity 0.6s ease';
                        loadingOverlay.style.opacity = '0';

                        setTimeout(() => {
                            loadingOverlay.remove();
                            viewerContainer.style.display = 'block';
                            logoutBtn.style.display = 'inline-block';
                            renderViewerDebaters();
                        }, 600);
                    } catch (err) {
                        console.error('❌ Failed to load viewer data:', err);
                        alert(
                            'Something went wrong while loading viewer data.'
                        );
                        loadingOverlay.style.display = 'none';
                        loginScreen.style.display = 'flex';
                    }
                } else {
                    alert('Access denied. Your account is not authorized.');
                    firebase.auth().signOut();
                }
            } else {
                // Not logged in
                loginScreen.style.display = 'flex';
                loadingOverlay.style.display = 'none';
                mainContainer.style.display = 'none';
                viewerContainer.style.display = 'none';
                authBar.style.display = 'none';
                logoutBtn.style.display = 'none';
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
