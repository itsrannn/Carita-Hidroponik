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

        // --- Initialization ---
        async init() {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = 'login page.html';
                return;
            }
            this.user = session.user;
            await this.getProfile();
        },

        // --- Profile and Address Management ---
        async getProfile() {
            this.loading = true;
            try {
                // Fetch the new phone_number field
                const { data, error } = await supabase
                    .from('profiles')
                    .select(`full_name, phone_number, address, postal_code, province, regency, district, village`)
                    .eq('id', this.user.id)
                    .single();

                if (error) throw error;
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
            try {
                const { data, error } = await supabase.from('profiles').update({
                    address: this.profile.address,
                    postal_code: this.profile.postal_code,
                    province: this.profile.province,
                    regency: this.profile.regency,
                    district: this.profile.district,
                    village: this.profile.village,
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
