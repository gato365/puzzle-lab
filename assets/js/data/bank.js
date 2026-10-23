// Word bank for Puzzle Lab. Every word is in Wordle's valid-guess list.
// Group A = intended easier (common words, no repeated letters, specific hints).
// Group B = intended harder (repeated letters, vaguer hints).
// Each word carries four hints. The student app reveals one hint after each wrong guess, in this order.
// The first entry in each group is the default for round 1 (TRAIN / APPLE); later rounds draw unused words from here.
window.PL_BANK = {
  A: [
    { word: 'TRAIN', hints: ['A form of transportation.', 'It travels on tracks.', 'It has an engine, cars, and stops at stations.', 'Starts with T and rhymes with "rain".'] },
    { word: 'FRAME', hints: ['It goes around a picture.', 'Also the skeleton of a house or a bicycle.', 'A photo hangs on the wall inside one.', 'Starts with FR and ends with E.'] },
    { word: 'BEACH', hints: ['A place with sand and waves.', 'You might bring a towel and sunscreen.', 'It is where the land meets the sea.', 'Starts with B and ends with H.'] },
    { word: 'PLANT', hints: ['It grows in soil.', 'It needs water and sunlight.', 'A flower, a bush, or a tree is one.', 'Starts with PL and ends with T.'] },
    { word: 'HOUSE', hints: ['A place where people live.', 'It has rooms, doors, and a roof.', 'Rhymes with "mouse".', 'Starts with H and ends with E.'] },
    { word: 'MUSIC', hints: ['You listen to it.', 'It is made of notes, rhythm, and melody.', 'Bands and orchestras make it.', 'Starts with MU and ends with C.'] },
    { word: 'CHAIR', hints: ['A piece of furniture.', 'You sit on it.', 'It usually has four legs and a back.', 'Starts with CH and ends with R.'] },
    { word: 'WATER', hints: ['You drink it every day.', 'It fills oceans, rivers, and lakes.', 'It freezes into ice and boils into steam.', 'Starts with W and ends with R.'] },
    { word: 'LIGHT', hints: ['The opposite of dark.', 'A lamp or the sun gives it off.', 'It also means "not heavy".', 'Starts with L and ends with T.'] },
    { word: 'BREAD', hints: ['A food made from flour.', 'It is baked in an oven.', 'Sandwiches and toast are made from it.', 'Starts with BR and ends with D.'] },
    { word: 'CLOUD', hints: ['You see it in the sky.', 'It is white or gray and made of tiny water droplets.', 'Rain falls from it.', 'Starts with CL and ends with D.'] },
    { word: 'SMILE', hints: ['Something you do with your face.', 'It shows you are happy.', 'A photographer asks you to do this.', 'Starts with SM and ends with E.'] },
    { word: 'TIGER', hints: ['A large wild animal.', 'It is a big cat with stripes.', 'Orange and black, found in Asia.', 'Starts with T and ends with R.'] },
    { word: 'PIANO', hints: ['A musical instrument.', 'It has black and white keys.', 'You play it with both hands while sitting on a bench.', 'Starts with P and ends with O.'] },
    { word: 'HEART', hints: ['An organ in your body.', 'It pumps blood.', 'A symbol of love, often drawn in red.', 'Starts with H and ends with T.'] },
    { word: 'MONEY', hints: ['You use it to buy things.', 'It comes as coins and bills.', 'You keep it in a wallet or a bank.', 'Starts with M and ends with Y.'] }
  ],
  B: [
    { word: 'APPLE', hints: ['Something you might encounter in everyday life.', 'It comes in different varieties.', 'It can be red, green, or yellow.', 'A fruit that grows on trees. It has a repeated letter.'] },
    { word: 'PIZZA', hints: ['Many people enjoy this.', 'It is often shared.', 'It comes in slices.', 'A food with a double Z.'] },
    { word: 'LEVEL', hints: ['It can mean more than one thing.', 'It reads the same forwards and backwards.', 'A stage in a video game.', 'Starts and ends with L.'] },
    { word: 'QUEEN', hints: ['A person with a certain role.', 'You might find one in a deck of cards.', 'She wears a crown.', 'Starts with Q and has a double E.'] },
    { word: 'SHEEP', hints: ['Something found outdoors.', 'The word is the same for one or many.', 'A farm animal with wool.', 'Has a double E in the middle.'] },
    { word: 'BERRY', hints: ['Something small.', 'It grows on bushes.', 'Strawberries and blueberries are kinds of this.', 'Has a double R and ends with Y.'] },
    { word: 'HAPPY', hints: ['A feeling.', 'The opposite of sad.', 'A birthday song starts with this word.', 'Has a double P and ends with Y.'] },
    { word: 'DIZZY', hints: ['A way you might feel.', 'Spinning around causes it.', 'Your head feels like it is going in circles.', 'Has a double Z and ends with Y.'] },
    { word: 'MOTTO', hints: ['Something a group might have.', 'A short saying.', 'A phrase that sums up what you believe in.', 'Has a double T and ends with O.'] },
    { word: 'KAYAK', hints: ['Used outdoors.', 'You sit inside it.', 'A small boat with a double-bladed paddle.', 'Reads the same forwards and backwards. Starts with K.'] },
    { word: 'FLUFF', hints: ['Something soft.', 'You might find it on a sweater or a pet.', 'Light, fuzzy stuff.', 'Starts with FL and has a double F.'] },
    { word: 'GEESE', hints: ['More than one of something.', 'They fly in a V shape.', 'Birds that honk.', 'Has a double E, then an S.'] },
    { word: 'LLAMA', hints: ['An animal.', 'It lives in the mountains of South America.', 'It looks like a small camel without a hump.', 'Starts with a double L.'] },
    { word: 'VIVID', hints: ['Describes something you see.', 'Bright and strong, like a color.', 'A very clear memory could be this.', 'Has two Vs and two Is.'] },
    { word: 'SILLY', hints: ['A way to describe someone.', 'Not serious.', 'A clown acts this way.', 'Has a double L and ends with Y.'] },
    { word: 'JELLY', hints: ['A food.', 'It wobbles.', 'Spread it on toast with peanut butter.', 'Starts with J and has a double L.'] }
  ]
};
