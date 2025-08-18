/*
  # Seed sample worksheet data

  1. Insert sample worksheet
  2. Insert sample regions with descriptions
*/

-- Insert sample worksheet
INSERT INTO worksheets (id, document_name, drm_protected_pages) VALUES 
('ABCDE', 'Colorful Illustrative Adjectives English Worksheet_2.pdf', ARRAY[1])
ON CONFLICT (id) DO UPDATE SET
  document_name = EXCLUDED.document_name,
  drm_protected_pages = EXCLUDED.drm_protected_pages,
  updated_at = now();

-- Insert sample regions
INSERT INTO regions (worksheet_id, page, x, y, width, height, type, name, description) VALUES 
('ABCDE', 1, 48.5, 277.666667938232, 481, 103, 'area', '1_1', ARRAY[
  'Think about different ways you can describe a house. You might talk about its size (is it big or small?), its age (is it old or new?), or how it looks in general (is it pretty, plain, colorful?). The words in the box give you some options.',
  'What words come to mind when you first look at the house, even before checking the box?',
  'Now, look at the words provided: "new," "small," "cute," "big," "fat." Which of these words could you use to describe a house? For instance, does it make sense to say a "fat house"? Probably not. But a house could certainly be "big" or "small."',
  'Go through each word in the box. Does it make sense with the word "house"?',
  'Look closely at the picture of the house. Does it seem very large and grand, or does it look more cozy and perhaps not so big? Compare the image to your idea of what a "big" house looks like versus a "small" one.',
  'Which word from the box best matches what you see in the picture of the house?'
]),
('ABCDE', 1, 50.5, 386.666667938232, 479, 100, 'area', '1_2', ARRAY[
  'Cars can be described in many ways too! They can be fast or slow, old or modern, and of course, they come in different sizes. We''re looking for one word from the box that fits this particular yellow car.',
  'What''s the first feature of this yellow car that you notice and could describe?',
  'Consider the adjectives available: "new," "small," "cute," "big," "fat." Which of these could apply to a car? Can a car be "fat"? Not really. But it could be "new," "small," "cute," or "big."',
  'Which of the words from the box sound like they could describe some kind of car?',
  'Now focus on the picture of the yellow car. Does it look like it just rolled out of the factory, or has it been around for a while? Does it seem particularly large, or is it more of a compact size? Sometimes, smaller, cheerful-looking things are described with a particular word from our list.',
  'Which adjective from the box do you think best describes this specific yellow car?'
]),
('ABCDE', 1, 50.5, 495.66667175293, 479, 99, 'area', '1_3', ARRAY[
  'This car is quite different from the last one! Think about what makes this vehicle stand out. Its most noticeable features will probably guide you to the best adjective.',
  'What is the most obvious difference between this car and a typical car you see on the road?',
  'Let''s check our list of adjectives again: "new," "small," "cute," "big," "fat." We already thought about which ones can describe a car. Now, think about which ones might fit this specific type of car.',
  'Looking at this powerful-looking car, which adjectives from the box seem like good possibilities, and which ones definitely don''t fit?',
  'Observe the monster truck. Pay special attention to its wheels and overall size compared to how you imagine a standard car. Would "small" be a good description? How about "cute"? Or does another word from the list capture its impressive appearance much better?',
  'Considering its size and features, which word from the box is the most accurate way to describe this car?'
]),
('ABCDE', 1, 50.5, 604.66667175293, 478, 96, 'area', '1_4', ARRAY[
  'Rabbits are often described with words that talk about their appearance or how they make us feel. Think about common words you hear people use when they see a rabbit.',
  'What are some words that usually come to mind when you see a fluffy animal like this rabbit?',
  'Our adjectives are "new," "small," "cute," "big," "fat." Can a rabbit be any of these things? A baby rabbit could be "new." Rabbits can certainly be "small," "cute," or even grow to be "big" or look "fat."',
  'Which of these adjectives could you use to describe a rabbit in general?',
  'Look closely at the rabbit in the picture. Does it look particularly large for a rabbit, or is it a more typical size? Does it have features like soft fur, long ears, and a sweet face that might lead you to a specific adjective from the list?',
  'Which word from the box do you feel best suits this particular rabbit?'
]),
('ABCDE', 1, 49.5, 711.66667175293, 478, 97, 'area', '1_5', ARRAY[
  'Cats are very common pets, and people use lots of different words to describe them. Think about cats you''ve seen or know. What are some of their characteristics?',
  'What are some general describing words you might use for any cat?',
  'Let''s look at our word box one last time: "new," "small," "cute," "big," "fat." Can a cat be described by these words? A kitten is often "new" and "small." Some cats are quite "big," and some might be a bit "fat." And many people find cats to be "cute."',
  'Which of these words from the box could apply to different kinds of cats you can imagine?',
  'Now, observe the cat in the drawing. Consider its friendly expression, its size as it''s drawn, and its overall appearance. Does it look like a very large cat, or a particularly plump one? Or does it have a certain charm or appeal that one of the other words might capture best?',
  'Thinking about this specific drawing, which word from the box seems like the most fitting description for this cat?'
])
ON CONFLICT DO NOTHING;

