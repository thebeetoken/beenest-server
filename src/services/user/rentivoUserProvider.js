const LRU = require('lru-cache');
const LRUCache = new LRU(1000);

const { buildUserFromMemberMapping } = require('../../services/rentivoAPI');

class RentivoUserProvider {
  getById(userId) {
    const cacheKey = `User-${userId}`;
    
    if (!LRUCache.has(cacheKey)) {
      LRUCache.set(cacheKey, buildUserFromMemberMapping(userId));
    }
    return LRUCache.get(cacheKey);
  }
}

module.exports = {
  RentivoUserProvider: new RentivoUserProvider()
};