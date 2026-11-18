-- LEVEL UP: Mock test №1, 18-сұрақ: жауаптардағы дәреже белгісін (2ᴺ) қалпына келтіру
update public.tests set questions = jsonb_set(questions, '{17,options}', '["A) K = 2ᴺ", "B) K = 2ᴺ + 1", "C) K = 2ᴺ - 1", "D) K = 2ᴺ - 2"]'::jsonb)
where title = 'Инфо | Mock test №1';
