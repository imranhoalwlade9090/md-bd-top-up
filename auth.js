(function () {
  const config = window.MB_FIREBASE_CONFIG;
  if (!config || !window.firebase) {
    window.MBAuth = { ready: Promise.resolve(null), token: async () => null, signIn: async () => { throw new Error("Firebase configuration is missing."); }, register: async () => { throw new Error("Firebase configuration is missing."); }, google: async () => { throw new Error("Firebase configuration is missing."); } };
    return;
  }
  firebase.initializeApp(config);
  const auth = firebase.auth();
  let currentUser = null;
  window.MBAuth = {
    ready: new Promise((resolve) => auth.onAuthStateChanged((user) => { currentUser = user; resolve(user); })),
    token: async () => currentUser ? currentUser.getIdToken() : null,
    signIn: (email, password) => auth.signInWithEmailAndPassword(email, password),
    register: (email, password) => auth.createUserWithEmailAndPassword(email, password),
    google: () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()),
    signOut: () => auth.signOut()
  };
})();
