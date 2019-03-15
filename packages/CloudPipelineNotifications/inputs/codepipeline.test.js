const Codepipeline = require('./codepipeline');
const {promisify} = require('util');
const fs = require('fs');
const path = require('path');
const readFileAsync = promisify(fs.readFile); // (A)
const testFile = path.join(__dirname, "codepipeline.fixture.json");

describe('codepipeline', () => {
	test('parse example', () => {
        return readFileAsync(testFile, {encoding: 'utf8'})
          .then((text) => {
            const output = Codepipeline.parse(text);
            const expected = `my-sample-project SUCCEEDED\nLOG: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#logEvent:group=/aws/codebuild/my-sample-project;stream=8745a7a9-c340-456a-9166-edf953571bEX`;
            expect(output).not.toEqual(null);
          });
	});
});

