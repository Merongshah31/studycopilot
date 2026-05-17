# Supabase Setup For PDF Import Storage

Use this once in your Supabase project so Schedule Import can store uploaded PDFs and track import history.

## 1) Run database schema

In Supabase SQL Editor, run:

- [schema.sql](/C:/reactproject/studypilot/backend/supabase/schema.sql)

This creates:
- `tasks`
- `schedule_imports`
- other app tables and RLS policies

## 2) Create Storage bucket

In Supabase Dashboard:
1. Open **Storage**
2. Create bucket: `schedule-pdfs`
3. Keep it **Private**

## 3) (Optional) Storage policies for client access

Current app uploads via backend service-role key, so client policies are not required for upload.

If you later need user-side direct read/list, add policies in SQL Editor:

```sql
create policy "users can read own schedule pdf objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'schedule-pdfs'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

## 4) Required backend env

Set in `backend/.env`:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-chat
```

## 5) Install Python extractor deps

From `backend/schedule-ai-extractor`:

```bash
pip install -r requirements.txt
```

## 6) Verify flow

1. Open `#/schedule-import`
2. Upload PDF
3. Preview extracted rows
4. Confirm selected rows

Expected:
- PDF object stored in bucket `schedule-pdfs` under `<user_id>/...`
- row created/updated in `schedule_imports`
- confirmed rows inserted into `tasks`
