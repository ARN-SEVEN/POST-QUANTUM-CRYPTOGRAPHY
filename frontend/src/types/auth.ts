export interface AuthUser {
  id: string
  email: string
  display_name: string | null
  created_at: string | null
}

export interface AuthSession {
  access_token: string
  token_type: string
  user: AuthUser
}
