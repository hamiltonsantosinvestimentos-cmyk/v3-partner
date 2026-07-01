-- investor_email pode ser NULL para convites a securitizadoras (acesso via token, sem email)
ALTER TABLE deal_room_invites ALTER COLUMN investor_email DROP NOT NULL;
