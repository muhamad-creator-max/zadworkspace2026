-- Seed minimal data. Run AFTER creating the admin auth user via the Supabase dashboard
-- (Authentication > Users > Add user: admin@zad.local / 123123, auto-confirm).

insert into rooms (name, description, capacity, hourly_prices, label_color) values
('Shared',   'Open shared coworking area', 20,
 '[{"hour":1,"price":40},{"hour":2,"price":70},{"hour":3,"price":100},{"hour":4,"price":130},{"hour":5,"price":150},{"hour":6,"price":170},{"hour":7,"price":190},{"hour":8,"price":210},{"hour":9,"price":230},{"hour":10,"price":250},{"hour":11,"price":270},{"hour":12,"price":290}]',
 '#354A37'),
('Silent',   'Silent focus room', 8,
 '[{"hour":1,"price":50},{"hour":2,"price":90},{"hour":3,"price":130},{"hour":4,"price":160},{"hour":5,"price":190},{"hour":6,"price":220},{"hour":7,"price":250},{"hour":8,"price":280},{"hour":9,"price":310},{"hour":10,"price":340},{"hour":11,"price":370},{"hour":12,"price":400}]',
 '#000000'),
('Meeting',  'Private meeting room', 6,
 '[{"hour":1,"price":80},{"hour":2,"price":150},{"hour":3,"price":220},{"hour":4,"price":280},{"hour":5,"price":340},{"hour":6,"price":400},{"hour":7,"price":460},{"hour":8,"price":520},{"hour":9,"price":580},{"hour":10,"price":640},{"hour":11,"price":700},{"hour":12,"price":760}]',
 '#FAA9A9');

insert into items (name, price, category, stock) values
('Tea',       15,  'Drink',   100),
('Coffee',    25,  'Drink',    80),
('Water',     10,  'Drink',   200),
('Croissant', 30,  'Snack',    40),
('Notebook',  50,  'Product',  25),
('Printing',   2,  'Service',1000);
