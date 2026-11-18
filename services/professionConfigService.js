const professionConfig = require('../public/profession-list.json');

const professions = new Set(professionConfig.professions);

function isConfiguredProfession(value) {
    return professions.has(value);
}

module.exports = { isConfiguredProfession };
