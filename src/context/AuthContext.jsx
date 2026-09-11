import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import { getCurrentProfile } from '../services/api'

const AuthContext = createContext(null)

async function fetchProfile(userId) {
  if (!userId) return null
  try {
    return await getCurrentProfile(userId)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const currentSession = data.session
      setSession(currentSession)
      if (currentSession?.user) {
        fetchProfile(currentSession.user.id).then((value) => {
          if (active) setProfile(value)
        })
      }
      setIsLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession)
        if (!newSession?.user) {
          setProfile(null)
          return
        }
        fetchProfile(newSession.user.id).then((value) => {
          if (active) setProfile(value)
        })
      },
    )

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const next = await fetchProfile(user?.id)
    setProfile(next)
    return next
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
    if (!data.user) throw new Error('No se pudo iniciar sesión.')
    const next = await fetchProfile(data.user.id)
    setProfile(next)
    return data.session
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      isStaff: profile?.role === 'doctor' || profile?.role === 'admin',
      isLoading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, isLoading, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }