
import type {
  AuthResponse,
  UserResponse
} from '@supabase/supabase-js'

import { getSupabaseClient } from '@/lib/supabase'

export interface SignUpInput {
  fullName: string
  email: string
  password: string
}

export interface SignInInput {
  email: string
  password: string
}

export const authService = {
  async signUp(input: SignUpInput): Promise<AuthResponse['data']> {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim()
        },
        emailRedirectTo: `${window.location.origin}/auth`
      }
    })

    if (error) {
      throw error
    }

    return data
  },

  async signIn(input: SignInInput): Promise<AuthResponse['data']> {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password
    })

    if (error) {
      throw error
    }

    return data
  },

  async resendSignupConfirmation(email: string): Promise<void> {
    const supabase = getSupabaseClient()

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth`
      }
    })

    if (error) {
      throw error
    }
  },

  async signOut(): Promise<void> {
    const supabase = getSupabaseClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
    const supabase = getSupabaseClient()

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/auth?mode=recovery`
      }
    )

    if (error) {
      throw error
    }
  },

  async updatePassword(password: string): Promise<UserResponse['data']> {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase.auth.updateUser({
      password
    })

    if (error) {
      throw error
    }

    return data
  }
}
