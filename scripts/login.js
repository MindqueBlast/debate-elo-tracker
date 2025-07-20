const firebaseConfig = {
    apiKey: "AIzaSyBMefj4U2hwFJ023PUzqM6C0YN_JP8PGgY",
    authDomain: "syossetelotracker.firebaseapp.com",
    projectId: "syossetelotracker",
    appId: "1:113119703269:web:3ad5ec93a3a0cd3fbe640c",
  };

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

  const allowedEmails = [
    "jiayimeng12@gmail.com",
    "aadityasahu26@gmail.com",
    "your.email3@gmail.com"
  ];

  const loginBtn = document.getElementById("loginBtn");
  const loginScreen = document.getElementById("loginScreen");

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      const email = user.email;
      if (allowedEmails.includes(email)) {
        loginScreen.style.display = "none";
        document.querySelector(".container").style.display = "block";
      } else {
        alert("Access denied. Your account is not authorized.");
        firebase.auth().signOut();
      }
    } else {
      document.querySelector(".container").style.display = "none";
    }
  });

  loginBtn.onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(error => {
      alert("Login failed: " + error.message);
    });
  };