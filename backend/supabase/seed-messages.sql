-- Run once after accounts exist and the messages table is created. Safe to
-- re-run: it only inserts when the messages table is still empty.
--
-- Re-runnable guard: skip entirely when messages already exist.

insert into public.messages (sender_id, content, sent_at)
select u.id, m.content, now() - (m.mins || ' minute')::interval
from public.users u
cross join (
  values
    ('bob@quantum.chat',   'Hi Alice!',                               12),
    ('alice@quantum-chat', 'Hello Bob!',                              11),
    ('alice@quantum-chat', 'How are you today?',                      10),
    ('bob@quantum.chat',   E'I\'m good! Just testing our messaging prototype.', 8),
    ('alice@quantum-chat', 'Great! It is working well.',              6),
    ('bob@quantum-chat',   'See you soon!',                           4)
) as m(email, content, mins)
where u.email = m.email and not exists (select 1 from public.messages limit 1);
