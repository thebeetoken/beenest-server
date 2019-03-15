const testUtils = require('../lib/testUtils');
const {
  convertRentivoListingJsonToDetailedListingObject,
  createListingFromRentivo,
  getRentivoListingPriceUsdAndAvailability,
  getRentivoMemberMapping,
  convertRentivoMemberMappingsJsonToUser,
} = require('../services/rentivoAPI');

describe('Rentivo API', () => {
  const convertedTestListing = {
    "amenities": ["Internet", "Hairdryer", "Kitchen", "Freezer", "Fridge", "Blender", "Garden", "On The Beach", "Security", "Maid", "Chef", "Air Condition", "King Size bed", "Single bed", "Bed Linen and Towels", "Dish washer", "Pots and Pans", "Air conditioning", "Parking available", "Sun beds / chairs"],
    "autoApprove": false,
    "checkInTime": {
      "from": "3:00 p.m.",
      "to": "10:00 p.m."
    },
    "checkOutTime": "11:00 a.m.",
    "city": "Ambalagonda",
    "country": "Sri Lanka",
    "description": "<p>A beachfront villa is the perfect ingredient to the perfect holiday since you have the golden sand and the cool water right at your doorstep. Lounge on the beach chairs as you gaze at the ocean or sunbathe, to feel utterly relaxed and at ease. The clear blue skies are conducive to a heady tranquility that you’ll soon get used to. Enjoy a relaxing morning with family and friends as you swim and frolic on the beach, building sandcastles and what not. With fishermen being your only point of contact, and that too only rarely, you have all the place to yourself! Dine beside the water for a truly enchanting experience.<br /><br />A beautifully and aesthetically designed living area is what greets you as you step inside through the wooden, antique doorway. The terrace is furnished with a dining area, and the indoors is furnished with comfortable couches and chairs for relaxation. There are antique cabinets and trinkets placed inside the room to give it a rustic ambiance which will instantly lift your spirits and make you feel at home. The high-vaulted ceiling is traditionally designed and has lighting hanging from it for an authentic vibe. Dine alfresco under the stars, or choose to dine indoors in the living area as you enjoy a freshly prepared meal in the fully-equipped kitchen. The kitchen is open-plan and is fitted with all modern appliances and amenities that you could possibly need for a nice, homely meal. It has been designed with polished cemented walls, and a separating mid-sized wall for a complete look.<br /><br />Beside daily housekeeping services, the kind and accommodating staff at the villa is happy to assist you in any way. Upon request, they can provide laundry service and even arrange for a car/driver to take you around. If you want them to plan any excursions or trips, they can do the needful!</p><br /><p>Located in the town of Ambalangoda, Ratu Villa is a two-bedroom oceanfront holiday home overlooking the Indian Ocean. The town is close to the popular tourist destination Hikkaduwa famous for its corals. Relax in the rustic setup of Ratu Villa which can be rented in conjunction with its sister Nil Villa. It has been designed with a focus on comfort and by using eco-friendly material. The beach is right where the villa begins, so all you need to do is to step outside to be greeted by the most marvelous view!</p> <br /> <h2>Booking Terms</h2><br /><p>A downpayment of 50% has to be made for each reservation. The remaining 50% is due to be paid one month prior to arrival.<p></p><br /><h2>Cancellation Terms</h2><br /><p>Cancel up to 7 days before check in and get a 50% refund (minus service fees). Cancel within 7 days of your trip and the reservation is non-refundable. Service fees are refunded when cancellation happens before check in and within 48 hours of booking.<p></p><br /><h2>Rate Includes</h2><br /><p>* Breakfast<br />* Service charge and tax<br />* check-in from 14:00 and check-out before 11:00<p></p><br /><h2>Rate Excludes</h2><br /><p>* Airport transfer (65USD) with AC minivan<br />* Lunch and Dinner<br />* Babysitter<p></p>",
    "homeType": "Entire Listing",
    "hostId": "rentivo_d48ac9ec-96f9-46a6-8fcc-4e69821c640c",
    "hostNameSlug": "eats-and-retreats",
    "houseRules": "<h2>Booking Terms</h2><br /><p>A downpayment of 50% has to be made for each reservation. The remaining 50% is due to be paid one month prior to arrival.<p></p><br /><h2>Cancellation Terms</h2><br /><p>Cancel up to 7 days before check in and get a 50% refund (minus service fees). Cancel within 7 days of your trip and the reservation is non-refundable. Service fees are refunded when cancellation happens before check in and within 48 hours of booking.<p></p><br /><h2>Rate Includes</h2><br /><p>* Breakfast<br />* Service charge and tax<br />* check-in from 14:00 and check-out before 11:00<p></p><br /><h2>Rate Excludes</h2><br /><p>* Airport transfer (65USD) with AC minivan<br />* Lunch and Dinner<br />* Babysitter<p></p>",
    "id": "rentivo_00087131-e86e-4f8c-b776-55792a933883",
    "idSlug": "eats-and-retreats",
    "isActive": true,
    "lat": 6.226649,
    "listingPicUrl": "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689281.jpg",
    "lng": 80.05399899999998,
    "maxGuests": 5,
    "maxNumberOfGuests": 5,
    "minNumberOfNights": 3,
    "minimumNights": 3,
    "numberOfBathrooms": 1,
    "numberOfBedrooms": 2,
    "photos": ["https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689282.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689283.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689285.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689286.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689288.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689289.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689290.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689292.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689293.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689294.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689295.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689296.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689297.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689298.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689299.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689300.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689301.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689302.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689303.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689305.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689306.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689308.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689309.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689310.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689311.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689312.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689313.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689314.jpg"],
    "pricePerNightUsd": 138,
    "sharedBathroom": "no",
    "sleepingArrangement": "",
    "state": undefined,
    "title": "Ratu Villa"
  };

  const builtCreateListingFromRentivo = {
    "addressLine1": null,
    "addressLine2": null,
    "airbnbLink": undefined,
    "amenities": ["Internet", "Hairdryer", "Kitchen", "Freezer", "Fridge", "Blender", "Garden", "On The Beach", "Security", "Maid", "Chef", "Air Condition", "King Size bed", "Single bed", "Bed Linen and Towels", "Dish washer", "Pots and Pans", "Air conditioning", "Parking available", "Sun beds / chairs"],
    "autoApprove": false,
    "canPublish": false,
    "checkInDate": undefined,
    "checkInTime": {
      "from": "3:00 p.m.",
      "to": "10:00 p.m."
    },
    "checkOutDate": undefined,
    "checkOutTime": "11:00 a.m.",
    "city": "Ambalagonda",
    "country": "SRI LANKA",
    "description": "<p>A beachfront villa is the perfect ingredient to the perfect holiday since you have the golden sand and the cool water right at your doorstep. Lounge on the beach chairs as you gaze at the ocean or sunbathe, to feel utterly relaxed and at ease. The clear blue skies are conducive to a heady tranquility that you’ll soon get used to. Enjoy a relaxing morning with family and friends as you swim and frolic on the beach, building sandcastles and what not. With fishermen being your only point of contact, and that too only rarely, you have all the place to yourself! Dine beside the water for a truly enchanting experience.<br /><br />A beautifully and aesthetically designed living area is what greets you as you step inside through the wooden, antique doorway. The terrace is furnished with a dining area, and the indoors is furnished with comfortable couches and chairs for relaxation. There are antique cabinets and trinkets placed inside the room to give it a rustic ambiance which will instantly lift your spirits and make you feel at home. The high-vaulted ceiling is traditionally designed and has lighting hanging from it for an authentic vibe. Dine alfresco under the stars, or choose to dine indoors in the living area as you enjoy a freshly prepared meal in the fully-equipped kitchen. The kitchen is open-plan and is fitted with all modern appliances and amenities that you could possibly need for a nice, homely meal. It has been designed with polished cemented walls, and a separating mid-sized wall for a complete look.<br /><br />Beside daily housekeeping services, the kind and accommodating staff at the villa is happy to assist you in any way. Upon request, they can provide laundry service and even arrange for a car/driver to take you around. If you want them to plan any excursions or trips, they can do the needful!</p><br /><p>Located in the town of Ambalangoda, Ratu Villa is a two-bedroom oceanfront holiday home overlooking the Indian Ocean. The town is close to the popular tourist destination Hikkaduwa famous for its corals. Relax in the rustic setup of Ratu Villa which can be rented in conjunction with its sister Nil Villa. It has been designed with a focus on comfort and by using eco-friendly material. The beach is right where the villa begins, so all you need to do is to step outside to be greeted by the most marvelous view!</p> <br /> <h2>Booking Terms</h2><br /><p>A downpayment of 50% has to be made for each reservation. The remaining 50% is due to be paid one month prior to arrival.<p></p><br /><h2>Cancellation Terms</h2><br /><p>Cancel up to 7 days before check in and get a 50% refund (minus service fees). Cancel within 7 days of your trip and the reservation is non-refundable. Service fees are refunded when cancellation happens before check in and within 48 hours of booking.<p></p><br /><h2>Rate Includes</h2><br /><p>* Breakfast<br />* Service charge and tax<br />* check-in from 14:00 and check-out before 11:00<p></p><br /><h2>Rate Excludes</h2><br /><p>* Airport transfer (65USD) with AC minivan<br />* Lunch and Dinner<br />* Babysitter<p></p>",
    "fullAddress": "Latitude & Longitude: 6.226649, 80.05399899999998, Ambalagonda, Sri Lanka",
    "homeType": "Entire Listing",
    "hostId": "rentivo_d48ac9ec-96f9-46a6-8fcc-4e69821c640c",
    "hostNameSlug": "eats-and-retreats",
    "houseRules": "<h2>Booking Terms</h2><br /><p>A downpayment of 50% has to be made for each reservation. The remaining 50% is due to be paid one month prior to arrival.<p></p><br /><h2>Cancellation Terms</h2><br /><p>Cancel up to 7 days before check in and get a 50% refund (minus service fees). Cancel within 7 days of your trip and the reservation is non-refundable. Service fees are refunded when cancellation happens before check in and within 48 hours of booking.<p></p><br /><h2>Rate Includes</h2><br /><p>* Breakfast<br />* Service charge and tax<br />* check-in from 14:00 and check-out before 11:00<p></p><br /><h2>Rate Excludes</h2><br /><p>* Airport transfer (65USD) with AC minivan<br />* Lunch and Dinner<br />* Babysitter<p></p>",
    "id": "rentivo_00087131-e86e-4f8c-b776-55792a933883",
    "idSlug": "rentivo_00087131-e86e-4f8c-b776-55792a933883_eats-and-retreats",
    "isActive": true,
    "lat": 6.226,
    "listingPicUrl": "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689281.jpg",
    "lng": 80.053,
    "maxGuests": 5,
    "maxNumberOfGuests": 5,
    "minNumberOfNights": 3,
    "minimumNights": 3,
    "numberOfBathrooms": 1,
    "numberOfBedrooms": 2,
    "photos": ["https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689282.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689283.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689285.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689286.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689288.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689289.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689290.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689292.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689293.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689294.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689295.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689296.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689297.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689298.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689299.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689300.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689301.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689302.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689303.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689305.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689306.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689308.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689309.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689310.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689311.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689312.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689313.jpg", "https://images.klik.villas/sri-lanka/villa6315/villa6315-pic1525689314.jpg"],
    "pricePerNightUsd": 138,
    "sharedBathroom": "no",
    "sleepingArrangement": "",
    "state": undefined,
    "title": "Ratu Villa",
    "totalQuantity": undefined,
    "updatedBy": undefined
  }

  const testMemberMappings = [{
    "biography": "Travel South East Asia in style with our portfolio of over 1,000 luxury villas throughout Thailand, Bali & Sri Lanka",
    "bookingSource": null,
    "brandCompanyName": "Eats and Retreats",
    "descriptiveName": "(C) BeeNest Settings",
    "emails": ["reservation@eatsandretreats.com"],
    "id": "d48ac9ec-96f9-46a6-8fcc-4e69821c640c",
    "logo": {
      "height": 120,
      "id": "199",
      "publicUrl": "https://s3-eu-west-1.amazonaws.com/lycan-general/uploads/logo/0001/01/785332dfd6241543f3c6c51470164d63fbf55012.png",
      "width": 689
    },
    "phone": null,
    "website": "https://www.eatsandretreats.com/"
  }, {
    "biography": "We Beetoken",
    "bookingSource": null,
    "brandCompanyName": "Beenest and Beetoken",
    "descriptiveName": "(C) BeeNest Settings",
    "emails": ["support@beetoken.com"],
    "id": "beenest-settings-id",
    "logo": {
      "height": 120,
      "id": "200",
      "publicUrl": "https://s3-eu-west-1.amazonaws.com/lycan-general/uploads/logo/0001/01/785332dfd6241543f3c6c51470164d63fbf55012.png",
      "width": 689
    },
    "phone": null,
    "website": "https://www.beenest.com/"
  }];

  const convertedTestUsers = [{
    "about": "Travel South East Asia in style with our portfolio of over 1,000 luxury villas throughout Thailand, Bali & Sri Lanka",
    "completedVerification": true,
    "email": "support@beenest.com",
    "firstName": "Eats and Retreats",
    "id": "rentivo_d48ac9ec-96f9-46a6-8fcc-4e69821c640c",
    "lastName": " ",
    "profilePicUrl": "https://s3-eu-west-1.amazonaws.com/lycan-general/uploads/logo/0001/01/785332dfd6241543f3c6c51470164d63fbf55012.png",
  }, {
    "about": "We Beetoken",
    "completedVerification": true,
    "email": "support@beenest.com",
    "firstName": "Beenest and Beetoken",
    "id": "rentivo_beenest-settings-id",
    "lastName": " ",
    "profilePicUrl": "https://s3-eu-west-1.amazonaws.com/lycan-general/uploads/logo/0001/01/785332dfd6241543f3c6c51470164d63fbf55012.png",
  }];

  test('able to merge memberMappings into an array of objects', async () => {
    const rentivoTestMemberMappings = testUtils.createTestRentivoMemberMappings();
    const memberMapping = getRentivoMemberMapping(rentivoTestMemberMappings);
    expect(memberMapping).toEqual(testMemberMappings);
  });

  test('able to convert memberMappings properties to match our User schema properties', async () => {
    const rentivoTestMemberMappings = testUtils.createTestRentivoMemberMappings();
    const memberMappings = getRentivoMemberMapping(rentivoTestMemberMappings);
    const convertedRentivoUsers = memberMappings.map(memberMapping => convertRentivoMemberMappingsJsonToUser(memberMapping));
    expect(convertedRentivoUsers).toEqual(convertedTestUsers);
  });

  test('able to convert Rentivo listing properties to match our Listing schema properties', async () => {
    const rentivoTestListing = testUtils.createTestRentivoListing();
    const rentivoTestChannel = testUtils.createTestRentivoChannel();
    const rentivoTestPricing = testUtils.createTestRentivoPricing();
    const convertedListing = convertRentivoListingJsonToDetailedListingObject(rentivoTestListing, rentivoTestChannel);
    const updatedPricingAndAvailability = getRentivoListingPriceUsdAndAvailability(rentivoTestPricing);
    const convertedListingWithPricing = {
      ...convertedListing,
      ...updatedPricingAndAvailability,
    }
    expect(convertedListingWithPricing).toEqual(convertedTestListing);
  });

  test('able to create listing from  Rentivo listing properties', async () => {
    const rentivoTestListing = testUtils.createTestRentivoListing();
    const rentivoTestChannel = testUtils.createTestRentivoChannel();
    const rentivoTestPricing = testUtils.createTestRentivoPricing();
    const convertedListing = convertRentivoListingJsonToDetailedListingObject(rentivoTestListing, rentivoTestChannel);
    const updatedPricingAndAvailability = getRentivoListingPriceUsdAndAvailability(rentivoTestPricing);
    const convertedListingWithPricing = {
      ...convertedListing,
      ...updatedPricingAndAvailability,
    }
    const builtListing = createListingFromRentivo(convertedListingWithPricing);
    const builtListingToJSON = builtListing.toJSON();
    // delete createdAt because value does not come back as a string and the createdAt time
    // will be different every time it's built
    delete builtListingToJSON.createdAt
    expect(builtListingToJSON).toEqual(builtCreateListingFromRentivo);
  });
});