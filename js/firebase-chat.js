import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  onSnapshot,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: window.FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: window.FIREBASE_AUTH_DOMAIN || 'YOUR_AUTH_DOMAIN',
  projectId: window.FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: window.FIREBASE_STORAGE_BUCKET || 'YOUR_STORAGE_BUCKET',
  messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || 'YOUR_MESSAGING_SENDER_ID',
  appId: window.FIREBASE_APP_ID || 'YOUR_APP_ID'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const firebaseChat = {
  onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),

  async getOrCreateChat(userId) {
    const chatQuery = query(
      collection(db, 'chats'),
      where('userId', '==', userId),
      where('status', 'in', ['waiting', 'active']),
      limit(1)
    );

    const existing = await getDocs(chatQuery);
    if (!existing.empty) {
      return { id: existing.docs[0].id, ...existing.docs[0].data() };
    }

    const chatRef = await addDoc(collection(db, 'chats'), {
      userId,
      status: 'faq',
      createdAt: serverTimestamp()
    });

    return { id: chatRef.id, userId, status: 'faq' };
  },

  async requestSeller(chatId, userId) {
    const chatDoc = doc(db, 'chats', chatId);
    await setDoc(chatDoc, {
      userId,
      status: 'waiting',
      createdAt: serverTimestamp()
    }, { merge: true });

    return updateDoc(chatDoc, { status: 'waiting' });
  },

  async sendMessage({ chatId, sender, text }) {
    return addDoc(collection(db, 'messages'), {
      chatId,
      sender,
      text,
      createdAt: serverTimestamp()
    });
  },

  subscribeMessages(chatId, callback) {
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }
};
