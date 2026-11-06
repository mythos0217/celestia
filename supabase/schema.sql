-- CELESTIA：学習記録の同期用（Supabase の SQL Editor で1回だけ実行する）
-- Supabase プロジェクトは Lemma と共通（アカウントも共通）。記録は Lemma（lemma_state）とは別の表に1人1行。
-- 各ユーザーは自分の行だけを読み書きできる（行単位のアクセス制限 RLS）。
create table if not exists public.celestia_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null,
  rev        integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint state_size check (pg_column_size(state) < 5000000)
);

alter table public.celestia_state enable row level security;

create policy "自分の記録を読む" on public.celestia_state
  for select using (auth.uid() = user_id);
create policy "自分の記録を作る" on public.celestia_state
  for insert with check (auth.uid() = user_id);
create policy "自分の記録を更新" on public.celestia_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "自分の記録を消す" on public.celestia_state
  for delete using (auth.uid() = user_id);

-- 退会用の関数 public.delete_my_account() は Lemma の schema.sql ですでに作成済み（共通で使う）。
-- アカウントごと消えるので、Lemma の記録（lemma_state）も一緒に消える。
