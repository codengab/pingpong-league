// src/services/authService.js
// Auth menggunakan Email + Password (Supabase built-in)

import { supabase } from '../lib/supabase.js';

export const authService = {

  /**
   * Login dengan email + password
   */
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password: password,
    });
    if (error) throw error;
    return data.user;
  },

  /**
   * Daftarkan admin baru (hanya bisa dilakukan admin yang sudah login)
   * Admin baru bisa langsung login — tidak perlu konfirmasi email
   */
  async registerAdmin(email, password) {
    // 1. Buat akun di Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email:    email.trim().toLowerCase(),
      password: password,
    });
    if (error) throw error;

    // 2. Daftarkan ke admin_list agar is_admin() RLS pass
    const { error: insertError } = await supabase
      .from('admin_list')
      .insert({ email: email.trim().toLowerCase() });

    if (insertError) throw insertError;

    return { message: 'Admin ' + email + ' berhasil didaftarkan dan bisa langsung login.' };
  },

  /**
   * Reset password — kirim email reset ke admin
   */
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: window.location.origin + '/?reset=true' }
    );
    if (error) throw error;
    return { message: 'Email reset password dikirim ke ' + email };
  },

  /** Logout */
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /** Get current user */
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  /** Cek apakah user yang login adalah admin */
  async isAdmin() {
    const user = await this.getCurrentUser();
    if (!user?.email) return false;

    const { data, error } = await supabase
      .from('admin_list')
      .select('email')
      .eq('email', user.email.toLowerCase())
      .maybeSingle();

    return !error && !!data;
  },

  /** Subscribe ke perubahan auth state */
  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
