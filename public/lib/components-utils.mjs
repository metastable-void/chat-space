
const parser = new DOMParser;

export const parseTemplates = (htmlSource) => {
    const parsedDocument = parser.parseFromString(htmlSource, 'text/html');
    const templates = [];
    for (const template of parsedDocument.querySelectorAll('template')) {
        templates.push(document.adoptNode(template));
    }
    return templates;
};
