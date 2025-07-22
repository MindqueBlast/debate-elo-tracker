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

const viewerOnlyEmails = [
    'altjiayi@gmail.com',
    'mindqueblast@gmail.com',
    'example@gmail.com',
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
    document.addEventListener('DOMContentLoaded', () => {
        firebase.auth().onAuthStateChanged(async (user) => {
            const loginScreen = document.getElementById('loginScreen');
            const loadingOverlay = document.getElementById('loadingOverlay');
            const mainContainer = document.querySelector('.container');
            const viewerContainer = document.querySelector('.viewer-container');
            const authBar = document.getElementById('authBar');
            const logoutBtn = document.getElementById('logoutBtn');

            // Defensive check for essential elements
            if (
                !loginScreen ||
                !loadingOverlay ||
                !mainContainer ||
                !viewerContainer ||
                !authBar ||
                !logoutBtn
            ) {
                console.error(
                    'One or more essential DOM elements are missing.'
                );
                return;
            }

            console.log('loadingOverlay:', loadingOverlay);

            if (user) {
                const email = user.email;

                loginScreen.style.display = 'none'; // hide login screen

                if (fullAccessEmails.includes(email)) {
                    // Show loading overlay while fetching data
                    loadingOverlay.style.display = 'flex';
                    loadingOverlay.style.opacity = '1';

                    try {
                        await loadData();

                        // Fade out loading overlay
                        loadingOverlay.style.transition = 'opacity 0.6s ease';
                        loadingOverlay.style.opacity = '0';

                        setTimeout(() => {
                            loadingOverlay.style.display = 'none'; // Hide instead of remove
                            mainContainer.style.display = 'block'; // show admin container
                            authBar.style.display = 'flex'; // show auth bar
                            logoutBtn.style.display = 'inline-block'; // show logout button
                        }, 600);
                    } catch (err) {
                        console.error('❌ Failed to load app data:', err);
                        alert(
                            'Something went wrong while loading. Try refreshing.'
                        );
                        loadingOverlay.style.display = 'none';
                        loginScreen.style.display = 'flex';
                    }

                    // Hide viewer container if it was visible
                    viewerContainer.style.display = 'none';
                } else if (viewerOnlyEmails.includes(email)) {
                    loadingOverlay.style.display = 'flex';
                    loadingOverlay.style.opacity = '1';

                    try {
                        await loadData();

                        loadingOverlay.style.transition = 'opacity 0.6s ease';
                        loadingOverlay.style.opacity = '0';

                        setTimeout(() => {
                            loadingOverlay.remove();
                            loginScreen.style.display = 'none';
                            mainContainer.style.display = 'none';
                            authBar.style.display = 'none';

                            logoutBtn.style.display = 'inline-block'; // <-- Step 3 here!

                            viewerContainer.style.display = 'block';
                            renderViewerDebaters();
                        }, 600);
                    } catch (err) {
                        console.error('Failed to load data for viewer:', err);
                        alert('Failed to load viewer data, try refreshing.');
                        loadingOverlay.style.display = 'none';
                        loginScreen.style.display = 'flex';
                    }
                } else {
                    alert('Access denied. Your account is not authorized.');
                    firebase.auth().signOut();

                    // Reset UI
                    mainContainer.style.display = 'none';
                    viewerContainer.style.display = 'none';
                    authBar.style.display = 'none';
                    logoutBtn.style.display = 'none';
                    loginScreen.style.display = 'flex';
                }
            } else {
                // No user logged in, show login screen, hide everything else
                loginScreen.style.display = 'flex';
                mainContainer.style.display = 'none';
                viewerContainer.style.display = 'none';
                authBar.style.display = 'none';
                logoutBtn.style.display = 'none';
                loadingOverlay.style.display = 'none';
            }
        });
    });

    loginBtn.onclick = () => {
        const provider = new firebase.auth.GoogleAuthProvider();

        // Show loading overlay right away to prevent UI flash
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.opacity = '1';

        firebase
            .auth()
            .signInWithPopup(provider)
            .catch((error) => {
                loadingOverlay.style.display = 'none';
                alert('Login failed: ' + error.message);
            });
    };

    logoutBtn.onclick = () => {
        firebase
            .auth()
            .signOut()
            .then(() => {
                document.querySelector('.container').style.display = 'none';
                document.querySelector('.viewer-container').style.display =
                    'none';
                document.getElementById('authBar').style.display = 'none';
                document.getElementById('loginScreen').style.display = 'flex';
                showToast('Logged out successfully.', 'success');
            })
            .catch((error) => {
                showToast('Logout failed: ' + error.message, 'error');
            });
    };
}
