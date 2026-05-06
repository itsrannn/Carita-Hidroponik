import { firebaseChat, auth } from '../firebase-chat.js';

const FAQ_DATA = [
  { q: 'Berapa ongkir?', a: 'Ongkir tergantung wilayah pengiriman dan kurir yang dipilih saat checkout.' },
  { q: 'Berapa lama pengiriman?', a: 'Estimasi pengiriman 1-3 hari kerja (Jabodetabek) dan 2-7 hari untuk luar kota.' },
  { q: 'Apakah bisa COD?', a: 'Saat ini pembayaran COD belum tersedia. Gunakan transfer bank atau pembayaran online.' },
  { q: 'Bagaimana cara retur?', a: 'Silakan kirim foto/video produk dan nomor pesanan, tim kami bantu proses retur.' }
];

export class MessageList {
  constructor(container) { this.container = container; }
  render(messages) {
    this.container.innerHTML = messages.map((m) => `
      <div class="cw-msg ${m.sender === 'user' ? 'cw-msg-user' : 'cw-msg-other'}">
        <div class="cw-bubble">
          ${m.sender !== 'user' ? `<small>${m.sender === 'bot' ? 'Bot' : 'Admin'}</small>` : ''}
          <p>${m.text}</p>
        </div>
      </div>`).join('');
    this.container.scrollTop = this.container.scrollHeight;
  }
}

export class FAQList {
  constructor(container, onPick) { this.container = container; this.onPick = onPick; }
  render() {
    this.container.innerHTML = FAQ_DATA.map((f) => `<button class="cw-faq-btn" data-q="${f.q}">${f.q}</button>`).join('');
    this.container.querySelectorAll('.cw-faq-btn').forEach((btn) => btn.addEventListener('click', () => this.onPick(btn.dataset.q)));
  }
}

export class ChatPanel {
  constructor(root) {
    this.root = root;
    this.state = { mode: 'faq', messages: [], user: null, chatId: null, unread: 0, unsub: null, typing: false };
  }

  async init() {
    this.render();
    this.bindUI();
    firebaseChat.onAuthStateChanged((user) => {
      this.state.user = user;
      this.toggleAuthUI();
    });
  }

  bindUI() {
    this.bodyEl = this.root.querySelector('.cw-body');
    this.emptyEl = this.root.querySelector('.cw-empty');
    this.inputEl = this.root.querySelector('.cw-input');
    this.sendEl = this.root.querySelector('.cw-send');
    this.ctaEl = this.root.querySelector('.cw-cta');
    this.statusEl = this.root.querySelector('.cw-auth-warning');
    this.badgeEl = document.querySelector('.cw-badge');

    this.messageList = new MessageList(this.bodyEl);
    this.faqList = new FAQList(this.root.querySelector('.cw-faq-list'), (q) => this.askFaq(q));
    this.faqList.render();

    this.ctaEl.addEventListener('click', () => this.escalateToSeller());
    this.sendEl.addEventListener('click', () => this.sendLiveMessage());
    this.inputEl.addEventListener('keypress', (e) => e.key === 'Enter' && this.sendLiveMessage());
  }

  toggleAuthUI() {
    const unauthorized = !auth.currentUser;
    this.inputEl.disabled = unauthorized || this.state.mode === 'faq';
    this.sendEl.disabled = unauthorized || this.state.mode === 'faq';
    this.ctaEl.hidden = this.state.mode === 'live';
    this.statusEl.textContent = unauthorized ? 'Silakan login untuk menggunakan fitur chat' : '';
  }

  pushMessage(sender, text) {
    this.state.messages.push({ sender, text });
    if (this.emptyEl) this.emptyEl.hidden = this.state.messages.length > 0;
    this.messageList.render(this.state.messages);
  }

  askFaq(question) {
    const found = FAQ_DATA.find((f) => f.q === question);
    this.pushMessage('user', question);
    this.pushMessage('bot', found?.a || 'Maaf, pertanyaan belum tersedia.');
  }

  async escalateToSeller() {
    if (!auth.currentUser) return this.toggleAuthUI();
    const userId = auth.currentUser.uid;
    const chat = await firebaseChat.getOrCreateChat(userId);
    this.state.chatId = chat.id;
    await firebaseChat.requestSeller(chat.id, userId);
    this.state.mode = 'live';
    this.toggleAuthUI();
    this.pushMessage('bot', 'Menghubungkan ke penjual...');
    this.pushMessage('bot', 'Menunggu respon...');

    if (this.state.unsub) this.state.unsub();
    this.state.unsub = firebaseChat.subscribeMessages(chat.id, (messages) => {
      this.state.messages = messages;
      this.messageList.render(messages);
      if (this.root.closest('.cw-panel').classList.contains('closed')) {
        this.state.unread += 1;
        this.badgeEl.textContent = this.state.unread;
        this.badgeEl.hidden = false;
      }
    });
  }

  async sendLiveMessage() {
    const text = this.inputEl.value.trim();
    if (!text || !this.state.chatId || !auth.currentUser) return;
    await firebaseChat.sendMessage({ chatId: this.state.chatId, sender: 'user', text });
    this.inputEl.value = '';
  }

  render() {
    this.root.innerHTML = `
      <div class="cw-header">
        <span class="cw-header-title">Customer Support</span>
        <span class="cw-header-subtitle">Online • Respon cepat</span>
      </div>
      <div class="cw-body">
        <div class="cw-empty">
          <h4>Halo! 👋</h4>
          <p>Kami siap bantu pertanyaan produk, pengiriman, atau pesanan Anda. Pilih pertanyaan cepat di bawah atau langsung chat dengan penjual.</p>
        </div>
      </div>
      <div class="cw-faq-list"></div>
      <div class="cw-footer">
        <p class="cw-auth-warning"></p>
        <button class="cw-cta">Chat dengan Penjual</button>
        <div class="cw-input-wrap">
          <input class="cw-input" placeholder="Tulis pesan..." />
          <button class="cw-send" aria-label="Kirim pesan">➤</button>
        </div>
      </div>
    `;
  }
}

export class ChatWidget {
  constructor() {
    this.button = document.createElement('button');
    this.panel = document.createElement('div');
  }

  mount() {
    this.button.className = 'cw-fab';
    this.button.innerHTML = '💬 <span class="cw-badge" hidden>0</span>';
    this.panel.className = 'cw-panel closed';
    document.body.append(this.button, this.panel);

    const panelInstance = new ChatPanel(this.panel);
    panelInstance.init();

    this.button.addEventListener('click', () => {
      this.panel.classList.toggle('closed');
      if (!this.panel.classList.contains('closed')) {
        const badge = this.button.querySelector('.cw-badge');
        badge.hidden = true;
        badge.textContent = '0';
      }
    });
  }
}

export const initChatWidget = () => new ChatWidget().mount();
