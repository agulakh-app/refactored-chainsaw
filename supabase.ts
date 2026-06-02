import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  'https://bvniuzekffxhzqgvvwea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bml1emVrZmZ4aHpxZ3Z2d2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NTAyMjMsImV4cCI6MjA5NTUyNjIyM30.Q06MYQsP_w8L-zReeHMPQAtd4rAM_QNUHNUtKzR2IRU'
)
