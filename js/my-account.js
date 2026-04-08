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
      city: '',
      regency: '',
      district: '',
      village: '',
      province_id: '',
      city_id: '',
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
    map: null,
    mapMarker: null,
    mapInitialized: false,

    async init() {
      try {
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

        await this.fetchProvinces();
        await Promise.all([
          this.fetchProfile(),
          this.fetchOrders()
        ]);

        this.$nextTick(() => this.initMap());
        this.$watch('editAddressMode', (isEditMode) => {
          if (isEditMode) {
            this.$nextTick(() => this.initMap());
          }
        });

        window.supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') {
            window.location.href = window.toAppPath('login-page.html');
          }
        });
      } catch (error) {
        console.error('[Account] Failed to initialize account page:', error);
      }
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

      await this.hydrateAddressSelections(data);

      this.syncMapWithProfile();
    },

    resolveRegionId(options, preferredId, preferredName) {
      if (!Array.isArray(options) || options.length === 0) return '';

      if (preferredId !== null && preferredId !== undefined && String(preferredId) !== '') {
        const byId = options.find((item) => String(item.id) === String(preferredId));
        if (byId) return String(byId.id);
      }

      if (preferredName) {
        const normalizedName = String(preferredName).trim().toLowerCase();
        const byName = options.find((item) => String(item.name).trim().toLowerCase() === normalizedName);
        if (byName) return String(byName.id);
      }

      return '';
    },

    async hydrateAddressSelections(data = {}) {
      this.selectedProvince = this.resolveRegionId(this.provinces, data.province_id, data.province);
      this.profile.province_id = this.selectedProvince;

      if (!this.selectedProvince) {
        this.regencies = [];
        this.districts = [];
        this.villages = [];
        this.selectedRegency = '';
        this.selectedDistrict = '';
        this.selectedVillage = '';
        return;
      }

      // 1) Load provinces, 2) set province, 3) load cities, 4) set city,
      // 5) load districts, 6) set district, 7) load villages, 8) set village.
      await this.fetchRegencies(false);
      this.selectedRegency = this.resolveRegionId(
        this.regencies,
        data.city_id ?? data.regency_id,
        data.city ?? data.regency
      );
      this.profile.city_id = this.selectedRegency;
      this.profile.regency_id = this.selectedRegency;

      if (!this.selectedRegency) {
        this.districts = [];
        this.villages = [];
        this.selectedDistrict = '';
        this.selectedVillage = '';
        return;
      }

      await this.fetchDistricts(false);
      this.selectedDistrict = this.resolveRegionId(this.districts, data.district_id, data.district);
      this.profile.district_id = this.selectedDistrict;

      if (!this.selectedDistrict) {
        this.villages = [];
        this.selectedVillage = '';
        return;
      }

      await this.fetchVillages(false);
      this.selectedVillage = this.resolveRegionId(this.villages, data.village_id, data.village);
      this.profile.village_id = this.selectedVillage;

      this.updateProfileVillage();
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
      try {
        const userId = this.user.id;
        const payload = {
          full_name: this.profile.full_name || null,
          phone_number: this.profile.phone_number || null
        };

        const { data, error } = await window.supabase
          .from('profiles')
          .update(payload)
          .eq('id', userId)
          .select();

        console.log('[Account] updateProfile result:', data, error);

        if (error) {
          console.error('[Account] Failed to update profile:', error);
          this.showNotification('Gagal menyimpan profil.', true);
          return;
        }

        this.editProfileMode = false;
        this.showNotification('Profil berhasil disimpan.');
      } catch (error) {
        console.error('[Account] Error while updating profile:', error);
        this.showNotification('Terjadi kesalahan saat menyimpan profil.', true);
      } finally {
        this.loading = false;
      }
    },

    async updateAddress() {
      if (!this.user?.id) return;
      this.loading = true;
      try {
        const userId = this.user.id;
        const latitude = this.profile.latitude === '' || this.profile.latitude === null || this.profile.latitude === undefined
          ? null
          : Number(this.profile.latitude);
        const longitude = this.profile.longitude === '' || this.profile.longitude === null || this.profile.longitude === undefined
          ? null
          : Number(this.profile.longitude);

        const findRegionName = (options, selectedId) => {
          if (!Array.isArray(options) || !selectedId) return null;
          const match = options.find((item) => String(item.id) === String(selectedId));
          return match?.name || null;
        };

        const provinceName = findRegionName(this.provinces, this.selectedProvince) || this.profile.province || null;
        const regencyName = findRegionName(this.regencies, this.selectedRegency) || this.profile.regency || this.profile.city || null;
        const districtName = findRegionName(this.districts, this.selectedDistrict) || this.profile.district || null;
        const villageName = findRegionName(this.villages, this.selectedVillage) || this.profile.village || null;

        const payload = {
          address: this.profile.address || null,
          postal_code: this.profile.postal_code || null,
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
          province: provinceName,
          regency: regencyName,
          district: districtName,
          village: villageName
        };

        console.info('[Account] Updating address payload:', payload);

        const { data, error } = await window.supabase
          .from('profiles')
          .update(payload)
          .eq('id', userId)
          .select();

        console.log('[Account] updateAddress result:', data, error);

        if (error) {
          console.error('[Account] Failed to update address:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            payload,
            raw: error
          });
          this.showNotification('Gagal menyimpan alamat.', true);
          return;
        }

        this.editAddressMode = false;
        this.showNotification('Perubahan alamat berhasil disimpan.');
      } catch (error) {
        console.error('[Account] Error while updating address:', {
          message: error?.message || String(error),
          details: error?.details,
          hint: error?.hint,
          code: error?.code
        });
        this.showNotification('Terjadi kesalahan saat menyimpan alamat.', true);
      } finally {
        this.loading = false;
      }
    },

    async fetchProvinces() {
      try {
        const response = await fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        this.districts = await response.json();
        const match = this.regencies.find((item) => String(item.id) === String(this.selectedRegency));
        this.profile.city = match?.name || '';
        this.profile.regency = this.profile.city;
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
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

    initMap() {
      try {
        if (!window.L) {
          console.error('[Account] Leaflet is not loaded.');
          return;
        }

        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
          console.error('[Account] Map container with id="map" not found.');
          return;
        }

        if (!this.mapInitialized) {
          const initialLat = Number(this.profile.latitude) || -6.2;
          const initialLng = Number(this.profile.longitude) || 106.816666;
          this.map = window.L.map('map').setView([initialLat, initialLng], 13);
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(this.map);

          this.map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            this.setCoordinate(lat, lng);
          });

          this.mapInitialized = true;
        }

        this.syncMapWithProfile();
        setTimeout(() => this.map?.invalidateSize(), 150);
      } catch (error) {
        console.error('[Account] Failed to initialize map:', error);
      }
    },

    setCoordinate(lat, lng) {
      const normalizedLat = Number(lat);
      const normalizedLng = Number(lng);
      if (!Number.isFinite(normalizedLat) || !Number.isFinite(normalizedLng)) return;

      this.profile.latitude = Number(normalizedLat.toFixed(7));
      this.profile.longitude = Number(normalizedLng.toFixed(7));

      if (!this.map) return;

      const latlng = [this.profile.latitude, this.profile.longitude];
      if (this.mapMarker) {
        this.mapMarker.setLatLng(latlng);
      } else {
        this.mapMarker = window.L.marker(latlng).addTo(this.map);
      }
      this.map.setView(latlng, Math.max(this.map.getZoom(), 13));
    },

    syncMapWithProfile() {
      if (!this.map) return;

      const lat = Number(this.profile.latitude);
      const lng = Number(this.profile.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        this.setCoordinate(lat, lng);
      }
    },

    showNotification(message, isError = false) {
      const notification = document.getElementById('notification');
      if (!notification) {
        if (isError) console.error('[Account] Notification:', message);
        else console.info('[Account] Notification:', message);
        alert(message);
        return;
      }

      notification.textContent = message;
      notification.style.backgroundColor = isError ? '#c62828' : 'var(--accent)';
      notification.classList.add('show');
      setTimeout(() => notification.classList.remove('show'), 2500);
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
