# Fichas de RPG

React + Vite. Dados e login no Supabase (projeto "projeto fichasrpgs").

- Login: Supabase Auth (Mestre cria os jogadores pelo painel; função `admin-users`).
- Dados: tabelas `profiles`, `campaigns`, `records` com regras de acesso (RLS).
- Deploy: Vercel (Vite, `npm run build`, saída `dist`).
