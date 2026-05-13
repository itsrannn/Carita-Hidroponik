document.addEventListener('alpine:init', () => {
  Alpine.data('growLabPage', () => ({
    loading: false, products: [], activeTimeline: [], secrets: [], secretLocked: true,
    waterVolume: 10, targetPpm: 800, activationCode: '', nutrientProductLink: window.toAppPath('product-details.html?id=nutrisi-ab-mix'),
    get requiredMl(){ return ((Number(this.targetPpm)||0)/100) * (Number(this.waterVolume)||0); },

    async init() {
      const { data } = await window.supabase.auth.getSession();
      if (!data?.session?.access_token) { window.location.href = window.toAppPath('login-page.html?redirect=my-grow-lab.html'); return; }
      this.token = data.session.access_token;
      await this.fetchProducts();
    },

    async api(path, opts={}) {
      const res = await fetch(`${window.API_BASE_URL}/api/grow-lab${path}`, { ...opts, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${this.token}`, ...(opts.headers||{}) } });
      if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
      return res.json();
    },

    async fetchProducts() {
      this.loading = true;
      try {
        const data = await this.api('/my-products');
        this.products = data.products || [];
        const firstActive = this.products.find((p) => p.is_activated);
        if (firstActive) await this.fetchTimeline(firstActive.id);
      } catch (e) { alert(e.message); } finally { this.loading = false; }
    },

    async fetchTimeline(productId){
      const { data, error } = await window.supabase.from('grow_timelines').select('*').eq('product_id', productId).order('day_number', {ascending:true});
      if (error) return;
      this.activeTimeline = data || [];
    },

    async activate(productId){
      await this.api('/activate',{method:'POST',body:JSON.stringify({product_id:productId})});
      alert('Activation success!');
      await this.fetchProducts();
    },

    async loadSecret(productId){
      try { const data = await this.api(`/secret/${productId}`); this.secrets = data.secrets || []; this.secretLocked = false; } catch(_){ this.secretLocked = true; }
    },

    async activateByCode(){
      try { await this.api('/activate-by-code',{method:'POST', body: JSON.stringify({activation_code:this.activationCode})}); alert('Activation by code success'); await this.fetchProducts(); }
      catch(e){ alert(e.message); }
    }
  }));
});
