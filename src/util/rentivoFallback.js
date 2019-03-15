module.exports = {
  createRentivoListingFallback: () => {
    return {
      autoApprove: false,
      amenities: [],
      checkInTime: {
        from: '3:00 p.m.',
        to: '10:00 p.m.',
      },
      checkOutTime: '11:00 a.m.',
      city: null,
      country: null,
      description: null,
      pricePerNightUsd: 0,
      homeType: null,
      id: 'Unknown',
      idSlug: null,
      houseRules: null,
      hostId: 'rentivo_d48ac9ec-96f9-46a6-8fcc-4e69821c640c',
      hostNameSlug: 'eats-and-retreats',
      lat: 0,
      lng: 0,
      maxGuests: 0,
      maxNumberOfGuests: 0,
      minNumberOfNights: 0,
      minimumNights: 0,
      numberOfBathrooms: 0,
      numberOfBedrooms: 0,
      sharedBathroom: 'no',
      sleepingArrangement: null,
      state: null,
      title: null,
      listingPicUrl: null,
      photos: [],
    }
  },
  createRentivoHostFallback: ()=> {
    return {
      about: "Travel South East Asia in style with our portfolio of over 1,000 luxury villas throughout Thailand, Bali & Sri Lanka",
      completedVerification: true,
      email: "support@beenest.com",
      firstName: "Eats and Retreats",
      id: "rentivo_d48ac9ec-96f9-46a6-8fcc-4e69821c640c",
      lastName: " ",
      profilePicUrl: "https://s3-eu-west-1.amazonaws.com/lycan-general/uploads/logo/0001/01/785332dfd6241543f3c6c51470164d63fbf55012.png",
    }
  }
}