const firebaseConfig = {
    apiKey: 'AIzaSyBMefj4U2hwFJ023PUzqM6C0YN_JP8PGgY',
    authDomain: 'syossetelotracker.firebaseapp.com',
    projectId: 'syossetelotracker',
    appId: '1:113119703269:web:3ad5ec93a3a0cd3fbe640c',
};

firebase.initializeApp(firebaseConfig);

// Separate admin and viewer emails
const adminEmails = [
    'jiayimeng12@gmail.com',
    'aadityasahu26@gmail.com',
    'zile.zhao@gmail.com',
];

const viewerEmails = [
    'mindqueblast@gmail.com',
    'viewer2@gmail.com',
    // Add more viewer-only emails here
];

const isLocalFile = window.location.protocol === 'file:';

document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const loginScreen = document.getElementById('loginScreen');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const mainContainer = document.querySelector('.container');
    const viewerContainer = document.getElementById('viewer-container');
    const authBar = document.getElementById('authBar');

    if (isLocalFile) {
        console.warn('Local file mode detected. Bypassing Firebase login.');
        loginScreen.style.display = 'none';
        loadingOverlay.style.display = 'none';
        mainContainer.style.display = 'block';
        authBar.style.display = 'flex';

        const testModeBadge = document.createElement('div');
        testModeBadge.textContent = 'TEST MODE – Not Signed In';
        Object.assign(testModeBadge.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: '#f39c12',
            color: '#000',
            padding: '10px 16px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            fontWeight: 'bold',
            zIndex: '1000',
            opacity: '0.9',
        });
        document.body.appendChild(testModeBadge);
        return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        // Reset everything first
        loginScreen.style.display = 'none';
        loadingOverlay.style.display = 'none';
        mainContainer.style.display = 'none';
        authBar.style.display = 'none';
        if (viewerContainer) viewerContainer.style.display = 'none';

        if (user) {
            const email = user.email;
            const isAdmin = adminEmails.includes(email);
            const isViewer = viewerEmails.includes(email);

            if (!isAdmin && !isViewer) {
                alert('Access denied. Your account is not authorized.');
                await firebase.auth().signOut();
                return;
            }

            // Show loading
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.opacity = '1';

            try {
                await loadData(isViewer);

                loadingOverlay.style.transition = 'opacity 0.6s ease';
                loadingOverlay.style.opacity = '0';

                setTimeout(() => {
                    loadingOverlay.remove();

                    if (isAdmin) {
                        mainContainer.style.display = 'block';
                        authBar.style.display = 'flex';
                    } else if (isViewer && viewerContainer) {
                        viewerContainer.style.display = 'block';
                        renderDebaters?.(); // call viewer UI render if defined
                    }
                }, 600);
            } catch (err) {
                console.error('❌ Failed to load app data:', err);
                alert('Something went wrong while loading. Try refreshing.');
            }
        } else {
            // Show login screen if no user
            loginScreen.style.display = 'flex';
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
                location.reload(); // force reset visibility
            });
    };
});
