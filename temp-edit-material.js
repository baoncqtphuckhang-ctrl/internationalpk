
const fs = require('fs');
const file = 'd:/0. WORKING/CODE WEB/01. INTERNATIONAL PK/internationalpk/components/MaterialCatalog.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const \\\[copyModal, setCopyModal\\\] = useState\\\({ isOpen: false, targetVersionId: null }\\\);/,
\const [copyModal, setCopyModal] = useState({ isOpen: false, targetVersionId: null });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');\);

content = content.replace(/if \\\(projects && projects.length > 0\\\) {\\s*const projName = configProjectName \\|\\| projects\\\[0\\\].name;/,
\if (projects && projects.length > 0) {
                const configuredProjects = projects.filter(p => templatesMap[p.name]);
                const projName = configProjectName || (configuredProjects[0]?.name) || '';\);

content = content.replace(/const handleGlobalSave = async \\\(updatedVersions, newActiveId\\\) => {/,
\const handleGlobalSave = async (updatedVersions, newActiveId, projOverride = null) => {
        const targetProject = projOverride || configProjectName;
        if (!targetProject) return;\);

content = content.replace(/configProjectName/g, (match, offset, fullText) => {
  if (offset >= content.indexOf('const handleGlobalSave') && offset < content.indexOf('updateOrdersAndDNTTOnPriceChange')) {
    if (fullText.substring(offset - 10, offset).includes('allTemplates[')) return 'targetProject';
    if (fullText.substring(offset - 15, offset).includes('eq(\\'project_name\\',')) return 'targetProject';
    if (fullText.substring(offset - 15, offset).includes('insert({ project_name:')) return 'targetProject';
    if (fullText.substring(offset - 25, offset).includes('[configProjectName]:')) return 'targetProject';
    if (fullText.substring(offset - 25, offset).includes('projectTemplates[configProjectName] =')) return 'targetProject';
  }
  return match;
});

// Since the regex replace for targetProject is a bit tricky, I'll just write a cleaner block replacement for handleGlobalSave.

