const { google } = require('../../config/geocoder');
const GoogleMaps = require('@google/maps');

const { Op } = require('sequelize');
const googleMapsClient = GoogleMaps.createClient({ key: google.apiKey, Promise });

const LocationUtil = {
  areBoundsValid: (bounds) => !!bounds && ['east', 'north', 'south', 'west'].every(key => typeof bounds[key] === 'number'),
  areCoordinatesValid: (coordinates) => !!coordinates && ['lat', 'lng'].every(key => typeof coordinates[key] === 'number'),
  convertToKilometers: (measurement) => {
    switch (measurement) {
      case 'KM':
        return 1000;
      case 'MI':
        return 621.37;
      default:
        return 1000;
    }
  },
  getGeometryFromLocation: async (address) => {
    if (!address) {
      return undefined;
    }
    try {
      const response = await googleMapsClient.geocode({ address }).asPromise();
      const { results } = response.json;
      if (!results || results.length < 1) {
        return;
      }
      return {
        coordinates: results[0].geometry.location,
        bounds: {
          east: results[0].geometry.bounds.northeast.lng,
          north: results[0].geometry.bounds.northeast.lat,
          south: results[0].geometry.bounds.southwest.lat,
          west: results[0].geometry.bounds.southwest.lng
        }
      };
    } catch (error) {
      console.error('Error in Google API', error);
      return undefined;
    }
  },
  getQueryAndQueryCoordinates: async ({ bounds, coordinates, locationQuery }) => {
    const areCoordinatesValid = LocationUtil.areCoordinatesValid(coordinates);
    const areBoundsValid = LocationUtil.areBoundsValid(bounds);
    const fallbackGeometry = (areCoordinatesValid && areBoundsValid) ?
      undefined : await LocationUtil.getGeometryFromLocation(locationQuery);
    const queryCoordinates = areCoordinatesValid ?
      coordinates : (fallbackGeometry && fallbackGeometry.coordinates);
    const queryBounds = areBoundsValid ?
      bounds : (fallbackGeometry && fallbackGeometry.bounds);
    const boundsQuery = queryBounds && LocationUtil.handleBounds(queryBounds);
    const pointQuery = queryCoordinates ?
      LocationUtil.handleCoordinates(queryCoordinates) :
      LocationUtil.handleLocationQuery(locationQuery);
    const query = boundsQuery || pointQuery;

    return {
      query,
      queryCoordinates,
    };
  },
  handleCoordinates: (coordinates) => {
    const { lat, lng, measurement } = coordinates
    const radius = coordinates.radius || 80; // 80 KiloMeters is equivalent to 50 miles
    const distance = LocationUtil.convertToKilometers(measurement);
    const { cos, PI } = Math;
    const m = (distance / (PI * 6378.137 / 180));
    const latRadius = (m * radius / distance);
    const lngRadius = (m * radius / distance) / cos(lat * (PI / 180));

    return {
      lat: {
        [Op.gte]: lat - latRadius,
        [Op.lte]: lat + latRadius,
      },
      lng: {
        [Op.gte]: lng - lngRadius,
        [Op.lte]: lng + lngRadius,
      },
    };
  },
  handleBounds: bounds => ({
    lat: { [Op.gte]: bounds.south, [Op.lte]: bounds.north },
    lng: { [Op.gte]: bounds.west, [Op.lte]: bounds.east, }
  }),
  handleLocationQuery: (locationQuery) => {
    const locationLowerCase = (locationQuery || '').toLowerCase();
    return {
      city: {
        [Op.like]: locationLowerCase
      }
    };
  }
}

module.exports = LocationUtil;