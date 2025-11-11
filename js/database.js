// js/database.js
import { supabase } from './supabase-client.js';

/**
 * Creates a public profile for a new user.
 *
 * @param {object} user The user object from Supabase auth.
 */
export const createProfileForNewUser = async (user) => {
  const { data, error } = await supabase
    .from('profiles')
    .insert([
      { id: user.id, full_name: user.user_metadata.full_name, updated_at: new Date() },
    ]);

  if (error) {
    console.error('Error creating profile:', error);
    // Throw the error to be caught by the calling function
    throw error;
  }

  return data;
};
