exports.parse = (event) => {
    if (!event) {
        throw new Error("No input.");
    }
    var parsed;
    try {
        parsed = JSON.parse(event);
    } catch (err) {
        parsed = event;
    }

    console.log('codebuild event:');
    console.log(parsed);

    var url;
    var gitLogUrl;
    switch(parsed.detail['project-name']) {
        case 'beenest-backend-master-branch':
            url = 'https://api-staging.beetoken.com/';
            gitLogUrl = 'https://github.com/thebeetoken/beenest-backend/commits/master';
            break;
        case 'beenest-backend-production-branch':
            url = 'https://api.beetoken.com/';
            gitLogUrl = 'https://github.com/thebeetoken/beenest-backend/commits/production';
            break;
        default:
            break;
    }
    const text = `*${parsed.detail['project-name']} ${parsed.detail['build-status']}*` +
    `\n\nLOG: ${parsed.detail['additional-information']['logs']['deep-link']}` +
    `\n\nGIT COMMITS: ${gitLogUrl}` +
    `\n\nURL: ${url}`;
    return text;
}
