document.addEventListener('alpine:init', () => {
    Alpine.data('accountPage', () => ({
        // --- User and Profile Data ---
        user: null,
        profile: {
            full_name: '',
            address: '',
            postal_code: '',
            province_id: '',
            regency_id: '',
            district_id: '',
            village_id: ''
        },
        loading: false,

        // --- UI State ---
        editProfileMode: false,
        editAddressMode: false,

        // --- Address Dropdown Data ---
        provinces: [],
        regencies: [],
        districts: [],
        villages: [],

        // --- Selected Address Values ---
        selectedProvince: '',
        selectedRegency: '',
        selectedDistrict: '',
        selectedVillage: '',

        // --- API Base URL ---
        apiBaseUrl: 'https://emsifa.github.io/api-wilayah-indonesia/api',

        // --- Initialization ---
        async init() {
            // Check session and fetch profile
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = '/login page.html';
                return;
            }
            this.user = session.user;
            await this.getProfile();

            // Load provinces for the dropdown
            this.loadProvinces();

            // --- Watchers for Cascading Dropdowns ---
            this.$watch('selectedProvince', (provinceId) => {
                this.selectedRegency = '';
                this.regencies = [];
                if (provinceId) this.loadRegencies(provinceId);
            });

            this.$watch('selectedRegency', (regencyId) => {
                this.selectedDistrict = '';
                this.districts = [];
                if (regencyId) this.loadDistricts(regencyId);
            });

            this.$watch('selectedDistrict', (districtId) => {
                this.selectedVillage = '';
                this.villages = [];
                if (districtId) this.loadVillages(districtId);
            });

            // Watcher to pre-fill dropdowns when entering edit mode
            this.$watch('editAddressMode', (isEditing) => {
                if (isEditing) {
                    this.loadAddressFromProfile();
                }
            });
        },

        // --- Profile and Address Management ---
        async getProfile() {
            this.loading = true;
            try {
                const { data, error, status } = await supabase
                    .from('profiles')
                    .select(`full_name, address, postal_code, province_id, regency_id, district_id, village_id`)
                    .eq('id', this.user.id)
                    .single();
                if (error && status !== 406) throw error;
                if (data) this.profile = { ...this.profile, ...data };
            } catch (error) {
                alert('Error loading profile: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        async updateProfile() {
            this.loading = true;
            try {
                const { error } = await supabase.from('profiles').upsert({
                    id: this.user.id,
                    full_name: this.profile.full_name,
                    updated_at: new Date()
                });
                if (error) throw error;
                alert('Profile updated successfully!');
                this.editProfileMode = false;
            } catch (error) {
                alert('Error updating profile: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        async updateAddress() {
            this.loading = true;
            try {
                const { error } = await supabase.from('profiles').upsert({
                    id: this.user.id,
                    address: this.profile.address,
                    postal_code: this.profile.postal_code,
                    province_id: this.selectedProvince,
                    regency_id: this.selectedRegency,
                    district_id: this.selectedDistrict,
                    village_id: this.selectedVillage,
                    updated_at: new Date()
                });
                if (error) throw error;
                alert('Address updated successfully!');
                this.editAddressMode = false;
            } catch (error) {
                alert('Error updating address: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        // --- Cascading Dropdown Methods ---
        async loadProvinces() {
            try {
                const response = await fetch(`${this.apiBaseUrl}/provinces.json`);
                this.provinces = await response.json();
            } catch (error) { console.error('Error loading provinces:', error); }
        },
        async loadRegencies(provinceId) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/regencies/${provinceId}.json`);
                this.regencies = await response.json();
            } catch (error) { console.error('Error loading regencies:', error); }
        },
        async loadDistricts(regencyId) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/districts/${regencyId}.json`);
                this.districts = await response.json();
            } catch (error) { console.error('Error loading districts:', error); }
        },
        async loadVillages(districtId) {
            try {
                const response = await fetch(`${this.apiBaseUrl}/villages/${districtId}.json`);
                this.villages = await response.json();
            } catch (error) { console.error('Error loading villages:', error); }
        },

        async loadAddressFromProfile() {
            if (!this.profile.province_id) return;

            this.selectedProvince = this.profile.province_id;
            await new Promise(resolve => setTimeout(resolve, 500));

            if (this.profile.regency_id) {
                this.selectedRegency = this.profile.regency_id;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (this.profile.district_id) {
                this.selectedDistrict = this.profile.district_id;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            if (this.profile.village_id) {
                this.selectedVillage = this.profile.village_id;
            }
        },

        async handleLogout() {
            this.loading = true;
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                window.location.href = '/';
            } catch (error) {
                alert('Error logging out: ' + error.message);
            } finally {
                this.loading = false;
            }
        }
    }));
});
