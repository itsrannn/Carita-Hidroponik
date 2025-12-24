-- =====================================================================================
-- SEED SCRIPT FOR 'products' TABLE
-- =====================================================================================
-- This script populates the 'products' table with initial product data
-- previously stored inside the 'js/app.js' file.
--
-- How to use:
-- 1. Go to your Supabase project dashboard.
-- 2. Navigate to the 'SQL Editor'.
-- 3. Copy and paste the entire content of this file into the editor.
-- 4. Click 'Run'.
--
-- This will insert all sample products into your database.

-- Empty existing data to prevent duplication if the script is run multiple times
TRUNCATE TABLE public.products RESTART IDENTITY;

-- Insert new data
INSERT INTO public.products (name, category, price, "characteristics", description, image_url) VALUES
('Carolina Chili Seeds', 'seeds', 12000, '1 pack contains ±12 seeds <br> - Superior Seeds <br> - Heat Level: Very High (±2,200,000 SHU) <br> - Care: Medium <br> - Harvest Time: ±90 days', 'Carolina Reaper Chili Seeds, a cross between a Habanero and a Ghost Pepper, is known as one of the hottest peppers in the world with a heat level reaching about 2.2 million Scoville Heat Units (SHU). This pepper has a wrinkled shape and a distinctive tail at the end of the fruit. Suitable for extreme spice lovers and collectors of rare chilies. Thrives in tropical areas with full sun, regular watering, and balanced organic fertilization for best results.', 'img/general/Cabai Carolina.png'),
('Fatalii Chili Seeds', 'seeds', 12000, '1 pack contains ±12 seeds <br> - Spicy & Citrus Flavor <br> - Heat Level: 125,000–400,000 SHU <br> - Origin: Central Africa <br> - Harvest: ±80 days', 'Fatalii Chili Seeds originate from Central Africa and are known for their sharp, spicy taste combined with a fresh citrus aroma. The fruits are bright yellow when ripe, perfect for hot sauces, fermented chili pastes, or fresh chili preparations. This variety is easy to grow in a tropical climate, fruits quickly, and has high productivity. Suitable for planting in pots or open land with full sun exposure.', 'img/general/Cabai Fatalii.png'),
('Ghost Pepper Chili Seeds', 'seeds', 15000, '1 pack contains ±12 seeds <br> - Super Hot <br> - Heat Level: ±1,041,427 SHU <br> - Origin: Northeast India <br> - Harvest: ±100 days', 'Ghost Pepper or Bhut Jolokia Chili Seeds come from Assam, India, and once held the title of the world''s hottest pepper. With a heat level of over 1 million SHU, this pepper provides a slow-building but long-lasting heat. It has a vibrant red color with a characteristic tropical fruit aroma. Ideal for super-hot sauces and powdered chili. Grows well in a warm climate with full sun.', 'img/general/Cabai Ghost Pepper.png'),
('Habanero Chili Seeds', 'seeds', 10000, '1 pack contains ±12 seeds <br> - Tropical Fruit Spiciness <br> - Heat Level: 100,000–350,000 SHU <br> - Color: Orange/red <br> - Harvest: ±80 days', 'Habanero Chili Seeds are a popular variety from Mexico and the Caribbean. Known for a sharp spiciness combined with tropical fruit aromas like mango and papaya. The small fruits are bright orange when ripe, perfect for hot sauces and cooking spices. Thrives in warm temperatures and requires regular watering with well-drained soil.', 'img/general/Cabai Habanero.png'),
('Jalapeno Chili Seeds', 'seeds', 20000, '1 pack contains ±12 seeds <br> - Medium Hot <br> - Heat Level: 2,500–8,000 SHU <br> - Origin: Mexico <br> - Harvest: ±75 days', 'Jalapeno Chili Seeds are a classic variety from Mexico with a medium heat and fresh aroma. This chili is often used on pizza, in tacos, and in various international dishes. The fruits are dark green and turn red when ripe, measuring about 7–9 cm. Suitable for planting in pots or small gardens with abundant yields and easy care.', 'img/general/Cabai Jalapeno.png'),
('Naga Viper Chili Seeds', 'seeds', 28000, '1 pack contains ±12 seeds <br> - Super Hybrid <br> - Heat Level: ±1,382,118 SHU <br> - Origin: England <br> - Harvest: ±95 days', 'Naga Viper Chili Seeds are a cross between three extreme varieties: Naga Morich, Bhut Jolokia, and Trinidad Scorpion. Known for its exceptionally high heat level with a gradual burn. The fruits are dark red with a characteristic wrinkled texture. Suitable for rare chili collectors or extreme chili enthusiasts. Grows well in warm climates with full sun.', 'img/general/Cabai Naga Viper.png'),
('Orange Drop Chili Seeds', 'seeds', 17000, '1 pack contains ±12 seeds <br> - Mini Chili <br> - Bright Orange Color <br> - Refreshing Heat <br> - Harvest: ±85 days', 'Orange Drop Chili Seeds produce attractive bright orange mini chilies. The heat is mild to medium with a fresh aroma typical of young peppers. Besides consumption, this variety is often used as an ornamental plant due to its aesthetic and productive nature. Suitable for planting in decorative pots on a terrace or balcony.', 'img/general/Cabai Orange Drop.png'),
('Scotch Bonnet Chili Seeds', 'seeds', 25000, '1 pack contains ±12 seeds <br> - Tropical Heat <br> - Heat Level: 100,000–350,000 SHU <br> - Origin: Caribbean <br> - Harvest: ±90 days', 'Scotch Bonnet Chili Seeds originate from the Caribbean Islands and are very popular in Jamaican cuisine. This chili has a shape resembling a bonnet with a yellow to bright red color when ripe. The heat is sharp with tropical fruit aromas like pineapple and mango. Perfect for hot sauces, grilled dishes, and typical Caribbean chili pastes.', 'img/general/Cabai Scotch Bonnet.png'),
('Thai Chili Seeds', 'seeds', 15000, '1 pack contains ±12 seeds <br> - Sharp Heat <br> - Heat Level: 50,000–100,000 SHU <br> - Small Size <br> - Harvest: ±75 days', 'Thai Chili (Prik Kee Noo) seeds are a typical Southeast Asian chili with a sharp heat and fresh aroma. Often used in Thai and Indonesian cuisine such as stir-fries, chili pastes, and spicy soups. It is small in size but very productive. Can grow well in pots or in the ground, is heat resistant, and easy to care for.', 'img/general/Cabai Thai Chili.png'),
('ZA Fertilizer', 'nutrition', 30000, 'Nitrogen Source <br> - Non-Organic <br> - Stimulates Leaves <br> - 1kg', 'ZA (Zwavelzure Ammoniak) fertilizer is a chemical fertilizer containing Nitrogen (21%) and Sulfur (24%). Its main function is to accelerate leaf and stem growth during the vegetative phase. It is excellent for leafy vegetables, rice, and ornamental plants. It should be used in measured doses and not excessively.', 'img/general/Pupuk X.png'),
('Burnt Rice Husk', 'media', 7000, 'Growing Medium <br> - High Porosity <br> - Sterile <br> - 1 bag', 'Burnt rice husk is the result of partially burning rice husks to be used as a growing medium with high porosity. It can maintain moisture and air circulation in the soil, and helps plant roots grow healthier. It is sterile from fungi and pests, ideal for soil mixtures or hydroponic media.', 'img/general/Sekam Bakar.png'),
('Hydroponic Sponge', 'media', 3000, 'Seeding Medium <br> - Hydroponics <br> - Water Absorbent <br> - 1 Board', 'A special sponge for seeding in hydroponic systems. It has high water absorption capacity while maintaining root aeration to prevent waterlogging. Suitable for seeding leafy vegetables like lettuce, spinach, and water spinach. Can be cut to fit the size of net pots or seeding trays.', 'img/general/Spons Hidroponik.png'),
('Plant Scissors', 'equipment', 38000, 'Stainless Steel <br> - Sharp & Precise <br> - Ergonomic <br> - Rustproof', 'High-quality pruning shears made of durable and sharp stainless steel. Designed with an ergonomic handle for comfortable use, suitable for trimming small branches, leaves, or flowers. Ideal for ornamental plants and vegetable gardens.', 'img/general/Gunting Tanaman.png'),
('Complete Gardening Set', 'promo', 75000, 'Complete Equipment <br> - Includes Shovel, Gloves, and Scissors <br> - Strong Material <br> - Suitable for Beginners', 'A complete gardening set containing basic equipment such as a mini shovel, gloves, plant scissors, and a soil fork. Made from high-quality materials and an ergonomic design for gardening comfort. Ideal for beginners who want to start gardening at home or in a small garden.', 'img/general/Set Komplit.png');

-- =====================================================================================
-- SEED SCRIPT FOR 'news' TABLE
-- =====================================================================================
-- This script populates the 'news' table with initial news data.

-- Empty existing data to prevent duplication
TRUNCATE TABLE public.news RESTART IDENTITY;

-- Insert new news data
INSERT INTO public.news (title, excerpt, image_url) VALUES
('5 Great Tips for Starting Hydroponics at Home', 'Hydroponics isn''t as difficult as you might think. With this guide, you can start a mini hydroponic garden on your balcony or in your yard.', 'img/Pemula.png'),
('Understanding A-B Mix Nutrition: The Key to Successful Hydroponic Plants', 'What is A-B Mix nutrition and why is it so important? Learn how to mix and use it for maximum harvest results.', 'img/Nutrisi AB.png'),
('Growing Media Comparison: Rockwool, Cocopeat, or Hydroton?', 'Each growing medium has its pros and cons. We help you choose the best one according to your plant type and system.', 'img/Cabai Silang.png');
