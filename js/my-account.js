document.addEventListener('alpine:init', () => {
  Alpine.data('accountPage', () => ({
    user: null,
    loading: false,
    isOrderLoading: false,
    activeView: 'profile',
    editProfileMode: false,
    editAddressMode: false,
    orders: [],
    profile: {
      full_name: '',
      phone_number: '',
      address: '',
      postal_code: '',
      latitude: null,
      longitude: null,
      province: '',
      regency: '',
      district: '',
      village: '',
      province_id: '',
      regency_id: '',
      district_id: '',
      village_id: ''
    },
    provinces: [],
    regencies: [],
    districts: [],
    villages: [],
    selectedProvince: '',
    selectedRegency: '',
    selectedDistrict: '',
    selectedVillage: '',

    async init() {
      if (!window.supabase) {
        window.location.href = window.toAppPath('login-page.html');
        return;
      }

      const { data, error } = await window.supabase.auth.getSession();
      if (error) {
        console.error('[Account] Failed to load session:', error);
      }

      const session = data?.session;
      if (!session?.user) {
        window.location.href = window.toAppPath('login-page.html?redirect=my-account.html');
        return;
      }

      this.user = session.user;

      await Promise.all([
        this.fetchProfile(),
        this.fetchOrders(),
        this.fetchProvinces()
      ]);

      window.supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          window.location.href = window.toAppPath('login-page.html');
        }
      });
    },

    async fetchProfile() {
      if (!this.user?.id) return;

      const { data, error } = await window.supabase
        .from('profiles')
        .select('*')
        .eq('id', this.user.id)
        .maybeSingle();

      if (error) {
        console.error('[Account] Failed to fetch profile:', error);
        return;
      }

      if (!data) return;

      this.profile = {
        ...this.profile,
        ...data
      };

      this.selectedProvince = data.province_id || '';
      this.selectedRegency = data.regency_id || '';
      this.selectedDistrict = data.district_id || '';
      this.selectedVillage = data.village_id || '';

      if (this.selectedProvince) await this.fetchRegencies(false);
      if (this.selectedRegency) await this.fetchDistricts(false);
      if (this.selectedDistrict) await this.fetchVillages(false);
    },

    async fetchOrders() {
      if (!this.user?.id) return;

      this.isOrderLoading = true;
      const { data, error } = await window.supabase
        .from('orders')
        .select('id, order_code, created_at, status, total_amount, order_details')
        .eq('user_id', this.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[Account] Failed to fetch orders:', error);
        this.orders = [];
      } else {
        this.orders = Array.isArray(data) ? data : [];
      }

      this.isOrderLoading = false;
    },

    async updateProfile() {
      if (!this.user?.id) return;
      this.loading = true;

      const payload = {
        full_name: this.profile.full_name || null,
        phone_number: this.profile.phone_number || null
      };

      const { error } = await window.supabase
        .from('profiles')
        .update(payload)
        .eq('id', this.user.id);

      this.loading = false;
      if (error) {
        console.error('[Account] Failed to update profile:', error);
        return;
      }

      this.editProfileMode = false;
    },

    async updateAddress() {
      if (!this.user?.id) return;
      this.loading = true;

      const payload = {
        address: this.profile.address || null,
        postal_code: this.profile.postal_code || null,
        latitude: this.profile.latitude || null,
        longitude: this.profile.longitude || null,
        province: this.profile.province || null,
        regency: this.profile.regency || null,
        district: this.profile.district || null,
        village: this.profile.village || null,
        province_id: this.selectedProvince || null,
        regency_id: this.selectedRegency || null,
        district_id: this.selectedDistrict || null,
        village_id: this.selectedVillage || null
      };

      const { error } = await window.supabase
        .from('profiles')
        .update(payload)
        .eq('id', this.user.id);

      this.loading = false;
      if (error) {
        console.error('[Account] Failed to update address:', error);
        return;
      }

      this.editAddressMode = false;
    },

    async fetchProvinces() {
      try {
        const response = await fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json');
        this.provinces = await response.json();
      } catch (error) {
        console.error('[Account] Failed to fetch provinces:', error);
        this.provinces = [];
      }
    },

    async fetchRegencies(reset = true) {
      if (!this.selectedProvince) {
        this.regencies = [];
        return;
      }

      if (reset) {
        this.selectedRegency = '';
        this.selectedDistrict = '';
        this.selectedVillage = '';
        this.districts = [];
        this.villages = [];
      }

      try {
        const response = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${this.selectedProvince}.json`);
        this.regencies = await response.json();
        const match = this.provinces.find((item) => String(item.id) === String(this.selectedProvince));
        this.profile.province = match?.name || '';
      } catch (error) {
        console.error('[Account] Failed to fetch regencies:', error);
        this.regencies = [];
      }
    },

    async fetchDistricts(reset = true) {
      if (!this.selectedRegency) {
        this.districts = [];
        return;
      }

      if (reset) {
        this.selectedDistrict = '';
        this.selectedVillage = '';
        this.villages = [];
      }

      try {
        const response = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${this.selectedRegency}.json`);
        this.districts = await response.json();
        const match = this.regencies.find((item) => String(item.id) === String(this.selectedRegency));
        this.profile.regency = match?.name || '';
      } catch (error) {
        console.error('[Account] Failed to fetch districts:', error);
        this.districts = [];
      }
    },

    async fetchVillages(reset = true) {
      if (!this.selectedDistrict) {
        this.villages = [];
        return;
      }

      if (reset) {
        this.selectedVillage = '';
      }

      try {
        const response = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${this.selectedDistrict}.json`);
        this.villages = await response.json();
        const match = this.districts.find((item) => String(item.id) === String(this.selectedDistrict));
        this.profile.district = match?.name || '';
      } catch (error) {
        console.error('[Account] Failed to fetch villages:', error);
        this.villages = [];
      }
    },

    updateProfileVillage() {
      const match = this.villages.find((item) => String(item.id) === String(this.selectedVillage));
      this.profile.village = match?.name || '';
    },

    getStatusClass(status = '') {
      return String(status || '').toLowerCase().replace(/\s+/g, '-');
    },

    translateStatus(status = '') {
      const normalized = String(status || '').trim().toLowerCase();
      const keyMap = {
        'menunggu konfirmasi': 'account.orders.status.pending',
        diproses: 'account.orders.status.processed',
        'dalam pengiriman': 'account.orders.status.shipping',
        selesai: 'account.orders.status.completed',
        ditolak: 'account.orders.status.rejected'
      };

      const key = keyMap[normalized];
      return key ? this.$store.i18n.t(key) : status;
    },

    formatRupiah(amount) {
      return window.formatRupiah(amount);
    },

    async handleLogout() {
      if (!window.supabase) return;

      const { error } = await window.supabase.auth.signOut();
      if (error) {
        console.error('[Account] Logout failed:', error);
        return;
      }

      Object.keys(window.sessionStorage)
        .filter((key) => key.startsWith('sb-'))
        .forEach((key) => window.sessionStorage.removeItem(key));

      window.location.href = window.toAppPath('login-page.html');
    }
  }));
});
