-- Kích hoạt Realtime cho các bảng cần thiết
BEGIN;
  -- Kiểm tra xem publication supabase_realtime đã tồn tại chưa (mặc định có sẵn trên Supabase)
  -- Nếu chưa có thì tạo mới (phòng hờ)
  DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END
  $$;

  -- Bật Realtime cho các bảng
  ALTER PUBLICATION supabase_realtime ADD TABLE approval_requests;
  ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
  ALTER PUBLICATION supabase_realtime ADD TABLE incomes;
  ALTER PUBLICATION supabase_realtime ADD TABLE material_orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE partner_debts;
COMMIT;
