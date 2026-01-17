/*
(async function() {
    // Wait for supabase client to be available
    while (typeof window.supabase === 'undefined') {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const { data: { user } } = await window.supabase.auth.getUser();

    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const { data, error } = await window.supabase.rpc('is_admin');

    if (error || !data) {
        window.location.href = 'index.html';
    }
})();
*/
