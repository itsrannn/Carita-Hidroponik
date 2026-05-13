document.addEventListener('alpine:init', () => {
  Alpine.data('growLabPage', () => ({
    username: 'Grower', mobileSidebar: false,
    leftMenu: ['My Grow Lab','Dashboard','My Seeds','Timeline','Secret Recipes','Calculator','Tasks','Plant Health','Achievements','Community','Settings'],
    phases: ['Germination','Vegetative','Flowering','Fruiting','Harvest'],
    dashboard: { currentDay: '-', currentPhase: '-', harvestCountdown: '-', targetPpm: 800 },
    seeds: [], timeline: [], stats: {}, liters: 10, targetPpm: 800,
    get mixMl(){ return (((Number(this.liters)||0)*(Number(this.targetPpm)||0))/1000).toFixed(1); },
    stepClass(idx){ const current = this.phases.indexOf(this.dashboard.currentPhase); if (idx < current) return 'step done'; if (idx === current) return 'step active'; return 'step'; },
    async init(){
      const { data } = await window.supabase.auth.getSession();
      if (!data?.session?.access_token) return window.location.href = 'login-page.html?redirect=my-grow-lab.html';
      this.token = data.session.access_token;
      this.username = data.session.user.user_metadata?.full_name || 'Grower';
      await this.loadDashboard(); await this.loadSeeds();
    },
    async api(path, opts={}){ const r = await fetch(`${window.API_BASE_URL}/api/grow-lab${path}`,{...opts,headers:{'Content-Type':'application/json',Authorization:`Bearer ${this.token}`,...(opts.headers||{})}}); if(!r.ok) throw new Error((await r.json()).message||'Failed'); return r.json(); },
    async loadDashboard(){ const d = await this.api('/dashboard'); this.dashboard = d.dashboard; this.stats = d.stats || {}; },
    async loadSeeds(){ const d = await this.api('/my-seeds'); this.seeds = d.seeds||[]; const active=this.seeds.find(s=>s.status==='ACTIVE'); if(active) await this.loadTimeline(active.activation_id); },
    async loadTimeline(activationId){ const d = await this.api(`/timeline/${activationId}`); this.timeline = d.timeline||[]; },
    async seedAction(seed){ if(seed.status==='ACTIVE') return this.loadTimeline(seed.activation_id); if(seed.status==='NOT ACTIVATED'){ await this.api('/activate',{method:'POST',body:JSON.stringify({product_id:seed.id})}); await this.loadSeeds(); await this.loadDashboard(); }}
  }));
});
