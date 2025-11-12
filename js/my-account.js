// js/my-account.js
// This script assumes 'supabase' is a global variable.

document.addEventListener('alpine:init', () => {
    Alpine.data('accountPage', () => ({
        // --- User and Profile Data ---
        user: null,
        profile: {
            full_name: '',
            phone_number: '', // Add phone_number to the profile object
            address: '',
            postal_code: '',
            province: '',
            regency: '',
            district: '',
            village: ''
        },
        loading: false,

        // --- UI State ---
        editProfileMode: false,
        editAddressMode: false,

        // --- Regional Data ---
        provinces: [],
        regencies: [],
        districts: [],
        villages: [],
        selectedProvince: '',
        selectedRegency: '',
        selectedDistrict: '',
        selectedVillage: '',

        // --- Initialization ---
        async init() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = 'login page.html';
                return;
            }
            this.user = session.user;
            await this.fetchProvinces(); // Fetch provinces first
            await this.getProfile(); // Then get the profile
        },

        // --- Regional Data Fetching ---
        async fetchProvinces() {
            try {
                const response = await fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json');
                this.provinces = await response.json();
            } catch (error) {
                console.error('Error fetching provinces:', error);
            }
        },

        async fetchRegencies() {
            if (!this.selectedProvince) {
                this.regencies = [];
                this.districts = [];
                this.villages = [];
                return;
            }
            try {
                const response = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${this.selectedProvince}.json`);
                this.regencies = await response.json();
                this.districts = [];
                this.villages = [];
            } catch (error) {
                console.error('Error fetching regencies:', error);
            }
        },

        async fetchDistricts() {
            if (!this.selectedRegency) {
                this.districts = [];
                this.villages = [];
                return;
            }
            try {
                const response = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${this.selectedRegency}.json`);
                this.districts = await response.json();
                this.villages = [];
            } catch (error) {
                console.error('Error fetching districts:', error);
            }
        },

        async fetchVillages() {
            if (!this.selectedDistrict) {
                this.villages = [];
                return;
            }
            try {
                const response = await fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${this.selectedDistrict}.json`);
                this.villages = await response.json();
            } catch (error) {
                console.error('Error fetching villages:', error);
            }
        },

        updateProfileVillage() {
            // Placeholder for future logic if needed when village changes
        },

        // --- Profile and Address Management ---
        async getProfile() {
            this.loading = true;
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select(`full_name, phone_number, address, postal_code, province, regency, district, village`)
                    .eq('id', this.user.id)
                    .single();

                if (error) throw error;
                if (data) {
                    this.profile = { ...this.profile, ...data };
                    // With provinces pre-loaded, we can now safely find the matching province
                    if (this.profile.province && this.provinces.length > 0) {
                        const province = this.provinces.find(p => p.name === this.profile.province);
                        if (province) {
                            this.selectedProvince = province.id;
                            await this.fetchRegencies();
                            // Continue for regency, district, and village
                        }
                    }
                }
            } catch (error) {
                alert('Error loading profile: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        async updateProfile() {
            this.loading = true;
            try {
                // Save the new phone_number field
                const { data, error } = await supabase.from('profiles').update({
                    full_name: this.profile.full_name,
                    phone_number: this.profile.phone_number,
                    updated_at: new Date()
                }).eq('id', this.user.id).select().single();

                if (error) throw error;

                if (data) {
                    this.profile = { ...this.profile, ...data };
                    alert('Profile updated successfully!');
                    this.editProfileMode = false;
                }
            } catch (error) {
                alert('Error updating profile: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        async updateAddress() {
            this.loading = true;

            // Find the names of the selected items
            const provinceName = this.provinces.find(p => p.id === this.selectedProvince)?.name || '';
            const regencyName = this.regencies.find(r => r.id === this.selectedRegency)?.name || '';
            const districtName = this.districts.find(d => d.id === this.selectedDistrict)?.name || '';
            const villageName = this.villages.find(v => v.id === this.selectedVillage)?.name || '';

            try {
                const { data, error } = await supabase.from('profiles').update({
                    address: this.profile.address,
                    postal_code: this.profile.postal_code,
                    province: provinceName,
                    regency: regencyName,
                    district: districtName,
                    village: villageName,
                    updated_at: new Date()
                }).eq('id', this.user.id).select().single();

                if (error) throw error;

                if (data) {
                    this.profile = { ...this.profile, ...data };
                    alert('Address updated successfully!');
                    this.editAddressMode = false;
                }
            } catch (error) {
                alert('Error updating address: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        async handleLogout() {
            this.loading = true;
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                // Correctly redirect to the login page relative to the current path
                window.location.href = 'login page.html';
            } catch (error) {
                alert('Error logging out: ' + error.message);
            } finally {
                this.loading = false;
            }
        }
    }));
});