-- Insert page 2 regions
INSERT INTO regions (worksheet_id, page, x, y, width, height, type, name, description) VALUES 
('ABCDE', 2, 7.5, 300.666667938232, 154, 199, 'area', '2_1', ARRAY[
  'Think about what you see. There''s a big, bright sun, and a fluffy cloud. When the sun is out, even if there are some clouds, what do we usually call that kind of day?',
  'What''s the main source of light you notice in this picture?',
  'Now, look at your word bank: Rainy, Cloudy, Sunny, Tornado, Snowing, Lightning. Which of these words best describes a day where the sun is shining? Some words clearly don''t fit, like "Tornado" or "Snowing."',
  'Can you narrow down the choices in the word bank to ones that involve the sun or clouds?',
  'Even though there''s a cloud, the sun is very visible and bright. One word in your bank perfectly captures the idea of the sun being the main feature of the weather.',
  'Which word from the bank do you think best describes this weather?'
]),
('ABCDE', 2, 222.5, 301.666667938232, 182, 196, 'area', '2_2', ARRAY[
  'This picture shows a few things happening! We see dark clouds, drops of water falling, and a very bright zigzag line. What is that bright flash of light called when it happens during a storm?',
  'What''s the most electrifying part of this weather scene?',
  'Let''s scan the word bank: Rainy, Cloudy, Sunny, Tornado, Snowing, Lightning. While it might be rainy and cloudy too, one of those words specifically names that flash of light.',
  'Which word in the bank refers to a bright flash in a stormy sky?',
  'The picture definitely shows rain, but the most striking event shown, which has its own name in the word bank, is that powerful spark. That''s the specific weather event it''s highlighting.',
  'Which word from the bank names that flash?'
]),
('ABCDE', 2, 436.5, 300.666667938232, 152, 198, 'area', '2_3', ARRAY[
  'Wow, this picture shows a very powerful weather event! Look at its shape – it''s like a spinning cone reaching down from the clouds. What do we call this kind of rapidly rotating column of air?',
  'What does the shape and movement in this picture remind you of?',
  'Check your word bank: Rainy, Cloudy, Sunny, Tornado, Snowing, Lightning. Only one of these words describes this specific, intense, spinning weather phenomenon.',
  'Which word from the list sounds like a very strong and windy weather event?',
  'This isn''t just any wind; it''s a very distinct and often destructive weather pattern. The picture clearly shows its characteristic shape.',
  'Which word from your bank matches this swirling weather?'
]),
('ABCDE', 2, 8.5, 552.66667175293, 186, 236, 'area', '2_4', ARRAY[
  'This picture is quite clear! What''s the main thing you see, shining brightly all by itself with no clouds around? When the sky looks like this, what kind of day is it?',
  'How would you describe a day where this is the main thing you see in the sky?',
  'Look at the words in your bank again: Rainy, Cloudy, Sunny, Tornado, Snowing, Lightning. Which word best fits a day that is bright and clear because of this big star?',
  'Which words from the bank definitely don''t fit this bright, clear picture?',
  'When there are no clouds to block its light, and no rain or snow, we use a simple word to describe this weather. It''s all about the light and warmth.',
  'Which word from the list best describes this kind of day?'
]),
('ABCDE', 2, 221.5, 552.66667175293, 175, 234, 'area', '2_5', ARRAY[
  'In this image, you can see clouds, and you can see drops falling from them. What do we call it when water falls from the clouds like this?',
  'What are those drops falling from the sky made of?',
  'Let''s look at the word bank: Rainy, Cloudy, Sunny, Tornado, Snowing, Lightning. Which of these words describes water falling from the sky? You can probably rule out a few options pretty quickly.',
  'Think about what you wear or carry when the weather looks like this. What word describes it?',
  'The picture clearly shows precipitation. It''s not frozen, and it''s not a violent storm. It''s just water droplets.',
  'Which word from your bank means that water is falling like this?'
]),
('ABCDE', 2, 434.5, 544.66667175293, 153, 244, 'area', '2_6', ARRAY[
  'Look closely at what''s falling from the clouds here. They aren''t raindrops like in the last picture. These have a different, more complex shape. What do we call these frozen crystals that fall from the sky?',
  'What season does this kind of weather make you think of?',
  'Consider your word bank one last time: Rainy, Cloudy, Sunny, Tornado, Snowing, Lightning. Which of these words describes weather where frozen flakes fall from the clouds?',
  'How are these falling things different from what you saw in the picture just before this one?',
  'When it''s cold enough, water in the clouds freezes into these beautiful shapes and falls to the ground. There''s a specific word for this in your list.',
  'Which word from the bank describes this wintry weather?'
])
ON CONFLICT DO NOTHING;