async updateAddress() {
    this.loading = true;

    // Mapping ID → Nama wilayah
    const provinceName = this.provinces.find(p => p.id === this.selectedProvince)?.name || '';
    const regencyName = this.regencies.find(r => r.id === this.selectedRegency)?.name || '';
    const districtName = this.districts.find(d => d.id === this.selectedDistrict)?.name || '';
    const villageName = this.villages.find(v => v.id === this.selectedVillage)?.name || '';

    try {
        // Payload data
        const payload = {
            address: this.profile.address,
            postal_code: this.profile.postal_code,
            province: provinceName,
            regency: regencyName,
            district: districtName,
            village: villageName,
            latitude: this.profile.latitude,
            longitude: this.profile.longitude,
            updated_at: new Date().toISOString()
        };

        console.log("📦 PAYLOAD:", payload);

        // Ambil user login
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError) {
            console.error("❌ AUTH ERROR:", authError);
            throw new Error("Authentication failed");
        }

        const currentUser = authData?.user;
        console.log("👤 USER:", currentUser);

        if (!currentUser) {
            throw new Error("USER NOT AUTHENTICATED");
        }

        console.log("🚀 Updating profile ID:", currentUser.id);

        // 🔥 FIX UTAMA DI SINI (users ➜ profiles)
        const { data: addressData, error: addressError } = await supabase
            .from('profiles') 
            .update(payload)
            .eq('id', currentUser.id)
            .select()
            .single();

        if (addressError) {
            console.error("❌ SUPABASE ERROR:", addressError);
            throw addressError;
        }

        if (addressData) {
            console.log("✅ UPDATE SUCCESS:", addressData);

            // Update state frontend
            this.profile = { ...this.profile, ...addressData };

            window.showNotification("Address updated successfully!");
            this.editAddressMode = false;
        }

    } catch (error) {
        console.error("🔥 FULL ERROR OBJECT:", error);

        let userMessage = error?.message || "Unknown error";

        // Deteksi khusus network error
        if (error instanceof TypeError && String(error.message).toLowerCase().includes("fetch")) {
            userMessage = "Network error: Failed to connect to Supabase. Check URL & internet.";
        }

        window.showNotification("Error updating address: " + userMessage, true);

    } finally {
        this.loading = false;
    }
}
