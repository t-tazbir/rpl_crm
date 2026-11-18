const projectConfig = require('../public/project-list.json');

const projectByName = new Map(projectConfig.projects.map(project => [project.name, project]));

function getConfiguredProject(name) {
    return projectByName.get(name) || null;
}

module.exports = { getConfiguredProject };
