# Агуулахын систем

## Суулгах заавар

### 1. Supabase схем
Supabase Dashboard → SQL Editor → `schema.sql` файлын агуулгыг paste хийж Run дарна.

### 2. Локал ажиллуулах
```bash
npm install
npm run dev
```
Хөтөч дээр: http://localhost:3000

### 3. Vercel-д deploy хийх
1. GitHub-д шинэ repo үүсгэж код upload хийнэ
2. vercel.com → New Project → GitHub repo сонгоно
3. Environment Variables нэмнэ:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Deploy дарна → link бэлэн болно

### Файлын бүтэц
```
src/
  app/
    page.tsx          — нэвтрэх/бүртгэх
    app/
      layout.tsx      — navigation
      page.tsx        — самбар + захиалга
      stock/page.tsx  — агуулах
      history/page.tsx— түүх
      payment/page.tsx— төлбөр
  lib/
    supabase.ts       — Supabase client
    types.ts          — TypeScript types
schema.sql            — Database схем (Supabase-д ажиллуулна)
```
